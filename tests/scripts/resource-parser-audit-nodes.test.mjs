import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const uuid = '12345678-1234-1234-1234-123456789abc';
const encode = value => Buffer.from(value).toString('base64url');
const parser = createNodeParser();
const bundle = bundleResourceParser();
const fields = line => Object.fromEntries(line.trim().split(',').slice(1).map(part => {
  const at = part.indexOf('='); return [part.slice(0, at).trim(), part.slice(at + 1).trim()];
}));

function bundled(input) {
  const content = typeof input === 'string' ? input : JSON.stringify(input);
  let calls = 0, callback;
  const context = vm.createContext({ $resource: { type: 'server', content }, $done: result => { calls++; callback = result; return result; } });
  const completion = vm.runInContext(bundle, context, { timeout: 3000 });
  assert.equal(calls, 1); assert.equal(completion, callback);
  return JSON.parse(JSON.stringify(completion));
}

function convert(input) {
  const content = typeof input === 'string' ? input : JSON.stringify(input);
  const result = parseResource({ type: 'server', content }).content;
  assert.equal(parser.parseNodes(input), result);
  assert.deepEqual(bundled(input), { content: result });
  return result;
}

function rejects(input, pattern = /Node conversion failed:/) {
  const content = typeof input === 'string' ? input : JSON.stringify(input);
  assert.throws(() => parser.parseNodes(input), pattern);
  assert.throws(() => parseResource({ type: 'server', content }), pattern);
  const result = bundled(input); assert.deepEqual(Object.keys(result), ['error']); assert.match(result.error, pattern);
}

const ss = { type: 'shadowsocks', tag: 'SS', server: 'example.com', server_port: 8388, method: 'aes-128-gcm', password: 'synthetic-password' };
const singboxUot = value => ({ outbounds: [{ ...ss, udp_over_tcp: value }] });
const clashWs = type => ({ name: type, type, server: 'example.com', port: 443, uuid, tls: true, network: 'ws', 'ws-opts': { path: '/ws', headers: { Host: 'front.example' } } });

test('legacy whole-Base64 SS passwords remain literal across encoding layers and the final bundle', () => {
  // https://shadowsocks.org/doc/configs.html: legacy passwords are plaintext.
  for (const password of ['p%40ss', 'p%25ss', 'plain%password', 'literal:@/?#', '日本%40😀']) {
    const credentials = 'aes-128-gcm:' + password;
    const expected = convert('ss://' + encode(credentials) + '@example.com:8388#SS');
    const raw = 'ss://aes-128-gcm:' + encodeURIComponent(password) + '@example.com:8388#SS';
    const legacy = 'ss://' + encode(credentials + '@example.com:8388') + '#SS';
    assert.equal(fields(expected).password, password);
    assert.equal(convert(raw), expected);
    assert.equal(convert(legacy), expected);
    assert.equal(convert(encode(legacy)), expected, 'whole encoded subscription must not decode the password again');
  }
});

test('sing-box UoT boolean and explicit enabled version 2 emit the same QX protocol', () => {
  // https://sing-box.sagernet.org/configuration/shared/udp-over-tcp/
  // https://github.com/crossutility/Quantumult-X/blob/master/sample.conf
  const expected = convert(singboxUot({ enabled: true, version: 2 }));
  assert.equal(fields(expected)['udp-over-tcp'], 'sp.v2');
  assert.equal(convert(singboxUot(true)), expected);
  assert.equal(convert(singboxUot({ enabled: true })), expected);
});

test('sing-box UoT objects with omitted enabled remain disabled', () => {
  // https://github.com/SagerNet/sing-box/blob/v1.14.0/option/udp_over_tcp.go
  const expected = convert(singboxUot(false));
  assert.equal(fields(expected)['udp-over-tcp'], 'false');
  for (const value of [{}, { version: 2 }, { version: 1 }, { enabled: false, version: 2 }]) {
    assert.equal(convert(singboxUot(value)), expected);
  }
});

