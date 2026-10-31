import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { renderFeatures } from '../../tools/lib/features.mjs';
import { renderManagedProfile } from '../../tools/lib/managed-profiles.mjs';

const baseUrl = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const digest = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
const checker = text => text.split('\n').find(line => line.startsWith('geo_location_checker='));
const scriptUrl = line => line.slice(line.indexOf(',') + 1).trim();

test('QX main and mirror URLs version the actual UTF-8 script bytes, not the repository revision', () => {
  for (const base of [baseUrl, baseUrl + '/', 'https://mirror.example/netatlas']) {
    const artifacts = new Map(renderFeatures('quantumultX', { baseUrl: base }).map(file => [file.path, file.content]));
    const script = artifacts.get('scripts/geoip.js');
    const line = checker(artifacts.get('fragments/geoip.conf'));
    const url = new URL(scriptUrl(line));
    assert.equal(url.href.split('?')[0], base.replace(/\/+$/, '') + '/clients/quantumultX/scripts/geoip.js');
    assert.deepEqual([...url.searchParams], [['v', digest(script)]]);
    assert.equal(url.hash, '');
    assert.equal(checker(renderManagedProfile('quantumultX', { baseUrl: base }).content), line);
  }
});

test('a generated main URL escapes an older nonempty URL-keyed QX script cache', () => {
  const artifacts = new Map(renderFeatures('quantumultX', { baseUrl }).map(file => [file.path, file.content]));
  const currentScript = artifacts.get('scripts/geoip.js');
  const previousUrl = baseUrl + '/clients/quantumultX/scripts/geoip.js';
  // Minimal reproduction of the published pre-5a51608 outer-return defect.
  // QX 946 reads its script cache by MD5(full scriptPath), without fetching on a hit.
  const cache = new Map([[digest(previousUrl, 'md5'),
    '(function () { $done({title:"日本",subtitle:"old",ip:"203.0.113.11",description:"old"}); }());']]);
  const run = script => vm.runInNewContext(script, {
    $response: {
      statusCode: 200,
      body: JSON.stringify({ ip: '203.0.113.11', success: true, country_code: 'JP', country: '日本' }),
    },
    $done: value => value,
  }, { timeout: 1000 });
  const checkCached = url => {
    const script = cache.get(digest(url, 'md5'));
    return script ? run(script) : undefined;
  };
  assert.equal(checkCached(previousUrl), undefined);
  const nextUrl = scriptUrl(checker(artifacts.get('fragments/geoip.conf')));
  const cacheKey = digest(nextUrl, 'md5');
  assert.equal(cache.has(cacheKey), false, 'the new URL must not reuse the old nonempty cache');
  assert.equal(checkCached(nextUrl), undefined, 'a first cold-cache check cannot evaluate a missing script');
  // Separate resource-download completion from a later check, as the native host does.
  cache.set(cacheKey, currentScript);
  const result = checkCached(nextUrl);
  assert.equal(result?.ip, '203.0.113.11', 'the generated URL must load the fixed script instead of the old nonempty cache');
  assert.match(result.title, /日本/);
  assert.equal(cache.size, 2);
});

test('rebuilding identical GeoIP content keeps a stable URL without timestamps or retries', () => {
  const first = checker(renderFeatures('quantumultX', { baseUrl }).find(file => file.path === 'fragments/geoip.conf').content);
  const again = checker(renderFeatures('quantumultX', { baseUrl: baseUrl + '/' }).find(file => file.path === 'fragments/geoip.conf').content);
  assert.equal(first, again);
  assert.match(scriptUrl(first), /\/main\/clients\/quantumultX\/scripts\/geoip\.js\?v=[a-f0-9]{64}$/);
});
