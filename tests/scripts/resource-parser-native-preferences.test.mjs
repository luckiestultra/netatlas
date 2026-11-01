import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { parseYaml } from '../../src/features/resource-parser/yaml.mjs';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const parser = createNodeParser({ parseYaml });
const uuid = '12345678-1234-1234-1234-123456789abc';
const publicKey = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const query = `encryption=none&type=tcp&security=reality&sni=front.example&pbk=${publicKey}&sid=4cbb2b&flow=xtls-rprx-vision&allowInsecure=1&udp=0&tfo=0`;
const uri = `vless://${uuid}@example.test:443?${query}`;
const native = `vless=example.test:443, method=none, password=${uuid}, obfs=over-tls, obfs-host=front.example, tls-verification=false, reality-base64-pubkey=${publicKey}, reality-hex-shortid=4cbb2b, vless-flow=xtls-rprx-vision, udp-relay=false, fast-open=false, tag=日本01`;
const vmess = { v: '2', ps: '日本01', add: 'example.test', port: 443, id: uuid, aid: 0, scy: 'auto', net: 'tcp', tls: 'tls', sni: 'front.example', alpn: 'h2', allowInsecure: false };
const clash = { name: '日本01', type: 'vless', server: 'example.test', port: 443, uuid, tls: true, servername: 'front.example', 'skip-cert-verify': true, udp: false, tfo: false, flow: 'xtls-rprx-vision', 'reality-opts': { 'public-key': publicKey, 'short-id': '4cbb2b' } };
const encodeVmess = value => 'vmess://' + Buffer.from(JSON.stringify(value)).toString('base64url');
const fields = line => Object.fromEntries(line.trim().split(',').map(part => { const at = part.indexOf('='); return [part.slice(0, at).trim(), part.slice(at + 1).trim()]; }));
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function check(input, expected, names) {
  const adaptations = new Set();
  const output = parser.parseNodes(input, { adaptations });
  assert.equal(output, expected);
  assert.deepEqual([...adaptations].sort(), names.sort());
  assert.doesNotMatch(output, /adaptations=|client-fingerprint=|(?:^|[,&])fp=|(?:^|[,&])spx=/);
  return output;
}
function reject(input, hidden = []) {
  const adaptations = new Set(['preexisting']);
  assert.throws(() => parser.parseNodes(input, { adaptations }), error => {
    assert.match(error.message, /^Node conversion failed: /);
    for (const secret of hidden) assert.ok(!error.message.includes(secret));
    return true;
  });
  assert.deepEqual([...adaptations], ['preexisting'], 'failed subscriptions must not publish adaptation metadata');
}

test('VLESS URI fp and spx use native preferences without changing KOP-equivalent connection fields', () => {
  const expected = parser.parseNodes(uri + '#日本01');
  assert.deepEqual(fields(expected), fields(parser.parseNodes(native)), 'matches the synthetic KOP native-field comparison fixture');
  for (const [extra, names] of [['&fp=chrome', ['fp']], ['&spx=%2F', ['spx']], ['&fp=chrome&spx=%2F', ['fp', 'spx']]]) {
    check(uri + extra + '#日本01', expected, names);
  }
});

test('VMess JSON fp does not change credentials, TLS verification or ALPN', () => {
  const expected = parser.parseNodes(encodeVmess(vmess));
  for (const fp of ['chrome', '', 'safari']) check(encodeVmess({ ...vmess, fp }), expected, ['fp']);
});

test('Clash client-fingerprint is adapted on a copy and never emitted as a native setting', () => {
  const source = freeze({ proxies: [{ ...clash, 'client-fingerprint': 'chrome' }] });
  const snapshot = JSON.stringify(source);
  const expected = parser.parseNodes({ proxies: [clash] });
  assert.deepEqual(fields(expected), fields(parser.parseNodes(native)), 'matches the synthetic KOP connection fields');
  check(source, expected, ['client-fingerprint']);
  assert.equal(JSON.stringify(source), snapshot);
  assert.equal(source.proxies[0]['client-fingerprint'], 'chrome');
});

test('empty and bounded preference strings are accepted without leaking values into metadata', () => {
  const expected = parser.parseNodes(uri + '#日本01');
  for (const fp of ['', 'x'.repeat(128)]) check(uri + '&fp=' + fp + '#日本01', expected, ['fp']);
  for (const spx of ['', '/'.repeat(2048)]) check(uri + '&spx=' + encodeURIComponent(spx) + '#日本01', expected, ['spx']);
  const privateValue = 'PRIVATE_LABEL_PATH';
  const adaptations = new Set();
  parser.parseNodes(uri + '&fp=' + privateValue + '&spx=%2F' + privateValue + '#日本01', { adaptations });
  assert.deepEqual([...adaptations], ['fp', 'spx']);
  assert.ok(!JSON.stringify([...adaptations]).includes(privateValue));
});

