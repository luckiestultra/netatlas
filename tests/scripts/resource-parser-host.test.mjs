import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { completeResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

// QX 946 installs an identity $done and consumes evaluateScript's final value.
const fixtures = [
  { type: 'server', content: 'http://example.com:80#HTTP', expected: 'content' },
  { type: 'filter', content: 'DOMAIN,example.com,DIRECT', expected: 'content' },
  { type: 'rewrite', content: '^https://example.com/ad url reject', expected: 'content' },
  { type: 'server', content: 'hysteria2://synthetic-secret@example.com:443', expected: 'error' },
  { type: 'filter', content: 'DOMAIN,example.com,DIRECT\nPROCESS-NAME,synthetic-secret,Proxy', expected: 'error' },
];

function contextFor(fixture, parser) {
  const context = vm.createContext({
    $resource: { type: fixture.type, content: fixture.content, link: 'https://example.com/resource?token=synthetic-secret' },
    ...(parser ? { $parser: parser } : {}),
    URL: undefined, URLSearchParams: undefined, Buffer: undefined, atob: undefined,
    TextDecoder: undefined, Intl: undefined,
  });
  vm.runInContext('var $done = function(result) {return result}', context);
  return context;
}

function assertResult(result, expected) {
  assert.equal(typeof result, 'object', 'native host must receive the evaluation object');
  assert.notEqual(result, null);
  assert.deepEqual(Object.keys(result), [expected]);
  assert.equal(typeof result[expected], 'string');
  if (expected === 'error') assert.doesNotMatch(result.error, /synthetic-secret|https:\/\//);
}

test('resource completion returns its result after exactly one host completion', () => {
  for (const fixture of fixtures) {
    let calls = 0, completed;
    const result = completeResource(fixture, value => { calls++; completed = value; });
    assert.equal(calls, 1);
    assert.equal(result, completed);
    assertResult(result, fixture.expected);
  }
  let calls = 0;
  assert.throws(() => completeResource(fixtures[0], () => { calls++; throw new Error('host stopped'); }), /host stopped/);
  assert.equal(calls, 1);
});

test('the emitted QX parser preserves native evaluation values for all three resources and atomic errors', () => {
  const code = bundleResourceParser();
  for (const fixture of fixtures) for (const helper of [false, true]) {
    const context = contextFor(fixture, helper ? {} : undefined);
    const result = vm.runInContext(code, context, { timeout: 3000 });
    assertResult(result, fixture.expected);
    if (helper) assert.equal(typeof context.$parser.hashSchema, 'function');
    assertResult(vm.runInContext(code, context, { timeout: 3000 }), fixture.expected);
  }
});

test('parser-helper-only loading and a throwing host never cause accidental or duplicate conversion', () => {
  const code = bundleResourceParser();
  let calls = 0;
  const helperContext = vm.createContext({ $parser: {}, $done: () => { calls++; } });
  assert.equal(vm.runInContext(code, helperContext, { timeout: 3000 }), undefined);
  assert.equal(calls, 0);
  assert.equal(typeof helperContext.$parser.hashToUI, 'function');
  const missingDone = vm.createContext({ $resource: fixtures[0], $parser: {} });
  assert.equal(vm.runInContext(code, missingDone, { timeout: 3000 }), undefined);
  const context = contextFor(fixtures[0], {});
  context.$done = () => { calls++; throw new Error('host stopped'); };
  assert.throws(() => vm.runInContext(code, context, { timeout: 3000 }), /host stopped/);
  assert.equal(calls, 1);
});
