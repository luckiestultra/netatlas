import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request, createServer } from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';
import { renderScriptRuntime, compileScriptRuntime } from '../../tools/lib/script-runtime.mjs';
import { renderRewriteActions } from '../../tools/lib/rewrite-actions.mjs';

// This is a host-contract/real-loopback check, never a native Quantumult X run.
// Only our own fixture programs and the licensed, pinned Maasea source execute.
// Other full public script resources remain inert parser input text.
// Contracts: https://manual.nssurge.com/http/map-local.html
// https://github.com/crossutility/Quantumult-X/blob/master/sample-echo-response.js
// https://nsloon.app/en/docs/Rewrite/ and https://jqlang.github.io/jq/manual/
const publicBase = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/';
const upstreams = JSON.parse(readFileSync(new URL('../../metadata/resource-parser-upstreams.json', import.meta.url), 'utf8'));
const youtube = readFileSync(new URL('../../src/features/youtube-enhance/upstream/YouTube.Enhance.sgmodule', import.meta.url), 'utf8');
const useBuilt = process.env.NETATLAS_COMPLETION_USE_BUILT === '1';
const publicCache = process.env.NETATLAS_COMPLETION_PUBLIC_CACHE;
function built(path, rendered) {
  if (!useBuilt && !publicCache) return rendered;
  const content = readFileSync(publicCache ? join(publicCache, path) : new URL('../../clients/quantumultX/' + path, import.meta.url), 'utf8');
  assert.equal(content, rendered, 'the frozen on-disk artifact must equal the current build');
  return content;
}
const artifactRows = [...renderScriptRuntime('quantumultX'), ...renderRewriteActions('quantumultX')];
const artifacts = new Map(artifactRows.map(row => [publicBase + row.path, built(row.path, row.content)]));

function convert(content, link = 'https://fixture.test/module', type = 'rewrite') {
  const calls = [];
  const denied = () => assert.fail('the parser must not perform network/storage/source execution');
  const context = vm.createContext({ $resource: { content, link, type }, $done: value => { calls.push(value); return value; }, $parser: {},
    $task: { fetch: denied }, $httpClient: { get: denied }, $prefs: { valueForKey: denied }, fetch: denied,
    console: { log: denied }, URL: undefined, URLSearchParams: undefined, Buffer: undefined, atob: undefined, TextDecoder: undefined, Intl: undefined,
  }, { codeGeneration: { strings: false, wasm: false } });
  const result = vm.runInContext(built('scripts/resource-parser.js', bundleResourceParser()), context, { timeout: 3000 });
  assert.equal(calls.length, 1);
  assert.equal(result, calls[0], 'the final program value must be its single completion object');
  return result;
}
function success(content, link, type) {
  const result = convert(content, link, type);
  assert.equal(result.error, undefined, result.error);
  assert.equal(typeof result.content, 'string');
  return result.content;
}
function rows(text) { return text.trim().split('\n').filter(line => line && !line.startsWith('#') && !line.startsWith('hostname =')); }
function reference(row) { const match = / url (script-[\w-]+) (https:\/\/\S+)$/.exec(row); assert.ok(match, 'a static executable reference is required'); return { pattern: row.slice(0, match.index), action: match[1], url: match[2] }; }
function artifact(url) { const body = artifacts.get(url.split('#')[0]); assert.equal(typeof body, 'string', 'only a registered local static artifact may execute'); return body; }
function convertJsc(content, link) {
  const setup = `var completed=[];var $resource=${JSON.stringify({ content, link, type: 'rewrite' })};var $parser={};
    var deny=function(){throw Error('parser I/O is forbidden')};var $task={fetch:deny};var $prefs={valueForKey:deny};var $httpClient={get:deny};
    var $done=function(value){completed.push(value);return value};var console={log:deny};`;
  const runner = fileURLToPath(new URL('../helpers/youtube-jsc.py', import.meta.url));
  const result = spawnSync('python3', [runner], { input: setup + '\n' + built('scripts/resource-parser.js', bundleResourceParser()) + '\nJSON.stringify(completed)', encoding: 'utf8', timeout: 10000, maxBuffer: 2000000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const completed = JSON.parse(result.stdout);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].error, undefined, completed[0].error);
  return completed[0].content;
}
function varint(value) { const out = []; do { const low = value % 128; value = Math.floor(value / 128); out.push(low | (value ? 128 : 0)); } while (value); return out; }
function field(number, bytes) { return [...varint(number * 8 + 2), ...varint(bytes.length), ...bytes]; }
function guide(ids) { return field(4, field(117866661, ids.flatMap(id => field(1, field(318370163, field(1, [...Buffer.from(id)])))))); }
const guideInput = guide(['FEuploads', 'FEshorts', 'FEhome', 'SPunlimited']);

