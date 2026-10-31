import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { renderProfile } from '../../tools/lib/profiles.mjs';
import { renderManagedProfile, managedModel } from '../../tools/lib/managed-profiles.mjs';
import { validateProfile } from '../../tools/lib/validation.mjs';
import { validateManagedProfile } from '../../tools/lib/managed-validation.mjs';
import { profileRoutingResources, expandedProfileEntries } from '../../tools/lib/routing-extensions.mjs';
import openai from '../../src/rules/ai/openai.json' with { type: 'json' };
import netflix from '../../src/rules/media/netflix.json' with { type: 'json' };

const clients = ['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox'];
const rulesets = [
  { version: 1, id: 'lan', category: 'network', entries: [{ type: 'domain', value: 'localhost' }] },
  openai,
  netflix,
  { version: 1, id: 'china-ipv4', category: 'network', entries: [{ type: 'ip-cidr', value: '1.0.1.0/24' }] },
];

for (const client of clients) test(`${client}: supported native conditions are actually connected to both profiles`, () => {
  const additions = profileRoutingResources(client, rulesets);
  const model = managedModel(client, { rulesets });
  const ids = model.rules.map(rule => rule.id);
  for (const addition of additions) {
    const index = ids.indexOf(addition.id);
    assert.ok(index >= 0, addition.id);
    assert.equal(model.rules[index].policy, model.rules.find(rule => rule.id === addition.sourceId).policy);
    assert.ok(index < ids.indexOf(addition.sourceId));
    assert.ok(model.rules[index].url.endsWith(`/clients/${client}/${addition.path}`));
  }
  if (client === 'singBox') {
    assert.equal(ids.includes('china-asn'), false);
    assert.equal(ids.includes('geoip-cn'), false);
  } else {
    assert.ok(ids.indexOf('china-asn') < ids.indexOf('geoip-cn'));
    assert.ok(ids.indexOf('geoip-cn') < ids.indexOf('china-ipv4'));
  }
  const standalone = renderProfile(client, { rulesets });
  assert.ok(expandedProfileEntries(client, rulesets).length > rulesets.reduce((n, set) => n + set.entries.length, 0) || client === 'shadowrocket');
  validateProfile(client, standalone.content, rulesets);
  const managed = renderManagedProfile(client, { rulesets });
  validateManagedProfile(client, managed.content, rulesets);
  if (client === 'mihomo') {
    const value = parse(managed.content);
    assert.equal(value['geo-auto-update'], true);
    assert.ok(value['geox-url'].asn.startsWith('https://'));
    const geo = ids.indexOf('geoip-cn');
    assert.equal(value.rules[geo], 'RULE-SET,geoip-cn,DIRECT');
  }
  if (client === 'egern') {
    const value = parse(managed.content);
    const urls = value.dns.forward.flatMap(rule => rule.proxy_rule_set ? [rule.proxy_rule_set.match] : []);
    assert.ok(urls.some(url => url.endsWith('/openai-regex.yaml')));
    assert.ok(urls.some(url => url.endsWith('/lan.yaml')));
    assert.equal(urls.some(url => /\/(china-asn|geoip-cn|china-ipv4|china-ipv6)\.yaml$/.test(url)), false,
      'IP database conditions must not be used as DNS hostname selectors');
  }
});

test('empty or service-only profiles do not acquire an unrelated national-IP policy', () => {
  for (const client of clients) {
    assert.deepEqual(profileRoutingResources(client, []), []);
    const model = managedModel(client, { rulesets: rulesets.slice(0, 2) });
    assert.equal(model.rules.some(rule => ['china-asn', 'geoip-cn'].includes(rule.id)), false);
  }
});

test('private subsets sharing a catalog ID do not silently acquire omitted source expressions', () => {
  const custom = [{ version: 1, id: 'adblock', category: 'privacy', entries: [{ type: 'domain', value: 'blocked.example' }] }];
  for (const client of clients) assert.deepEqual(profileRoutingResources(client, custom), []);
});

test('validators reject missing regex and changed native country/ASN matches', () => {
  const content = renderProfile('mihomo', { rulesets }).content;
  assert.ok(content.includes('DOMAIN-REGEX,'));
  assert.throws(() => validateProfile('mihomo', content.replace(/^.*DOMAIN-REGEX,.*\n/m, ''), rulesets));
  assert.throws(() => validateProfile('mihomo', content.replace('GEOIP,CN,DIRECT', 'GEOIP,US,DIRECT'), rulesets));
  const managed = renderManagedProfile('mihomo', { rulesets }).content;
  assert.throws(() => validateManagedProfile('mihomo', managed.replace('RULE-SET,china-asn,DIRECT', 'RULE-SET,china-asn,REJECT'), rulesets));
});
