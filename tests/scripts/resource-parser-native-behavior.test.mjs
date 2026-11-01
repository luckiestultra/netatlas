import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const uuid = '12345678-1234-1234-1234-123456789abc';
const key = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const uri = `vless://${uuid}@example.test:443?security=reality&type=tcp&sni=front.example&pbk=${key}&sid=4cbb2b&flow=xtls-rprx-vision`;
const fingerprintNote = '# NetAtlas: QX uses its native TLS fingerprint; source fp/client-fingerprint preferences are not preserved.\n';
const spiderNote = '# NetAtlas: QX has no Reality spider-path setting; source spx is omitted.\n';
const resource = content => ({ type: 'server', link: 'https://example.test/PRIVATE_SUB_TOKEN#info=1&out=套餐+重置&emoji=2', content });
function bundled(input) {
  let calls = 0, captured;
  const final = vm.runInNewContext(bundleResourceParser(), { $resource: resource(input), $done: value => { calls++; captured = value; return value; }, $notify: () => {} }, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(calls, 1); assert.equal(final, captured);
  return JSON.parse(JSON.stringify(final));
}
function converts(input, expected) {
  assert.equal(parseResource(resource(input)).content, expected);
  assert.deepEqual(bundled(input), { content: expected });
}

test('native fingerprint preferences are transparent source adaptations without resource mode switches', () => {
  const expected = parseResource(resource(uri + '#日本01')).content;
  converts(uri + '&fp=chrome#日本01', fingerprintNote + expected);
  converts(uri + '&spx=%2F#日本01', spiderNote + expected);
  converts(uri + '&fp=chrome&spx=%2F#日本01', fingerprintNote + spiderNote + expected);
});

test('Clash client-fingerprint uses the same explicit QX native note', () => {
  const node = { type: 'vless', name: '日本01', server: 'example.test', port: 443, uuid, tls: true, servername: 'front.example', 'reality-opts': { 'public-key': key, 'short-id': '4cbb2b' }, flow: 'xtls-rprx-vision' };
  const expected = parseResource(resource(JSON.stringify({ proxies: [node] }))).content;
  converts(JSON.stringify({ proxies: [{ ...node, 'client-fingerprint': 'chrome' }] }), fingerprintNote + expected);
});

test('adaptation notes never copy hint values or the subscription URL', () => {
  const result = bundled(uri + '&fp=PRIVATE_HINT_VALUE&spx=%2FPRIVATE_PATH#日本01');
  assert.equal(typeof result.content, 'string', 'source preferences must produce a native resource');
  const notes = result.content.split('\n').filter(line => line.startsWith('#')).join('\n');
  for (const value of ['PRIVATE_HINT_VALUE', 'PRIVATE_PATH', 'PRIVATE_SUB_TOKEN', 'example.test', uuid, key]) assert.ok(!notes.includes(value));
  assert.equal(result.content.split('\n').filter(line => line.startsWith('vless=')).length, 1);
});

test('unsafe or unsupported source rows stay atomic even after a valid adaptation', () => {
  for (const suffix of ['&fingerprint=PRIVATE_PIN', '&made-up-option=PRIVATE_VALUE', '&type=grpc']) {
    // Unsupported source semantics must not be hidden by out.
    const invalid = suffix === '&type=grpc' ? uri.replace('type=tcp', 'type=grpc') : uri + suffix;
    const result = bundled(uri + '&fp=chrome#日本01\n' + invalid + '#套餐');
    assert.deepEqual(Object.keys(result), ['error']);
    assert.ok(!result.error.includes('PRIVATE_'));
  }
});
