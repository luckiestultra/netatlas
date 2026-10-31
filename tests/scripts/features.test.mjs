import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { renderFeatures } from '../../tools/lib/features.mjs';

const baseUrl = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const files = (client) => new Map(renderFeatures(client, { baseUrl }).map((file) => [file.path, file.content]));
const apiBody = JSON.stringify({
  ip: '192.0.2.10', country_code: 'GB', country_name: 'United Kingdom',
  city_name: 'Oxford', asn: '64500', as_desc: 'Example Network',
});

test('QX native response parser completes once and never performs another network request', () => {
  const script = files('quantumultX').get('scripts/geoip.js');
  const results = [];
  vm.runInNewContext(script, {
    $response: { statusCode: 200, body: apiBody },
    $done: (value) => results.push(value),
  }, { timeout: 1000 });
  assert.equal(results.length, 1);
  assert.equal(results[0].ip, '192.0.2.10');
  assert.match(results[0].title, /英国.*192\.0\.2\.10/);
  assert.match(results[0].subtitle, /Oxford/);
  assert.doesNotMatch(script, /\$task|\$prefs|\$persistentStore|\$surge/);
});

// QX's built-in checker defines $done as an identity function and consumes
// evaluateScript's final value; a side-effect-only callback mock misses this.
test('QX built-in GeoIP returns the final evaluation object consumed by the native host', () => {
  const script = files('quantumultX').get('scripts/geoip.js');
  const cases = [
    { name: 'ipwho', statusCode: 200, body: apiBody, ip: '192.0.2.10', title: /英国/ },
    {
      name: 'ip-api empty ASN', statusCode: 200,
      body: JSON.stringify({ status: 'success', query: '203.0.113.10', countryCode: 'JP', country: '日本', regionName: '东京都', city: '东京', as: '', isp: 'Example Network' }),
      ip: '203.0.113.10', title: /日本/,
    },
    {
      name: 'ipinfo IPv6', statusCode: 200,
      body: JSON.stringify({ ip: '2001:db8::10', country: 'US', city: 'Los Angeles', org: 'AS64500 Example Network' }),
      ip: '2001:db8::10', title: /美国/,
    },
    { name: 'invalid JSON', statusCode: 200, body: '{broken', ip: '', title: /响应无效/ },
    { name: 'rate limit', statusCode: 429, body: '', ip: '', title: /查询限流/ },
    { name: 'absent response', ip: '', title: /网络错误/ },
  ];
  for (const fixture of cases) {
    const supplied = fixture.statusCode ? { statusCode: fixture.statusCode, body: fixture.body } : undefined;
    const context = vm.createContext({ $response: supplied });
    vm.runInContext('var $done = function(result) {return result}', context);
    const result = vm.runInContext(script, context, { timeout: 1000 });
    assert.equal(typeof result, 'object', fixture.name + ' must yield the object, not undefined');
    assert.notEqual(result, null, fixture.name);
    assert.deepEqual(Object.keys(result).sort(), ['description', 'ip', 'subtitle', 'title'], fixture.name);
    for (const field of ['description', 'ip', 'subtitle', 'title']) assert.equal(typeof result[field], 'string', fixture.name + ': ' + field);
    assert.equal(result.ip, fixture.ip, fixture.name);
    assert.match(result.title, fixture.title, fixture.name);
    if (fixture.ip) {
      assert.ok(result.title.includes(fixture.ip), fixture.name);
      assert.ok(result.subtitle.includes(fixture.ip), fixture.name);
    }
  }
});

test('QX native parser also completes once with absent response and malformed JSON', () => {
  for (const supplied of [undefined, { statusCode: 200, body: '{broken' }, { statusCode: 429, body: '' }]) {
    const results = [];
    vm.runInNewContext(files('quantumultX').get('scripts/geoip.js'), {
      $response: supplied, $done: (value) => results.push(value),
    }, { timeout: 1000 });
    assert.equal(results.length, 1);
    assert.equal(typeof results[0].title, 'string');
    assert.doesNotMatch(JSON.stringify(results[0]), /undefined|高谭|Cross-GFW/);
  }
});

test('Surge panel uses one explicit existing policy without reading or changing client state', () => {
  const script = files('surge').get('scripts/geoip.js');
  const results = [];
  let requested;
  let callback;
  let timeout;
  vm.runInNewContext(script, {
    $argument: 'Proxy',
    $httpClient: { get: (options, done) => { requested = options; callback = done; } },
    $done: (value) => results.push(value),
    setTimeout: (handler) => { timeout = handler; },
  }, { timeout: 1000 });
  assert.equal(requested.url, 'https://ipinfo.io/json');
  assert.equal(requested.policy, 'Proxy');
  callback(null, { status: 200 }, JSON.stringify({ ip: '192.0.2.10', country: 'GB', org: 'AS64500 Example Network' }));
  timeout();
  assert.equal(results.length, 1);
  assert.match(results[0].content, /Policy: Proxy/);
  assert.doesNotMatch(script, /\$prefs|\$persistentStore|\$surge|\$httpAPI/);
});