test('sing-box UoT enabled versions and unknown options remain validated atomically', () => {
  assert.equal(fields(convert(singboxUot({ enabled: true, version: 1 })))['udp-over-tcp'], 'sp.v1');
  for (const value of [{ enabled: true, version: 3 }, { enabled: 'invalid' }, { enabled: true, extra: true }]) {
    rejects({ outbounds: [{ ...ss, tag: 'Valid' }, { ...ss, udp_over_tcp: value }] });
  }
});

test('Clash VMess and VLESS WSS default SNI to their explicit websocket Host', () => {
  // https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/vmess.go#L183-L189
  // https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/vless.go#L167-L173
  for (const type of ['vmess', 'vless']) {
    const source = clashWs(type);
    const expected = convert({ proxies: [{ ...source, servername: 'front.example' }] });
    assert.equal(fields(expected)['obfs-host'], 'front.example');
    assert.equal(convert({ proxies: [source] }), expected);
    assert.equal(convert({ proxies: [{ ...source, 'ws-opts': { path: '/ws', headers: { host: 'front.example' } } }] }), expected);
  }
});

test('Clash VMess and VLESS WSS preserve the source fixed HTTP/1.1 ALPN', () => {
  // Mihomo v1.19.33 vmess.go L218 and vless.go L197 use http/1.1 in WSS.
  for (const type of ['vmess', 'vless']) {
    const source = { ...clashWs(type), servername: 'front.example' };
    const expected = convert({ proxies: [source] });
    assert.equal(fields(expected)['tls-alpn'], '08687474702f312e31');
    for (const alpn of [[], ['h2'], ['h2', 'http/1.1']]) {
      assert.equal(convert({ proxies: [{ ...source, alpn }] }), expected);
    }
  }
});

test('WSS source defaults do not permit distinct names or suppress malformed input', () => {
  for (const type of ['vmess', 'vless']) {
    const source = clashWs(type);
    for (const extra of [{ servername: 'different.example' }, { alpn: [''] }, { alpn: {} }, { 'ws-opts': { headers: { Host: 'front.example', host: 'front.example' } } }]) {
      rejects({ proxies: [{ ...source, name: 'Valid', servername: 'front.example' }, { ...source, ...extra }] });
    }
  }
  rejects({ outbounds: [{ type: 'vless', tag: 'SingBox', server: 'example.com', server_port: 443, uuid, tls: { enabled: true }, transport: { type: 'ws', headers: { Host: 'front.example' } } }] }, /separate TLS and websocket names/);
  rejects(`vless://${uuid}@example.com:443?security=tls&type=ws&host=front.example#URI`, /separate TLS and websocket names/);
  rejects({ proxies: [{ name: 'Trojan', type: 'trojan', server: 'example.com', port: 443, password: 'synthetic-password', network: 'ws', 'ws-opts': { headers: { Host: 'front.example' } } }] }, /separate TLS and websocket names/);
});

test('Clash WSS normalization leaves Trojan, sing-box, URI and TCP ALPN semantics intact', () => {
  const trojan = { name: 'Trojan', type: 'trojan', server: 'example.com', port: 443, password: 'synthetic-password', sni: 'front.example', network: 'ws', 'ws-opts': { headers: { Host: 'front.example' } }, alpn: ['h2'] };
  const singbox = { type: 'vless', tag: 'SingBox', server: 'example.com', server_port: 443, uuid, tls: { enabled: true, server_name: 'front.example', alpn: ['h2'] }, transport: { type: 'ws', headers: { Host: 'front.example' } } };
  for (const input of [
    { proxies: [trojan] }, { outbounds: [singbox] },
    `vless://${uuid}@example.com:443?security=tls&type=ws&host=front.example&sni=front.example&alpn=h2#URI`,
    { proxies: [{ name: 'TCP', type: 'vless', server: 'example.com', port: 443, uuid, tls: true, alpn: ['h2'] }] },
  ]) assert.equal(fields(convert(input))['tls-alpn'], '026832');
});

