import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

function convert(content, hash, type) {
  const resource = { content, link: 'https://example.test/public#' + hash, ...(type ? { type } : {}) };
  const expected = parseResource(resource);
  let calls = 0, captured;
  const result = vm.runInNewContext(bundleResourceParser(), {
    $resource: resource, $done: value => { calls++; captured = value; return value; },
    fetch: () => assert.fail('no downloads'), $prefs: { valueForKey: () => assert.fail('no storage') },
  }, { timeout: 3000 });
  assert.equal(calls, 1); assert.equal(result, captured);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
  return result.content;
}

test('literal keyword options filter validated rule and rewrite rows without mode switches', () => {
  assert.equal(convert('DOMAIN,ads.example,REJECT\nDOMAIN,api.example,DIRECT', 'out=ads', 'filter'), 'host,api.example,direct\n');
  assert.equal(convert('DOMAIN,ads.example,REJECT\nDOMAIN,api.example,DIRECT', 'in=api.example', 'filter'), 'host,api.example,direct\n');
  const rewrites = '^https://ads.example/ url reject\n^https://api.example/ url reject\nhostname = ads.example,api.example';
  assert.equal(convert(rewrites, 'out=ads', 'rewrite'), '^https://api.example/ url reject\nhostname = ads.example, api.example\n');
  assert.equal(convert(rewrites, 'in=api&outhn=ads', 'rewrite'), '^https://api.example/ url reject\nhostname = api.example\n');
  assert.equal(convert(rewrites, 'inhn=api', 'rewrite'), '^https://ads.example/ url reject\n^https://api.example/ url reject\nhostname = api.example\n');
});

test('keyword filtering cannot hide malformed or executable source semantics', () => {
  for (const content of ['DOMAIN,example.test,DIRECT\n#!include https://example.test/secret', 'DOMAIN,example.test,DIRECT\nPROCESS-NAME,discard.exe,Proxy']) {
    assert.throws(() => convert(content, 'out=include+PROCESS', 'filter'));
  }
  assert.throws(() => convert('^https://a.example/ url reject\n[MITM]\nca-p12=fixture', 'out=fixture', 'rewrite'));
  assert.throws(() => convert('DOMAIN,ads.example,REJECT', 'out=ads', 'filter'), /empty resource/);
  assert.throws(() => convert('^https://ads.example/ url reject\nhostname=ads.example', 'out=ads', 'rewrite'), /empty resource/);
});

test('hostname filters are rewrite-only and other node transformations stay node-only', () => {
  for (const [content, type] of [['http=proxy.example:80,tag=Test', 'server'], ['DOMAIN,example.test,DIRECT', 'filter']]) {
    assert.throws(() => convert(content, 'outhn=example', type), /hostname options are not valid/);
  }
  assert.throws(() => convert('DOMAIN,example.test,DIRECT', 'prefix=X', 'filter'), /node options are not valid/);
});

test('valid custom country database labels do not require a numeric ASN or two-letter country', () => {
  assert.equal(convert('GEOIP,PRIVATE,DIRECT\nGEOIP,CLOUDFLARE,Proxy\nGEOIP,JP,Proxy', '', 'filter'), 'geoip,private,direct\ngeoip,cloudflare,Proxy\ngeoip,jp,Proxy\n');
  for (const category of ['evil=rule', 'A B', 'X'.repeat(65)]) assert.throws(() => convert('GEOIP,' + category + ',Proxy', '', 'filter'));
});

test('local first-line options use the same syntax and URL parameters take precedence', () => {
  const content = '#out=TRIAL&emoji=1\nhttp=proxy.example:80,tag=Trial\nhttp=proxy.example:81,tag=日本01';
  const result = parseResource({ link: 'Profiles/local.list', type: 'server', content });
  assert.equal(result.content, 'http=proxy.example:81,tag=🇯🇵 日本01\n');
  const override = parseResource({ link: 'Profiles/local.list#out=日本', type: 'server', content });
  assert.equal(override.content, 'http=proxy.example:80,tag=Trial\n');
  // An HTTP source comment must not secretly enable transformations.
  assert.match(parseResource({ link: 'https://example.test/sub', type: 'server', content }).content, /tag=Trial/);
});

test('foreign built-in policies with no proven QX equivalent cannot become undeclared group names', () => {
  for (const policy of ['REJECT-TINYGIF', 'REJECT-DROP', 'REJECT-NO-DROP', 'CELLULAR', 'CELLULAR-ONLY', 'HYBRID', 'NO-HYBRID']) {
    assert.throws(() => convert('[Rule]\nDOMAIN,example.test,' + policy, '', 'filter'), /unsupported built-in policy/);
  }
  assert.equal(convert('[Rule]\nDOMAIN,example.test,REJECT-DROP', 'policy=MyGroup', 'filter'), '# NetAtlas: explicit policy override replaces every source policy.\nhost,example.test,MyGroup\n');
});

test('node names and credentials containing rewrite words remain node resources', () => {
  for (const content of [
    'http=proxy.example:80,tag=Fast url node',
    'Fast url node = http, proxy.example, 80, username=test, password=fixture',
    'http://proxy.example:80#Fast%20url%20node',
    'http://proxy.example:80#Fast url node',
  ]) {
    const actual = convert(content, '');
    assert.match(actual, /^http=proxy\.example:80,/);
  }
  assert.equal(convert('https://example.test/ url reject', ''), 'https://example.test/ url reject\n');
});


test('rewrite target fragments cannot steal resource detection from redirect actions', () => {
  assert.equal(convert('https://example.test/ url 302 https://destination.test/path#fragment', ''), 'https://example.test/ url 302 https://destination.test/path#fragment\n');
  assert.equal(convert('https://example.test/ https://destination.test/path#fragment 302', ''), 'https://example.test/ url 302 https://destination.test/path#fragment\n');
});

test('non-local schemes and protocol-relative resources cannot enable first-line options', () => {
  const content = '#prefix=Changed\nhttp=proxy.example:80,tag=Original';
  for (const link of ['ftp://example.test/sub', '//example.test/sub']) {
    assert.match(parseResource({ link, type: 'server', content }).content, /tag=Original/);
  }
  assert.match(parseResource({ link: 'file:///local.list', type: 'server', content }).content, /tag=ChangedOriginal/);
});


test('the final bundle returns one atomic error even when filters would remove the bad row', () => {
  for (const [content, hash, type] of [
    ['DOMAIN,example.test,DIRECT\nPROCESS-NAME,discard.exe,Proxy', 'out=PROCESS', 'filter'],
    ['DOMAIN,example.test,REJECT-DROP', '', 'filter'],
    ['^https://a.example/ url reject\n[MITM]\nca-p12=fixture', 'out=fixture', 'rewrite'],
    ['GEOIP,A B,Proxy', '', 'filter'],
  ]) {
    let calls = 0, captured;
    const result = vm.runInNewContext(bundleResourceParser(), {
      $resource: { content, link: 'https://example.test/sub#' + hash, type },
      $done: value => { calls++; captured = value; return value; },
    }, { timeout: 3000 });
    assert.equal(calls, 1); assert.equal(result, captured);
    assert.deepEqual(Object.keys(result), ['error']);
    assert.equal(typeof result.error, 'string');
    assert.ok(!result.error.includes('fixture'));
  }
});
