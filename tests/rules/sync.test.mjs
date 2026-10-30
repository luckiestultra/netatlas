import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, chmod, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDomainList, parseDomainList, publishCatalog, recoverPublication, syncCatalog } from '../../tools/lib/sync.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const revision = 'a'.repeat(40);
const license = 'MIT License\nCopyright test fixture\n';

test('conditional includes filter attributes without changing match types', async () => {
  const files = {
    main: 'include:child @cn @-ads\nfull:Exact.Example.ORG\n',
    child: 'example.cn @cn\nad.example.cn @cn @ads\nother.example.org\n'
  };
  const result = await collectDomainList('main', { readFile: async name => files[name] });
  assert.deepEqual(result.entries, [
    { type: 'domain-suffix', value: 'example.cn' },
    { type: 'domain', value: 'exact.example.org' }
  ]);
  assert.equal(result.excluded.length, 0);
});

test('an unsupported upstream expression fails unless exactly reviewed', async () => {
  const text = 'example.org\nregexp:^api[0-9]+\\.example\\.org$\n';
  await assert.rejects(collectDomainList('main', { readFile: async () => text }), /main:2.*regexp/);
  const result = await collectDomainList('main', {
    readFile: async () => text,
    exclusions: [{ file: 'main', rule: 'regexp:^api[0-9]+\\.example\\.org$', reason: 'No equivalent portable matcher.' }]
  });
  assert.deepEqual(result.entries, [{ type: 'domain-suffix', value: 'example.org' }]);
  assert.equal(result.excluded[0].line, 2);
  assert.equal(result.excluded[0].rule, 'regexp:^api[0-9]+\\.example\\.org$');
});

test('a newly introduced unsupported expression cannot use a broad exclusion', async () => {
  await assert.rejects(collectDomainList('main', {
    readFile: async () => 'regexp:^new\\.example$\n',
    exclusions: [{ file: 'main', rule: 'regexp:^old\\.example$', reason: 'Previously reviewed.' }]
  }), /Unsupported/);
});

test('include cycles and traversal are rejected with a source location', async () => {
  await assert.rejects(collectDomainList('main', { readFile: async () => 'include:main' }), /cycle/);
  assert.throws(() => parseDomainList('include:../private', 'main'), /Invalid include/);
  assert.throws(() => parseDomainList('full:example.org trailing-data', 'main'), /Unexpected/);
});

test('include depth and file bytes are bounded', async () => {
  await assert.rejects(collectDomainList('a', {
    readFile: async name => name === 'a' ? 'include:b' : 'example.org', maxDepth: 0
  }), /depth/);
  await assert.rejects(collectDomainList('a', {
    readFile: async () => 'example.org\n'.repeat(100), maxFileBytes: 20
  }), /size/);
  await assert.rejects(collectDomainList('a', {
    readFile: async name => name === 'a' ? 'include:b\ninclude:b' : 'example.org', maxVisits: 2
  }), /expansion count/);
});

async function sandbox() {
  await mkdir(path.join(root, '.cache', 'sync-tests'), { recursive: true });
  const dir = await mkdtemp(path.join(root, '.cache', 'sync-tests', 'case-'));
  await mkdir(path.join(dir, 'metadata'), { recursive: true });
  const metadata = {
    version: 1,
    repositories: [{ id: 'dlc', repository: 'v2fly/domain-list-community', author: 'Fixture contributors', revision, revisionDate: '2026-10-01T00:00:00Z', license: 'MIT', licensePath: 'LICENSE', licenseSha256: sha256(license) }],
    rulesets: [
      { id: 'alpha', category: 'development', source: { repository: 'dlc', list: 'alpha' }, exclusions: [] },
      { id: 'beta', category: 'media', source: { repository: 'dlc', list: 'beta' }, exclusions: [] }
    ]
  };
  await writeFile(path.join(dir, 'metadata', 'upstreams.json'), JSON.stringify(metadata, null, 2) + '\n');
  const fetchText = async url => {
    if (url.endsWith('/LICENSE')) return license;
    if (url.endsWith('/data/alpha')) return 'alpha.example\n';
    if (url.endsWith('/data/beta')) return 'full:beta.example\n';
    throw new Error('Unexpected fixture URL: ' + url);
  };
  return { dir, metadata, fetchText };
}

