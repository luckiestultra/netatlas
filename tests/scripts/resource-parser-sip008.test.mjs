import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseResource, completeResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';

// SIP008: https://shadowsocks.org/doc/sip008.html
// id is server-update metadata; it is not a protocol credential.
const id = '27b8a625-4f4b-4428-9f0f-8a2317db7c79';
const server = {
  id, remarks: 'SIP008 example', server: 'example.com', server_port: 8388,
  password: 'example', method: 'chacha20-ietf-poly1305',
};
const envelope = (servers = [server], version = 1) => ({ version, servers });
const convert = document => parseResource({ content: JSON.stringify(document), type: 'server' });
const expected = 'shadowsocks=example.com:8388, method=chacha20-ietf-poly1305, password=example, tag=SIP008 example\n';

test('SIP008 v1 validates server UUID metadata without emitting it as a credential', () => {
  const document = envelope();
  assert.equal(convert(document).content, expected);
  assert.equal(createNodeParser().parseNodes(document), expected);
  assert.equal(document.servers[0].id, id, 'direct object input metadata must not be mutated');
  assert.doesNotMatch(convert(document).content, new RegExp(id));
  const { id: _metadata, ...withoutId } = server;
  assert.equal(convert(envelope([withoutId])).content, expected, 'existing missing-id compatibility remains available');
  assert.equal(convert({ servers: [withoutId] }).content, expected, 'unversioned existing servers format remains available');
  assert.match(convert(envelope([{ ...withoutId, udp: true }])).content, /udp-relay=true/, 'known fields in existing missing-id servers remain supported');
});

test('SIP008 UUID metadata is accepted only in a version-1 servers envelope', () => {
  for (const version of [0, 2, '1', null]) {
    assert.throws(() => convert(envelope([server], version)), /SIP008 version/);
    const { id: _metadata, ...withoutId } = server;
    assert.throws(() => convert(envelope([withoutId], version)), /SIP008 version/);
  }
  assert.throws(() => convert({ servers: [server] }), /unsupported field/);
  const clash = { name: 'Clash', type: 'ss', server: server.server, port: server.server_port, cipher: server.method, password: server.password, id };
  for (const document of [{ proxies: [clash] }, { nodes: [clash] }, [clash]]) assert.throws(() => convert(document), /unsupported field/);
  assert.throws(() => convert({ ...envelope([server, { ...server, type: 'direct' }]), outbounds: [] }), /unsupported field/, 'unselected root fields must not bypass SIP008 server validation');
  const vmess = convert({ proxies: [{ name: 'VMess', type: 'vmess', server: 'example.com', port: 80, id }] }).content;
  assert.match(vmess, new RegExp('password=' + id), 'VMess id remains a protocol credential');
});

test('SIP008 malformed UUIDs and unknown connection options fail atomically', () => {
  const invalid = ['', 'not-a-uuid', 123, null, {}, '27b8a625-4f4b-4428-9f0f-8a2317db7c7'];
  for (const value of invalid) assert.throws(() => convert(envelope([{ ...server, id: value }])), /UUID|scalar|field/);
  for (const extra of [{ tls: true }, { 'skip-cert-verify': true }, { uuid: id }, { type: 'http' }, { 'unknown-security': true }]) {
    const results = [];
    completeResource({ content: JSON.stringify(envelope([server, { ...server, remarks: 'Invalid', ...extra }])), type: 'server' }, result => results.push(result));
    assert.equal(results.length, 1);
    assert.deepEqual(Object.keys(results[0]), ['error']);
    assert.doesNotMatch(results[0].error, /example\.com|password|27b8a625/);
  }
});

test('the standalone QX resource bundle accepts SIP008 metadata and preserves atomic errors', () => {
  const script = bundleResourceParser();
  for (const [document, success] of [[envelope(), true], [envelope([{ ...server, id: 'invalid' }]), false], [envelope([server], 2), false]]) {
    const results = [];
    vm.runInNewContext(script, {
      $resource: { content: JSON.stringify(document), type: 'server' },
      $done: result => results.push(result),
      URL: undefined, Buffer: undefined, atob: undefined, TextDecoder: undefined,
    }, { timeout: 3000 });
    assert.equal(results.length, 1);
    assert.deepEqual(Object.keys(results[0]), [success ? 'content' : 'error']);
    if (success) assert.equal(results[0].content, expected);
  }
});