test('non-string, oversized and control preference values remain errors', () => {
  for (const fp of [null, true, 1, {}, [], 'x'.repeat(129), 'PRIVATE\nVALUE']) reject(encodeVmess({ ...vmess, fp }), ['PRIVATE\nVALUE']);
  for (const value of [null, true, 1, {}, [], 'x'.repeat(129), 'PRIVATE\u0000VALUE']) reject({ proxies: [{ ...clash, 'client-fingerprint': value }] }, ['PRIVATE\u0000VALUE']);
  for (const extra of ['&fp=' + 'x'.repeat(129), '&spx=' + 'x'.repeat(2049), '&fp=PRIVATE%0AVALUE', '&spx=PRIVATE%7FVALUE']) reject(uri + extra + '#日本01', ['PRIVATE\nVALUE', 'PRIVATE\u007fVALUE']);
});

test('pins, utls, arbitrary fields and native fp do not inherit preference adaptation', () => {
  for (const field of ['fingerprint', 'utls', 'certificate', 'certificate_public_key_sha256', 'unknown-key']) {
    reject({ proxies: [{ ...clash, 'client-fingerprint': 'chrome', [field]: 'PRIVATE_FIELD_VALUE' }] }, ['PRIVATE_FIELD_VALUE']);
  }
  const singbox = { type: 'vless', tag: '日本01', server: 'example.test', server_port: 443, uuid, tls: { enabled: true, server_name: 'front.example' } };
  reject({ outbounds: [{ ...singbox, 'client-fingerprint': 'chrome' }] });
  reject({ proxies: [{ ...singbox, 'client-fingerprint': 'chrome' }] });
  reject({ outbounds: [{ ...singbox, tls: { ...singbox.tls, utls: { enabled: true, fingerprint: 'chrome' } } }] });
  reject({ version: 1, servers: [{ server: 'example.test', server_port: 8388, method: 'aes-128-gcm', password: 'PRIVATE_PASSWORD', 'client-fingerprint': 'chrome' }] }, ['PRIVATE_PASSWORD']);
  reject(native + ', fp=chrome');
  reject(uri + '&fp=chrome&packetEncoding=xudp#日本01');
  reject(uri + '&spiderX=%2F#日本01');
});

test('WS Host, path and explicit TLS verification are unchanged by the three preference fields', () => {
  const plain = `vless://${uuid}@example.test:443?encryption=none&security=tls&type=ws&host=front.example&sni=front.example&path=%2Fsocket%3Fed%3D2048&allowInsecure=0&alpn=http%2F1.1`;
  const expected = parser.parseNodes(plain + '#日本01');
  check(plain + '&fp=chrome&spx=%2Fignored#日本01', expected, ['fp', 'spx']);
  const source = { ...clash, network: 'ws', flow: undefined, 'reality-opts': undefined, 'ws-opts': { path: '/socket?ed=2048', headers: { Host: 'front.example' } }, 'skip-cert-verify': false };
  delete source.flow; delete source['reality-opts'];
  const original = JSON.stringify(source);
  check({ proxies: [{ ...source, 'client-fingerprint': 'chrome' }] }, parser.parseNodes({ proxies: [source] }), ['client-fingerprint']);
  assert.equal(JSON.stringify(source), original);
});

test('adaptation metadata is published only after every node validates, and is a fixed deduplicated set', () => {
  const adapted = uri + '&fp=chrome#日本01';
  const malformed = `vless://${uuid}@example.test:443?security=reality&pbk=BAD&sid=4cbb2b#另一个节点`;
  reject(adapted + '\n' + malformed);
  reject(adapted + '\n' + adapted);
  const adaptations = new Set();
  parser.parseNodes(adapted + '\n' + uri + '&fp=safari&spx=%2F#日本02', { adaptations });
  assert.deepEqual([...adaptations], ['fp', 'spx']);
  assert.equal(parser.parseNodes(uri + '#日本01', { adaptations: [] }), parser.parseNodes(uri + '#日本01'));
});

test('exact user options work after native adaptation while unknown filtered nodes stay atomic errors', () => {
  const resource = { type: 'server', link: 'https://example.test/sub#info=1&out=套餐+重置&emoji=2', content: uri + '&fp=chrome&spx=%2F#日本01' };
  const converted = parseResource(resource);
  assert.match(converted.content, /tag=🇯🇵 日本01/);
  for (const secret of ['fp=chrome', 'spx=%2F']) assert.ok(!converted.content.includes(secret));
  const bundle = bundleResourceParser(); let calls = 0, captured;
  const final = vm.runInNewContext(bundle, {
    $resource: { ...resource, content: resource.content + '\n' + uri + '&fp=chrome&unknown-secret=PRIVATE_VALUE#套餐' },
    $done: value => { calls++; captured = value; return value; },
  }, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(calls, 1); assert.equal(final, captured); assert.deepEqual(Object.keys(final), ['error']);
  assert.ok(!final.error.includes('PRIVATE_VALUE')); assert.ok(!final.error.includes('unknown-secret'));
});
