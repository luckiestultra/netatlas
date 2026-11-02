import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileScriptRuntime, renderScriptRuntime } from '../../tools/lib/script-runtime.mjs';
import { SCRIPT_RUNTIME_REGISTRY, findScriptRuntime } from '../../src/features/script-runtime/registry.mjs';

function fixtureProgram(config = {}, setup = '') {
  return `var calls=[],logs=[],timers=[],writes=[],notifications=[],requests=[];
    var console={log:function(value){logs.push(String(value))}};
    var $request={url:'https://fixture.test/path?x=1',method:'POST',headers:{'User-Agent':'fixture'},sessionIndex:9,bodyBytes:new Uint8Array([1,2,3]).buffer};
    var $response={statusCode:200,headers:{'Content-Type':'application/octet-stream'},bodyBytes:new Uint8Array([4,5,6]).buffer};
    var $environment={sourcePath:'https://fixture.test/runtime.js#na='+encodeURIComponent(${JSON.stringify(JSON.stringify({ v: 1, kind: 'response', binary: true, maxSize: -1, timeout: 5, ...config }))})};
    var store={};
    var $prefs={valueForKey:function(key){return store[key]===undefined?null:store[key]},setValueForKey:function(value,key){writes.push([value,key]);store[key]=value;return true},removeValueForKey:function(key){delete store[key];return true}};
    var $notify=function(){notifications.push(Array.from(arguments))};
    var $done=function(value){calls.push(value)};
    var setTimeout=function(fn,ms){timers.push({fn:fn,ms:ms});return timers.length};
    var $task={fetch:function(options){requests.push(options);return Promise.resolve({statusCode:201,headers:{ok:'yes'},body:'reply',bodyBytes:new Uint8Array([10,20,30]).buffer})}};
    ${setup}`;
}
function run(source, config = {}, setup = '') {
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(fixtureProgram(config, setup), context);
  vm.runInContext(source, context, { timeout: 1000 });
  return context;
}
const summaryProgram = `JSON.stringify({calls:calls.map(function(value){var copy=Object.assign({},value);if(copy.bodyBytes)copy.bodyBytes=Array.from(new Uint8Array(copy.bodyBytes));return copy}),logs:logs,writes:writes,notifications:notifications,requests:requests.map(function(r){var c=Object.assign({},r);if(c.bodyBytes)c.bodyBytes=Array.from(new Uint8Array(c.bodyBytes));return c}),timerDelays:timers.map(function(t){return t.ms})})`;
const result = context => JSON.parse(vm.runInContext(summaryProgram, context));
const compile = (source, kind = 'response') => compileScriptRuntime(source, { kind, worker: false, name: 'fixture' });

