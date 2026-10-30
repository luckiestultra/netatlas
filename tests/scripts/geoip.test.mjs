import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  diagnoseHttpResponse,
  formatQuantumultX,
  formatSurgePanel,
  parseGeoResponse,
} from '../../src/features/geoip/core.mjs';

const response = (body, statusCode = 200) => ({
  statusCode,
  body: typeof body === 'string' ? body : JSON.stringify(body),
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
  assert.match(formatQuantumultX(result).title, /🇬🇧.*Oxford/);
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
  assert.match(formatQuantumultX(result).title, /New Zealand/);
  assert.doesNotMatch(JSON.stringify(formatQuantumultX(result)), /undefined|null|高谭|Cross-GFW/);
});

test('ip-api empty AS data does not throw and ISP remains visible', () => {
  const result = parseGeoResponse(response({
    status: 'success', query: '203.0.113.30', countryCode: 'FR',
    country: 'France', city: 'Lyon', as: '', isp: 'Example Transit', org: '',
  }));
  assert.equal(result.state, 'ok');
  assert.equal(result.asn, '');
  assert.equal(result.country, 'France');
  assert.equal(result.organization, 'Example Transit');
  assert.match(formatQuantumultX(result).subtitle, /Example Transit/);
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