test('dry run performs validation but does not publish files or update registry', async () => {
  const { dir, fetchText } = await sandbox();
  const before = await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8');
  const result = await syncCatalog({ root: dir, dryRun: true, fetchText });
  assert.equal(result.rulesets.length, 2);
  assert.equal(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'), before);
  await assert.rejects(readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json')), /ENOENT/);
});

test('pinned sync produces repeatable bytes and hashes the exact written files', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const file = path.join(dir, 'src', 'rules', 'development', 'alpha.json');
  const first = await readFile(file, 'utf8');
  const firstMetadata = await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8');
  await syncCatalog({ root: dir, fetchText });
  assert.equal(await readFile(file, 'utf8'), first);
  assert.equal(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'), firstMetadata);
  const registry = JSON.parse(firstMetadata);
  assert.equal(registry.rulesets[0].outputSha256, sha256(first));
  assert.equal(registry.rulesets[0].files[0].sha256, sha256('alpha.example\n'));
});

test('network failure leaves the entire previous catalog and registry intact', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const before = await readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json'), 'utf8');
  const metadata = await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8');
  await assert.rejects(syncCatalog({ root: dir, fetchText: async url => {
    if (url.endsWith('/data/beta')) throw new Error('Network unavailable');
    if (url.endsWith('/data/alpha')) return 'changed.example\n';
    return fetchText(url);
  } }), /Network unavailable/);
  assert.equal(await readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json'), 'utf8'), before);
  assert.equal(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'), metadata);
});

test('source update dates come from the pinned commit instead of the local clock', async () => {
  const { dir, fetchText } = await sandbox();
  const updatedRevision = 'b'.repeat(40);
  await syncCatalog({ root: dir, latest: true, fetchText: async url => {
    if (url.includes('/git/ref/heads/')) return JSON.stringify({ object: { sha: updatedRevision } });
    if (url.endsWith('/commits/' + updatedRevision)) return JSON.stringify({ sha: updatedRevision, commit: { committer: { date: '2026-10-30T13:25:16Z' } } });
    return fetchText(url);
  } });
  const metadata = JSON.parse(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'));
  assert.equal(metadata.repositories[0].revisionDate, '2026-10-30T13:25:16Z');
  assert.equal(metadata.rulesets[0].updatedAt, '2026-10-30T13:25:16Z');
  assert.equal(metadata.rulesets[0].source.repository, 'dlc');
});

test('source license changes or local manual edits prevent an overwrite', async () => {
  const { dir, fetchText } = await sandbox();
  await assert.rejects(syncCatalog({ root: dir, fetchText: async url => url.endsWith('/LICENSE') ? 'Different license' : fetchText(url) }), /license checksum/i);
  await syncCatalog({ root: dir, fetchText });
  const file = path.join(dir, 'src', 'rules', 'development', 'alpha.json');
  await writeFile(file, 'personal local edit');
  await assert.rejects(syncCatalog({ root: dir, fetchText }), /Local changes/);
  assert.equal(await readFile(file, 'utf8'), 'personal local edit');
});

test('a manual edit made while a download is pending is not overwritten', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const file = path.join(dir, 'src', 'rules', 'development', 'alpha.json');
  await assert.rejects(syncCatalog({ root: dir, fetchText: async url => {
    if (url.endsWith('/data/alpha')) return 'new-source.example\n';
    if (url.endsWith('/data/beta')) await writeFile(file, 'local edit during download');
    return fetchText(url);
  } }), /changed during sync/);
  assert.equal(await readFile(file, 'utf8'), 'local edit during download');
});

test('metadata publication failure rolls back the catalog directory', async () => {
  const { dir } = await sandbox();
  const rules = path.join(dir, 'src', 'rules');
  await mkdir(rules, { recursive: true });
  await writeFile(path.join(rules, 'marker.json'), 'previous');
  const metadataDir = path.join(dir, 'metadata');
  await chmod(metadataDir, 0o555);
  try {
    await assert.rejects(publishCatalog(dir, new Map([['development/alpha.json', '{}\n']]), '{}\n'));
  } finally {
    await chmod(metadataDir, 0o755);
  }
  assert.equal(await readFile(path.join(rules, 'marker.json'), 'utf8'), 'previous');
  await assert.rejects(readFile(path.join(rules, 'development', 'alpha.json')), /ENOENT/);
});

test('an interrupted directory swap is recovered without deleting either version', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const metadata = await readFile(path.join(dir, 'metadata', 'upstreams.json'));
  const batch = path.join(dir, '.cache', 'sync', 'batch-interrupted');
  await mkdir(batch, { recursive: true });
  await rename(path.join(dir, 'src', 'rules'), path.join(batch, 'previous-rules'));
  await mkdir(path.join(dir, 'src', 'rules'), { recursive: true });
  await writeFile(path.join(dir, 'src', 'rules', 'new-version.json'), 'interrupted candidate');
  await writeFile(path.join(batch, 'publication.json'), JSON.stringify({ state:'pending', hadPreviousRules:true, oldMetadataSha256:sha256(metadata), newMetadataSha256:'f'.repeat(64) }));
  await assert.rejects(recoverPublication(dir, { dryRun:true }), /Interrupted/);
  await recoverPublication(dir);
  assert.match(await readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json'), 'utf8'), /alpha.example/);
  assert.equal(await readFile(path.join(batch, 'interrupted-rules', 'new-version.json'), 'utf8'), 'interrupted candidate');
});
