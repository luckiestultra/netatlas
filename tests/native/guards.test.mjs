import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rename, symlink, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { gzipSync } from 'node:zlib';

// These are filesystem tests. Even a broken guard must never run a fixture or kernel.
let executions = 0;
const originalExecFile = childProcess.execFile;
const originalSpawn = childProcess.spawn;
const refuseExecution = () => { executions++; throw new Error('Native execution is forbidden in managed-path unit tests'); };
childProcess.execFile = refuseExecution;
childProcess.spawn = refuseExecution;
syncBuiltinESMExports();
const native = await import('../../tools/lib/native.mjs');
after(() => {
  childProcess.execFile = originalExecFile;
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
});

const platform = 'linux-x64';
const tools = [{ id: 'mihomo', binary: 'mihomo', repo: 'MetaCubeX/mihomo' }, { id: 'singBox', binary: 'sing-box', repo: 'SagerNet/sing-box' }];
const executable = Buffer.from('Guard fixture bytes: never execute this file.\n');
const compressed = gzipSync(executable);
const digest = createHash('sha256').update(compressed).digest('hex');

async function snapshot(directory) {
  const result = [];
  async function visit(current, relative = '') {
    for (const name of (await readdir(current)).sort()) {
      const file = path.join(current, name), label = path.join(relative, name), stat = await lstat(file);
      if (stat.isDirectory()) { result.push([label, 'directory', stat.mode]); await visit(file, label); }
      else if (stat.isSymbolicLink()) result.push([label, 'symlink', await readlink(file)]);
      else result.push([label, 'file', stat.mode, (await readFile(file)).toString('base64')]);
    }
  }
  await visit(directory);
  return result;
}

async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), 'netatlas-native-guard-'));
  const root = path.join(base, 'repo'), outside = path.join(base, 'outside');
  for (const relative of ['metadata', '.cache/bin', '.cache/native-tools/' + platform]) await mkdir(path.join(root, relative), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(outside, 'sentinel.txt'), 'External user data must retain its exact bytes.\n');
  const registry = { version: 1, tools: tools.map(tool => ({ id: tool.id, version: '1.0.0', repo: tool.repo, assets: { [platform]: { file: `${tool.id}-fixture.gz`, sha256: digest, kind: 'gzip' } } })) };
  await writeFile(path.join(root, 'metadata/native-tools.json'), JSON.stringify(registry));
  // Cached archive bytes provide valid targets for archive-file symlink cases.
  for (const tool of tools) {
    await writeFile(path.join(root, '.cache/native-tools', platform, `${tool.id}-fixture.gz`), compressed);
    await writeFile(path.join(root, '.cache/bin', tool.binary), executable, { mode: 0o600 });
  }
  return { root, outside };
}

const installLinks = [
  'metadata', 'metadata/native-tools.json', '.cache', '.cache/bin', '.cache/native-tools', `.cache/native-tools/${platform}`,
  ...tools.flatMap(tool => [`.cache/native-tools/${platform}/${tool.id}-fixture.gz`, `.cache/bin/${tool.binary}`]),
];
for (const relative of installLinks) {
  test(`native install rejects symlink ${relative} before download or execution and preserves external data`, async () => {
    const { root, outside } = await fixture();
    // Leave unrelated archives cold: reject even a later-tool symlink before the first download.
    for (const tool of tools) {
      const archive = `.cache/native-tools/${platform}/${tool.id}-fixture.gz`;
      if (archive !== relative) await rename(path.join(root, archive), path.join(outside, `${tool.id}-held.gz`));
    }
    const target = path.join(outside, 'linked-entry');
    await rename(path.join(root, relative), target);
    await symlink(target, path.join(root, relative));
    const beforeOutside = await snapshot(outside);
    let downloads = 0, error;
    try {
      await native.installNativeTools({ root, platform, fetchBytes: async () => { downloads++; return compressed; } });
    } catch (caught) { error = caught; }
    assert.equal(executions, 0, 'a rejected managed path must never reach native execution');
    assert.equal(downloads, 0, 'reject the complete managed-path plan before a download');
    assert.deepEqual(await snapshot(outside), beforeOutside, 'external bytes, permissions and directory entries must remain unchanged');
    assert.match(error?.message ?? '', /symlink/i, 'the symlink itself must be rejected');
  });
}

for (const relative of ['.cache', '.cache/native-check', '.cache/native-check/latest.json']) {
  test(`native report rejects symlink ${relative} and retains the previous report`, async () => {
    const { root, outside } = await fixture();
    await mkdir(path.join(root, '.cache/native-check'));
    await writeFile(path.join(root, '.cache/native-check/latest.json'), '{"status":"previous user report"}\n');
    const target = path.join(outside, 'linked-report');
    await rename(path.join(root, relative), target);
    await symlink(target, path.join(root, relative));
    const beforeOutside = await snapshot(outside);
    let error;
    if (typeof native.writeNativeReport === 'function') {
      try { await native.writeNativeReport({ root, report: { status: 'candidate' } }); } catch (caught) { error = caught; }
    }
    assert.equal(executions, 0);
    assert.deepEqual(await snapshot(outside), beforeOutside, 'the prior report and every external file must remain unchanged');
    assert.equal(typeof native.writeNativeReport, 'function', 'export the report writer so path rejection is testable without a native run');
    assert.match(error?.message ?? '', /symlink/i);
  });
}
