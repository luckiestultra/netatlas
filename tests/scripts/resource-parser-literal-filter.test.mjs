import assert from 'node:assert/strict';
import test from 'node:test';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { installParserHelper } from '../../src/features/resource-parser/helper.mjs';

const convert = (content, hash, type = 'filter') => parseResource({ type, content, link: 'https://example.test/resource#' + hash }).content;

test('rule out uses case-sensitive literal source text, including dots and source policy before overrides', () => {
  const source = 'DOMAIN,ads.example,REJECT\nDOMAIN,ads.test,ExamplePolicy\nDOMAIN,keep.test,DirectPolicy';
  assert.equal(convert(source, 'out=ads.example'), 'host,ads.test,ExamplePolicy\nhost,keep.test,DirectPolicy\n');
  assert.match(convert(source, 'out=ADS.EXAMPLE'), /host,ads.example,reject/);
  assert.equal(convert(source, 'out=ExamplePolicy&policy=Target'), '# NetAtlas: explicit policy override replaces every source policy.\nhost,ads.example,Target\nhost,keep.test,Target\n');
  assert.throws(() => convert(source, 'out=DOMAIN'), /empty resource/);
});

test('rule in uses converted rule text, while plus-separated alternatives and encoded plus stay literal', () => {
  const source = 'DOMAIN,ads.example,REJECT\nDOMAIN,ads.test,ExamplePolicy\nDOMAIN,keep.test,DirectPolicy';
  assert.equal(convert(source, 'in=ads.example+keep.test'), 'host,ads.example,reject\nhost,keep.test,DirectPolicy\n');
  assert.throws(() => convert(source, 'in=DOMAIN'), /empty resource/);
  assert.equal(convert('DOMAIN,a.test,A+B\nDOMAIN,b.test,A', 'in=A%2BB'), 'host,a.test,A+B\n');
});

test('rewrite filters are case-insensitive literal strings rather than dot-AND expressions', () => {
  const source = '^https://ads.example/ url reject\n^https://ads.test/example url reject\nhostname=ads.example,api.example';
  assert.equal(convert(source, 'out=ADS.EXAMPLE', 'rewrite'), '^https://ads.test/example url reject\nhostname = ads.example, api.example\n');
  assert.equal(convert(source, 'in=ads.example', 'rewrite'), '^https://ads.example/ url reject\nhostname = ads.example, api.example\n');
});

test('hostname filters are case-sensitive literal strings and preserve hostname spelling', () => {
  const source = '^https://example.test/ url reject\nhostname=Ads.Example,ads.test.example,api.example';
  assert.equal(convert(source, 'outhn=Ads.Example', 'rewrite'), '^https://example.test/ url reject\nhostname = ads.test.example, api.example\n');
  assert.match(convert(source, 'outhn=ads.example', 'rewrite'), /hostname = Ads.Example, ads.test.example, api.example/);
});

test('literal leading or consecutive dots survive options/helper; node AND syntax is still validated by its consumer', () => {
  assert.equal(convert('host,a.example,reject\nhost,a.test,reject', 'out=.example'), 'host,a.test,reject\n');
  assert.equal(convert('host,a.example,A..B\nhost,b.test,A', 'out=A..B'), 'host,b.test,A\n');
  assert.throws(() => convert('http=proxy.example:80,tag=A', 'out=A..B', 'server'), /options/i);
  const previous = globalThis.$parser; const helper = {}; globalThis.$parser = helper;
  try {
    installParserHelper(helper);
    const ui = helper.hashToUI('type=filter&out=.example+A..B');
    assert.equal(ui.unknown, '');
    const values = Object.fromEntries(ui.sections.flatMap(group => group.items.map(item => [item.key, item.value])));
    assert.equal(helper.uiToHash(values), 'type=filter&out=.example+A..B');
  } finally { if (previous === undefined) delete globalThis.$parser; else globalThis.$parser = previous; }
});


test('quoted HTTP URL patterns unwrap only their outer quotes before native emission and filtering', () => {
  assert.equal(convert('"^https://example.test/path" url reject', '', 'rewrite'), '^https://example.test/path url reject\n');
  assert.equal(convert(String.raw`"^https?://example.test/" \r\nUser-Agent: fixture url-and-header reject`, '', 'rewrite'), String.raw`^https?://example.test/ \r\nUser-Agent: fixture url-and-header reject` + '\n');
  assert.equal(convert('"^https://example.test/path" url reject\n^https://keep.test/ url reject', 'out=%22', 'rewrite'), '^https://example.test/path url reject\n^https://keep.test/ url reject\n');
  assert.equal(convert('"literal" url reject', '', 'rewrite'), '"literal" url reject\n', 'literal quote matchers are not HTTP wrappers');
  assert.equal(convert(String.raw`^https://example.test/\"literal\" url reject`, '', 'rewrite'), String.raw`^https://example.test/\"literal\" url reject` + '\n', 'inner quote escapes are preserved');
});


test('HTTP quote normalization preserves non-scheme words and escaped closing quotes', () => {
  for (const expression of ['"http_status"', '"https-code"', String.raw`"^https://example.test/\"`]) {
    assert.equal(convert(expression + ' url reject', '', 'rewrite'), expression + ' url reject\n');
  }
  assert.equal(convert(String.raw`"^https://example.test/\\" url reject`, '', 'rewrite'), String.raw`^https://example.test/\\ url reject` + '\n', 'an even number of backslashes does not escape the outer quote');
});
