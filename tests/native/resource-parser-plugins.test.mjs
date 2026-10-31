import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { testResourceParserPlugins } from '../../tools/lib/resource-parser-plugin-flow.mjs';

test('Mihomo SS-over-WS matches the final parser bundle for literal paths and source Host defaults', {
  skip: process.env.PROXY_ATLAS_NATIVE_INTEGRATION !== '1', timeout: 30_000,
}, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const result = await testResourceParserPlugins({ root, binaries: { mihomo: path.join(root, '.cache/bin/mihomo') } });
  assert.equal(result.status, 'passed');
  assert.equal(result.cases.length, 3);
  assert.equal(result.cases.find(item => item.id === 'source-default-host').upgrades[0].host, 'bing.com');
  assert.equal(result.cases.find(item => item.id === 'literal-semicolon-tls').upgrades[0].path, '/ws;tls');
  assert.equal(result.cases.find(item => item.id === 'literal-semicolon-equals').upgrades[0].path, '/ws;version=2');
  assert.ok(result.cases.every(item => item.status === 'passed' && item.result.status === 200 && item.decryptedRequest.startsWith('GET /proof HTTP/1.1')));
  assert.equal(result.nativeQx, 'not-run');
});
