import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, lstat, rename, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publishCatalog, recoverPublication, syncCatalog } from '../../tools/lib/sync.mjs';
import { loadCatalog } from '../../tools/lib/build.mjs';

const moduleUrl = new URL('../../tools/lib/sync.mjs', import.meta.url).href;
const license = 'MIT License\nCopyright fixture\n';
const sha256 = text => createHash('sha256').update(text).digest('hex');
const lockPath = root => path.join(root, '.cache/sync.lock');
const busy = /sync.*lock|sync.*progress|sync.*busy/i;

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'netatlas-sync-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'metadata'));
  await writeFile(path.join(root, 'metadata/upstreams.json'), JSON.stringify({
    version: 1,
    repositories: [{ id: 'dlc', repository: 'fixture/rules', author: 'Fixture', revision: 'a'.repeat(40), revisionDate: '2026-10-01T00:00:00Z', license: 'MIT', licensePath: 'LICENSE', licenseSha256: sha256(license) }],
    rulesets: [{ id: 'alpha', category: 'network', source: { repository: 'dlc', list: 'alpha' }, exclusions: [] }],
  }, null, 2) + '\n');
  return root;
}

function fetchText(url) {
  if (url.endsWith('/LICENSE')) return Promise.resolve(license);
  if (url.endsWith('/data/alpha')) return Promise.resolve('alpha.example\n');
  throw new Error('Unexpected fixture URL');
}

function startHolder(t, root, dryRun = false) {
  const source = `
    import { syncCatalog } from ${JSON.stringify(moduleUrl)};
    try {
      const result = await syncCatalog({ root: ${JSON.stringify(root)}, dryRun: ${dryRun}, fetchText: async url => {
        if (url.endsWith('/LICENSE')) return ${JSON.stringify(license)};
        if (url.endsWith('/data/alpha')) {
          const released = new Promise(resolve => process.once('message', resolve));
          process.send({ event: 'paused' });
          await released;
          return 'holder.example\\n';
        }
        throw new Error('Unexpected fixture URL');
      } });
      process.send({ event: 'result', ok: true, result });
    } catch (error) { process.send({ event: 'result', ok: false, message: error.message }); }
    process.disconnect();
  `;
  return startChild(t, source);
}

function startChild(t, source) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let result, stderr = '', reachedPause = false;
  child.stderr.on('data', data => { stderr += data; });
  const paused = new Promise((resolve, reject) => {
    child.on('message', message => { if (message.event === 'paused') { reachedPause = true; resolve(); } });
    child.once('error', reject);
    child.once('exit', () => { if (!reachedPause) reject(new Error(result?.message ?? stderr ?? 'Holder exited before download')); });
  });
  const finished = new Promise((resolve, reject) => {
    child.on('message', message => { if (message.event === 'result') result = message; });
    child.once('error', reject);
    child.once('exit', code => result ? resolve(result) : reject(new Error('Holder exited ' + code + ': ' + stderr)));
  });
  finished.catch(() => {});
  t.after(() => { if (child.exitCode === null) child.kill(); });
  return { paused, release: async () => { if (child.connected) child.send('release'); return finished; } };
}

async function assertConsistent(root, expected) {
  const metadata = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const bytes = await readFile(path.join(root, 'src/rules/network/alpha.json'));
  assert.equal(JSON.parse(bytes).entries[0].value, expected);
  assert.equal(metadata.rulesets[0].outputSha256, sha256(bytes));
  const catalog = await loadCatalog(root);
  assert.equal(catalog.rulesets[0].entries[0].value, expected);
}

