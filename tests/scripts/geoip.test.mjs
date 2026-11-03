import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  createGeoIP,
  diagnoseHttpResponse,
  formatQuantumultX,
  formatSurgePanel,
  parseGeoResponse,
} from '../../src/features/geoip/core.mjs';

const response = (body, statusCode = 200) => ({
  statusCode,
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('every standalone country label matches the pinned Unicode CLDR projection without rewriting provider data', () => {
  const projection = JSON.parse(readFileSync(new URL('../../src/features/geoip/localization/territories-zh.json', import.meta.url), 'utf8'));
  assert.equal(projection.license, 'Unicode-3.0');
  assert.equal(projection.revision, 'acd6d88ae493633240e19a87a721076a8a75c310');
  assert.equal(Object.keys(projection.labels).length, 264);
  for (const [code, name] of Object.entries(projection.labels)) {
    const result = parseGeoResponse(response({
      ip: '203.0.113.85', country_code: code, country_name: 'Provider country name', city_name: null,
    }));
    assert.ok(formatQuantumultX(result).title.includes(name), code + ' must display ' + name);
    assert.equal(result.country, 'Provider country name');
    assert.equal(result.countryCode, code);
  }
});

test('the actual QX adapter runs standalone with no Intl, imports or network access and retains the full IP', () => {
  const adapter = readFileSync(new URL('../../src/features/geoip/quantumultX.js', import.meta.url), 'utf8');
  const script = 'var AtlasGeoIP = (' + createGeoIP.toString() + ')();\n' + adapter;
  for (const address of ['203.0.113.80', '2001:db8:abcd:1234::80']) {
    const results = [];
    vm.runInNewContext(script, {
      Intl: undefined,
      $response: response({ ip: address, country_code: 'US', country_name: 'United States', city_name: null, asn: null, as_desc: 'HARA PARTNERS SYSTEMS LLC' }),
      $done: (value) => results.push(value),
    }, { timeout: 1000 });
    assert.equal(results.length, 1);
    assert.match(results[0].title, /🇺🇸 美国/);
    assert.ok(!results[0].title.includes(address));
    assert.equal(results[0].ip, address);
    assert.ok(results[0].subtitle.endsWith(address));
    assert.ok(results[0].description.startsWith('IP: ' + address));
    assert.deepEqual(Object.keys(results[0]).sort(), ['description', 'ip', 'subtitle', 'title']);
  }
});

test('ipwho.is localized nested fields retain region, city, timezone and connection details', () => {
  const result = parseGeoResponse(response({
    ip: '203.0.113.86', success: true, country: '美国', country_code: 'US',
    region: '加利福尼亚州', city: '洛杉矶',
    connection: { asn: 64500, org: 'Example Org', isp: 'Example ISP' },
    timezone: { id: 'America/Los_Angeles', utc: '-07:00' },
  }));
  assert.equal(result.state, 'ok');
  assert.equal(result.source, 'ipwho.is');
  assert.equal(result.countryCode, 'US');
  assert.equal(result.country, '美国');
  assert.equal(result.region, '加利福尼亚州');
  assert.equal(result.city, '洛杉矶');
  assert.equal(result.asn, 'AS64500');
  assert.equal(result.organization, 'Example Org');
  assert.equal(result.timezone, 'America/Los_Angeles');
  const card = formatQuantumultX(result);
  assert.equal(card.title, '🇺🇸 美国 加州 洛杉矶');
  assert.ok(card.subtitle.endsWith('203.0.113.86'));
  assert.match(card.subtitle, /AS64500/);
  assert.match(card.description, /时区: America\/Los_Angeles/);
});

test('ipwho.is errors, missing fields and malformed nested data never imply success', () => {
  for (const success of [false, 'true', 1, null]) {
    const result = parseGeoResponse(response({ ip: '203.0.113.86', success, country_code: 'US', country: '美国', message: 'Invalid IP address' }));
    assert.notEqual(result.state, 'ok');
  }
  const absentSuccess = parseGeoResponse(response({ ip: '203.0.113.86', country: 'United States', country_code: 'US', city: 'Los Angeles', connection: { asn: 64500 }, timezone: { id: 'America/Los_Angeles' } }));
  assert.equal(absentSuccess.source, 'ipwho.is');
  assert.notEqual(absentSuccess.state, 'ok', 'nested ipwho.is cannot bypass success validation as IPinfo Lite');
  const sparse = parseGeoResponse(response({ ip: '203.0.113.87', success: true, country_code: 'JP', country: 'Japan', connection: null, timezone: {} }));
  assert.equal(sparse.state, 'ok');
  assert.equal(sparse.asn, '');
  assert.equal(sparse.region, '');
  assert.equal(sparse.city, '');
  assert.equal(sparse.timezone, '');
  assert.match(formatQuantumultX(sparse).title, /日本/);
  const invalid = parseGeoResponse(response({ ip: '203.0.113.87', success: true, country_code: 'JP', country: 'Japan', connection: { asn: {}, org: ['secret'], isp: 'Example ISP' }, timezone: ['secret'] }));
  assert.equal(invalid.asn, '');
  assert.equal(invalid.organization, 'Example ISP');
  assert.equal(invalid.timezone, '');
  assert.doesNotMatch(JSON.stringify(formatQuantumultX(invalid)), /secret|undefined|null/);
});

test('IPinfo Lite country_code and top-level ASN are distinct from legacy country codes', () => {
  const result = parseGeoResponse(response({ ip: '203.0.113.88', country: 'United States', country_code: 'US', asn: 'AS64500', as_name: 'Example Network' }));
  assert.equal(result.source, 'ipinfo');
  assert.equal(result.state, 'ok');
  assert.equal(result.countryCode, 'US');
  assert.equal(result.country, 'United States');
  assert.equal(result.asn, 'AS64500');
  assert.equal(result.organization, 'Example Network');
  assert.equal(result.city, '');
  assert.match(formatQuantumultX(result).title, /美国/);
});

test('IPinfo Lite optional country fields do not discard the ASN or invent a location', () => {
  const codeOnly = parseGeoResponse(response({ ip: '203.0.113.89', country_code: 'US', asn: 'AS64500', as_name: 'Example Network' }));
  assert.equal(codeOnly.source, 'ipinfo');
  assert.equal(codeOnly.state, 'ok');
  assert.equal(codeOnly.countryCode, 'US');
  assert.equal(codeOnly.country, '');
  assert.equal(codeOnly.asn, 'AS64500');
  assert.match(formatQuantumultX(codeOnly).title, /美国/);
  const nameOnly = parseGeoResponse(response({ ip: '203.0.113.89', country: 'United States', asn: 'AS64500', as_name: 'Example Network' }));
  assert.equal(nameOnly.state, 'ok');
  assert.equal(nameOnly.country, 'United States');
  assert.equal(nameOnly.countryCode, '');
  const pureName = parseGeoResponse(response({ ip: '203.0.113.89', country: 'United States' }));
  assert.equal(pureName.state, 'ok');
  assert.equal(pureName.country, 'United States');
  assert.equal(pureName.countryCode, '');
  for (let fields = 0; fields < 16; fields += 1) {
    const body = { ip: '203.0.113.89' };
    if (fields & 1) body.country_code = 'US';
    if (fields & 2) body.country = 'United States';
    if (fields & 4) body.asn = 'AS64500';
    if (fields & 8) body.as_name = 'Example Network';
    const sparse = parseGeoResponse(response(body));
    assert.equal(sparse.state, fields & 3 ? 'ok' : 'no-data', 'optional-field set ' + fields);
    assert.equal(sparse.country, fields & 2 ? 'United States' : '');
    assert.equal(sparse.countryCode, fields & 1 ? 'US' : '');
    assert.equal(sparse.asn, fields & 4 ? 'AS64500' : '');
    assert.equal(sparse.organization, fields & 8 ? 'Example Network' : '');
    assert.equal(sparse.city, '');
  }
  const asOnly = parseGeoResponse(response({ ip: '203.0.113.89', asn: 'AS64500', as_name: 'Example Network' }));
  assert.equal(asOnly.source, 'ipinfo');
  assert.equal(asOnly.state, 'no-data');
  assert.equal(asOnly.asn, 'AS64500');
  assert.equal(asOnly.organization, 'Example Network');
  assert.equal(asOnly.countryCode, '');
  assert.match(formatQuantumultX(asOnly).description, /ASN: AS64500/);
  assert.doesNotMatch(formatQuantumultX(asOnly).title, /美国|United States/);
});

test('IPinfo normalization preserves the returned location and separates ASN from organization', () => {
  const result = parseGeoResponse(response({
    ip: '192.0.2.10', country: 'GB', region: 'England', city: 'Oxford',
    org: 'AS64500 Example Network', timezone: 'Europe/London',
  }));
  assert.equal(result.state, 'ok');
  assert.equal(result.source, 'ipinfo');
  assert.equal(result.countryCode, 'GB');
  assert.equal(result.city, 'Oxford');
  assert.equal(result.asn, 'AS64500');
  assert.equal(result.organization, 'Example Network');
  assert.match(formatQuantumultX(result).title, /🇬🇧.*英国.*英格兰.*Oxford/);
  assert.match(formatQuantumultX(result).title, /Oxford/);
});

test('ipwho.de response keeps missing city or ASN empty without inventing replacements', () => {
  const result = parseGeoResponse(response({
    ip: '198.51.100.20', country_code: 'NZ', country_name: 'New Zealand',
    city_name: null, asn: null, as_desc: null,
  }));
  assert.equal(result.state, 'ok');
  assert.equal(result.source, 'ipwho.de');
  assert.equal(result.asn, '');
  assert.equal(result.city, '');
  assert.equal(result.organization, '');
  assert.match(formatQuantumultX(result).title, /新西兰/);
  assert.doesNotMatch(JSON.stringify(formatQuantumultX(result)), /undefined|null|高谭|Cross-GFW/);
});

test('the screenshot-shaped ipwho.de payload keeps a compact Chinese title and full IP in the second line', () => {
  const result = parseGeoResponse(response({
    ip: '203.0.113.80', country_code: 'US', country_name: 'United States',
    city_name: null, asn: null, as_desc: 'HARA PARTNERS SYSTEMS LLC',
  }));
  const card = formatQuantumultX(result);
  assert.match(card.title, /🇺🇸.*美国/);
  assert.ok(!card.title.includes('203.0.113.80'));
  assert.ok(card.subtitle.endsWith('203.0.113.80'));
  assert.ok(card.description.startsWith('IP: 203.0.113.80'));
  assert.equal(card.ip, '203.0.113.80');
  assert.equal(result.city, '');
  assert.equal(result.asn, '');
  assert.ok(card.description.includes('HARA PARTNERS SYSTEMS LLC'));
  assert.ok(card.subtitle.length <= 36);
  assert.doesNotMatch(card.title, /United States|加州|洛杉矶/);
});

test('QX location retains country, reported region and reported city with Chinese display labels', () => {
  const result = parseGeoResponse(response({
    status: 'success', query: '203.0.113.81', countryCode: 'US',
    country: 'United States', regionName: 'California', city: 'Los Angeles',
    as: 'AS64500 Example Carrier',
  }));
  const card = formatQuantumultX(result);
  assert.equal(card.title, '🇺🇸 美国 加州 洛杉矶');
  assert.ok(card.subtitle.endsWith('203.0.113.81'));
  assert.match(card.description, /国家\/地区: 美国/);
  assert.match(card.description, /州\/省: 加利福尼亚州/);
  assert.match(card.description, /城市: 洛杉矶/);
  assert.equal(result.country, 'United States', 'source data is not rewritten');
  assert.equal(result.region, 'California');
  assert.equal(result.city, 'Los Angeles');
});

test('unknown cities retain source spelling and missing regions are never inferred from a city', () => {
  const result = parseGeoResponse(response({
    ip: '203.0.113.82', country_code: 'NZ', country_name: 'New Zealand', city_name: 'Fictionvale',
  }));
  const card = formatQuantumultX(result);
  assert.match(card.title, /新西兰/);
  assert.match(card.title, /Fictionvale/);
  assert.equal(result.region, '');
  const la = parseGeoResponse(response({ ip: '203.0.113.83', country_code: 'US', country_name: 'United States', city_name: 'Los Angeles' }));
  assert.match(formatQuantumultX(la).title, /洛杉矶/);
  assert.doesNotMatch(JSON.stringify(formatQuantumultX(la)), /加利福尼亚|加州/);
});

test('known IP remains visible in QX error/no-location cards without implying geolocation succeeded', () => {
  const result = parseGeoResponse(response({ ip: '203.0.113.84', country: null }));
  const card = formatQuantumultX(result);
  assert.match(card.title, /暂无定位.*203\.0\.113\.84/);
  assert.ok(card.subtitle.startsWith('203.0.113.84'));
  assert.ok(card.description.startsWith('IP: 203.0.113.84'));
  assert.equal(result.state, 'no-data');
  assert.match(card.description, /状态: GeoIP 暂无定位/);
  assert.match(card.subtitle, /定位服务未返回可用的位置数据/);
});

test('internal error displays use Chinese labels and messages while provider diagnostics retain their original text', () => {
  for (const [supplied, expected] of [
    [undefined, /网络错误/],
    [response('{broken'), /响应无效/],
    [response('', 429), /查询限流/],
    [response('Forbidden', 403), /HTTP 错误/],
  ]) {
    const card = formatQuantumultX(parseGeoResponse(supplied));
    assert.match(card.title, expected);
    assert.match(card.description, /状态:/);
    assert.doesNotMatch(card.description, /No HTTP|GeoIP service|GeoIP response|unknown/);
  }
  const provider = parseGeoResponse(response({ status: 'fail', message: 'reserved range', query: '192.0.2.1' }));
  assert.equal(provider.message, 'reserved range');
  assert.match(formatQuantumultX(provider).description, /reserved range/);
});

test('ip-api empty AS data does not throw and ISP remains in details', () => {
  const result = parseGeoResponse(response({
    status: 'success', query: '203.0.113.30', countryCode: 'FR',
    country: 'France', city: 'Lyon', as: '', isp: 'Example Transit', org: '',
  }));
  assert.equal(result.state, 'ok');
  assert.equal(result.asn, '');
  assert.equal(result.country, 'France');
  assert.equal(result.organization, 'Example Transit');
  assert.equal(formatQuantumultX(result).subtitle, 'Example Transit · ' + result.ip);
  assert.match(formatQuantumultX(result).description, /Example Transit/);
});

test('ip-api AS text supplies ASN and organization when provider fields are missing', () => {
  const result = parseGeoResponse(response({
    status: 'success', query: '192.0.2.40', countryCode: 'CA',
    country: 'Canada', as: 'AS64501 Example Carrier',
  }));
  assert.equal(result.asn, 'AS64501');
  assert.equal(result.organization, 'Example Carrier');
});

test('IPinfo organization without an AS prefix is usable', () => {
  const result = parseGeoResponse(response({
    ip: '192.0.2.41', country: 'DE', org: 'Example Organization',
  }));
  assert.equal(result.state, 'ok');
  assert.equal(result.asn, '');
  assert.equal(result.organization, 'Example Organization');
});

test('an IP without geographic data is shown as no-data, not a connected-node claim', () => {
  const result = parseGeoResponse(response({ ip: '192.0.2.42', country: null, org: null }));
  assert.equal(result.state, 'no-data');
  assert.equal(result.ip, '192.0.2.42');
  assert.doesNotMatch(formatQuantumultX(result).title, /Node OK|已连接|日本|Tokyo/);
});

test('failed API status stays separate from a network failure', () => {
  const result = parseGeoResponse(response({ status: 'fail', message: 'reserved range', query: '192.0.2.1' }));
  assert.equal(result.state, 'no-data');
  assert.equal(result.message, 'reserved range');
});

test('ip-api data is not accepted unless its own status explicitly reports success', () => {
  const result = parseGeoResponse(response({
    status: 'pending', query: '192.0.2.1', countryCode: 'GB', country: 'United Kingdom',
  }));
  assert.equal(result.state, 'no-data');
});

test('numeric ASN is supported but numeric geographic fields do not become a location', () => {
  const result = parseGeoResponse(response({
    ip: '192.0.2.2', country_code: null, country_name: 42, city_name: 123, asn: 64500,
  }));
  assert.equal(result.state, 'no-data');
  assert.equal(result.asn, 'AS64500');
  assert.equal(result.country, '');
  assert.equal(result.city, '');
});

test('rate limiting is recognized even if the response is HTML', () => {
  const result = parseGeoResponse(response('<html>Too many requests</html>', 429));
  assert.equal(result.state, 'rate-limited');
  assert.equal(result.statusCode, 429);
});

test('explicit API quota messages are recognized independently of HTTP success', () => {
  const result = parseGeoResponse(response({ status: 'fail', message: 'rate limit exceeded', query: '192.0.2.1' }));
  assert.equal(result.state, 'rate-limited');
});

test('HTTP 403 is not automatically mislabeled as rate limiting', () => {
  assert.equal(parseGeoResponse(response('Forbidden', 403)).state, 'http-error');
});

test('malformed JSON and a non-object JSON root are rejected without throwing', () => {
  assert.equal(parseGeoResponse(response('{broken')).state, 'invalid-response');
  assert.equal(parseGeoResponse(response([])).state, 'invalid-response');
  assert.equal(parseGeoResponse(response(null)).state, 'invalid-response');
});

test('empty successful responses and structurally unknown objects contain no location data', () => {
  assert.equal(parseGeoResponse(response('', 204)).state, 'no-data');
  assert.equal(parseGeoResponse(response({ message: 'hello' })).state, 'no-data');
});

test('untrusted field types are not converted to misleading object strings', () => {
  const result = parseGeoResponse(response({
    ip: '192.0.2.43', country: {}, city: ['fake'], org: {}, timezone: {},
  }));
  assert.equal(result.state, 'no-data');
  assert.equal(result.city, '');
  assert.doesNotMatch(JSON.stringify(result), /\[object Object\]/);
});

test('a transport timeout differs from a generic transport error', () => {
  assert.equal(parseGeoResponse(null, { error: 'request timed out' }).state, 'timeout');
  assert.equal(parseGeoResponse(null, { error: 'connection refused' }).state, 'network-error');
  assert.equal(parseGeoResponse(undefined).state, 'network-error');
});

test('invalid IP values cannot produce a successful lookup result', () => {
  assert.equal(parseGeoResponse(response({ ip: 'not-an-ip', country: 'GB' })).state, 'no-data');
  assert.equal(parseGeoResponse(response({ ip: '999.2.3.4', country: 'GB' })).state, 'no-data');
  assert.equal(parseGeoResponse(response({ ip: '2001:db8::10', country: 'SE' })).state, 'ok');
});

test('Surge panel describes the explicitly requested policy without claiming all traffic uses it', () => {
  const result = parseGeoResponse(response({ ip: '192.0.2.44', country: 'CA', org: 'AS64502 Example Carrier' }));
  const panel = formatSurgePanel(result, { policy: 'Proxy' });
  assert.match(panel.content, /Policy: Proxy/);
  assert.match(panel.content, /192\.0\.2\.44/);
  assert.doesNotMatch(panel.content, /all traffic|所有流量|current node/);
});

test('HTTP diagnostics only claim response receipt and never infer total network health', () => {
  assert.deepEqual(diagnoseHttpResponse({ statusCode: 204, body: '' }), {
    state: 'response', statusCode: 204, responseReceived: true,
  });
  assert.equal(diagnoseHttpResponse(null, { error: 'timeout' }).state, 'timeout');
  assert.equal(diagnoseHttpResponse({ statusCode: 429 }).responseReceived, true);
});
