import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { safePattern } from '../../src/features/resource-parser/safe-pattern.mjs';
import { parseOptions, applyNodeOptions } from '../../src/features/resource-parser/options.mjs';

test('common quantified capture and noncapture groups match actual node declarations', () => {
  const content = 'http=example.test:80, tag=JPJP\nhttp=example.test:80, tag=HK\nhttp=example.test:80, tag=US\n';
  const options = parseOptions('https://example.test/#regex=' + encodeURIComponent('tag=(?:JP|HK)+$'));
  const result = applyNodeOptions(content, options);
  assert.match(result, /tag=JPJP/); assert.match(result, /tag=HK/); assert.doesNotMatch(result, /tag=US/);
});
test('each group repetition clears all captures belonging to that iteration', () => {
  for (const [pattern, text] of [['(a(b)?)+', 'aba'], ['(a|(b))*c', 'bac'], ['((a)|(b))+', 'aba'], ['(a()b)+', 'abab'], ['(?:(a)|(b)){1,3}', 'aba']]) {
    const replacement = '[$&:$1:$2:$3]';
    assert.equal(safePattern(pattern).replace(text, replacement), text.replace(new RegExp(pattern, 'gi'), replacement), pattern);
  }
});
test('nullable group bodies and unsupported executable or assertion constructs remain errors', () => {
  for (const pattern of ['(a*)*b', '(a?)+', '(?:|a)+', '(a|)*', '(?=a)', '(?!a)', '(?<=a)', '(a)\\1']) assert.throws(() => safePattern(pattern), error => error.message === 'Resource parser options: invalid parameters');
});
test('trusted span replacement reports final capture spans without executing source text', () => {
  const calls = [];
  const result = safePattern('(a(b)?)+').replaceWith('xabay', (spans, text) => { calls.push(spans); assert.equal(text, 'xabay'); return spans[2] === undefined ? 'CLEARED' : 'STALE'; });
  assert.equal(result, 'xCLEAREDy'); assert.deepEqual(calls, [[[1, 4], [3, 4], undefined]]);
  assert.throws(() => safePattern('(a)+').replaceWith('aaa', () => 'x'.repeat(20), 10), /invalid parameters/);
});
test('quantified groups retain shared work bounds on pathological ambiguity', () => {
  const match = safePattern('(a|aa)+Z', false, { remaining: 2097152 });
  assert.equal(match.test('a'.repeat(16000)), false);
  assert.throws(() => safePattern('(a|aa)+Z', false, { remaining: 128 }).test('a'.repeat(16000)), /invalid parameters/);
  assert.equal(vm.runInNewContext('(' + safePattern.toString() + ")('(a|aa)+Z',false,{remaining:2097152}).test('a'.repeat(16000))", {}, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } }), false);
  assert.throws(() => safePattern('((a){128}){128}'), /invalid parameters/);
});
test('deterministic quantified-group differential corpus matches native test and replace', () => {
  let seed = 0x31a721;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const atoms = ['a', 'b', '[ab]', '\\d', '.', '(a|b)', '(?:ab|a)', '(a(b)?)', '(a()b)', '(?:a(?:b|a))'];
  const quantifiers = ['', '+', '+?', '*', '*?', '?', '??', '{1,2}', '{1,2}?', '{0,2}', '{1,}'];
  const inputs = ['', 'a', 'b', 'ab', 'aba', 'bab', 'aab', 'baab', 'abba', 'abaa', 'aaa', 'bbb', 'abab', 'baba', 'a1b', '123', 'Aba', 'BAAB', 'xababz', 'xaba', 'aaba', 'bbaab', 'aababb', '  ab ', 'abababa', 'abababba', '11ab', 'b1a', 'aba1', 'aaab', 'abbb', 'aabab', '😀a', 'a😀b', '😀'];
  const replacements = ['[$&:$1:$2:$3]', '$2/$1', '$10:$$', "$`<$1>$'"];
  let count = 0;
  for (let index = 0; index < 1000; index++) {
    let pattern = '';
    for (let part = 0, length = 1 + random(3); part < length; part++) pattern += atoms[random(atoms.length)] + quantifiers[random(quantifiers.length)];
    if (random(3) === 0) pattern = '(?:a' + pattern + ')'+ quantifiers[random(quantifiers.length)];
    const sensitive = random(2) === 0, flags = sensitive ? 'g' : 'gi';
    let matcher;
    try { matcher = safePattern(pattern, sensitive); } catch { continue; }
    for (const input of inputs) {
      assert.equal(matcher.test(input), new RegExp(pattern, sensitive ? '' : 'i').test(input), pattern + ' on ' + input);
      const replacement = replacements[random(replacements.length)]; assert.equal(matcher.replace(input, replacement), input.replace(new RegExp(pattern, flags), replacement), pattern + ' on ' + input + ' replacement ' + replacement);
      if (index % 10 === 0) { const spans = []; const erased = matcher.replaceWith(input, captureSpans => { spans.push(captureSpans); return ''; }); assert.equal(erased, input.replace(new RegExp(pattern, flags), '')); assert.deepEqual(spans, Array.from(input.matchAll(new RegExp(pattern, flags + 'd')), match => Array.from(match.indices)), pattern + ' capture spans'); }
      count++;
    }
  }
  assert.ok(count >= 30000, String(count));
});