for (const dryRun of [false, true]) {
  test(`${dryRun ? 'dry-run' : 'publishing'} sync excludes every public sync entry point across processes`, { timeout: 10_000 }, async t => {
    const root = await fixture(t);
    await syncCatalog({ root, fetchText });
    const before = await readFile(path.join(root, 'metadata/upstreams.json'));
    const holder = startHolder(t, root, dryRun);
    let completed;
    try {
      await holder.paused;
      let downloads = 0;
      await assert.rejects(syncCatalog({ root, fetchText: async url => { downloads++; return fetchText(url); } }), busy);
      await assert.rejects(syncCatalog({ root, dryRun: true, fetchText }), busy);
      await assert.rejects(publishCatalog(root, new Map(), '{}\n'), busy);
      await assert.rejects(recoverPublication(root), busy);
      assert.equal(downloads, 0, 'contender must fail before downloading');
      assert.deepEqual(await readFile(path.join(root, 'metadata/upstreams.json')), before);
      await assertConsistent(root, 'alpha.example');
    } finally { completed = await holder.release(); }
    assert.equal(completed.ok, true, completed.message);
    await assertConsistent(root, dryRun ? 'alpha.example' : 'holder.example');
    await assert.rejects(lstat(lockPath(root)), { code: 'ENOENT' });
    await syncCatalog({ root, fetchText });
    await assertConsistent(root, 'alpha.example');
    await assert.rejects(lstat(lockPath(root)), { code: 'ENOENT' });
  });
}

test('an existing stale or manual sync lock is never reclaimed by any entry point', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, '.cache'));
  const marker = JSON.stringify({ pid: 2147483647, token: 'manual-or-stale' }) + '\n';
  await writeFile(lockPath(root), marker);
  for (const action of [
    () => syncCatalog({ root, fetchText }), () => syncCatalog({ root, dryRun: true, fetchText }),
    () => publishCatalog(root, new Map(), '{}\n'), () => recoverPublication(root),
  ]) {
    await assert.rejects(action, busy);
    assert.equal(await readFile(lockPath(root), 'utf8'), marker);
  }
});

test('each public entry point releases its own lock after a rejected operation', async t => {
  const root = await fixture(t);
  await assert.rejects(syncCatalog({ root, fetchText: async () => { throw new Error('fixture offline'); } }), /fixture offline/);
  await assert.rejects(lstat(lockPath(root)), { code: 'ENOENT' });
  await assert.rejects(publishCatalog(root, new Map([['../escape', 'x']]), '{}\n'), /Invalid managed rule path/);
  await assert.rejects(lstat(lockPath(root)), { code: 'ENOENT' });
  const batch = path.join(root, '.cache/sync/batch-pending');
  await mkdir(batch, { recursive: true });
  await writeFile(path.join(batch, 'publication.json'), JSON.stringify({ state: 'pending', oldMetadataSha256: '0'.repeat(64), newMetadataSha256: '1'.repeat(64) }));
  await assert.rejects(recoverPublication(root), /conflicts/);
  await assert.rejects(lstat(lockPath(root)), { code: 'ENOENT' });
  await rm(batch, { recursive: true });
  await syncCatalog({ root, fetchText });
  await assertConsistent(root, 'alpha.example');
});

for (const replacement of ['new inode', 'changed contents', 'copied token']) {
  test(`lock release preserves a manual replacement with ${replacement}`, async t => {
    const root = await fixture(t);
    await syncCatalog({ root, fetchText });
    let manual;
    await assert.rejects(syncCatalog({ root, fetchText: async url => {
      if (url.endsWith('/data/alpha')) {
        const original = await readFile(lockPath(root), 'utf8');
        manual = replacement === 'copied token' ? original : replacement === 'changed contents' ? original.replace(/("token":")[^"]/, '$1!') : 'manual lock contents';
        if (replacement !== 'changed contents') await rename(lockPath(root), path.join(root, 'original-lock'));
        await writeFile(lockPath(root), manual);
        return 'changed.example\n';
      }
      return fetchText(url);
    } }), /sync lock.*(?:ownership|changed)/i);
    assert.equal(await readFile(lockPath(root), 'utf8'), manual);
    if (replacement !== 'changed contents') assert.ok((await readFile(path.join(root, 'original-lock'), 'utf8')).length > 0);
    await assertConsistent(root, 'alpha.example');
  });
}

test('cache and lock symlinks are refused without altering their targets', async t => {
  for (const component of ['.cache', '.cache/sync.lock']) {
    const root = await fixture(t);
    const outside = await fixture(t);
    const sentinel = path.join(outside, 'sentinel');
    await writeFile(sentinel, 'keep');
    if (component.endsWith('sync.lock')) await mkdir(path.join(root, '.cache'));
    await symlink(component === '.cache' ? outside : sentinel, path.join(root, component));
    for (const action of [() => syncCatalog({ root, fetchText }), () => publishCatalog(root, new Map(), '{}\n'), () => recoverPublication(root)]) await assert.rejects(action, /symlink/i);
    assert.equal(await readFile(sentinel, 'utf8'), 'keep');
    assert.equal((await lstat(path.join(root, component))).isSymbolicLink(), true);
  }
});