function prelude(url, body = guideInput) {
  return `var calls=[],logs=[],timers=[],network=0,writes=[];
    var $environment={sourcePath:${JSON.stringify(url)}};
    var $request={url:'https://youtubei.googleapis.com/youtubei/v1/guide',method:'POST',headers:{'User-Agent':'fixture'},sessionIndex:7};
    var $response={statusCode:200,headers:{'Content-Type':'application/x-protobuf'},bodyBytes:new Uint8Array(${JSON.stringify(body)}).buffer};
    var $prefs={valueForKey:function(){return null},setValueForKey:function(value,key){writes.push([value,key]);return true},removeValueForKey:function(){return true}};
    var $notify=function(){throw Error('unexpected notification')};
    var $done=function(value){calls.push(value)};
    var setTimeout=function(callback,delay){timers.push([callback,delay])};
    var $task={fetch:function(){network++;throw Error('business/Worker requests are forbidden')}};
    var console={log:function(value){logs.push(String(value))}};`;
}
const summarize = `JSON.stringify({calls:calls.map(function(value){var result=Object.assign({},value);if(result.bodyBytes)result.bodyBytes=Array.from(new Uint8Array(result.bodyBytes));return result}),network:network,writes:writes,logs:logs,timers:timers.map(function(value){return value[1]}),capabilities:[typeof process,typeof require,typeof fetch,typeof XMLHttpRequest,typeof readFile]})`;
function runStatic(url, setup = '') {
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(prelude(url) + setup, context);
  vm.runInContext(artifact(url), context, { timeout: 1000 });
  return JSON.parse(vm.runInContext(summarize, context));
}
function originalResponse(overrides) {
  const link = upstreams.cases[0].url + (overrides ? '#arguments=' + encodeURIComponent(JSON.stringify(overrides)) : '');
  const output = success(youtube, link);
  const row = rows(output).find(value => value.includes(' url script-response-body '));
  assert.ok(row);
  const { url } = reference(row);
  const metadata = JSON.parse(decodeURIComponent(url.slice(url.indexOf('#na=') + 4)));
  assert.equal(metadata.binary, true);
  assert.equal(metadata.maxSize, -1);
  assert.equal(metadata.timeout, 5);
  assert.equal(metadata.worker, false);
  return { url, output, metadata };
}

test('the static renderers produce each registered executable artifact exactly once', () => {
  assert.deepEqual(artifactRows.map(row => row.path).sort(), ['scripts/compat-youtube-request.js', 'scripts/compat-youtube-response.js', 'scripts/rewrite-actions.js']);
  assert.equal(artifacts.size, artifactRows.length);
  for (const row of artifactRows) assert.ok(row.content.length > 100);
});

