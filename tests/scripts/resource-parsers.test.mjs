import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { loadResourceParsers, renderResourceParsers, validateResourceParsers } from '../../tools/lib/resource-parsers.mjs';

const registry = loadResourceParsers();
const expected = {
  quantumultX: { section: 'general', key: 'resource_parser_url', bytes: 271667, sha256: '1315ad57a31a2431a9fdf3d9fa0c892f7e91b9fa74f1c81bdaac04d521817b67' },
  loon: { section: 'General', key: 'resource-parser', bytes: 1276648, sha256: '54756d35c1777ef73aa384de4bea022d96ed58d8128f3610a14e202ee300d16c' },
};

for (const [client, contract] of Object.entries(expected)) {
  test(client + ' emits exactly the documented native external-parser field', () => {
    const parser = registry.clients[client];
    const [artifact] = renderResourceParsers(client);
    assert.equal(artifact.path, 'fragments/resource-parser.conf');
    const lines = artifact.content.split('\n').filter(line => line && !line.startsWith('#'));
    assert.deepEqual(lines, ['[' + contract.section + ']', contract.key + ' = ' + parser.url]);
    assert.match(parser.url, /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\/.+\.js$/);
    assert.equal(parser.bytes, contract.bytes);
    assert.equal(parser.sha256, contract.sha256);
    assert.equal(parser.httpStatus, 200);
    assert.equal(parser.tlsVerified, true);
    assert.equal(parser.syntaxCheck, 'node --check (no execution)');
    assert.ok(parser.sourceMarkers.includes('$resource'));
    assert.ok(parser.sourceMarkers.includes('$done'));
    assert.equal(parser.nativeApp, 'not-run');
    assert.equal(parser.externalOnly, true);
    assert.equal(parser.defaultEnabled, false);
    assert.ok(artifact.content.includes(parser.author));
    assert.ok(artifact.content.includes(parser.upstreamLicense));
    assert.ok(artifact.content.includes(contract.sha256));
    assert.match(artifact.content, /not run/);
    assert.doesNotMatch(artifact.content, /^\[(?:Script|MITM|Task|Remote Proxy)\]|ca[-_]p12|type=cron|^\s*cron\s|script-path=|(?:^|\n)(?:function|var|let|const)\s/m);
    assert.deepEqual(renderResourceParsers(client, { baseUrl: 'https://example.test/custom/publish' }), [artifact], 'baseUrl must not redirect upstream scripts');
  });
}

test('QX original-author recipe exposes unknown license and host-contract limits without copying source', () => {
  const parser = registry.clients.quantumultX;
  assert.equal(parser.upstreamLicense, 'unspecified');
  assert.equal(parser.repository, 'KOP-XIAO/QuantumultX');
  assert.ok(parser.sourceMarkers.includes('hashSchema'));
  assert.equal(parser.sourceContract.helperUiMinimumBuild, 918);
  assert.match(renderResourceParsers('quantumultX')[0].content, /license is unspecified/);
  assert.equal(registry.sourceRegistry.vendoredJavaScript, false);
  assert.equal(existsSync(new URL('../../clients/quantumultX/scripts/resource-parser.js', import.meta.url)), false);
});

test('Loon records the matching AGPL release source and node/rule-only product contract', () => {
  const parser = registry.clients.loon;
  assert.equal(parser.upstreamLicense, 'AGPL-3.0-only');
  assert.equal(parser.release, '2.44.2');
  assert.equal(parser.sourceCommit, 'c1018115a7eee4cdcb9042cce5e94afda41e48ba');
  assert.equal(parser.commit, 'd26e713e38901e02565a6505c1ae5cb8bb8a1a22');
  assert.deepEqual(parser.sourceContract.supportedResourceTypes, { 1: 'nodes', 2: 'rules' });
  assert.ok(parser.productSourceUrl.includes(parser.sourceCommit));
  assert.ok(parser.licenseUrl.includes(parser.sourceCommit));
  assert.match(renderResourceParsers('loon')[0].content, /parser-enabled=true/);
  assert.equal(parser.permissions.automaticTasks, false);
  assert.equal(parser.permissions.mitm, false);
});

test('the six other known clients receive no invented parser syntax', () => {
  for (const client of ['surge', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']) assert.deepEqual(renderResourceParsers(client), []);
  assert.throws(() => renderResourceParsers('unknown'), /client/i);
});

test('external recipes reject moving refs, altered fields, bad integrity records and unsafe defaults', () => {
  for (const mutate of [
    value => { value.clients.quantumultX.url = value.clients.quantumultX.url.replace(value.clients.quantumultX.commit, 'master'); },
    value => { value.clients.quantumultX.upstreamLicense = 'MIT'; },
    value => { value.clients.quantumultX.sha256 = 'bad'; },
    value => { value.clients.quantumultX.httpStatus = 404; },
    value => { value.clients.quantumultX.sourceMarkers = ['$done']; },
    value => { value.clients.loon.sourceCommit = '0'.repeat(40); },
    value => { value.clients.loon.defaultEnabled = true; },
    value => { value.clients.loon.permissions.automaticTasks = true; },
    value => { value.clients.loon.artifacts = ['scripts/parser.js']; },
    value => { value.clients.loon.nativeApp = 'passed'; },
    value => { value.sourceRegistry.vendoredJavaScript = true; },
  ]) {
    const value = structuredClone(registry);
    mutate(value);
    assert.throws(() => validateResourceParsers(value));
  }
});

test('unused public-base option is still validated for all native recipes', () => {
  for (const baseUrl of ['http://example.test', 'https://user:secret@example.test', 'https://example.test?token=secret', 'https://example.test/#bad', 'https://example.test/\n[Script]', 'https://example.test/a,b']) assert.throws(() => renderResourceParsers('quantumultX', { baseUrl }), /baseUrl/);
});
