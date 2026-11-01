import assert from 'node:assert/strict';
import test from 'node:test';
import { materializeSubscription } from '../../tools/lib/private-profile.mjs';

const uuid = '7c9a3d20-44b0-493e-90d2-9b219674d04c';
const source = extra => ({ name: 'WSS', type: 'vless', server: '192.0.2.10', port: 443, uuid, tls: true, network: 'ws', 'ws-opts': { path: '/secured', headers: { Host: 'front.example.test' } }, ...extra });
const convert = node => materializeSubscription('singBox', JSON.stringify({ proxies: [node] }))[0];

for (const type of ['vless', 'vmess']) {
  test(`Clash ${type} WSS preserves source Host fallback SNI and HTTP/1.1 ALPN`, () => {
    const node = convert(source({ type, alpn: ['h2'] }));
    assert.equal(node.tls.server_name, 'front.example.test');
    assert.deepEqual(node.tls.alpn, ['http/1.1']);
    assert.equal(node.transport.headers.Host, 'front.example.test');
    assert.equal(node.server, '192.0.2.10');
    assert.equal(node.uuid, uuid);
  });
}

test('WSS preserves explicit TLS server name separately from its HTTP Host', () => {
  const node = convert(source({ servername: 'tls.example.test' }));
  assert.equal(node.tls.server_name, 'tls.example.test');
  assert.equal(node.transport.headers.Host, 'front.example.test');
  assert.deepEqual(node.tls.alpn, ['http/1.1']);
  const lower = convert(source({ 'ws-opts': { headers: { host: 'lower.example.test' } } }));
  assert.equal(lower.tls.server_name, 'lower.example.test');
});

test('non-WS ALPN and cleartext WS stay unchanged; source-ignored WS Reality cannot be activated', () => {
  const tcp = convert(source({ network: 'tcp', alpn: ['h2'] }));
  assert.deepEqual(tcp.tls.alpn, ['h2']);
  const cleartext = convert(source({ tls: false }));
  assert.equal(cleartext.tls, undefined);
  const reality = { 'public-key': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'short-id': 'aabb' };
  assert.throws(() => convert(source({ 'reality-opts': reality })), /Reality|native sing-box/i);
  assert.throws(() => convert(source({ tls: false, 'reality-opts': reality })), /Reality|native sing-box/i);
});


test('case-insensitive duplicate WebSocket Host headers cannot choose an arbitrary TLS name', () => {
  for (const headers of [{ Host: 'one.example.test', host: 'two.example.test' }, { HOST: 'same.example.test', Host: 'same.example.test' }]) {
    assert.throws(() => convert(source({ 'ws-opts': { headers } })), /ambiguous|duplicate.*Host/i);
  }
});


test('Mihomo VMess/VLESS WSS does not activate an ignored sni alias over WS Host', () => {
  for (const type of ['vless', 'vmess']) {
    assert.equal(convert(source({ type, sni: 'ignored.example.test' })).tls.server_name, 'front.example.test');
  }
});
