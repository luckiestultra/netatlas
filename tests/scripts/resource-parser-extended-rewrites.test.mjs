import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { parseRewrites } from '../../src/features/resource-parser/rewrites.mjs';
import { renderRewriteActions } from '../../tools/lib/rewrite-actions.mjs';

function runAction(line, input = {}) {
  const url = line.match(/https:\/\/\S+#na=\S+$/)?.[0];
  assert.ok(url, 'conversion must emit an executable static adapter reference');
  const code = renderRewriteActions('quantumultX')[0].content;
  const completed = [];
  let io = 0;
  const deny = () => { io++; throw new Error('I/O is not allowed'); };
  vm.runInNewContext(code, { $environment: { sourcePath: url }, $request: { url: 'https://example.test/', headers: {}, ...input.request }, $response: input.response, $done: result => completed.push(result), $task: { fetch: deny }, $prefs: { valueForKey: deny }, console: { log() {} }, URL: undefined, TextDecoder: undefined, atob: undefined }, { timeout: 1000 });
  assert.equal(completed.length, 1); assert.equal(io, 0);
  return JSON.parse(JSON.stringify(completed[0]));
}

test('Map Local inline mocks return the configured status, headers and exact body without contacting upstream', () => {
  const output = parseRewrites('[Map Local]\n^https://example.test/ data-type=text data="{\"message\":\"a $1 \\\\ b\"}" status-code=503 header="Content-Type:application/json|X-Test:ok"');
  const result = runAction(output.trim());
  assert.equal(result.status, 'HTTP/1.1 503 Service Unavailable');
  assert.equal(result.headers['Content-Type'], 'application/json');
  assert.equal(result.headers['X-Test'], 'ok');
  assert.equal(result.body, '{"message":"a $1 \\\\ b"}');
  assert.deepEqual(runAction(parseRewrites('[Map Local]\n^http://example.test/ data-type=text data=""').trim()), { status: 'HTTP/1.1 200 OK', headers: { 'Content-Type': 'text/plain' }, body: '' });
});

test('header transformations operate on actual case-insensitive header maps and preserve unrelated headers', () => {
  const output = parseRewrites('[Rewrite]\n^https://example.test/ header-replace User-Agent Agent\n^https://example.test/ response-header-del X-Remove');
  const rows = output.trim().split('\n').filter(row => !row.startsWith('#'));
  assert.deepEqual(runAction(rows[0], { request: { headers: { 'user-agent': 'old', Keep: 'yes' } } }), { headers: { 'user-agent': 'Agent', Keep: 'yes' } });
  assert.deepEqual(runAction(rows[1], { response: { headers: { 'x-remove': 'gone', Keep: 'yes' } } }), { headers: { Keep: 'yes' } });
});

test('Loon and Surge jq transformations run on real JSON data with native jq', () => {
  const cases = [
    ['^https://example.test/ response-body-json-del data.ad, data.rows[0]', { data: { ad: true, rows: [1, 2] }, keep: 1 }, { data: { rows: [2] }, keep: 1 }],
    ['^https://example.test/ response-body-json-replace data.ad {}, data.title "a,b"', { data: { ad: true, title: 'old' } }, { data: { ad: {}, title: 'a,b' } }],
    ['^https://example.test/ request-body-json-replace missing.deep true', { keep: 1 }, { keep: 1 }],
    ['http-response-jq ^https://example.test/ \'.result = 7\'', { result: 0 }, { result: 7 }],
  ];
  for (const [source, input, expected] of cases) {
    const output = parseRewrites(source);
    const expression = output.match(/ url jsonjq-(?:request|response)-body '([^\n]*)'/)?.[1];
    assert.ok(expression);
    const result = spawnSync('jq', ['-c', expression], { input: JSON.stringify(input), encoding: 'utf8', timeout: 1000 });
    assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), expected);
  }
});

test('source disabled rewrites, filtering preview, echo files and destination extraction remain explicit', () => {
  assert.match(parseRewrites('^https://example.test/ - reject'), / - reject/);
  assert.match(parseRewrites('^https://example.test/ url reject', { out: ['example.test'], hide: false }), / - reject/);
  assert.equal(parseRewrites('^https://example.test/ url echo-response application/json echo-response fixture.json'), '^https://example.test/ url echo-response application/json echo-response fixture.json\n');
  const module = '[Rule]\nDOMAIN,filter.test,REJECT\n[Rewrite]\n^http://ad.test/ reject-200\n[MITM]\nhostname=ad.test';
  assert.doesNotMatch(parseRewrites(module, { dst: 'rewrite' }), /host,filter.test/);
  assert.equal(parseRewrites(module, { dst: 'filter' }), 'host,filter.test,reject\n');
});

test('mixed native filters apply policy/interface options and keep notes outside semantic filtering', () => {
  const module = '[Rule]\n{# skip.test appears only in a note #} DOMAIN,keep.test,Proxy\n[Rewrite]\n^http://ad.test/ reject-200';
  const selected = parseRewrites(module, { pset: [['keep', 'Media']], fcr: '1', via: 'en0', out: ['skip.test'] }, { build: 950 });
  assert.match(selected, /^\{# skip\.test appears only in a note #\} host,keep\.test,Media,force-cellular,via-interface=en0$/m);
});

test('unknown map/header settings and malformed transformations fail the entire resource', () => {
  for (const row of ['[Map Local]\n^http://example.test/ data-type=text data="ok" unknown=SECRET', '[Map Local]\n^http://example.test/ data-type=text data="ok" status-code=99', '[Rewrite]\n^http://example.test/ header-replace X-Test value\r\nInjected: value', '^http://example.test/ url echo-response text/plain echo-response ../../secret']) {
    assert.throws(() => parseRewrites(row), error => !error.message.includes('SECRET'));
  }
});

test('all header regex operations share one bounded runtime budget and never return partial headers', () => {
  const expression = 'a?'.repeat(100) + 'Q';
  const row = '^https://example.test/ header-replace-regex ' + Array(8).fill('X-Long ' + expression + ' Z').join(' ');
  const output = parseRewrites(row);
  assert.deepEqual(runAction(output.trim(), { request: { headers: { 'X-Long': 'z'.repeat(5000) } } }), {});
});

test('physical rewrite output limits include notes and compatibility warning rows', () => {
  const source = '{# n #} fixture=type=http-response,pattern=^http://example.test/,script-path=https://example.test/script.js';
  const rows = Array(9999).fill('{# n #} ^http://example.test/ url reject');
  assert.throws(() => parseRewrites('[Script]\n' + source + '\n[rewrite_local]\n' + rows.join('\n')), /output limit/);
});
