import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const base = { name: 'SS', type: 'ss', server: 'example.com', port: 80, cipher: 'aes-128-gcm', password: 'synthetic-password', plugin: 'v2ray-plugin' };
const node = options => ({ ...base, 'plugin-opts': { mode: 'websocket', mux: false, ...options } });
const document = options => ({ proxies: [node(options)] });
const convert = options => parseResource({ type: 'server', content: JSON.stringify(document(options)) }).content;
const native = options => createNodeParser().parseNodes(document(options));

test('Clash structured plugin paths remain literal, including SIP003 delimiters and escapes', () => {
  for (const path of ['/ws;tls', '/ws;version=2', '/ws\\;tls', '/ws\\=literal', '/ws:branch=2']) {
    const line = convert({ host: 'example.com', path });
    assert.match(line, /obfs=ws,/);
    assert.ok(line.includes('obfs-uri=' + path + ','), path);
    assert.doesNotMatch(line, /tls-verification=/);
    assert.equal(native({ host: 'example.com', path }), line);
  }
});

test('Clash structured TLS false is a boolean rather than a SIP003 flag', () => {
  assert.equal(convert({ host: 'example.com', path: '/ws', tls: false }), convert({ host: 'example.com', path: '/ws' }));
  assert.match(convert({ host: 'example.com', path: '/ws', tls: true }), /obfs=wss,.*tls-verification=true/);
});

test('Clash v2ray-plugin keeps its source Host default independently of SIP003', () => {
  // https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/shadowsocks.go#L312
  for (const tls of [true, false]) {
    assert.equal(convert({ path: '/ws', tls }), convert({ host: 'bing.com', path: '/ws', tls }));
    assert.match(convert({ path: '/ws', tls }), /obfs-host=bing\.com,/);
  }
  const uri = 'ss://aes-128-gcm:synthetic-password@example.com:80/?plugin=' + encodeURIComponent('v2ray-plugin;mode=websocket;mux=0;tls;path=/ws') + '#SS';
  assert.match(createNodeParser().parseNodes(uri), /obfs=wss, obfs-host=cloudfront\.com,/);
  assert.throws(() => createNodeParser().parseNodes(uri.replace('tls%3B', 'tls%3Dfalse%3B')));
});

test('Clash plugin YAML and the real QX bundle preserve the corrected fields', () => {
  const content = 'proxies:\n  - name: SS\n    type: ss\n    server: example.com\n    port: 80\n    cipher: aes-128-gcm\n    password: synthetic-password\n    plugin: v2ray-plugin\n    plugin-opts: {mode: websocket, mux: false, tls: false, path: "/ws;tls"}\n';
  const expected = convert({ tls: false, path: '/ws;tls' });
  assert.equal(parseResource({ type: 'server', content }).content, expected);
  const context = vm.createContext({ $resource: { type: 'server', content }, $parser: {} });
  vm.runInContext('var $done = function(result) {return result}', context);
  const result = vm.runInContext(bundleResourceParser(), context, { timeout: 3000 });
  assert.equal(result.content, expected);
  assert.deepEqual(Object.keys(result), ['content']);
});

test('structured plugin validation still rejects unsupported security, mux and nonscalar fields atomically', () => {
  for (const options of [{ mux: true }, { tls: 'invalid' }, { 'skip-cert-verify': true }, { path: {} }, { host: {} }]) {
    const content = JSON.stringify({ proxies: [node({ host: 'example.com' }), { ...node(options), name: 'Invalid' }] });
    assert.throws(() => parseResource({ type: 'server', content }), error => !error.message.includes('synthetic-password') && !error.message.includes('example.com'));
  }
  assert.throws(() => createNodeParser().parseNodes({ proxies: [{ ...base, plugin: 'obfs', 'plugin-opts': { mode: 'http', obfs: 'tls' } }] }));
  assert.match(createNodeParser().parseNodes({ proxies: [{ ...base, plugin: 'obfs', 'plugin-opts': { mode: 'http', host: 'front.example' } }] }), /obfs=http, obfs-host=front\.example,/);
});