test('node resources reject executable comment directives atomically through the final bundle', () => {
  const safe = 'Safe = http, proxy.example, 80';
  for (const input of [
    '[Proxy]\n' + safe + '\n#!include https://example.test/ignored',
    '#!REQUIREMENT SYSTEM==\'macOS\'\n[Proxy]\n' + safe,
    '[Proxy]\n' + safe + '\n//!SYSTEM=mac',
    '[Proxy]\n' + safe + ' #!TVOS-ONLY',
    '[General]\n#!MACOS-ONLY\n[Proxy]\n' + safe,
  ]) rejects(input, /unsupported executable directive/);
});

test('ordinary node comments do not consume quoted credentials, URI fragments or native fields', () => {
  const native = 'http=proxy.example:80, username="user #!include", password="pass // #!SYSTEM=mac ; literal", tag=Quoted';
  assert.equal(convert('#!name=ordinary metadata\n# ordinary #!include is documentation\n' + native + ' # ordinary inline comment'), native + ' # ordinary inline comment\n');
  const proxy = '[Proxy]\nSafe = http, proxy.example, 80, username="user #!include", password="pass // #!SYSTEM=mac ; literal"';
  const line = convert(proxy + ' // ordinary inline comment');
  assert.equal(fields(line).username, 'user #!include');
  assert.equal(fields(line).password, 'pass // #!SYSTEM=mac ; literal');
  const uri = 'http://synthetic-user:literal%23%21include@proxy.example:80#Name%20%23%21SYSTEM%3Dmac';
  const parsed = fields(convert(uri));
  assert.equal(parsed.password, 'literal#!include'); assert.equal(parsed.tag, 'Name #!SYSTEM=mac');
});

test('Clash websocket cannot activate Reality ignored by the source VMess or VLESS transport', () => {
  // Mihomo v1.19.33 vmess.go L183-L218 and vless.go L167-L200 do not pass RealityConfig to WSS.
  // Their TCP branches pass RealityConfig at vmess.go L342 and vless.go L306 instead.
  const reality = { 'public-key': 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG', 'short-id': '0123' };
  for (const type of ['vmess', 'vless']) {
    const source = { ...clashWs(type), servername: 'front.example', 'reality-opts': reality };
    rejects({ proxies: [{ ...clashWs(type), name: 'Valid', servername: 'front.example' }, source] }, /Reality.*websocket|websocket.*Reality/);
    const tcp = { name: 'TCP', type, server: 'example.com', port: 443, uuid, tls: true, servername: 'front.example', 'reality-opts': reality };
    assert.equal(fields(convert({ proxies: [tcp] }))['reality-hex-shortid'], '0123');
  }
  assert.equal(fields(convert(`vless://${uuid}@example.com:443?security=reality&pbk=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&sid=0123&type=ws&host=front.example&sni=front.example#URI`))['reality-hex-shortid'], '0123');
});

test('native node fields and URI tags retain unquoted comment-like literal text', () => {
  for (const marker of ['//', '#', ';']) {
    for (const native of [
      `http=proxy.example:80, tag=Safe, password=literal ${marker} secret`,
      `http=proxy.example:80, username=literal ${marker} user, tag=Safe`,
      `http=proxy.example:80, password=synthetic-password, tag=Safe ${marker} tag`,
    ]) assert.equal(convert(native), native + '\n');
    const uri = `http://synthetic-user:literal%20%2F%2F%20secret@proxy.example:80#Safe ${marker} tag`;
    const parsed = fields(convert(uri));
    assert.equal(parsed.password, 'literal // secret'); assert.equal(parsed.tag, `Safe ${marker} tag`);
  }
  const surge = fields(convert('[Proxy]\nhttp = http, proxy.example, 80, username=user, password=literal # ordinary comment'));
  assert.equal(surge.tag, 'http'); assert.equal(surge.password, 'literal');
  for (const directive of ['#!IOS-ONLY', '//!SYSTEM=mac']) {
    const data = 'http=proxy.example:80, tag=Safe, password=literal ' + directive;
    assert.equal(convert(data), data + '\n', 'native value tails are data, not executable comments');
    rejects(directive + '\nhttp=proxy.example:80, tag=Safe', /unsupported executable directive/);
  }
  assert.equal(fields(convert('http=proxy.example:80, tag=Safe #!IOS-ONLY')).tag, 'Safe #!IOS-ONLY');
});
