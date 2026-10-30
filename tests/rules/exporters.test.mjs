import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { clientIds } from '../../tools/lib/clients.mjs';
import { renderRuleset, decodeRuleset } from '../../tools/lib/exporters.mjs';
import { normalizeRuleset, matchesEntry } from '../../tools/lib/rules.mjs';

const ruleset = normalizeRuleset({ version: 1, id: 'example', category: 'development', entries: [
  { type: 'domain', value: 'api.example.test' },
  { type: 'domain-suffix', value: 'example.com' },
  { type: 'ip-cidr', value: '192.0.2.0/24' },
  { type: 'ip-cidr6', value: '2001:db8::/32' }
] });
const cases = [{host:'api.example.test'}, {host:'sub.api.example.test'}, {host:'example.com'}, {host:'a.example.com'}, {host:'notexample.com'}, {ip:'192.0.2.255'}, {ip:'192.0.3.0'}, {ip:'2001:db8:ffff::1'}, {ip:'2001:db9::1'}];

for (const client of clientIds) test(`${client}: real serialized rules retain root-domain and IP boundary semantics`, () => {
  const file = renderRuleset(client, ruleset);
  assert.match(file.path, /^rules\/example\.(?:list|yaml|json)$/);
  const decoded = decodeRuleset(client, file.content);
  assert.equal(decoded.length, ruleset.entries.length);
  for (const candidate of cases) assert.equal(decoded.some(entry => matchesEntry(entry,candidate)), ruleset.entries.some(entry => matchesEntry(entry,candidate)), JSON.stringify(candidate));
});

test('Egern rulesets use native *_set fields and YAML, not a renamed Clash payload', () => {
  const object = parse(renderRuleset('egern', ruleset).content);
  assert.deepEqual(object.domain_set, ['api.example.test']);
  assert.deepEqual(object.domain_suffix_set, ['example.com']);
  assert.deepEqual(object.ip_cidr6_set, ['2001:db8::/32']);
  assert.equal(object.payload, undefined);
});

test('Mihomo classical YAML and sing-box headless JSON are distinct schemas', () => {
  const mihomo = parse(renderRuleset('mihomo', ruleset).content);
  const singBox = JSON.parse(renderRuleset('singBox', ruleset).content);
  assert.ok(mihomo.payload.includes('DOMAIN-SUFFIX,example.com'));
  assert.equal(singBox.version, 3);
  assert.deepEqual(singBox.rules.find(rule=>rule.domain_suffix)?.domain_suffix, ['example.com']);
});

test('unknown target and unsupported input are errors, not partial exports', () => {
  assert.throws(()=>renderRuleset('unknownClient', ruleset));
  assert.throws(()=>renderRuleset('surge',{...ruleset,entries:[{type:'regexp',value:'.*'}]}));
});
