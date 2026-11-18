import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, symlink, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { cleanCache, pruneSubdirectories } from '../tools/lib/clean.mjs';

async function tempRoot(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'netatlas-clean-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('cleanCache removes stale build backups, native temp runs and scratch files while keeping pinned binaries and latest report', async t => {
  const root = await tempRoot(t);
  await mkdir(resolve(root, '.cache/bin'), { recursive: true });
  await writeFile(resolve(root, '.cache/bin/mihomo'), 'pinned-binary');
  await mkdir(resolve(root, '.cache/native-tools/darwin-arm64'), { recursive: true });
  await writeFile(resolve(root, '.cache/native-tools/darwin-arm64/mihomo.gz'), 'pinned-archive');

  for (let i = 0; i < 4; i++) {
    const dir = resolve(root, `.cache/build/batch-${i}/previous`);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, 'artifact.txt'), `batch-${i}`);
    const stamp = new Date(1_700_000_000_000 + i * 10_000);
    await utimes(resolve(root, `.cache/build/batch-${i}`), stamp, stamp);
  }

  await mkdir(resolve(root, '.cache/native-check/catalog-old'), { recursive: true });
  await writeFile(resolve(root, '.cache/native-check/catalog-old/check.log'), 'old');
  await mkdir(resolve(root, '.cache/native-check/catalog-active'), { recursive: true });
  await writeFile(resolve(root, '.cache/native-check/catalog-active/mihomo-managed-checked.yaml'), 'active');
  await writeFile(resolve(root, '.cache/native-check/latest.json'), JSON.stringify({
    profiles: [{ checkedSnapshot: '.cache/native-check/catalog-active/mihomo-managed-checked.yaml' }],
  }));

  await mkdir(resolve(root, '.cache/managed-workflow/run-stale'), { recursive: true });
  await writeFile(resolve(root, '.cache/scratch-debug.log'), 'scratch');
  await mkdir(resolve(root, 'private/workflow-Ab12Cd'), { recursive: true });
  await writeFile(resolve(root, 'private/singBox.json'), '{"version":1}');

  const summary = await cleanCache(root, { keepBuildBackups: 1 });
  assert.ok(summary.removed >= 7);
  assert.deepEqual(await readdir(resolve(root, 'private')), ['singBox.json']);
  assert.deepEqual(await readdir(resolve(root, '.cache/bin')), ['mihomo']);
  assert.deepEqual(await readdir(resolve(root, '.cache/build')), ['batch-3']);
  assert.deepEqual((await readdir(resolve(root, '.cache/native-check'))).sort(), ['catalog-active', 'latest.json']);
  assert.deepEqual((await readdir(resolve(root, '.cache'))).sort(), ['bin', 'build', 'native-check', 'native-tools']);
});

test('cleanCache --all clears cached binaries too while still refusing symlinked cache roots', async t => {
  const root = await tempRoot(t);
  await mkdir(resolve(root, '.cache/bin'), { recursive: true });
  await writeFile(resolve(root, '.cache/bin/sing-box'), 'binary');
  await writeFile(resolve(root, '.cache/sync.lock'), 'held');
  await cleanCache(root, { all: true });
  assert.deepEqual(await readdir(resolve(root, '.cache')), ['sync.lock']);

  const linkedRoot = await tempRoot(t);
  const outside = await tempRoot(t);
  await writeFile(resolve(outside, 'keep.txt'), 'safe');
  await symlink(outside, resolve(linkedRoot, '.cache'), 'dir');
  await assert.rejects(() => cleanCache(linkedRoot, { all: true }), /symlink/i);
  assert.deepEqual(await readdir(outside), ['keep.txt']);
});

test('pruneSubdirectories retains only the newest directories and keeps explicitly protected names', async t => {
  const root = await tempRoot(t);
  const parent = resolve(root, '.cache/build');
  await mkdir(parent, { recursive: true });
  for (let i = 0; i < 5; i++) {
    const entry = resolve(parent, `item-${i}`);
    await mkdir(entry);
    const stamp = new Date(1_700_000_000_000 + i * 5_000);
    await utimes(entry, stamp, stamp);
  }
  await pruneSubdirectories(root, '.cache/build', { keep: 2, preserve: new Set(['item-0']) });
  assert.deepEqual((await readdir(parent)).sort(), ['item-0', 'item-3', 'item-4']);
});

test('publishBuild automatically caps retained .cache/build backups across repeated updates', async t => {
  const { publishBuild } = await import('../tools/lib/build.mjs');
  const { createHash } = await import('node:crypto');
  const sha = value => createHash('sha256').update(value).digest('hex');
  const json = value => JSON.stringify(value, null, 2) + '\n';
  const root = await tempRoot(t);
  for (const file of ['package.json', 'package-lock.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    await writeFile(resolve(root, file), `${file}\n`);
  }
  for (const dir of ['src', 'metadata', 'tools']) await mkdir(resolve(root, dir), { recursive: true });
  const makeFakeBuild = async version => {
    await writeFile(resolve(root, 'LICENSE'), `MIT-${version}\n`);
    const inputs = [];
    for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'package-lock.json', 'package.json']) {
      const content = await import('node:fs/promises').then(fs => fs.readFile(resolve(root, file)));
      inputs.push({ path: file, sha256: sha(content) });
    }
    const inputSha256 = sha(json(inputs));
    const readme = `# Surge ${version}\n`;
    const manifest = json({ version: 1, client: 'surge', artifacts: [{ path: 'README.md', sha256: sha(readme), bytes: Buffer.byteLength(readme) }] });
    const catalogBody = { version: 1, builder: 'netatlas@0.1.0', input: { sha256: inputSha256, files: inputs }, clients: [{ id: 'surge', name: 'Surge', manifest: 'surge/manifest.json', sha256: sha(manifest) }] };
    const catalog = json({ ...catalogBody, contentSha256: sha(json(catalogBody)) });
    return {
      files: new Map([['surge/README.md', readme], ['surge/manifest.json', manifest], ['catalog.json', catalog]]),
      sourceRoot: root,
      inputSha256,
    };
  };
  for (let round = 1; round <= 5; round++) {
    const result = await publishBuild(root, await makeFakeBuild(round), { maxBackups: 2 });
    assert.equal(result.changed, true);
    if (round === 1) assert.equal(result.backup, null);
    else assert.ok(result.backup);
  }
  const retained = await readdir(resolve(root, '.cache/build'));
  assert.equal(retained.length, 2, 'only the 2 most recent build backups should remain');
});

