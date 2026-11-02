import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDomainAnd, intersectGlobs } from '../../src/features/resource-parser/domain-and.mjs';
import { parseRules } from '../../src/features/resource-parser/rules.mjs';

const keyword = value => ({ type: 'DOMAIN-KEYWORD', value });
const suffix = value => ({ type: 'DOMAIN-SUFFIX', value });
const exact = value => ({ type: 'DOMAIN', value });
const matcher = patterns => {
  const expressions = patterns.map(pattern => new RegExp('^' + [...pattern].map(c => c === '*' ? '.*' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$', 'i'));
  return value => expressions.some(expression => expression.test(value));
};
const predicate = (terms, value) => terms.every(term => {
  value = value.toLowerCase();
  const part = term.value.toLowerCase();
  return term.type === 'DOMAIN' ? value === part : term.type === 'DOMAIN-SUFFIX' ? value === part || value.endsWith('.' + part) : value.includes(part);
});

test('positive domain AND preserves substring overlaps, suffix roots and dot boundaries', () => {
  const cases = [
    [keyword('a'), keyword('ab')], [keyword('ab'), keyword('bc')],
    [keyword('aba'), keyword('bab')], [keyword('aa'), keyword('a')],
    [suffix('ab'), keyword('a')], [exact('abc'), suffix('bc')],
    [suffix('a.b'), suffix('b')], [exact('a.b'), suffix('b')],
    [keyword('ab'), keyword('bc'), keyword('ca')],
    [suffix('b'), keyword('ab'), keyword('ba')],
    [keyword('a.b'), keyword('b.c')],
  ];
  const corpus = [''];
  let previous = [''];
  for (let length = 1; length <= 6; length++) {
    const next = [];
    for (const prefix of previous) for (const c of ['a', 'b', 'c', '.']) next.push(prefix + c);
    corpus.push(...next); previous = next;
  }
  corpus.push('AB', 'x.a.b', 'x.a.b.evil', 'notab', 'abab', 'baba', 'abc');
  for (const terms of cases) {
    const patterns = compileDomainAnd(terms), matches = matcher(patterns);
    const reversed = matcher(compileDomainAnd([...terms].reverse()));
    for (const value of corpus) {
      assert.equal(matches(value), predicate(terms, value), 'AND must be an intersection including overlaps');
      assert.equal(reversed(value), matches(value), 'source conjunction order must not change its language');
    }
  }
});

test('AND expansion keeps every source policy and does not turn conjunction into disjunction', () => {
  const source = 'AND, ((DOMAIN-KEYWORD,-ad-),(DOMAIN-SUFFIX,byteimg.com)), REJECT\nDOMAIN,keep.example,DIRECT';
  const result = parseRules(source);
  assert.ok(result.includes('host,keep.example,direct'));
  const rows = result.trim().split('\n').filter(line => !line.startsWith('#'));
  const globs = rows.filter(line => line.startsWith('host-wildcard,')).map(line => line.split(',')[1]);
  assert.ok(globs.length);
  assert.ok(rows.filter(line => line.startsWith('host-wildcard,')).every(line => line.endsWith(',reject')));
  const matches = matcher(globs);
  for (const host of ['a-ad-b.byteimg.com', 'a-ad-b.nested.byteimg.com']) assert.equal(matches(host), true);
  for (const host of ['byteimg.com', 'a.byteimg.com', 'a-ad-b.byteimg.com.evil', 'a-ad-b.other.test']) assert.equal(matches(host), false);
});

test('domain-only AND rejects unsupported predicates, malformed syntax and expansion exhaustion atomically', () => {
  for (const source of [
    'AND,((DOMAIN,a.example),(DST-PORT,443)),REJECT',
    'AND,((DOMAIN,a.example),(IP-CIDR,192.0.2.0/24)),REJECT',
    'AND,((DOMAIN-KEYWORD,a),(NOT,(DOMAIN,b.example))),REJECT',
    'AND,((DOMAIN-KEYWORD,a),(DOMAIN-KEYWORD,b)),REJECT,no-resolve',
    'AND,((DOMAIN-KEYWORD,a),(DOMAIN-KEYWORD,b)),REJECT=invalid',
    'AND,((DOMAIN-KEYWORD,a),(DOMAIN-KEYWORD,b)),',
  ]) assert.throws(() => parseRules('DOMAIN,first.example,REJECT\n' + source));
  assert.throws(() => compileDomainAnd([keyword('a'.repeat(254)), keyword('b')]));
  assert.throws(() => compileDomainAnd(Array.from({ length: 5 }, (_, i) => keyword(String(i)))));
  assert.throws(() => intersectGlobs('*a*', '*b*', { maxStates: 1 }));
  assert.deepEqual(compileDomainAnd([exact('abc'), exact('abd')]), []);
});
