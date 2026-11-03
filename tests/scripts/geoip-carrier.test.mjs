import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseGeoResponse, formatQuantumultX } from '../../src/features/geoip/core.mjs';
import { renderGeoIPScript } from '../../tools/lib/geoip.mjs';

const fixture = (connection = { asn: 6079, org: 'AMERICA' }, ip = '203.0.113.74') => ({
  statusCode: 200, body: JSON.stringify({ success: true, ip, country_code: 'US',
    country: 'United States', region: 'California', city: 'Los Angeles', connection }),
});

test('screenshot-shaped GeoIP retains the short carrier before ASN and the complete IPv4', () => {
  const result = parseGeoResponse(fixture());
  const card = formatQuantumultX(result);
  assert.equal(card.title, '🇺🇸 美国 加州 洛杉矶');
  assert.equal(card.subtitle, 'AMERICA · AS6079 · 203.0.113.74');
  assert.equal(card.ip, result.ip);
  assert.match(card.description, /运营商: AMERICA/);
});

test('actual generated QX script returns the carrier and the same single completion object', () => {
  const context = vm.createContext({ $response: fixture(), Intl: undefined });
  vm.runInContext('var calls=0,captured;var $done=function(value){calls++;captured=value;return value;}', context);
  const card = vm.runInContext(renderGeoIPScript('quantumultX'), context, { timeout: 1000 });
  assert.equal(card.subtitle, 'AMERICA · AS6079 · 203.0.113.74');
  assert.equal(context.calls, 1);
  assert.equal(card, context.captured);
});

test('missing organization never invents a country label or empty carrier segment', () => {
  const card = formatQuantumultX(parseGeoResponse(fixture({ asn: 6079 })));
  assert.equal(card.subtitle, 'AS6079 · 203.0.113.74');
});

test('organization without ASN is shown without fabricating a network number', () => {
  const card = formatQuantumultX(parseGeoResponse(fixture({ org: 'AMERICA' })));
  assert.equal(card.subtitle, 'AMERICA · 203.0.113.74');
});

test('long and wide carrier labels shorten only the carrier and keep one complete IP', () => {
  for (const org of ['A very long network organization with legal suffixes', '网络运营商名称特别长', '12345678😀😀 Network']) {
    const result = parseGeoResponse(fixture({ asn: 6079, org }));
    const card = formatQuantumultX(result);
    assert.ok(card.subtitle.endsWith(' · AS6079 · ' + result.ip));
    assert.ok(card.subtitle.includes('…'));
    assert.ok(card.subtitle.length <= 36);
    assert.ok(card.subtitle.isWellFormed());
    assert.equal(card.subtitle.split(result.ip).length - 1, 1);
    assert.ok(card.description.includes(org));
  }
});

test('carrier boundaries preserve exact fitting labels and never add empty segments', () => {
  const card = formatQuantumultX(parseGeoResponse(fixture({ asn: 6079, org: '123456789012' })));
  assert.equal(card.subtitle, '123456789012 · AS6079 · 203.0.113.74');
});

test('carrier display folds visual line separators while details preserve its value', () => {
  const card = formatQuantumultX(parseGeoResponse(fixture({ asn: 6079, org: 'A\u2028B\u2029C' })));
  assert.equal(card.subtitle, 'A B C · AS6079 · 203.0.113.74');
  assert.doesNotMatch(card.subtitle, /[\r\n\u2028\u2029]/);
});

test('normalized provider limits never cut a valid emoji surrogate pair in half', () => {
  const result = parseGeoResponse(fixture({ asn: 6079, org: 'a'.repeat(299) + '😀' }));
  assert.ok(result.organization.isWellFormed());
  assert.ok(formatQuantumultX(result).description.isWellFormed());
});
