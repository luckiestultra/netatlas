import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { artifactFor, decodeToolArchive, installNativeTools, verifyArtifact } from '../../tools/lib/native.mjs';

const metadata = {
  version: 1,
  tools: [{ id: 'mihomo', version: '1.19.33', repo: 'MetaCubeX/mihomo', assets: {
    'darwin-arm64': { file: 'mihomo-darwin-arm64-v1.19.33.gz', sha256: 'a'.repeat(64), kind: 'gzip' },
    'linux-x64': { file: 'mihomo-linux-amd64-compatible-v1.19.33.gz', sha256: 'b'.repeat(64), kind: 'gzip' },
  } }],
};

test('pinned artifacts select the requested architecture and official release URL', () => {
  const asset = artifactFor(metadata, 'mihomo', 'linux-x64');
  assert.equal(asset.sha256, 'b'.repeat(64));
  assert.equal(asset.url, 'https://github.com/MetaCubeX/mihomo/releases/download/v1.19.33/mihomo-linux-amd64-compatible-v1.19.33.gz');
  assert.throws(() => artifactFor(metadata, 'mihomo', 'win32-x64'), /platform/i);
  assert.throws(() => artifactFor(metadata, 'unknown', 'linux-x64'), /tool/i);
});

test('wrong SHA blocks a native artifact before decompression or execution', () => {
  const compressed = gzipSync(Buffer.from('test executable bytes'));
  const expected = createHash('sha256').update(compressed).digest('hex');
  assert.equal(verifyArtifact(compressed, expected), expected);
  const corrupt = Buffer.from(compressed);
  corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => verifyArtifact(corrupt, expected), /SHA-256/i);
});

test('gzip decoding returns exactly the pinned executable bytes', () => {
  const bytes = Buffer.from('not executed: fixture native bytes');
  assert.deepEqual(decodeToolArchive(gzipSync(bytes), { kind: 'gzip' }), bytes);
});

test('tar decoding extracts only the exact registered regular file and rejects traversal', () => {
  const payload = Buffer.from('fixture binary');
  function tarFile(name, type = '0') {
    const header = Buffer.alloc(512);
    header.write(name);
    header.write(payload.length.toString(8).padStart(11, '0') + '\0', 124);
    header.write(type, 156);
    return Buffer.concat([header, payload, Buffer.alloc((512 - payload.length % 512) % 512), Buffer.alloc(1024)]);
  }
  assert.deepEqual(decodeToolArchive(gzipSync(tarFile('tool/bin')), { kind: 'tar', member: 'tool/bin' }), payload);
  assert.throws(() => decodeToolArchive(gzipSync(tarFile('tool/bin', '2')), { kind: 'tar', member: 'tool/bin' }), /regular file/i);
  assert.throws(() => decodeToolArchive(gzipSync(tarFile('../bad')), { kind: 'tar', member: '../bad' }), /member|path/i);
  assert.throws(() => decodeToolArchive(gzipSync(tarFile('other/bin')), { kind: 'tar', member: 'tool/bin' }), /missing/i);
});

test('installation replaces unverified binaries only from SHA-verified archive bytes and rechecks its cache', async () => {
  const cache = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.cache');
  await mkdir(cache, { recursive: true });
  const root = await mkdtemp(path.join(cache, 'native-install-test-'));
  await mkdir(path.join(root, 'metadata'));
  await mkdir(path.join(root, '.cache/bin'), { recursive: true });
  const executable = Buffer.from('fixture bytes: never execute this file');
  const compressed = gzipSync(executable);
  const digest = createHash('sha256').update(compressed).digest('hex');
  const registry = { version: 1, tools: ['mihomo', 'singBox'].map(id => ({
    id, version: '1.0.0', repo: id === 'mihomo' ? 'MetaCubeX/mihomo' : 'SagerNet/sing-box',
    assets: { 'linux-x64': { file: `${id}-fixture.gz`, sha256: digest, kind: 'gzip' } },
  })) };
  await writeFile(path.join(root, 'metadata/native-tools.json'), JSON.stringify(registry));
  const binary = path.join(root, '.cache/bin/mihomo');
  await writeFile(binary, 'unverified pre-existing bytes');
  let downloads = 0;
  const fetchBytes = async () => { downloads++; return compressed; };
  const installed = await installNativeTools({ root, platform: 'linux-x64', fetchBytes });
  assert.equal(downloads, 2);
  assert.deepEqual(await readFile(binary), executable);
  assert.equal(installed.artifacts.length, 2);
  await installNativeTools({ root, platform: 'linux-x64', fetchBytes });
  assert.equal(downloads, 2, 'verified archive cache avoids an unnecessary network request');
  await writeFile(path.join(root, '.cache/native-tools/linux-x64/mihomo-fixture.gz'), 'corrupted archive');
  await assert.rejects(installNativeTools({ root, platform: 'linux-x64', fetchBytes }), /SHA-256/i);
  assert.deepEqual(await readFile(binary), executable, 'failed archive verification preserves the installed bytes');
});
