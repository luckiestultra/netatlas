import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { testNativeDatabaseRouting } from '../../tools/lib/native.mjs';

test('Mihomo routes real HTTP/SOCKS by ASN and GeoIP MMDB lookups and changes after live database refresh', {
  skip: process.env.PROXY_ATLAS_NATIVE_INTEGRATION !== '1', timeout: 60_000,
}, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const result = await testNativeDatabaseRouting({ root, binaries: { mihomo: path.join(root, '.cache/bin/mihomo') } });
  assert.equal(result.status, 'passed');
  assert.equal(result.cases.length, 8);
  assert.equal(result.updates.length, 3);
  assert.equal(result.cases.filter(item => item.behavior === 'asn-before-country').length, 2);
  assert.equal(result.cases.filter(item => item.behavior === 'country-after-asn-miss').length, 2);
  assert.equal(result.cases.filter(item => item.behavior === 'asn-and-country-miss').length, 2);
  assert.equal(result.cases.filter(item => item.behavior === 'asn-independent-of-country').length, 2);
  assert.equal(result.databaseRequests.filter(item => item.path === '/country.mmdb').length, 4);
  assert.equal(result.databaseRequests.filter(item => item.path === '/asn.mmdb').length, 4);
});
