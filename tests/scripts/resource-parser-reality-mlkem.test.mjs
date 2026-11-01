import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { parseYaml } from '../../src/features/resource-parser/yaml.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const hint = 'support-x25519mlkem768';
const uuid = '12345678-1234-1234-1234-123456789abc';
const key = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const query = `encryption=none&security=reality&type=tcp&sni=front.example&pbk=${key}&sid=4cbb2b&flow=xtls-rprx-vision&allowInsecure=1&udp=0&tfo=0`;
const uri = `vless://${uuid}@example.test:443?${query}`;
const parser = createNodeParser({ parseYaml });
const clash = { type: 'vless', name: '日本01', server: 'example.test', port: 443, uuid, tls: true, servername: 'front.example', 'skip-cert-verify': true, flow: 'xtls-rprx-vision', 'reality-opts': { 'public-key': key, 'short-id': '4cbb2b' }, udp: false, tfo: false };
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function rejects(input, pattern = /Node conversion failed:/, hidden = []) {
  const adaptations = new Set(['preexisting']);
  assert.throws(() => parser.parseNodes(input, { adaptations }), error => {
    assert.match(error.message, pattern);
    assert.ok(error.message.length < 240);
    for (const secret of [uuid, key, 'example.test', 'front.example', ...hidden]) assert.ok(!error.message.includes(secret));
    return true;
  });
  assert.deepEqual([...adaptations], ['preexisting']);
}
function accepts(input, expected, names = [hint]) {
  const adaptations = new Set();
  const output = parser.parseNodes(input, { adaptations });
  assert.equal(output, expected);
  assert.deepEqual([...adaptations].sort(), names.sort());
  assert.ok(!output.includes(hint + '='));
  return output;
}

test('the published 3x-ui true capability hint works in a whole encoded VLESS subscription', () => {
  // 3x-ui internal/sub/service.go revision 1a5100ea166361cc2a01d8f245d616fb18baa0dd
  // emits this exact string "true" in its Reality subscription branch.
  const plain = uri + '&' + hint + '=true#日本01';
  const encoded = Buffer.from(plain).toString('base64');
  accepts(encoded, parser.parseNodes(uri + '#日本01'));
});

test('URI true and 1 preserve every existing native connection field', () => {
  const expected = parser.parseNodes(uri + '#日本01');
  for (const value of ['true', '1']) accepts(uri + '&' + hint + '=' + value + '#日本01', expected);
  accepts(uri + '&fp=chrome&spx=%2F&' + hint + '=true#日本01', expected, ['fp', 'spx', hint]);
});

test('Clash nested Reality true values are accepted on a copy for VMess and VLESS', () => {
  for (const type of ['vmess', 'vless']) {
    const base = { ...clash, type }; if (type === 'vmess') delete base.flow;
    const expected = parser.parseNodes({ proxies: [base] });
    for (const value of [true, 1, 'true', '1']) {
      const source = freeze({ proxies: [{ ...base, 'reality-opts': { ...base['reality-opts'], [hint]: value } }] });
      const snapshot = JSON.stringify(source);
      accepts(source, expected);
      assert.equal(JSON.stringify(source), snapshot);
    }
  }
});

test('already supported non-VLESS Reality URI types retain their original fields', () => {
  for (const scheme of ['trojan', 'anytls', 'https']) {
    const credentials = scheme === 'https' ? 'synthetic-user:synthetic-password' : 'synthetic-password';
    const source = `${scheme}://${credentials}@example.test:443?security=reality&sni=front.example&pbk=${key}&sid=4cbb2b&allowInsecure=0&tfo=0`;
    accepts(source + '&' + hint + '=true#日本01', parser.parseNodes(source + '#日本01'));
  }
});

test('false, empty and malformed hint values cannot claim QX can disable native MLKEM', () => {
  for (const value of ['false', '0', '', 'TRUE', '2', 'PRIVATE_HINT_VALUE', '%00', '%5Btrue%5D']) {
    rejects(uri + '&' + hint + '=' + value + '#日本01', new RegExp(hint), ['PRIVATE_HINT_VALUE']);
  }
  for (const value of [false, 0, 'false', '0', '', null, [], {}, 'PRIVATE_HINT_VALUE']) {
    rejects({ proxies: [{ ...clash, 'reality-opts': { ...clash['reality-opts'], [hint]: value } }] }, new RegExp(hint), ['PRIVATE_HINT_VALUE']);
  }
});

