import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const uuid = '12345678-1234-1234-1234-123456789abc';
const key = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const hint = 'support-x25519mlkem768';
const base = `vless://${uuid}@example.test:443?encryption=none&flow=xtls-rprx-vision&fp=chrome&pbk=${key}&security=reality&sid=4cbb2b&sni=front.example&spx=%2F&type=tcp`;
const fingerprintNote = '# NetAtlas: QX uses its native TLS fingerprint; source fp/client-fingerprint preferences are not preserved.\n';
const spiderNote = '# NetAtlas: QX has no Reality spider-path setting; source spx is omitted.\n';
const capabilityNote = '# NetAtlas: QX uses its native Reality handshake for X25519MLKEM768 support.\n';
const resource = content => ({ type: 'server', content, link: 'https://example.test/PRIVATE_SUB_TOKEN#info=1&out=套餐+重置&emoji=2' });
function bundled(content) {
  let calls = 0, captured, notices = 0;
  const result = vm.runInNewContext(bundleResourceParser(), { $resource: resource(content), $done: value => { calls++; captured = value; return value; }, $notify: () => { notices++; } }, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(calls, 1); assert.equal(result, captured);
  return { result: JSON.parse(JSON.stringify(result)), notices };
}
const nodes = content => content.split('\n').filter(line => !line.startsWith('#')).join('\n');

test('the observed 3x-ui query-field structure survives whole-subscription Base64 with explicit native support', () => {
  const expected = nodes(parseResource(resource(base + '#日本01')).content);
  for (const positive of ['true', '1']) {
    const raw = base + '&' + hint + '=' + positive + '#日本01';
    for (const content of [raw, Buffer.from(raw).toString('base64')]) {
      const expectedContent = fingerprintNote + spiderNote + capabilityNote + expected;
      assert.equal(parseResource(resource(content)).content, expectedContent);
      assert.deepEqual(bundled(content).result, { content: expectedContent });
      assert.ok(!nodes(expectedContent).includes(hint + '='));
    }
  }
});

test('Clash nested Reality capability and client-fingerprint retain baseline connection fields', () => {
  const node = { type: 'vless', name: '日本01', server: 'example.test', port: 443, uuid, tls: true, servername: 'front.example', flow: 'xtls-rprx-vision', 'client-fingerprint': 'chrome', 'reality-opts': { 'public-key': key, 'short-id': '4cbb2b' } };
  const baseline = nodes(parseResource(resource(JSON.stringify({ proxies: [node] }))).content);
  for (const value of [true, 1, 'true', '1']) {
    const content = JSON.stringify({ proxies: [{ ...node, 'reality-opts': { ...node['reality-opts'], [hint]: value } }] });
    const expected = fingerprintNote + capabilityNote + baseline;
    assert.equal(parseResource(resource(content)).content, expected);
    assert.deepEqual(bundled(content).result, { content: expected });
  }
});

test('false, malformed, non-Reality and signature parameters remain atomic errors', () => {
  const safe = base + '&' + hint + '=true#日本01';
  for (const bad of [
    base + '&' + hint + '=false', base + '&' + hint + '=', base + '&' + hint + '=PRIVATE_HINT_VALUE',
    base.replace('security=reality', 'security=tls') + '&' + hint + '=true',
    base + '&' + hint + '=true&pqv=PRIVATE_SIGNATURE_KEY',
    base.replace(key, 'invalid-public-key') + '&' + hint + '=true',
  ]) {
    const { result, notices } = bundled(safe + '\n' + bad + '#套餐');
    assert.deepEqual(Object.keys(result), ['error']);
    assert.equal(notices, 0);
    for (const hidden of ['PRIVATE_HINT_VALUE', 'PRIVATE_SIGNATURE_KEY', 'PRIVATE_SUB_TOKEN', uuid, key, 'example.test']) assert.ok(!result.error.includes(hidden));
  }
});
