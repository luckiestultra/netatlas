import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { renderBodyReplacement } from '../../tools/lib/body-replacement.mjs';

const files = new Map(renderBodyReplacement('surge', { baseUrl: 'https://example.test/netatlas' }).map(item => [item.path, item.content]));
function execute(type, body, argument) {
  const results = [];
  vm.runInNewContext(files.get('scripts/replace-body.js'), {
    $script: { type }, $request: { body }, $response: { body }, $argument: argument,
    $done: value => results.push(JSON.parse(JSON.stringify(value))),
    $httpClient: { get() { assert.fail('body replacement must not send network requests'); } },
  }, { timeout: 100 });
  assert.equal(results.length, 1); return results[0];
}
test('generated Surge request/response scripts replace bodies with explicit JSON and legacy rules', () => {
  for (const type of ['http-request', 'http-response']) {
    assert.deepEqual(execute(type, 'foo foo', 'foo->bar'), { body: 'bar foo' });
    assert.deepEqual(execute(type, 'foo FOO', '/foo/gi->bar'), { body: 'bar bar' });
    assert.deepEqual(execute(type, 'foo', 'foo->bar&bar->baz'), { body: 'baz' });
    assert.deepEqual(execute(type, 'abc 123', JSON.stringify({ rules: [{ pattern: '(abc) (123)', replacement: '$2 $1' }] })), { body: '123 abc' });
    assert.deepEqual(execute(type, 'a&b->c', encodeURIComponent(JSON.stringify({ rules: [{ pattern: 'a&b->c', replacement: '汉字 & ->' }] }))), { body: '汉字 & ->' });
    assert.deepEqual(execute(type, '', 'foo->bar'), { body: '' });
  }
});
test('malformed, partial, oversized or unsupported input passes through once without a partial edit', () => {
  for (const argument of [undefined, '', '{broken', '%ZZ', '[->x', 'foo->bar&[->bad', JSON.stringify({ rules: [{ pattern: 'foo', replacement: 'bar' }, { pattern: '[', replacement: 'bad' }] }), JSON.stringify({ rules: [{ pattern: 'foo', replacement: 'bar', command: 'secret' }] })]) {
    assert.deepEqual(execute('http-response', 'foo', argument), {});
  }
  assert.deepEqual(execute('http-response', 'a'.repeat(1_048_577), 'a->b'), {});
  assert.deepEqual(execute('http-response', null, 'foo->bar'), {});
  assert.deepEqual(execute('other', 'foo', 'foo->bar'), {});
});
test('body replacement is a scoped script utility, never an automatically enabled global module', () => {
  assert.match(files.get('fragments/replace-body.conf'), /requires-body=true,max-size=1048576/);
  assert.match(files.get('fragments/replace-body.conf'), /script-path=https:\/\/example\.test\/netatlas\/clients\/surge\/scripts\/replace-body\.js/);
  assert.ok(files.get('fragments/replace-body.conf').split('\n').filter(line => line && !line.startsWith('#')).every(line => line === '[Script]'));
  for (const client of ['quantumultX', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']) assert.deepEqual(renderBodyReplacement(client), []);
  assert.throws(() => renderBodyReplacement('wrong'), /client/i);
});
