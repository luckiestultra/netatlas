import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseResource, completeResource } from '../../src/features/resource-parser/core.mjs';
import { parseRules } from '../../src/features/resource-parser/rules.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

// Public anti-AD workflow, with synthetic bulk rows instead of a moving network fixture.
const link = 'https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-quanx.txt#out=mycleanmymac.com+wxs.qq.com+mcs.zijieapi.com';
const removed = ['mycleanmymac.com', 'wxs.qq.com', 'mcs.zijieapi.com'];
const retained = ['wxsnsad.tc.qq.com', 'wxsnsdy.tc.qq.com', 'wxsnsdy.video.qq.com'];
const row = domain => `host-suffix,${domain},reject`;
const bulk = Array.from({ length: 101512 }, (_, i) => row(`ad${i}.example.test`));
const input = ['#TITLE=synthetic anti-AD workflow', ...removed.map(row), ...retained.map(row), ...bulk].join('\n') + '\n';

function assertFullList(result) {
  assert.deepEqual(Object.keys(result), ['content']);
  const expected = [...retained.map(row), ...bulk].join('\n') + '\n';
  assert.equal(result.content, expected, 'only the three complete literal domains are removed, in original order');
}

test('the 100k-rule public anti-AD parameter workflow works with host, explicit and detected filter types', () => {
  assert.ok(input.length > 2 * 1024 * 1024);
  for (const resource of [
    { type: 'filter', link, content: input },
    { link, content: input },
    { type: 7, link: link + '&type=rule', content: input },
  ]) assertFullList(parseResource(resource));
});

test('the final browser bundle completes a large filtered resource once without I/O or host codecs', () => {
  let calls = 0, captured;
  const denied = () => assert.fail('resource conversion must remain offline');
  const result = vm.runInNewContext(bundleResourceParser(), {
    $resource: { type: 'filter', link, content: input },
    $done: value => { calls++; captured = value; return value; },
    fetch: denied, $task: { fetch: denied }, $prefs: { valueForKey: denied },
    Buffer: undefined, URL: undefined, atob: undefined, TextDecoder: undefined,
  }, { timeout: 10000 });
  assert.equal(calls, 1); assert.equal(result, captured); assertFullList(result);
});

test('large filters validate even excluded rows and return only a private-value-free error', () => {
  let calls = 0;
  const result = completeResource({ type: 'filter', link: link + '+PRIVATE_VALUE', content: input + 'PROCESS-NAME,PRIVATE_VALUE,Proxy\n' }, () => { calls++; });
  assert.equal(calls, 1); assert.deepEqual(Object.keys(result), ['error']);
  assert.doesNotMatch(result.error, /PRIVATE_VALUE|https:\/\//);
});

test('plain rule budgets bound physical lines, emitted lines, and characters before filtering', () => {
  const line = 'host,a.test,reject';
  const maximum = Array(250000).fill(line).join('\n');
  assert.equal(parseRules(maximum + '\n').trim().split('\n').length, 250000);
  assert.throws(() => parseRules(maximum + '\n' + line), /limit|oversized/i);
  assert.throws(() => parseResource({ type: 'filter', content: '# comment\n'.repeat(250000) + line }), /limit|oversized/i);
  assert.throws(() => parseRules(maximum, { policy: 'X'.repeat(128), out: ['a.test'] }), /limit|oversized/i, 'a tiny selected output must not bypass the unfiltered character budget');
  assert.throws(() => parseResource({ type: 'filter', content: 'x'.repeat(8 * 1024 * 1024 + 1) }), /limit|oversized/i);
  const expanded = Array(626).fill(String.raw`DOMAIN-REGEX,.+\.awsdns-[0-9][0-9]\.(co\.uk|com|net|org)$,Proxy`).join('\n');
  assert.throws(() => parseRules(expanded, { out: ['awsdns-'] }), /limit/i, 'registered regex expansion is bounded before filtering');
});

test('large filter support does not expand node, rewrite, encoded or structured-document budgets', () => {
  const node = 'http=proxy.example:80,tag=Test';
  const rewrite = '^https://example.test/ url reject';
  for (const [type, sample] of [['server', node], ['rewrite', rewrite]]) {
    assert.throws(() => parseResource({ type, content: sample + '\n#' + 'x'.repeat(2 * 1024 * 1024) }), /limit|oversized/i);
    assert.throws(() => parseResource({ type, content: '# comment\n'.repeat(20000) + sample }), /limit|oversized/i);
  }
  assert.throws(() => parseResource({ type: 'filter', content: Buffer.from(node + '\n#' + 'x'.repeat(2 * 1024 * 1024)).toString('base64') }), /limit|oversized/i);
  const json = JSON.stringify({ version: 3, rules: [{ domain: Array(100001).fill('example.test') }] });
  assert.throws(() => parseResource({ type: 'filter', content: json }), /limit|oversized|YAML|conversion failed/i);
  assert.throws(() => parseRules(json), /limit|oversized/i);
});
