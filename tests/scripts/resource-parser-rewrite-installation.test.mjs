import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRewrites } from '../../src/features/resource-parser/rewrites.mjs';
import { completeResource } from '../../src/features/resource-parser/core.mjs';

const rule = '^https://api.example/account url script-response-body https://scripts.example/main.js';
const request = '^https://api.example/header url script-request-header https://scripts.example/header.js';
const reject = '^https://ads.example/ url reject';
const script = header => '/*\n' + header + '\n*/\nconst opaque = "never execute"; throw new Error("must not execute");';

test('leading script installation sections retain native rule order and permit one final hostname comma', () => {
  const source = script('Documentation before installation.\n************************\n[rewrite_local]\n# Native installation\n' + [rule, request, reject].join('\n') + '\n[mitm]\nhostname = api.example, *.media.example, api.example,\n*\n*');
  assert.equal(parseRewrites(source), [rule, request, reject, 'hostname = api.example, *.media.example', ''].join('\n'));
});

test('mixed installation header omits explicit task/debug sections while retaining later MITM declarations', () => {
  const header = 'Example application.\n======调试区|忽略======\n# ^https://debug.example/ url script-response-body http://127.0.0.1/debug.js\n======调试区|忽略======\n====================\n[rewrite_local]\n' + rule + '\n[task_local]\n1 0 * * * https://scripts.example/main.js, tag=Task, enabled=true\n[mitm]\nhostname = api.example\n====================';
  const output = parseRewrites(script(header));
  assert.equal(output, rule + '\nhostname = api.example\n');
  assert.doesNotMatch(output, /127\.0\.0\.1|debug\.example|tag=Task|task_local/);
});

test('multiple native rules in script headers retain exact conditions and actions', () => {
  const rows = [reject.replace('reject', 'reject-dict'), '^https://ads.example/next url reject-array', '^https://data.example/ url reject', request, rule];
  assert.equal(parseRewrites(script('[rewrite_local]\n' + rows.join('\n') + '\n[mitm]\nhostname = *.api.example, 192.0.2.*, api.example')), rows.join('\n') + '\nhostname = *.api.example, 192.0.2.*, api.example\n');
});

test('JSDoc and contiguous leading line comments are installation comments rather than executable input', () => {
  assert.equal(parseRewrites('/**\n * [rewrite_local]\n * ' + rule + '\n * [mitm]\n * hostname = api.example\n */\n(()=>{throw 1})();'), rule + '\nhostname = api.example\n');
  assert.equal(parseRewrites('// Installation\n// [rewrite_local]\n// ' + rule + '\n// [mitm]\n// hostname = api.example\nlet js = "opaque";'), rule + '\nhostname = api.example\n');
});

test('explicit debug blocks inside an installation are excluded without collecting local references', () => {
  const header = '[rewrite_local]\n' + rule + '\n======Debug|Ignore======\n^https://debug.example/ url script-response-body http://localhost/debug.js\n======Debug|Ignore======\n' + reject + '\n[mitm]\nhostname = api.example';
  assert.equal(parseRewrites(script(header)), rule + '\n' + reject + '\nhostname = api.example\n');
});

test('an explicit script header completes once through the real resource dispatcher without executing JavaScript', () => {
  const source = script('[rewrite_local]\n' + rule + '\n[mitm]\nhostname = api.example');
  let calls = 0;
  const result = completeResource({ type: 'rewrite', content: source, link: 'https://scripts.example/original.js' }, () => calls++);
  assert.equal(calls, 1);
  assert.equal(result.content, rule + '\nhostname = api.example\n');
  assert.deepEqual(Object.keys(result), ['content']);
});

test('only leading comments with explicit rewrite_local installation sections are eligible', () => {
  for (const source of [
    'const text = `/*\n[rewrite_local]\n' + rule + '\n[mitm]\nhostname = api.example\n*/`;',
    'const code = 1;\n/*\n[rewrite_local]\n' + rule + '\n*/',
    '/* Readme only. */\nconst text = `[rewrite_local]\n' + rule + '`;',
    '/*\n' + rule + '\nhostname = api.example\n*/\nconst js = 1;',
  ]) assert.throws(() => parseRewrites(source), /Rewrite conversion:/);
});

test('unknown installation rows, sections, executable directives and certificate settings still fail atomically', () => {
  for (const header of [
    '[rewrite_local]\n' + rule + '\nunknown-setting=true',
    '[rewrite_local]\n' + rule + '\n[general]\nskip-proxy=true',
    '[rewrite_local]\n' + rule + '\n[mitm]\nhostname=api.example\nca-p12=DO_NOT_ECHO',
    '#!requirement=CORE_VERSION>=20\n[rewrite_local]\n' + rule,
    '[rewrite_local]\n' + rule + '\n[mitm]\nhostname=api.example\nskip-server-cert-verify=true',
    '[rewrite_local]\n' + rule + '\n1 0 * * * https://scripts.example/task.js',
    'unknown-option=true\n[rewrite_local]\n' + rule,
    '[rewrite_local]\n' + rule + '\n[task_local]\nunknown-option=true\n[mitm]\nhostname=api.example',
  ]) assert.throws(() => parseRewrites(script(header)), error => /^Rewrite conversion:/.test(error.message) && !error.message.includes('DO_NOT_ECHO'));
});

test('separate leading comments cannot hide unknown installation sections or unscoped fields', () => {
  const valid = '/*\n[rewrite_local]\n' + rule + '\n*/';
  for (const extra of ['[general]\nskip-proxy=true', 'hostname=extra.example', reject]) {
    assert.throws(() => parseRewrites(valid + '\n/*\n' + extra + '\n*/\nconst js=1;'), /Rewrite conversion:/);
  }
});

test('script-header extraction does not discard malformed non-JavaScript text outside the comment', () => {
  for (const tail of ['[general]\nskip-proxy=true', 'unknown malformed rewrite', rule]) {
    assert.throws(() => parseRewrites('/*\n[rewrite_local]\n' + reject + '\n*/\n' + tail), /Rewrite conversion:/);
  }
  assert.throws(() => parseRewrites('/*\n[rewrite_local]\n' + reject), /Rewrite conversion:/);
});

test('hostname tolerance is limited to one final empty comma, never internal or repeated empty entries', () => {
  assert.equal(parseRewrites(rule + '\nhostname=api.example, '), rule + '\nhostname = api.example\n');
  for (const hosts of ['api.example,,other.example', 'api.example,,', ',api.example', ',']) {
    assert.throws(() => parseRewrites(script('[rewrite_local]\n' + rule + '\n[mitm]\nhostname=' + hosts)), /MITM hostname/);
  }
});


test('leading global assignment expressions are opaque JavaScript rather than installation rows', () => {
  const source = '/*\n[rewrite_local]\n' + rule + '\n[mitm]\nhostname=api.example\n*/\npayload=~[];payload={text:"hostname=body.example"};throw new Error("must not execute");';
  assert.equal(parseRewrites(source), rule + '\nhostname = api.example\n');
});