function startCommitHolder(t, root, recovery) {
  const source = `
    import fs from 'node:fs';
    import { createHash } from 'node:crypto';
    import { syncBuiltinESMExports } from 'node:module';
    const root = ${JSON.stringify(root)}, rules = root + '/src/rules';
    const rename = fs.promises.rename;
    let paused = false;
    fs.promises.rename = async (from, to) => {
      if (!paused && to === rules) {
        paused = true;
        const released = new Promise(resolve => process.once('message', resolve));
        process.send({ event: 'paused' });
        await released;
      }
      return rename(from, to);
    };
    syncBuiltinESMExports();
    const { publishCatalog, recoverPublication } = await import(${JSON.stringify(moduleUrl)});
    try {
      if (${recovery}) await recoverPublication(root);
      else {
        const metadata = JSON.parse(await fs.promises.readFile(root + '/metadata/upstreams.json', 'utf8'));
        const content = JSON.stringify({ version: 1, id: 'alpha', category: 'network', entries: [{ type: 'domain-suffix', value: 'holder.example' }] }, null, 2) + '\\n';
        metadata.rulesets[0].outputSha256 = createHash('sha256').update(content).digest('hex');
        await publishCatalog(root, new Map([['network/alpha.json', content]]), JSON.stringify(metadata, null, 2) + '\\n');
      }
      process.send({ event: 'result', ok: true });
    } catch (error) { process.send({ event: 'result', ok: false, message: error.message }); }
    process.disconnect();
  `;
  return startChild(t, source);
}

for (const recovery of [false, true]) {
  test(`direct ${recovery ? 'recovery' : 'publication'} holds the repository lock throughout the directory commit`, { timeout: 10_000 }, async t => {
    const root = await fixture(t);
    await syncCatalog({ root, fetchText });
    if (recovery) {
      const metadata = await readFile(path.join(root, 'metadata/upstreams.json'));
      const batch = path.join(root, '.cache/sync/batch-interrupted');
      await mkdir(batch);
      await rename(path.join(root, 'src/rules'), path.join(batch, 'previous-rules'));
      await mkdir(path.join(root, 'src/rules'));
      await writeFile(path.join(root, 'src/rules/candidate'), 'unfinished candidate');
      await writeFile(path.join(batch, 'publication.json'), JSON.stringify({ state: 'pending', hadPreviousRules: true, oldMetadataSha256: sha256(metadata), newMetadataSha256: 'f'.repeat(64) }));
    }
    const holder = startCommitHolder(t, root, recovery);
    let completed;
    try {
      await holder.paused;
      await assert.rejects(syncCatalog({ root, fetchText }), busy);
      await assert.rejects(publishCatalog(root, new Map(), '{}\n'), busy);
      await assert.rejects(recoverPublication(root), busy);
    } finally { completed = await holder.release(); }
    assert.equal(completed.ok, true, completed.message);
    await assertConsistent(root, recovery ? 'alpha.example' : 'holder.example');
    await assert.rejects(lstat(lockPath(root)), { code: 'ENOENT' });
  });
}

test('replacing the cache parent with a symlink cannot redirect lock cleanup', async t => {
  const root = await fixture(t);
  await syncCatalog({ root, fetchText });
  const saved = path.join(root, 'saved-cache');
  await assert.rejects(syncCatalog({ root, fetchText: async url => {
    if (url.endsWith('/data/alpha')) {
      await rename(path.join(root, '.cache'), saved);
      await symlink(saved, path.join(root, '.cache'));
      return 'changed.example\n';
    }
    return fetchText(url);
  } }), /symlink/i);
  assert.equal((await lstat(path.join(root, '.cache'))).isSymbolicLink(), true);
  assert.ok((await readFile(path.join(saved, 'sync.lock'), 'utf8')).includes('token'));
  await assertConsistent(root, 'alpha.example');
});