test('full original YouTube module defaults and fragment overrides change actual pinned protobuf output', () => {
  assert.equal(createHash('sha256').update(youtube).digest('hex'), upstreams.cases[0].sha256);
  const cases = [[undefined, ['FEshorts', 'FEhome']], [{ '屏蔽上传按钮': false, '屏蔽Shorts按钮': true }, ['FEuploads', 'FEhome']]];
  for (const [overrides, expected] of cases) {
    const { url, output, metadata } = originalResponse(overrides);
    assert.equal(rows(output).length, 3);
    assert.doesNotMatch(output, /\{\{\{|settings are not applied/);
    const options = typeof metadata.argument === 'string' ? JSON.parse(metadata.argument) : metadata.argument;
    assert.equal(options.blockUpload, overrides?.['屏蔽上传按钮'] ?? true);
    assert.equal(options.blockShorts, overrides?.['屏蔽Shorts按钮'] ?? false);
    const actual = runStatic(url);
    assert.deepEqual(actual.calls, [{ bodyBytes: guide(expected) }], 'the licensed protobuf program must change meaningful fields, not pass bytes through');
    assert.equal(actual.network, 0);
    assert.deepEqual(actual.capabilities, Array(5).fill('undefined'));
    assert.ok(actual.timers.includes(5000));
  }
});

test('Apple JavaScriptCore executes the same parser-generated references and actual protobuf effects', { skip: process.platform !== 'darwin' }, () => {
  const runner = fileURLToPath(new URL('../helpers/youtube-jsc.py', import.meta.url));
  for (const [overrides, expected] of [[undefined, ['FEshorts', 'FEhome']], [{ '屏蔽上传按钮': false, '屏蔽Shorts按钮': true }, ['FEuploads', 'FEhome']]]) {
    const { url, output } = originalResponse(overrides);
    const link = upstreams.cases[0].url + (overrides ? '#arguments=' + encodeURIComponent(JSON.stringify(overrides)) : '');
    assert.equal(convertJsc(youtube, link), output, 'the full module must emit identical references in system JavaScriptCore');
    const result = spawnSync('python3', [runner], { input: prelude(url) + '\n' + artifact(url) + '\n' + summarize, encoding: 'utf8', timeout: 10000, maxBuffer: 2000000 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const actual = JSON.parse(result.stdout);
    assert.deepEqual(actual.calls, [{ bodyBytes: guide(expected) }]);
    assert.equal(actual.network, 0);
    assert.deepEqual(actual.capabilities, Array(5).fill('undefined'));
  }
});

test('module arguments cannot silently succeed on unrelated resource types', () => {
  for (const [content, type] of [['trojan://fixture@proxy.example:443#Node', 'server'], ['DOMAIN,fixture.test,DIRECT', 'filter']]) {
    const result = convert(content, 'https://fixture.test/resource#arguments=%7B%22option%22%3Atrue%7D', type);
    assert.equal(typeof result.error, 'string', 'rewrite-module-only arguments must be rejected instead of ignored');
    assert.equal(result.content, undefined);
  }
});

test('registered Surge script names are preserved in the emitted static wrapper metadata', () => {
  const source = '[Script]\nOriginal.Script.Name = type=http-response,pattern=^https://youtubei.googleapis.com/youtubei/v1/guide,requires-body=true,binary-body-mode=true,script-path=https://raw.githubusercontent.com/Maasea/sgmodule/master/Script/Youtube/youtube.response.js';
  const emitted = rows(success(source));
  assert.equal(emitted.length, 1);
  const { url } = reference(emitted[0]);
  const metadata = JSON.parse(decodeURIComponent(url.slice(url.indexOf('#na=') + 4)));
  assert.equal(metadata.name, 'Original.Script.Name', 'the source script name is observable through $script.name');
});

test('conflicting binary body aliases fail atomically regardless of source field order', () => {
  for (const flags of ['binary-body-mode=true,binary-mode=false', 'binary-mode=false,binary-body-mode=true']) {
    const source = '^http://fixture.test/ url reject\n[Script]\nfixture = type=http-response,pattern=^https://youtubei.googleapis.com/youtubei/v1/guide,requires-body=true,' + flags + ',script-path=https://raw.githubusercontent.com/Maasea/sgmodule/master/Script/Youtube/youtube.response.js';
    const result = convert(source);
    assert.deepEqual(Object.keys(result), ['error']);
    assert.equal(typeof result.error, 'string', 'conflicting aliases must not silently discard one source setting');
  }
});

test('the full dispatcher auto-detects supported Map Local and header/JSON source syntax', () => {
  for (const source of ['[Map Local]\n^http://fixture.test/ data-type=text data="ok"',
    '^http://fixture.test/ header-replace User-Agent Agent',
    '^http://fixture.test/ response-body-json-del data.ad',
    'http-response-jq ^http://fixture.test/ \'.result = 7\'']) {
    assert.equal(success(source, 'https://fixture.test/module', null), success(source), 'supported source syntax must reach the rewrite converter without a forced type');
  }
});

async function listen(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}
function http(url, options = {}) {
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\//, 'only loopback HTTP is allowed');
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method ?? 'GET', headers: options.headers }, res => {
      const chunks = []; res.on('data', value => chunks.push(value));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end(options.body);
  });
}
function runAction(url, input, observed) {
  let count = 0, result;
  const deny = () => assert.fail('a static rewrite action must never contact upstream or storage');
  const context = vm.createContext({ $environment: { sourcePath: url }, $request: input.request, $response: input.response,
    $done: value => { count++; result = value; }, $task: { fetch: deny }, $prefs: { valueForKey: deny }, fetch: deny,
    console: { log: deny }, URL: undefined, Buffer: undefined, atob: undefined, TextDecoder: undefined,
  }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(artifact(url), context, { timeout: 1000 });
  assert.equal(count, 1);
  observed.push(url);
  return result;
}
function respond(res, result) {
  const match = /^HTTP\/1\.1 (\d{3}) (.+)$/.exec(result.status);
  assert.ok(match);
  res.writeHead(Number(match[1]), match[2], result.headers);
  res.end(result.bodyBytes === undefined ? result.body : Buffer.from(new Uint8Array(result.bodyBytes)));
}

test('bundled Map Local to static echo adapter produces real loopback HTTP status, headers, text and bytes', async t => {
  const observed = [];
  let emitted;
  const { server, origin } = await listen((req, res) => {
    try {
      const url = origin + req.url, matching = emitted.filter(row => new RegExp(row.pattern).test(url));
      assert.equal(matching.length, 1);
      respond(res, runAction(matching[0].url, { request: { url, headers: req.headers } }, observed));
    }
    catch (error) { res.destroy(error); }
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const prefix = '^' + origin.replaceAll('.', '\\.');
  const source = '[Map Local]\n' + prefix + '/text data-type=text data="{\"message\":\"fixture $1\"}" status-code=503 header="Content-Type:application/json|X-Local:yes"\n' + prefix + '/bytes data-type=base64 data="AAEC/w==" status-code=201 header="X-Local:binary"';
  emitted = rows(success(source)).map(reference);
  assert.deepEqual(emitted.map(row => row.action), ['script-echo-response', 'script-echo-response']);
  const text = await http(origin + '/text');
  assert.equal(text.statusCode, 503);
  assert.equal(text.headers['content-type'], 'application/json');
  assert.equal(text.headers['x-local'], 'yes');
  assert.equal(text.body.toString(), '{"message":"fixture $1"}');
  const binary = await http(origin + '/bytes');
  assert.equal(binary.statusCode, 201);
  assert.equal(binary.headers['x-local'], 'binary');
  assert.equal(binary.headers['content-type'], 'application/octet-stream');
  assert.deepEqual([...binary.body], [0, 1, 2, 255]);
  assert.equal(observed.length, 2);
});

test('bundled header adapters alter the headers observed across a real loopback HTTP exchange', async t => {
  const observed = [];
  let emitted;
  const { server, origin } = await listen((req, res) => {
    try {
      const matching = emitted.filter(row => new RegExp(row.pattern).test(origin + req.url));
      assert.equal(matching.length, 6);
      let headers = req.headers;
      for (const row of matching.filter(value => value.action === 'script-request-header')) headers = runAction(row.url, { request: { url: origin + req.url, headers } }, observed).headers;
      const body = JSON.stringify(headers);
      let responseHeaders = { 'Content-Type': 'application/json', 'X-Origin': 'before', 'X-Remove': 'gone' };
      for (const row of matching.filter(value => value.action === 'script-response-header')) responseHeaders = runAction(row.url, { response: { statusCode: 200, headers: responseHeaders } }, observed).headers;
      respond(res, { status: 'HTTP/1.1 200 OK', headers: responseHeaders, body });
    } catch (error) { res.destroy(error); }
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const prefix = '^' + origin.replaceAll('.', '\\.');
  const source = '[Rewrite]\n' + prefix + '/ header-replace User-Agent Blue-Agent\n' + prefix + '/ header-replace-regex X-Version "^v(.*)$" "rev-$1"\n' + prefix + '/ header-del X-Remove\n' + prefix + '/ response-header-replace X-Origin local\n' + prefix + '/ response-header-add X-Added yes\n' + prefix + '/ response-header-del X-Remove';
  emitted = rows(success(source)).map(reference);
  const result = await http(origin + '/', { headers: { 'User-Agent': 'old', 'X-Version': 'v42', 'X-Remove': 'gone', 'X-Keep': 'untouched' } });
  const echoed = JSON.parse(result.body);
  assert.equal(echoed['user-agent'], 'Blue-Agent');
  assert.equal(echoed['x-version'], 'rev-42');
  assert.equal(echoed['x-remove'], undefined);
  assert.equal(echoed['x-keep'], 'untouched');
  assert.equal(result.headers['x-origin'], 'local');
  assert.equal(result.headers['x-added'], 'yes');
  assert.equal(result.headers['x-remove'], undefined);
  assert.equal(observed.length, 6);
});

test('the static HTTP bridge passes real loopback bytes and HTTP callback results through exactly once', async t => {
  let received;
  const { server, origin } = await listen((req, res) => {
    const chunks = []; req.on('data', value => chunks.push(value)); req.on('end', () => {
      received = { method: req.method, headers: req.headers, body: [...Buffer.concat(chunks)] };
      res.writeHead(201, { 'Content-Type': 'application/octet-stream', 'X-Fixture': 'callback' }); res.end(Buffer.from([90, 10, 20, 80]));
    });
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const code = compileScriptRuntime(`$httpClient.post({url:${JSON.stringify(origin + '/binary')},headers:{'X-Sent':'yes'},body:new Uint8Array([99,1,2,88]).subarray(1,3),'binary-mode':true,'auto-redirect':false},function(error,response,data){if(error||response.status!==201||response.headers['x-fixture']!=='callback'||!(data instanceof Uint8Array))throw Error('HTTP callback contract');$done({status:206,body:data.subarray(1,3)});$done({body:'late'});});`, { kind: 'response', name: 'controlled-http-fixture', worker: false });
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(prelude('https://fixture.test/static.js#na=' + encodeURIComponent(JSON.stringify({ v: 1, kind: 'response', binary: true, maxSize: -1, timeout: 2 }))), context);
  context.$task.fetch = async options => {
    assert.equal(options.url, origin + '/binary');
    assert.deepEqual(JSON.parse(JSON.stringify(options.opts)), { 'auto-cookie': true, redirection: false });
    const reply = await http(options.url, { method: options.method, headers: options.headers, body: Buffer.from(new Uint8Array(options.bodyBytes)) });
    return vm.runInContext('({statusCode:' + reply.statusCode + ',headers:' + JSON.stringify(reply.headers) + ',bodyBytes:new Uint8Array(' + JSON.stringify([...reply.body]) + ').buffer})', context);
  };
  vm.runInContext(code, context, { timeout: 1000 });
  for (let attempt = 0; attempt < 100 && !vm.runInContext('calls.length', context); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  const actual = JSON.parse(vm.runInContext(summarize, context));
  assert.deepEqual(actual.calls, [{ status: 'HTTP/1.1 206 Partial Content', bodyBytes: [10, 20] }]);
  assert.deepEqual(received.body, [1, 2]);
  assert.equal(received.method, 'POST');
  assert.equal(received.headers['x-sent'], 'yes');
});

test('bundled Loon and Surge JSON DSL output performs the intended changes in the actual jq CLI', () => {
  const source = '[Rewrite]\n^http://fixture.test/ response-body-json-del data.ad, data.rows[0]\n^http://fixture.test/ response-body-json-replace data.title "a,b", missing.deep true\nhttp-response-jq ^http://fixture.test/ \'.result = 7\'';
  let data = { data: { ad: true, rows: [1, 2], title: 'old' }, result: 0, keep: true };
  for (const row of rows(success(source))) {
    const match = / url jsonjq-response-body '([^\n]*)'$/.exec(row); assert.ok(match);
    const result = spawnSync('jq', ['-c', match[1]], { input: JSON.stringify(data), encoding: 'utf8', timeout: 1000 });
    assert.equal(result.status, 0, result.stderr); data = JSON.parse(result.stdout);
  }
  assert.deepEqual(data, { data: { rows: [2], title: 'a,b' }, result: 7, keep: true });
});

test('four unmodified public inputs remain text through the actual bundle and complete once', { skip: !process.env.NETATLAS_PUBLIC_RESOURCE_CACHE }, () => {
  const files = { 'youtube-enhance-module': 'youtube.txt', 'dragonread-loon-plugin': 'dragonread.txt', 'mgtv-js-installation': 'mgtv.txt', 'zhihu-js-installation': 'zhbd.txt' };
  for (const entry of upstreams.cases) {
    const content = readFileSync(join(process.env.NETATLAS_PUBLIC_RESOURCE_CACHE, files[entry.id]), 'utf8');
    assert.equal(createHash('sha256').update(content).digest('hex'), entry.sha256);
    const output = success(content, entry.url);
    const actualRows = output.trim().split('\n').filter(line => line && !line.startsWith('#'));
    assert.equal(actualRows.filter(line => / url /.test(line)).length, entry.rewriteRows, entry.id);
    assert.equal(actualRows.filter(line => !line.includes(' url ') && !line.startsWith('hostname = ')).length, entry.filterRows, entry.id);
    assert.equal(actualRows.find(line => line.startsWith('hostname = '))?.slice(11).split(', ').length ?? 0, entry.hostnames, entry.id);
    if (process.platform === 'darwin') assert.equal(convertJsc(content, entry.url), output, entry.id + ' full input must have identical VM and JavaScriptCore effects');
  }
});
