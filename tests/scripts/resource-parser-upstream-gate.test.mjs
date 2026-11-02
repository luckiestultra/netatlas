import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';
import { replayOriginalResource } from '../../tools/check-resource-parser-upstreams.mjs';

test('public regression runner feeds the complete original resource and rejects double completion or I/O', () => {
  const content = `/*\n[rewrite_local]\n^http://ads.example/ url reject\n[mitm]\nhostname=ads.example\n*/\nthrow new Error('Business source must never execute');`;
  const result = replayOriginalResource(bundleResourceParser(), content, 'https://example.test/source.js');
  assert.equal(result.rewriteRows, 1); assert.equal(result.hostnames, 1);
  assert.equal(result.doneCalls, 1); assert.equal(result.forbiddenApiCalls, 0);
  for (const code of [
    '$done({content:"^http://a.example/ url reject"});$done({content:"^http://a.example/ url reject"});',
    'fetch("https://example.test/");$done({content:"^http://a.example/ url reject"});',
    '$done({error:"ignored failure"});',
    '$done({content:"garbage"});',
  ]) assert.throws(() => replayOriginalResource(code, content, 'https://example.test/source.js'));
});

test('four public regressions retain original URLs, source hashes and full AND accounting without redistributing raw business JS', () => {
  const registry = JSON.parse(readFileSync(new URL('../../metadata/resource-parser-upstreams.json', import.meta.url), 'utf8'));
  assert.equal(registry.version, 1); assert.equal(registry.cases.length, 4);
  assert.equal(new Set(registry.cases.map(entry => entry.id)).size, 4);
  for (const entry of registry.cases) {
    const url = new URL(entry.url);
    assert.equal(url.hostname, 'raw.githubusercontent.com');
    assert.equal(url.protocol, 'https:'); assert.equal(url.search, ''); assert.equal(url.hash, '');
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(entry.rewriteRows > 0);
    assert.deepEqual(Object.keys(entry).filter(key => /content|body|cookie|password/i.test(key)), []);
  }
  const dragon = registry.cases.find(entry => entry.id === 'dragonread-loon-plugin');
  assert.equal(dragon.sourceDomainConjunctions, 21);
  assert.equal(dragon.compiledConjunctionRows, 39);
  assert.equal(dragon.filterRows, dragon.compiledConjunctionRows + dragon.ordinaryFilterRows);
  assert.equal(registry.minimumMixedSnippetBuild, 844);
});

test('public regression CLI validates arguments when launched through a symlink instead of silently succeeding', () => {
  const directory = mkdtempSync(join(tmpdir(), 'netatlas-parser-gate-'));
  try {
    const link = join(directory, 'gate.mjs');
    symlinkSync(fileURLToPath(new URL('../../tools/check-resource-parser-upstreams.mjs', import.meta.url)), link);
    const result = spawnSync(process.execPath, [link, '--unexpected'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Public parser regression failed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
