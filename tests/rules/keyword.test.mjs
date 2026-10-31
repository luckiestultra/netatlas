import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIds } from '../../tools/lib/clients.mjs';
import { normalizeEntry, normalizeRuleset, matchesEntry } from '../../tools/lib/rules.mjs';
import { renderRuleset, decodeRuleset } from '../../tools/lib/exporters.mjs';
import { renderProfile } from '../../tools/lib/profiles.mjs';
import { validateProfile } from '../../tools/lib/validation.mjs';

const keyword = { type: 'domain-keyword', value: 'stream-key' };
test('keyword semantics are a real case-insensitive substring condition, distinct from suffixes', () => {
  assert.deepEqual(normalizeEntry({ ...keyword, value: 'STREAM-KEY' }), keyword);
  assert.equal(matchesEntry(keyword, { host: 'prefix-stream-key-other.example' }), true);
  assert.equal(matchesEntry(keyword, { host: 'prefix-stream-ke-other.example' }), false);
  for (const value of ['.*', 'x/y', 'a,b', 'a\nb', 'https://a', 'a?b']) assert.throws(() => normalizeEntry({ ...keyword, value }));
});
for (const client of clientIds) test(`${client}: keyword file and inline route survive native serialization with keyword identity`, () => {
  const ruleset = normalizeRuleset({ version: 1, id: 'keyword-fixture', category: 'media', entries: [keyword] });
  const file = renderRuleset(client, ruleset);
  assert.deepEqual(decodeRuleset(client, file.content), [keyword]);
  const profile = renderProfile(client, { rulesets: [ruleset] });
  assert.equal(validateProfile(client, profile.content, [ruleset]).rules, 1);
  assert.match(file.content, client === 'quantumultX' ? /host-keyword/ : ['egern', 'singBox'].includes(client) ? /domain_keyword/ : /DOMAIN-KEYWORD/);
});