test('the capability hint is rejected unless native Reality is actually enabled', () => {
  for (const security of ['tls', 'none', '']) {
    const source = `vless://${uuid}@example.test:443?type=tcp${security ? '&security=' + security : ''}&${hint}=true#日本01`;
    rejects(source, /requires Reality/);
  }
  rejects({ proxies: [{ ...clash, tls: false, 'reality-opts': { ...clash['reality-opts'], [hint]: true } }] }, /requires Reality/);
});

test('the capability keeps WS Reality, keys, UUID, flow and TLS verification validation strict', () => {
  rejects({ proxies: [{ ...clash, network: 'ws', 'ws-opts': { path: '/socket', headers: { Host: 'front.example' } }, 'reality-opts': { ...clash['reality-opts'], [hint]: true } }] }, /websocket unsupported|unsupported transport/);
  for (const source of [uri.replace(key, 'BAD_KEY'), uri.replace('sid=4cbb2b', 'sid=not-hex'), uri.replace(uuid, 'BAD_UUID'), uri.replace('xtls-rprx-vision', 'OTHER_FLOW'), uri.replace('allowInsecure=1', 'allowInsecure=invalid')]) {
    rejects(source + '&' + hint + '=true#日本01');
  }
});

test('native, top-level Clash, sing-box and SIP008 do not borrow the URI capability exception', () => {
  const native = parser.parseNodes(uri + '#日本01').trim();
  rejects(native + ', ' + hint + '=true', new RegExp('QX native: ' + hint));
  rejects({ proxies: [{ ...clash, [hint]: true }] }, new RegExp('Clash node: ' + hint));
  const singbox = { type: 'vless', tag: '日本01', server: 'example.test', server_port: 443, uuid, tls: { enabled: true, server_name: 'front.example', reality: { enabled: true, public_key: key, short_id: '4cbb2b' } } };
  rejects({ outbounds: [{ ...singbox, [hint]: true }] }, new RegExp(hint));
  rejects({ outbounds: [{ ...singbox, tls: { ...singbox.tls, reality: { ...singbox.tls.reality, [hint]: true } } }] }, new RegExp(hint));
  rejects({ version: 1, servers: [{ server: 'example.test', server_port: 8388, method: 'aes-128-gcm', password: 'PRIVATE_PASSWORD', [hint]: true }] }, new RegExp(hint), ['PRIVATE_PASSWORD']);
  const legacyVless = { version: 1, servers: [clash] };
  assert.equal(parser.parseNodes(legacyVless), parser.parseNodes({ proxies: [clash] }), 'existing missing-id behavior remains unchanged');
  rejects({ version: 1, servers: [{ ...clash, 'reality-opts': { ...clash['reality-opts'], [hint]: true } }] }, new RegExp('SIP008 node Reality: ' + hint));
});

test('other security options and failed later nodes stay atomic with no published capability metadata', () => {
  for (const suffix of ['&pqv=PRIVATE_PIN', '&fingerprint=PRIVATE_PIN', '&unknown-key=PRIVATE_VALUE']) {
    rejects(uri + '&' + hint + '=true' + suffix + '#日本01', /unsupported field/, ['PRIVATE_PIN', 'PRIVATE_VALUE']);
  }
  const valid = uri + '&' + hint + '=true#日本01';
  rejects(valid + '\n' + uri + '&' + hint + '=false#日本02', new RegExp(hint));
  rejects(valid + '\n' + valid, /duplicate node name/);
});

test('the final bundle preserves exact user options, single completion and a fixed native handshake note', () => {
  const content = Buffer.from(uri + '&' + hint + '=true#日本01').toString('base64');
  let calls = 0, captured;
  const result = vm.runInNewContext(bundleResourceParser(), {
    $resource: { content, type: 'server', link: 'https://example.test/PRIVATE_SUB_TOKEN#info=1&out=套餐+重置&emoji=2' },
    $done: value => { calls++; captured = value; return value; },
  }, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(calls, 1); assert.equal(result, captured); assert.deepEqual(Object.keys(result), ['content']);
  assert.match(result.content, /^# NetAtlas: QX uses its native Reality handshake for X25519MLKEM768 support\.\n/);
  assert.match(result.content, /tag=🇯🇵 日本01/);
  const notes = result.content.split('\n').filter(line => line.startsWith('#')).join('\n');
  for (const secret of ['PRIVATE_SUB_TOKEN', uuid, key, 'example.test', 'front.example']) assert.ok(!notes.includes(secret));
});
