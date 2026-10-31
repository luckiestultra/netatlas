import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { renderManagedProfile, managedModel } from '../../tools/lib/managed-profiles.mjs';
import { validateManagedProfile } from '../../tools/lib/managed-validation.mjs';
import { loadCatalog } from '../../tools/lib/build.mjs';
import { clients } from '../../tools/lib/clients.mjs';

const root = resolve(import.meta.dirname, '../..');
const { rulesets } = await loadCatalog(root);
const resourceCounts={quantumultX:121,surge:123,loon:123,shadowrocket:121,egern:127,stash:127,mihomo:127,singBox:125};

for (const client of clients) {
  test(`${client.id}: App default is compact and subscribes to the complete ordered rule catalog`, () => {
    const profile = renderManagedProfile(client.id, { rulesets });
    assert.ok(Buffer.byteLength(profile.content) < 100_000, 'daily profile should contain settings and resource references, not the entire rule database');
    assert.equal(profile.path, `profiles/default.${client.profileExtension}`);
    const result = validateManagedProfile(client.id, profile.content, rulesets);
    assert.equal(result.resources, resourceCounts[client.id]);
    assert.equal(result.entries, 29_153);
    assert.doesNotMatch(profile.content, /Matrix|npm run|private input|your-service-provider/);
    assert.ok(profile.content.includes('日本节点'));
    assert.ok(profile.content.includes('自动选择'));
    assert.ok(profile.content.includes('漏网之鱼'));
    assert.doesNotMatch(profile.content, /chatgpt\.com|100\.64\.0\.0\/10/);
    assert.equal(profile.content, renderManagedProfile(client.id, { rulesets }).content);
  });
}

test('remote rules preserve specific-service priority and use a separately maintained business policy layer', () => {
  const model = managedModel('quantumultX', { rulesets });
  assert.equal(model.rules[0].id, 'lan');
  assert.ok(model.rules.findIndex(rule => rule.id === 'openai') < model.rules.findIndex(rule => rule.id === 'china'));
  assert.equal(model.rules.find(rule => rule.id === 'openai').policy, 'AI服务');
  assert.equal(model.rules.find(rule => rule.id === 'china').policy, 'DIRECT');
  assert.equal(model.rules.find(rule => rule.id === 'adblock').policy, 'REJECT');
  assert.equal(model.rules.some(rule => rule.id === 'anti-ad'), false);
  assert.equal(model.groups.find(group => group.name === '苹果服务').choices[0], 'DIRECT');
  assert.equal(model.groups.find(group => group.name === 'AI服务').choices[0], '节点选择');
  assert.ok(model.groups.filter(group => group.kind === 'region').every(group => group.regex));
});

test('QX uses App-selected proxy, native automatic groups and wires GeoIP without a fragment merge', () => {
  const { content } = renderManagedProfile('quantumultX', { rulesets });
  assert.match(content, /^static=节点选择,proxy,自动选择,direct,.*日本节点.*server-tag-regex=\.\+$/m);
  assert.match(content, /^url-latency-benchmark=自动选择,/m);
  assert.match(content, /^url-latency-benchmark=日本节点,.*server-tag-regex=/m);
  assert.match(content, /^geo_location_checker=http:\/\/ipwho\.de\/json, https:\/\/raw\.githubusercontent\.com\/luckiestultra\/netatlas\/main\/clients\/quantumultX\/scripts\/geoip\.js$/m);
  assert.match(content, /^resource_parser_url=https:\/\/raw\.githubusercontent\.com\/luckiestultra\/netatlas\/main\/clients\/quantumultX\/scripts\/resource-parser\.js$/m);
  assert.match(content, /^\[filter_remote\]$/m);
  assert.match(content, /rules\/openai\.list, tag=openai, force-policy=AI服务, update-interval=86400/);
  assert.equal(content.split('[filter_local]')[1].split(/^\[/m)[0].trim(), 'final,漏网之鱼');
});

test('managed validation rejects a wrong policy, missing resource, invalid group and external URL', () => {
  const { content } = renderManagedProfile('quantumultX', { rulesets });
  for (const bad of [
    content.replace('force-policy=AI服务', 'force-policy=不存在'),
    content.split('\n').filter(line => !line.includes('rules/openai.list,')).join('\n'),
    content.replace('static=AI服务,节点选择,', 'static=AI服务,不存在,'),
    content.replace('/main/clients/quantumultX/rules/openai.list', '/main/clients/surge/rules/openai.list'),
  ]) assert.throws(() => validateManagedProfile('quantumultX', bad, rulesets));
});

test('Surge multiple native subscription sources retain quoted include-other-group references', () => {
  const subscriptions = ['个人订阅', '备用订阅'].map(name => ({ name, url: 'https://private.example.test/' + encodeURIComponent(name) }));
  const profile = renderManagedProfile('surge', { rulesets, subscriptions });
  assert.equal(validateManagedProfile('surge', profile.content, rulesets).resources, resourceCounts.surge);
  assert.throws(() => validateManagedProfile('surge', profile.content.replace('"个人订阅,备用订阅"', '"个人订阅,不存在"'), rulesets), /member/);
});

test('remote CN IP resources can resolve domains while LAN avoids unwanted DNS', async () => {
  const { renderRuleset } = await import('../../tools/lib/exporters.mjs');
  for (const id of ['surge', 'loon', 'shadowrocket', 'stash', 'mihomo', 'egern']) {
    const lan = renderRuleset(id, rulesets.find(rule => rule.id === 'lan')).content;
    assert.match(lan, id === 'egern' ? /no_resolve: true/ : /no-resolve/);
    for (const name of ['china-ipv4', 'china-ipv6']) {
      const cn = renderRuleset(id, rulesets.find(rule => rule.id === name)).content;
      assert.doesNotMatch(cn, /no-resolve|no_resolve: true/);
    }
  }
});

 test('region matchers cover conventional node tags without country-code substring false positives', () => {
  const regions = managedModel('quantumultX', { rulesets }).groups.filter(group => group.kind === 'region');
  const aliases = [['HK01', 'hk01', '[HK] 01', 'Hong_Kong 01'], ['TW01', 'Taiwan'], ['JP01', 'Tokyo'], ['KR01', 'Seoul'], ['SG01', 'Singapore'], ['US01', 'USA01', 'United States']];
  regions.forEach((group, index) => { for (const alias of aliases[index]) assert.match(alias, new RegExp(group.regex)); });
  for (const name of ['Usage node', 'USAGE NODE', 'Australia', 'RUSSIAN']) assert.equal(new RegExp(regions.at(-1).regex).test(name), false);
});
