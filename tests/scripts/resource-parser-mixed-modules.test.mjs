import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRewrites } from '../../src/features/resource-parser/rewrites.mjs';
import { parseResource, completeResource } from '../../src/features/resource-parser/core.mjs';
const registeredResponse = 'https://raw.githubusercontent.com/Maasea/sgmodule/master/Script/Youtube/youtube.response.js';
const runtimeConfig = output => JSON.parse(decodeURIComponent(/compat-youtube-response\.js#na=([^\n]+)/.exec(output)[1]));

test('original pinned YouTube module converts all three script declarations without adding URL options', () => {
  const content = readFileSync(new URL('../../src/features/youtube-enhance/upstream/YouTube.Enhance.sgmodule', import.meta.url), 'utf8');
  const result = parseResource({ type: 'rewrite', link: 'https://raw.githubusercontent.com/Maasea/sgmodule/refs/heads/master/YouTube.Enhance.sgmodule', content }).content;
  const rows = result.split('\n').filter(line => line && !line.startsWith('#'));
  assert.equal(rows.filter(line => line.includes(' url script-')).length, 3);
  assert.equal(rows.filter(line => line.includes(' url script-response-body ')).length, 1);
  assert.equal(rows.filter(line => line.includes(' url script-request-body ')).length, 2);
  assert.ok(rows.includes('hostname = *.googlevideo.com, youtubei.googleapis.com'));
  assert.match(result, /^# .*registered script API\/arguments.*static Maasea adapter/im);
  assert.match(result, /compat-youtube-response\.js#na=/);
  assert.equal(runtimeConfig(result).binary, true);
  assert.ok(rows.every(line => !line.includes('{{{')));
});

test('modern QX rewrite snippets retain native filter conditions and URL blocking together', () => {
  const content = '#!name=fixture\n#!system=\n#!system_version=\n#!loon_version=3.2.4(787)\n[Rule]\n'
    + 'AND, ((DOMAIN-KEYWORD,-ad-),(DOMAIN-SUFFIX,media.example)), REJECT\n'
    + 'URL-REGEX, "^http://ads\\.example/(ad|image)/", REJECT\n'
    + 'DOMAIN,metrics.example,REJECT\nDOMAIN-KEYWORD,tracking.example,REJECT';
  const result = parseResource({ type: 'rewrite', link: 'https://example.test/filter.plugin', content }).content;
  assert.equal(parseResource({ link: 'https://example.test/filter.plugin', content }).content, result, 'auto detection must recognize the complete mixed module');
  assert.match(result, /^host-wildcard,.*media\.example,reject$/m);
  assert.match(result, /^\^http:\/\/ads\\.example\/\(ad\|image\)\/ url reject-200$/m);
  assert.match(result, /^host,metrics\.example,reject$/m);
  assert.match(result, /^host-keyword,tracking\.example,reject$/m);
  assert.match(result, /^# .*URL-REGEX.*REJECT.*reject-200/m);
  assert.match(result, /^# .*844/m);
  assert.ok(result.indexOf('host-wildcard,') < result.indexOf('url reject-200'));
  assert.ok(result.indexOf('url reject-200') < result.indexOf('host,metrics.example,reject'));
  assert.ok(!result.includes('hostname ='), 'plain HTTP URL-REGEX must not add MITM');
});

test('mixed rewrite container retains existing native filter order and every policy', () => {
  const text = 'host,one.example,direct\n^http://redirect.example/ url 302 https://target.example/\nhost-suffix,two.example,reject';
  const result = parseRewrites(text);
  const rows = result.split('\n').filter(line => line && !line.startsWith('#'));
  assert.deepEqual(rows, text.split('\n'));
  assert.equal(parseResource({ content: text }).content, result);
});

test('script options accept documented source booleans and preserve regex quotes and nested JSON parsing', () => {
  const input = '#!arguments=Caption:off\n[Script]\nname = type=http-response,pattern=^https://example\\.test/["\x27](a,b),requires-body=1,max-size=-1,binary-body-mode=1,timeout=20,script-path=' + registeredResponse + ',argument="{"caption":"{{{Caption}}}","nested":{"a":true}}"';
  const output = parseRewrites(input);
  assert.match(output, /\["\x27\]\(a,b\) url script-response-body .*compat-youtube-response\.js#na=/);
  const config = runtimeConfig(output);
  assert.deepEqual(JSON.parse(config.argument), { caption: 'off', nested: { a: true } });
  assert.equal(config.timeout, 20); assert.equal(config.maxSize, -1); assert.equal(config.binary, true); assert.equal(config.name, 'name');
  assert.doesNotMatch(output.split('\n').filter(line => line.startsWith('#')).join('\n'), /Caption|"nested"/, 'argument values belong to script configuration, never diagnostics');
});

test('unsupported logical predicates, routing URL actions and executable directives still fail atomically', () => {
  for (const bad of [
    '[Rule]\nAND,((DOMAIN,example.test),(DST-PORT,443)),REJECT',
    '[Rule]\nURL-REGEX,^http://example.test/,DIRECT',
    '#!include https://example.test/SECRET\n[Rule]\nDOMAIN,example.test,REJECT',
    '#!system=mac\n[Rule]\nDOMAIN,example.test,REJECT',
    '[General]\nSECRET=true\n[Rule]\nDOMAIN,example.test,REJECT',
    '[Script]\nname=type=http-response,pattern=^http://example.test/,requires-body=maybe,script-path=https://example.test/a.js',
  ]) {
    let count = 0;
    const result = completeResource({ type: 'rewrite', content: '^http://valid.example/ url reject\n' + bad }, value => { count++; assert.ok(value.error); });
    assert.equal(count, 1);
    assert.deepEqual(Object.keys(result), ['error']);
    assert.doesNotMatch(result.error, /SECRET|https:\/\//);
  }
});

test('mixed-section boundaries cannot reset the shared logical expansion budget', () => {
  const and = 'AND,((DOMAIN-KEYWORD,' + 'a'.repeat(20) + '),(DOMAIN-KEYWORD,' + 'b'.repeat(20) + ')),REJECT';
  const chunk = '[Rule]\n' + and + '\n[Rewrite]\n^http://fixture.example/ reject-200\n';
  assert.doesNotThrow(() => parseRewrites(chunk));
  let calls = 0;
  const result = completeResource({ type: 'rewrite', content: chunk.repeat(512) }, () => { calls++; });
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(result), ['error']);
  assert.match(result.error, /expansion limit/);
});

test('false domain conjunctions do not discard later rewrites or hide invalid operands and policies', () => {
  assert.match(parseRewrites('[Rule]\nAND,((DOMAIN,a.example),(DOMAIN,b.example)),REJECT\n[Rewrite]\n^http://ads.example/ reject-200'), /\^http:\/\/ads.example\/ url reject-200/);
  for (const and of [
    'AND,((DOMAIN,a.example),(DOMAIN,b.example)),"quoted policy"',
    'AND,((DOMAIN,a.example),(DOMAIN,b.example)),REJECT-DROP',
    'AND,((DOMAIN,a.example),(DOMAIN,b.example),(IP-CIDR,192.0.2.0/24)),REJECT',
  ]) assert.throws(() => parseRewrites('[Rule]\n' + and + '\n[Rewrite]\n^http://ads.example/ reject-200'));
});

test('mixed sections retain FINAL state across rewrites, including empty intersections', () => {
  const prefix = '[Rule]\nMATCH,DIRECT\n[Rewrite]\n^http://ads.example/ reject-200\n';
  assert.doesNotThrow(() => parseRewrites(prefix));
  for (const later of ['DOMAIN,later.example,REJECT', 'MATCH,REJECT', 'AND,((DOMAIN,a.example),(DOMAIN,b.example)),REJECT']) {
    let calls = 0;
    const result = completeResource({ type: 'rewrite', content: prefix + '[Rule]\n' + later }, () => { calls++; });
    assert.equal(calls, 1);
    assert.deepEqual(Object.keys(result), ['error']);
    assert.match(result.error, /follows final/);
  }
});

test('unwrapped JSON argument strings do not change declaration bracket or field boundaries', () => {
  const prefix = '[Script]\nfixture=type=http-response,pattern=^http://ads.example/,requires-body=true,script-path=' + registeredResponse + ',argument=';
  for (const text of ['[', '(', '}', 'a, timeout=2', 'quote" and slash\\']) {
    const output = parseRewrites(prefix + JSON.stringify({ text, nested: { enabled: true } }) + ',timeout=20');
    assert.match(output, /url script-response-body .*compat-youtube-response\.js#na=/);
    assert.deepEqual(JSON.parse(runtimeConfig(output).argument), { text, nested: { enabled: true } });
    assert.equal(runtimeConfig(output).timeout, 20);
    assert.doesNotMatch(output.split('\n').filter(line => line.startsWith('#')).join('\n'), /"nested"|"text"/);
  }
  assert.throws(() => parseRewrites(prefix + '{"text":"unterminated}'));
});
