import test from 'node:test';
import assert from 'node:assert/strict';
import { createScriptRuntime } from '../../src/features/script-runtime/runtime.mjs';
import { parseRewrites } from '../../src/features/resource-parser/rewrites.mjs';

const source = 'https://raw.githubusercontent.com/Maasea/sgmodule/master/Script/Youtube/youtube.response.js';
function fixture(config = {}, version) {
  const values = new Map([['existing', 'keep']]), changes = [], requests = [], completed = [];
  const host = { environment: { version, sourcePath: 'https://example.test/wrapper.js#na=' + encodeURIComponent(JSON.stringify({ v: 1, kind: 'response', ...config })) }, request: { url: 'https://example.test/' }, response: { statusCode: 200, headers: {}, body: 'body' },
    prefs: { valueForKey: key => values.get(key) ?? null, setValueForKey: (value, key) => { changes.push(['set', key]); values.set(key, value); return true; }, removeValueForKey: key => { changes.push(['remove', key]); return values.delete(key); } },
    fetch: options => { requests.push(options); return Promise.resolve({ statusCode: 200, headers: {}, body: 'ok' }); }, notify() {}, done: value => completed.push(value), timer() {}, log() {} };
  const runtime = createScriptRuntime(host, { kind: 'response', name: 'fixed-name', worker: false, sourceUrls: [source] });
  return { runtime, values, changes, requests, completed };
}

test('undefined is not deletion data in the Surge storage contract and explicit keys stay plain', () => {
  const result = fixture();
  assert.equal(result.runtime.persistentStore.write(undefined, 'existing'), false);
  assert.equal(result.values.get('existing'), 'keep');
  assert.equal(result.changes.length, 0);
  assert.equal(result.runtime.persistentStore.write(null, 'existing'), true);
  assert.equal(result.values.has('existing'), false);
  assert.equal(result.runtime.persistentStore.write('value', '../key'), false);
});

test('default storage is scoped to the original source path rather than the declaration name', () => {
  const first = fixture({ name: 'first', sourceUrl: source });
  assert.equal(first.runtime.active, true);
  assert.equal(first.runtime.persistentStore.write('value'), true);
  const second = fixture({ name: 'second', sourceUrl: source });
  second.runtime.persistentStore.write('other');
  assert.equal(first.changes[0][1], second.changes[0][1]);
  assert.ok(first.changes[0][1].includes(source));
  assert.equal(fixture({ sourceUrl: 'https://unregistered.test/script.js' }).runtime.active, false);
  const output = parseRewrites('[Script]\nfirst=type=http-response,pattern=^https://example.test/,requires-body=true,script-path=' + source);
  const config = JSON.parse(decodeURIComponent(output.match(/#na=(\S+)/)[1]));
  assert.equal(config.sourceUrl, source);
});

test('auto-cookie=false maps only on a documented QX build while source default still enables its jar', async () => {
  for (const [version, supported] of [['Quantumult X 1.5.6 build 934', true], ['Quantumult X 1.8.0 build 946', true], ['Quantumult X 1.5.6 build 933', false], [undefined, false]]) {
    const current = fixture({}, version);
    const response = await new Promise(resolve => current.runtime.httpClient.get({ url: 'https://fixture.test/', 'auto-cookie': false }, (error, result, data) => resolve({ error, result, data })));
    if (supported) { assert.equal(response.error, null); assert.equal(current.requests[0].opts['auto-cookie'], false); }
    else { assert.equal(typeof response.error, 'string'); assert.equal(current.requests.length, 0); }
  }
  const ordinary = fixture();
  await new Promise(resolve => ordinary.runtime.httpClient.get('https://fixture.test/', () => resolve()));
  assert.equal(ordinary.requests[0].opts['auto-cookie'], true);
});
