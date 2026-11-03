import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseGeoResponse, formatQuantumultX } from '../../src/features/geoip/core.mjs';
import { renderFeatures } from '../../tools/lib/features.mjs';

const response = data => ({ statusCode: 200, body: JSON.stringify(data) });
const japan = (extra = {}) => ({
  ip: '203.0.113.10', success: true, country_code: 'JP', country: 'Japan',
  region: '东京都', city: '东京', connection: { asn: 64500, org: 'Example' },
  timezone: { id: 'Asia/Tokyo' }, ...extra,
});

test('QX title shows a compact Chinese location while the second line retains the full IP', () => {
  const result = parseGeoResponse(response(japan()));
  const card = formatQuantumultX(result);
  assert.equal(card.title, '🇯🇵 日本 东京');
  assert.equal(card.subtitle, 'ASIA/TOKYO · AS64500 · 203.0.113.10');
  assert.equal(card.ip, '203.0.113.10');
  assert.match(card.description, /州\/省: 东京都/);
  assert.match(card.description, /城市: 东京/);
  assert.match(card.description, /时区: Asia\/Tokyo/);
  assert.doesNotMatch(card.title, /203\.0\.113\.10|Asia\/Tokyo/);
  assert.doesNotMatch(card.subtitle, /★|Asia\/Tokyo|东京都/);
});

test('California has a short display label without changing provider location data', () => {
  const result = parseGeoResponse(response({
    status: 'success', query: '203.0.113.11', countryCode: 'US', country: 'United States',
    regionName: 'California', city: 'Los Angeles', as: 'AS64500 Example',
  }));
  const card = formatQuantumultX(result);
  assert.equal(card.title, '🇺🇸 美国 加州 洛杉矶');
  assert.ok(card.subtitle.endsWith('203.0.113.11'));
  assert.equal(result.region, 'California');
  assert.match(card.description, /州\/省: 加利福尼亚州/);
});

test('provider names stay in details while timezone, ASN and IPv4 form the network line', () => {
  const organization = 'A very long provider organization with all its legal suffixes';
  const result = parseGeoResponse(response(japan({ connection: { asn: 64500, org: organization } })));
  const card = formatQuantumultX(result);
  assert.ok(card.subtitle.length <= 36);
  assert.equal(card.subtitle, 'ASIA/TOKYO · AS64500 · 203.0.113.10');
  assert.ok(card.subtitle.endsWith(result.ip));
  assert.ok(card.description.includes(organization));
  assert.equal(card.subtitle.split(result.ip).length - 1, 1);
});

test('Unicode organization text stays in details without changing the timezone line', () => {
  const organization = 'a'.repeat(9) + '😀 Organization Unlimited';
  const card = formatQuantumultX(parseGeoResponse(response(japan({
    connection: { asn: 64500, org: organization },
  }))));
  assert.equal(card.subtitle, 'ASIA/TOKYO · AS64500 · 203.0.113.10');
  assert.ok(card.description.includes(organization));
  assert.ok(card.subtitle.isWellFormed());
});

test('long IPv6 retains its complete address by moving network metadata into details', () => {
  const address = '2001:db8:1234:5678:90ab:cdef:1234:5678';
  const card = formatQuantumultX(parseGeoResponse(response(japan({ ip: address }))));
  assert.equal(card.subtitle, address);
  assert.equal(card.ip, address);
  assert.ok(card.description.includes(address));
  assert.match(card.description, /AS64500/);
  assert.doesNotMatch(card.title, /2001:db8/);
});

test('compact location labels do not invent absent cities or duplicate country names', () => {
  const result = parseGeoResponse(response(japan({ city: null })));
  assert.equal(formatQuantumultX(result).title, '🇯🇵 日本 东京');
  assert.equal(result.city, '');
  assert.doesNotMatch(formatQuantumultX(result).description, /城市:/);
  const hongKong = parseGeoResponse(response({
    ip: '203.0.113.12', success: true, country_code: 'HK', country: 'Hong Kong',
    region: 'Hong Kong', city: 'Hong Kong',
  }));
  assert.equal(formatQuantumultX(hongKong).title, '🇭🇰 香港');
});

test('the generated QX script keeps the native final-return contract with the compact layout', () => {
  const script = renderFeatures('quantumultX').find(file => file.path === 'scripts/geoip.js').content;
  const context = vm.createContext({ $response: response(japan()), Intl: undefined });
  vm.runInContext('var calls=0;var $done=function(value){calls++;return value;}', context);
  const card = vm.runInContext(script, context, { timeout: 1000 });
  assert.equal(card.title, '🇯🇵 日本 东京');
  assert.equal(card.subtitle, 'ASIA/TOKYO · AS64500 · 203.0.113.10');
  assert.equal(context.calls, 1);
  assert.deepEqual(Object.keys(card).sort(), ['description', 'ip', 'subtitle', 'title']);
});


test('QX network line uses timezone independently of the organization', () => {
  for (const org of ['Example', 'EXAMPLE TRANSIT GMBH', '字宽不同的运营商名称😀']) {
    const card = formatQuantumultX(parseGeoResponse(response(japan({ connection: { asn: 64500, org } }))));
    assert.equal(card.subtitle, 'ASIA/TOKYO · AS64500 · 203.0.113.10');
    assert.ok(card.description.includes(org));
    assert.ok(card.subtitle.length <= 36);
  }
});