test('finite optional group clones preserve native lazy and greedy capture priority', () => {
  for (const [pattern, text] of [['(.+?){1,3}?c', 'abac'], ['(a+?){1,3}?b', 'aaaaab'], ['(.+?){0,3}?c', 'abac'], ['(.+?){1,3}c', 'abac'], ['(.+){1,3}?c', 'abac']]) {
    const replacement = '[$&:$1]';
    assert.equal(safePattern(pattern).replace(text, replacement), text.replace(new RegExp(pattern, 'gi'), replacement), pattern);
  }
});

test('zero-width global replacements match native UTF16 advancement and text retention', () => {
  const patterns = ['^', '$', '\\b', 'a*', 'a?', 'a*?', '(a*)', '(a?)', '(?:a|)', '(?:|a)', 'a|$', '^|$', '(a)|', '[ab]*', '[ab]??'];
  const inputs = ['', 'a', 'aa', 'ab', 'ba', 'a b', 'abc', '😀', '😀a', 'a😀b', 'é a'];
  const replacements = ['X', '', '[$&:$1]', '$10:$$', "$`<$&>$'"];
  for (const pattern of patterns) for (const input of inputs) for (const replacement of replacements) {
    assert.equal(safePattern(pattern).replace(input, replacement), input.replace(new RegExp(pattern, 'gi'), replacement), pattern + ' on ' + input);
  }
  assert.throws(() => safePattern(''), /invalid parameters/);
});
test('trusted empty-span callbacks agree with native match indices and replacement order', () => {
  for (const pattern of ['^', '$', '\\b', '(a*)', '(a)?', '(a)|', '(?:|a)']) for (const input of ['', 'a', 'aba', '😀a😀']) {
    const actual = [];
    const value = safePattern(pattern).replaceWith(input, (spans, text) => { actual.push(spans); assert.equal(text, input); return '{' + spans[0][0] + ':' + (spans[0][1] - spans[0][0]) + '}'; });
    const expected = input.replace(new RegExp(pattern, 'gi'), (...args) => '{' + args.at(-2) + ':' + args[0].length + '}');
    assert.equal(value, expected, pattern + ' on ' + input);
    assert.deepEqual(actual, Array.from(input.matchAll(new RegExp(pattern, 'dgi')), match => Array.from(match.indices)), pattern + ' span indices');
  }
});
test('zero-width replacement obeys actual node option, work and output limits', () => {
  const input = 'http=example.test:80, tag=JP\n';
  const prefix = parseOptions('https://example.test/#replace=%5E@%20');
  assert.equal(applyNodeOptions(input, prefix), ' http=example.test:80, tag=JP\n');
  const delreg = parseOptions('https://example.test/#delreg=%5E'); assert.equal(applyNodeOptions(input, delreg), input);
  assert.throws(() => safePattern('a?', false, { remaining: 100 }).replace('b'.repeat(1000), 'x'), /invalid parameters/);
  assert.throws(() => safePattern('a?').replace('b'.repeat(1000), 'x'.repeat(512), 100), /invalid parameters/);
  assert.throws(() => safePattern('a?').replaceWith('b'.repeat(1000), () => 'x'.repeat(512), 100), /invalid parameters/);
});

test('dot excludes all four ECMAScript line terminators in match and replacement', () => {
  const input = 'a\nb\rc\u2028d\u2029e';
  assert.equal(safePattern('.').replace(input, 'X'), input.replace(/./gi, 'X'));
  for (const character of ['\n', '\r', '\u2028', '\u2029']) assert.equal(safePattern('.').test(character), false);
});
