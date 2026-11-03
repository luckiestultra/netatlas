import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseGeoResponse, formatQuantumultX } from '../../src/features/geoip/core.mjs';
import { renderGeoIPScript } from '../../tools/lib/geoip.mjs';

// Original IP-API.js passes data.timezone, ASN and query to its subtitle helper.
// The unrelated organization below prevents a carrier label masquerading as a timezone test.
// Source snapshot: I-am-R-E/Functional-Store-Hub@6ddebd526ed0a7598bd2def84452b76d85fcf1ba,
// GeoLocationChecker/QuantumultX/IP-API.js; original full script was replayed in an isolated VM.
const fixture = (extra = {}) => ({ success: true, ip: '198.51.100.174', country_code: 'US',
  country: 'United States', region: 'California', city: 'Los Angeles',
  connection: { asn: 6079, org: 'FLUX TELECOM EXAMPLE' }, timezone: { id: 'America/Los_Angeles' }, ...extra });
const response = body => ({ statusCode: 200, body: JSON.stringify(body) });
const card = extra => formatQuantumultX(parseGeoResponse(response(fixture(extra))));

test('screenshot label comes from the timezone and never from the unrelated organization', () => {
  const result = card();
  assert.equal(result.subtitle, 'AMERICA · AS6079 · 198.51.100.174');
  assert.doesNotMatch(result.subtitle, /FLUX|…/);
  assert.match(result.description, /运营商: FLUX TELECOM EXAMPLE/);
  assert.match(result.description, /时区: America\/Los_Angeles/);
});

test('the generated script preserves timezone semantics and its single final return', () => {
  const context = vm.createContext({ $response: response(fixture()), Intl: undefined });
  vm.runInContext('var calls=0,captured;var $done=function(value){calls++;captured=value;return value;}', context);
  const result = vm.runInContext(renderGeoIPScript('quantumultX'), context, { timeout: 1000 });
  assert.equal(result.subtitle, 'AMERICA · AS6079 · 198.51.100.174');
  assert.equal(context.calls, 1); assert.equal(result, context.captured);
});

test('missing timezone never substitutes the carrier or infers a timezone from the country', () => {
  assert.equal(card({ timezone: undefined }).subtitle, 'AS6079 · 198.51.100.174');
});

test('complete timezone, final component and preceding component are tried in source order', () => {
  assert.equal(card({ timezone: { id: 'Asia/Tokyo' } }).subtitle, 'ASIA/TOKYO · AS6079 · 198.51.100.174');
  assert.equal(card({ timezone: { id: 'America/Los_Angeles' }, ip: '203.0.113.10' }).subtitle, 'LOS ANGELES · AS6079 · 203.0.113.10');
  assert.equal(card({ timezone: { id: 'Etc/UTC' } }).subtitle, 'ETC/UTC · AS6079 · 198.51.100.174');
  assert.equal(card({ timezone: { id: 'America/New_York' } }).subtitle, 'NEW YORK · AS6079 · 198.51.100.174');
  assert.equal(card({ timezone: { id: 'America/Argentina/Buenos_Aires' } }).subtitle, 'AS6079 · 198.51.100.174');
  assert.equal(card({ timezone: { id: 'A'.repeat(40) } }).subtitle, 'AS6079 · 198.51.100.174');
});

test('carrier changes cannot alter the timezone label and remain available only in details', () => {
  for (const org of ['AMERICA', 'FLUX TELECOM EXAMPLE', '网络名称特别长', '12345678😀😀 Network', 'A\u2028B\u2029C']) {
    const result = card({ connection: { asn: 6079, org } });
    assert.equal(result.subtitle, 'AMERICA · AS6079 · 198.51.100.174');
    assert.ok(result.description.includes(org));
  }
});

test('all timezone-bearing provider structures use timezone rather than organization', () => {
  const fixtures = [
    { status: 'success', query: '198.51.100.174', countryCode: 'US', timezone: 'America/Los_Angeles', as: 'AS6079 EXAMPLE NETWORK', org: 'OTHER ORGANIZATION' },
    { ip: '198.51.100.174', country: 'US', timezone: 'America/Los_Angeles', org: 'AS6079 OTHER ORGANIZATION' },
    { ip: '198.51.100.174', country_code: 'US', timezone: 'America/Los_Angeles', asn: 'AS6079', as_name: 'OTHER ORGANIZATION' },
    fixture(),
  ];
  for (const input of fixtures) assert.equal(formatQuantumultX(parseGeoResponse(response(input))).subtitle, 'AMERICA · AS6079 · 198.51.100.174');
  const withoutTimezone = { ip: '198.51.100.174', country_code: 'US', country_name: 'United States', asn: 6079, as_desc: 'OTHER ORGANIZATION' };
  assert.equal(formatQuantumultX(parseGeoResponse(response(withoutTimezone))).subtitle, 'AS6079 · 198.51.100.174');
});

test('missing ASN, long IPv6 and full component boundaries never lose the complete IP', () => {
  assert.equal(card({ connection: { org: 'OTHER ORGANIZATION' }, timezone: { id: 'UTC' } }).subtitle, 'UTC · 198.51.100.174');
  const ip = '2001:db8:1234:5678:90ab:cdef:1234:5678';
  assert.equal(card({ ip }).subtitle, ip);
  const exact = card({ timezone: { id: 'Asia/Tokyo' } });
  assert.equal(exact.subtitle.length, 36);
  assert.equal(card({ timezone: { id: 'Asia/TokyoX' } }).subtitle, 'TOKYOX · AS6079 · 198.51.100.174');
});

test('display normalization and source length limits never split lines or valid emoji', () => {
  const result = card({ timezone: { id: 'A\u2028B\u2029C' } });
  assert.equal(result.subtitle, 'A B C · AS6079 · 198.51.100.174');
  const normalized = parseGeoResponse(response(fixture({ connection: { asn: 6079, org: 'a'.repeat(299) + '😀' } })));
  assert.ok(normalized.organization.isWellFormed());
  assert.ok(formatQuantumultX(normalized).description.isWellFormed());
});