test('Surge timeout returns a result once even if a late response arrives', () => {
  const results = [];
  let callback;
  let timeout;
  vm.runInNewContext(files('surge').get('scripts/geoip.js'), {
    $argument: 'Proxy',
    $httpClient: { get: (_options, done) => { callback = done; } },
    $done: (value) => results.push(value),
    setTimeout: (handler) => { timeout = handler; },
  }, { timeout: 1000 });
  timeout();
  callback(null, { status: 200 }, JSON.stringify({ ip: '192.0.2.10', country: 'GB' }));
  assert.equal(results.length, 1);
  assert.match(results[0].title, /超时/);
});

test('Surge synchronous HTTP-client failure produces an error panel instead of an uncaught exception', () => {
  const results = [];
  vm.runInNewContext(files('surge').get('scripts/geoip.js'), {
    $httpClient: { get: () => { throw new Error('transport unavailable'); } },
    $done: (value) => results.push(value),
    setTimeout: () => {},
  }, { timeout: 1000 });
  assert.equal(results.length, 1);
  assert.match(results[0].title, /网络错误/);
});

test('feature URLs use the requested public base, including a trailing slash', () => {
  const qx = files('quantumultX');
  assert.match(qx.get('fragments/geoip.conf'), /geo_location_checker=http:\/\/ipwho\.de\/json, https:\/\/raw\.githubusercontent\.com\/luckiestultra\/netatlas\/main\/clients\/quantumultX\/scripts\/geoip\.js/);
  const surge = files('surge');
  assert.match(surge.get('modules/geoip.sgmodule'), /script-path=https:\/\/raw\.githubusercontent\.com\/luckiestultra\/netatlas\/main\/clients\/surge\/scripts\/geoip\.js/);
  assert.deepEqual(renderFeatures('surge', { baseUrl: baseUrl + '/' }), renderFeatures('surge', { baseUrl }));
});

test('local Surge script path resolves relative to the generated main profile directory', () => {
  const module = renderFeatures('surge', {}).find((file) => file.path === 'modules/geoip.sgmodule');
  assert.match(module.content, /script-path=\.\.\/scripts\/geoip\.js/);
  assert.equal(new URL('../scripts/geoip.js', 'file:///clients/surge/profiles/default.conf').pathname, '/clients/surge/scripts/geoip.js');
});

test('public script URLs cannot inject native module options or configuration lines', () => {
  for (const baseUrl of ['https://example.test/a,timeout=1', 'https://example.test/a\n[Script]', 'https://user:secret@example.test/a', 'https://example.test/a?token=hidden']) {
    assert.throws(() => renderFeatures('surge', { baseUrl }), /baseUrl/);
    assert.throws(() => renderFeatures('quantumultX', { baseUrl }), /baseUrl/);
  }
});

test('unsupported GeoIP targets do not emit placeholder scripts or GeoIP modules', () => {
  for (const client of ['loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']) {
    const paths=renderFeatures(client,{baseUrl}).map(file=>file.path);
    assert.ok(!paths.includes('scripts/geoip.js'));
    assert.ok(!paths.includes('modules/geoip.sgmodule'));
    assert.ok(!paths.includes('fragments/geoip.conf'));
    assert.ok(paths.some(path=>path.includes('anti-ad')));
  }
  assert.throws(() => renderFeatures('not-a-client', { baseUrl }), /client/i);
});

test('native search rewrite outputs live in rewrites and preserve the encoded search term', () => {
  const url = 'https://www.bing.com/search?q=cats%20%26%20dogs&form=QBLH';
  const expected = 'https://www.google.com/search?q=cats%20%26%20dogs';
  for (const [client, path] of [
    ['quantumultX', 'rewrites/search-redirect.snippet'],
    ['surge', 'rewrites/search-redirect.sgmodule'],
  ]) {
    const artifacts = files(client);
    const artifact = artifacts.get(path);
    assert.ok(artifact);
    assert.equal([...artifacts.keys()].some((entry) => entry.startsWith('modules/search-redirect')), false);
    const rule = artifact.split('\n').find((line) => line.startsWith('^https'));
    const [pattern, second, third, fourth] = rule.split(' ');
    const replacement = client === 'quantumultX' ? fourth : second;
    assert.equal(third, '302');
    const expression = new RegExp(pattern);
    assert.equal(url.replace(expression, replacement), expected);
    assert.equal(expression.test('https://evil.example/search?q=test'), false);
    assert.equal(expression.test('https://www.bing.com/search?form=first&q=test'), false);
  }
});

test('feature metadata names native adapters and explicitly separates VM verification from native-app verification', () => {
  const metadata = JSON.parse(readFileSync(new URL('../../metadata/features.json', import.meta.url), 'utf8'));
  assert.equal(metadata.version, 1);
  assert.ok(metadata.features.find((feature) => feature.id === 'geoip'));
  assert.ok(metadata.features.find((feature) => feature.id === 'search-redirect'));
  for (const feature of metadata.features) {
    assert.equal(feature.validation.nativeApp, 'not-run');
    assert.ok(feature.sources.every((source) => /^https:\/\//.test(source)));
  }
});