test('registered wrappers are exact public source matches and contain pinned static code with complete licenses', () => {
  const out = renderScriptRuntime('quantumultX');
  assert.deepEqual(out.map(row => row.path), ['scripts/compat-youtube-request.js', 'scripts/compat-youtube-response.js']);
  assert.equal(SCRIPT_RUNTIME_REGISTRY.length, 2);
  for (const entry of SCRIPT_RUNTIME_REGISTRY) {
    for (const url of entry.sourceUrls) assert.equal(findScriptRuntime(url), entry);
    for (const url of [entry.sourceUrls[0] + '?unreviewed=1', entry.sourceUrls[0].replace('Maasea', 'other'), 'https://evil.test/youtube.request.js']) assert.equal(findScriptRuntime(url), undefined);
  }
  for (const { content } of out) {
    for (const notice of ['Apache License', 'Copyright 2008 Google Inc.', 'Copyright (c) 2016, Daniel Wirtz', 'CC0 1.0 Universal']) assert.ok(content.includes(notice));
    assert.doesNotMatch(content, /\beval\s*\(|new\s+Function\s*\(/);
  }
  assert.deepEqual(renderScriptRuntime('surge'), []);
});

test('source argument strings and objects survive unchanged; binary views retain only their selected bytes', () => {
  for (const argument of ['x=&雪,{"a":1}', { caption: '雪', enabled: false, count: 4 }, null]) {
    const source = compile(`if(typeof $task!=='undefined'||typeof $prefs!=='undefined'||typeof $loon!=='undefined')throw Error('wrong runtime');
      if(JSON.stringify($argument)!==${JSON.stringify(JSON.stringify(argument))})throw Error('argument changed');
      if($response.status!==200||$request.id!=='9'||!($response.body instanceof Uint8Array))throw Error('input contract');
      $done({body:new Uint8Array([99,7,8,88]).subarray(1,3),status:206});$done({body:'late'});`);
    const actual = result(run(source, { argument }));
    assert.deepEqual(actual.calls, [{ status: 'HTTP/1.1 206 Partial Content', bodyBytes: [7, 8] }]);
  }
});

test('response headers/status changes include the original body and unsupported results fail visibly', () => {
  assert.deepEqual(result(run(compile(`$done({headers:{custom:'yes'},status:202})`))).calls, [{ status: 'HTTP/1.1 202 Accepted', headers: { custom: 'yes' }, bodyBytes: [4, 5, 6] }]);
  for (const value of [`{abort:true}`, `{url:'https://other.test/path'}`, `{unknown:true}`]) {
    const actual = result(run(compile(`$done(${value})`)));
    assert.deepEqual(actual.calls, [{}]);
    assert.ok(actual.logs.some(value => value.startsWith('NetAtlas script runtime:')));
  }
});

test('text bodies remain strings and same-origin request URL changes use the documented QX path result', () => {
  const text = result(run(compile(`if(typeof $response.body!=='string'||$script.binaryBodyMode!==false)throw Error('text contract');$done({headers:{ok:'yes'}})`), { binary: false }, `$response.body='text 雪'`));
  assert.deepEqual(text.calls, [{ headers: { ok: 'yes' }, bodyBytes: [4, 5, 6] }]);
  const request = result(run(compile(`$done({url:'https://fixture.test/next?q=雪',body:''})`, 'request'), { kind: 'request' }));
  assert.deepEqual(request.calls, [{ path: '/next?q=雪', body: '' }]);
});

test('size/deadline/config guards skip execution and completion is delivered only once', () => {
  const source = compile(`$persistentStore.write('ran','marker');setTimeout(function(){$done({body:'late'})},50);`);
  const oversized = result(run(source, { maxSize: 2 }));
  assert.deepEqual(oversized.calls, [{}]);
  assert.deepEqual(oversized.writes, []);
  const ctx = run(source, { timeout: 0.01 });
  vm.runInContext('timers[0].fn();timers[1].fn()', ctx);
  assert.deepEqual(result(ctx).calls, [{}]);
  assert.ok(result(ctx).logs.some(value => value.includes('deadline')));
  for (const config of [{ v: 2 }, { kind: 'request' }, { worker: true }, { maxSize: -2 }, { timeout: 0 }, { arbitrary: 'value' }]) {
    const actual = result(run(source, config));
    assert.deepEqual(actual.calls, [{}]);
    assert.deepEqual(actual.writes, []);
  }
  const request = result(run(compile(`$persistentStore.write('ran','marker')`, 'request'), { kind: 'request', maxSize: 2 }));
  assert.deepEqual(request.calls, [{}]);
  assert.ok(request.logs.some(value => value.includes('request limit cannot reproduce native connection termination')));
});

test('HTTP callbacks, persistent storage and notifications use the captured QX host and typed byte boundaries', async () => {
  const ctx = run(compile(`$persistentStore.write('saved','fixture');
    if($persistentStore.read('fixture')!=='saved')throw Error('storage');
    $notification.post('title','sub','body',{url:'https://fixture.test/open'});
    $httpClient.post({url:'http://localhost/fixture',body:new Uint8Array([90,1,2,80]).subarray(1,3),'binary-mode':true,'auto-redirect':false},function(error,response,data){
      if(error||response.status!==201||!(data instanceof Uint8Array))throw Error('HTTP contract');
      $done({body:data.subarray(1,2)});
    });`));
  await new Promise(resolve => setImmediate(resolve));
  const actual = result(ctx);
  assert.deepEqual(actual.calls, [{ bodyBytes: [20] }]);
  assert.deepEqual(actual.requests, [{ url: 'http://localhost/fixture', method: 'POST', bodyBytes: [1, 2], opts: { 'auto-cookie': true, redirection: false } }]);
  assert.deepEqual(actual.writes, [['saved', 'fixture']]);
  assert.deepEqual(actual.notifications, [['title', 'sub', 'body', { 'open-url': 'https://fixture.test/open' }]]);
});

test('HTTP deadlines suppress late callbacks and unsupported host options fail before a request or notification', async () => {
  const ctx = run(compile(`$httpClient.get({url:'http://localhost/fixture',timeout:0.01},function(error){$done({body:error})});`), { timeout: 10 }, `var fulfill;$task.fetch=function(options){requests.push(options);return new Promise(function(resolve){fulfill=resolve})}`);
  vm.runInContext(`timers[1].fn();fulfill({statusCode:200,headers:{},body:'late'})`, ctx);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(result(ctx).calls, [{ body: 'HTTP request deadline exceeded' }]);
  const cookie = run(compile(`$httpClient.get({url:'http://localhost/fixture','auto-cookie':false},function(error){$done({body:error})});`));
  assert.deepEqual(result(cookie).requests, []);
  assert.deepEqual(result(cookie).calls, [{ body: 'unsupported HTTP request options' }]);
  const notification = result(run(compile(`$notification.post('t','s','b',{action:'clipboard',text:'fixture'});$done({body:'unreachable'})`)));
  assert.deepEqual(notification.notifications, []);
  assert.deepEqual(notification.calls, [{}]);
  assert.ok(notification.logs.some(value => value.includes('unsupported notification options')));
});

test('a synchronous result after its deadline is discarded and malformed encoded metadata does not run source', () => {
  const late = result(run(compile(`fakeNow=100;$done({body:'late'})`), { timeout: 0.01 }, `var fakeNow=0;Date.now=function(){return fakeNow}`));
  assert.deepEqual(late.calls, [{}]);
  assert.ok(late.logs.some(value => value.includes('synchronous execution cannot be preempted')));
  for (const hash of ['#na=%ZZ', '#na=%7Bbroken', '#na=%7B%22v%22%3A1%7D&na=%7B%7D']) {
    const actual = result(run(compile(`$persistentStore.write('ran','fixture');$done({})`), {}, `$environment.sourcePath='https://fixture.test/runtime.js'+${JSON.stringify(hash)}`));
    assert.deepEqual(actual.calls, [{}]);
    assert.deepEqual(actual.writes, []);
  }
});

function varint(number) { const bytes=[]; do { const next=number%128;number=Math.floor(number/128);bytes.push(next|(number?128:0)); } while(number);return bytes; }
function field(number, bytes) { return [...varint(number * 8 + 2), ...varint(bytes.length), ...bytes]; }
function guide(ids) { return field(4, field(117866661, ids.flatMap(id => field(1, field(318370163, field(1, Array.from(new TextEncoder().encode(id)))))))); }

test('real pinned Maasea protobuf processing honors source options on the QX host without source fetches', () => {
  const source = renderScriptRuntime('quantumultX').find(row => row.path.endsWith('response.js')).content;
  const setup = `$request.url='https://youtubei.googleapis.com/youtubei/v1/guide';$response.bodyBytes=new Uint8Array(${JSON.stringify(guide(['FEuploads', 'FEshorts', 'FEhome', 'SPunlimited']))}).buffer;`;
  for (const [options, expected] of [
    [{ blockUpload: false, blockShorts: false }, ['FEuploads', 'FEshorts', 'FEhome']],
    [{ blockUpload: true, blockShorts: true }, ['FEhome']],
  ]) {
    for (const argument of [JSON.stringify(options), options]) {
      const actual = result(run(source, { argument }, setup));
      assert.deepEqual(actual.calls, [{ bodyBytes: guide(expected) }]);
      assert.deepEqual(actual.requests, []);
    }
  }
  const request = renderScriptRuntime('quantumultX').find(row => row.path.endsWith('request.js')).content;
  for (const path of ['initplayback?ack=1', 'initplayback-extra?ack=1']) {
    const actual = result(run(request, { kind: 'request', worker: false }, `$request.url='https://fixture.googlevideo.com/'+${JSON.stringify(path)}`));
    assert.deepEqual(actual.calls, [{}]);
    assert.deepEqual(actual.requests, []);
    assert.deepEqual(actual.writes, []);
    assert.ok(actual.logs.some(value => value.includes('separate explicit Worker opt-in')));
  }
});

test('Apple JavaScriptCore runs the same static wrappers and real protobuf option fixtures', { skip: process.platform !== 'darwin' }, () => {
  const source = renderScriptRuntime('quantumultX').find(row => row.path.endsWith('response.js')).content;
  const setup = `$request.url='https://youtubei.googleapis.com/youtubei/v1/guide';$response.bodyBytes=new Uint8Array(${JSON.stringify(guide(['FEuploads', 'FEshorts', 'FEhome', 'SPunlimited']))}).buffer;`;
  const runner = fileURLToPath(new URL('../helpers/youtube-jsc.py', import.meta.url));
  for (const argument of [JSON.stringify({ blockUpload: false, blockShorts: false }), JSON.stringify({ blockUpload: true, blockShorts: true }), { blockUpload: false, blockShorts: false }, { blockUpload: true, blockShorts: true }]) {
    const config = { argument };
    const native = spawnSync('python3', [runner], { input: fixtureProgram(config, setup) + '\n' + source + '\n' + summaryProgram, encoding: 'utf8', timeout: 10000, maxBuffer: 2000000 });
    assert.equal(native.status, 0, native.stderr + native.stdout);
    const actual = JSON.parse(native.stdout);
    assert.deepEqual(actual, result(run(source, config, setup)));
    const options = typeof argument === 'string' ? JSON.parse(argument) : argument;
    assert.deepEqual(actual.calls, [{ bodyBytes: guide(options.blockUpload ? ['FEhome'] : ['FEuploads', 'FEshorts', 'FEhome']) }]);
  }
});
