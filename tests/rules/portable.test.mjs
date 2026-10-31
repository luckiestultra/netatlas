import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntry, matchesEntry, normalizeRuleset } from '../../tools/lib/rules.mjs';

test('suffix includes the root and real subdomains, never lookalike domains', () => {
  const entry = normalizeEntry({ type: 'domain-suffix', value: 'OpenAI.COM.' });
  assert.equal(entry.value, 'openai.com');
  for (const host of ['openai.com', 'api.openai.com', 'API.OpenAI.com.']) assert.equal(matchesEntry(entry, { host }), true);
  for (const host of ['notopenai.com', 'openai.com.attacker.test']) assert.equal(matchesEntry(entry, { host }), false);
});

test('exact IDN domains do not match subdomains', () => {
  const entry = normalizeEntry({ type: 'domain', value: '例子.测试' });
  assert.equal(entry.value, 'xn--fsqu00a.xn--0zwm56d');
  assert.equal(matchesEntry(entry, { host: '例子.测试' }), true);
  assert.equal(matchesEntry(entry, { host: 'api.例子.测试' }), false);
});

test('domain input cannot be silently truncated or URL-decoded by IDNA conversion', () => {
  for (const type of ['domain', 'domain-suffix']) {
    for (const value of ['example.com/path', 'example.com?query', 'example.com#fragment', 'example.com\\path', 'example.com%2fpath', 'example.com:443', 'user@example.com', 'exa\nmple.com']) {
      assert.throws(() => normalizeEntry({ type, value }), /domain/i, value);
    }
  }
});

test('CIDR normalization and boundary matching preserve IPv4 and IPv6 semantics', () => {
  const v4 = normalizeEntry({ type: 'ip-cidr', value: '192.0.2.17/24' });
  assert.equal(v4.value, '192.0.2.0/24');
  for (const ip of ['192.0.2.0', '192.0.2.255']) assert.equal(matchesEntry(v4, { ip }), true);
  for (const ip of ['192.0.1.255', '192.0.3.0', '2001:db8::1']) assert.equal(matchesEntry(v4, { ip }), false);
  const v6 = normalizeEntry({ type: 'ip-cidr6', value: '2001:db8:12::123/48' });
  assert.equal(v6.value, '2001:db8:12::/48');
  assert.equal(matchesEntry(v6, { ip: '2001:db8:12:ffff:ffff:ffff:ffff:ffff' }), true);
  assert.equal(matchesEntry(v6, { ip: '2001:db8:13::' }), false);
});

test('invalid or nonportable input is rejected rather than silently discarded', () => {
  for (const entry of [
    { type: 'regexp', value: '.*' },
    { type: 'domain', value: '*.example.com' },
    { type: 'domain', value: '-bad.example' },
    { type: 'domain', value: 'example..com' },
    { type: 'ip-cidr', value: '192.0.2.0/33' },
    { type: 'ip-cidr6', value: 'fe80::1%en0/64' },
    { type: 'ip-cidr6', value: '192.0.2.0/24' }
  ]) assert.throws(() => normalizeEntry(entry));
});

test('canonicalization is deterministic and deduplicates equivalent entries', () => {
  const ruleset = normalizeRuleset({ version: 1, id: 'example', category: 'development', entries: [
    { type: 'domain-suffix', value: 'EXAMPLE.com' },
    { type: 'domain-suffix', value: 'example.com.' },
    { type: 'ip-cidr6', value: '2001:0db8::1/32' },
    { type: 'ip-cidr6', value: '2001:db8::/32' }
  ] });
  assert.equal(ruleset.entries.length, 2);
  assert.deepEqual(normalizeRuleset(ruleset), ruleset);
  assert.throws(() => normalizeRuleset({ ...ruleset, id: '../outside' }));
});
