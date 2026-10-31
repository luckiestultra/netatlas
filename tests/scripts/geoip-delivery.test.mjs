import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { renderFeatures } from '../../tools/lib/features.mjs';
import { renderManagedProfile } from '../../tools/lib/managed-profiles.mjs';

const baseUrl = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const cacheKey = value => createHash('md5').update(value).digest('hex');
const checker = text => text.split('\n').find(line => line.startsWith('geo_location_checker='));
const scriptUrl = line => line.slice(line.indexOf(',') + 1).trim();

test('QX main and mirror configuration URLs have no version query or fragment', () => {
  for (const base of [baseUrl, baseUrl + '/', 'https://mirror.example/netatlas']) {
    const artifacts = new Map(renderFeatures('quantumultX', { baseUrl: base }).map(file => [file.path, file.content]));
    const line = checker(artifacts.get('fragments/geoip.conf'));
    const url = new URL(scriptUrl(line));
    assert.equal(url.href, base.replace(/\/+$/, '') + '/clients/quantumultX/scripts/geoip.js');
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.equal(checker(renderManagedProfile('quantumultX', { baseUrl: base }).content), line);
  }
});

test('the ordinary main URL evaluates the fixed script after an explicit cache refresh', () => {
  const artifacts = new Map(renderFeatures('quantumultX', { baseUrl }).map(file => [file.path, file.content]));
  const currentScript = artifacts.get('scripts/geoip.js');
  const previousUrl = baseUrl + '/clients/quantumultX/scripts/geoip.js';
  // Model QX 946's URL-keyed cache with the published pre-5a51608 return defect.
  const cache = new Map([[cacheKey(previousUrl),
    '(function () { $done({title:"日本",subtitle:"old",ip:"203.0.113.11",description:"old"}); }());']]);
  const checkCached = url => {
    const script = cache.get(cacheKey(url));
    return script ? vm.runInNewContext(script, {
      $response: {
        statusCode: 200,
        body: JSON.stringify({ ip: '203.0.113.11', success: true, country_code: 'JP', country: '日本' }),
      },
      $done: value => value,
    }, { timeout: 1000 }) : undefined;
  };
  const nextUrl = scriptUrl(checker(artifacts.get('fragments/geoip.conf')));
  assert.equal(nextUrl, previousUrl, 'publishing an update keeps the ordinary main URL');
  assert.equal(checkCached(nextUrl), undefined, 'a stable URL alone cannot replace cached bytes');
  // Model a separate, successful App resource refresh before the later check.
  cache.set(cacheKey(nextUrl), currentScript);
  const result = checkCached(nextUrl);
  assert.equal(result?.ip, '203.0.113.11');
  assert.match(result.title, /日本/);
  assert.equal(cache.size, 1);
});

test('rebuilding GeoIP configuration keeps the same ordinary main URL', () => {
  const first = checker(renderFeatures('quantumultX', { baseUrl }).find(file => file.path === 'fragments/geoip.conf').content);
  const again = checker(renderFeatures('quantumultX', { baseUrl: baseUrl + '/' }).find(file => file.path === 'fragments/geoip.conf').content);
  assert.equal(first, again);
  assert.equal(scriptUrl(first), baseUrl + '/clients/quantumultX/scripts/geoip.js');
});
