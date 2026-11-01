import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const uuid = '12345678-1234-1234-1234-123456789abc';
const key = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const hash = '#info=1&out=套餐+重置&emoji=2';
const native = `vless=example.test:443, method=none, password=${uuid}, obfs=over-tls, obfs-host=front.example, tls-verification=false, reality-base64-pubkey=${key}, reality-hex-shortid=4cbb2b, vless-flow=xtls-rprx-vision, fast-open=false, udp-relay=false, tag=日本01`;
const uri = `vless://${uuid}@example.test:443?encryption=none&security=reality&type=tcp&sni=front.example&pbk=${key}&sid=4cbb2b&flow=xtls-rprx-vision`;
const clash = { name: 'Private resource label', type: 'vless', server: 'example.test', port: 443, uuid, tls: true, servername: 'front.example' };
const singbox = { type: 'vless', tag: 'Private resource label', server: 'example.test', server_port: 443, uuid, tls: { enabled: true, server_name: 'front.example' } };
const bundle = bundleResourceParser();

function resource(input) {
  return { type: 'server', content: typeof input === 'string' ? input : JSON.stringify(input), link: 'https://example.test/PRIVATE_SUBSCRIPTION_TOKEN' + hash };
}
function bundled(input) {
  let calls = 0, captured, notices = 0;
  const final = vm.runInNewContext(bundle, {
    $resource: resource(input), $done: value => { calls++; captured = value; return value; },
    $notify: () => { notices++; }, fetch: () => assert.fail('no network'),
  }, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(calls, 1); assert.equal(final, captured);
  return { result: JSON.parse(JSON.stringify(final)), notices };
}
function rejects(input, expected, hidden = []) {
  assert.throws(() => parseResource(resource(input)), error => error.message === expected);
  const { result, notices } = bundled(input);
  assert.deepEqual(Object.keys(result), ['error']); assert.equal(result.error, expected);
  assert.equal(notices, 0); assert.ok(result.error.length < 240);
  for (const value of ['PRIVATE_SUBSCRIPTION_TOKEN', 'Private resource label', 'example.test', 'front.example', uuid, key, ...hidden]) {
    assert.ok(!result.error.includes(value), 'diagnostic must not contain source data');
  }
}

test('the supplied native VLESS field structure succeeds with the exact user hash', () => {
  const expected = native.replace('tag=日本01', 'tag=🇯🇵 日本01') + '\n';
  assert.equal(parseResource(resource(native)).content, expected);
  assert.deepEqual(bundled(native).result, { content: expected });
});

test('known URI candidate fields identify the format and field while remaining rejected', () => {
  for (const field of ['fp', 'spx', 'fingerprint', 'packetEncoding']) {
    rejects(uri + '&' + field + '=PRIVATE_FIELD_VALUE#日本01', 'Node conversion failed: unsupported field in URI options: ' + field, ['PRIVATE_FIELD_VALUE']);
  }
});

test('VMess JSON names a fixed public field without exposing its value', () => {
  const content = { v: '2', ps: 'Private resource label', add: 'example.test', port: 443, id: uuid, net: 'tcp', tls: 'tls', fp: 'PRIVATE_FIELD_VALUE' };
  rejects('vmess://' + Buffer.from(JSON.stringify(content)).toString('base64url'), 'Node conversion failed: unsupported field in VMess URI: fp', ['PRIVATE_FIELD_VALUE']);
});

test('Clash diagnostics distinguish a known field from arbitrary secret-like keys', () => {
  rejects({ proxies: [{ ...clash, 'client-fingerprint': 'PRIVATE_FIELD_VALUE' }] }, 'Node conversion failed: unsupported field in Clash node: client-fingerprint', ['PRIVATE_FIELD_VALUE']);
  for (const unknown of ['PRIVATE_KEY_NAME_1234567890', '秘密令牌字段', 'fp_PRIVATE_KEY_NAME']) {
    rejects({ proxies: [{ ...clash, [unknown]: 'PRIVATE_FIELD_VALUE' }] }, 'Node conversion failed: unsupported field in Clash node: [unrecognized name]', [unknown, 'PRIVATE_FIELD_VALUE']);
  }
});

test('sing-box nested TLS diagnostics have fixed context and registered names', () => {
  for (const field of ['utls', 'ech', 'certificate']) {
    rejects({ outbounds: [{ ...singbox, tls: { ...singbox.tls, [field]: 'PRIVATE_FIELD_VALUE' } }] }, 'Node conversion failed: unsupported field in sing-box TLS: ' + field, ['PRIVATE_FIELD_VALUE']);
  }
});

test('native unsupported fields use the same redaction with a native context', () => {
  rejects(native + ', certificate=PRIVATE_FIELD_VALUE', 'Node conversion failed: unsupported field in QX native: certificate', ['PRIVATE_FIELD_VALUE']);
  rejects(native + ', PRIVATE_KEY_NAME_1234567890=PRIVATE_FIELD_VALUE', 'Node conversion failed: unsupported field in QX native: [unrecognized name]', ['private_key_name_1234567890', 'PRIVATE_FIELD_VALUE']);
});

test('existing schema field names remain readable when misplaced in another protocol', () => {
  rejects({ proxies: [{ type: 'ss', name: 'Private resource label', server: 'example.test', port: 443, cipher: 'aes-128-gcm', password: 'PRIVATE_PASSWORD', uuid }] }, 'Node conversion failed: unsupported field in Clash node: uuid', ['PRIVATE_PASSWORD']);
});

test('diagnostic errors remain atomic even when node filters would discard the bad node', () => {
  rejects(native + '\n' + uri + '&fp=PRIVATE_FIELD_VALUE#套餐', 'Node conversion failed: unsupported field in URI options: fp', ['PRIVATE_FIELD_VALUE']);
});
