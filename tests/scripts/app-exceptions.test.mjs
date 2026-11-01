import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFeatures } from '../../tools/lib/features.mjs';
import { renderManagedProfile } from '../../tools/lib/managed-profiles.mjs';
import { renderProfile } from '../../tools/lib/profiles.mjs';
import { matchesEntry } from '../../tools/lib/rules.mjs';
import { parseRules } from '../../src/features/resource-parser/rules.mjs';

const path = 'rules/app-exceptions.list';
const approvedRows = [
  'host,wxapp.tc.qq.com,direct',
  'host-suffix,weixin.qq.com,direct',
  'host-suffix,mon.zijieapi.com,direct',
  'host-suffix,zijieapi.com,direct',
  'host-suffix,mp.toutiao.com,direct',
  'host-suffix,bytedance.com,direct',
  'host-suffix,bytegoofy.com,direct',
  'host,mobads.baidu.com,reject',
  'host-suffix,toutiao-hl.fqnovel.com,reject',
  'host-suffix,misc-lq.fqnovel.com,reject',
  'host-suffix,core-lq.ecombdapi.com,reject',
];
const rows = text => text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
function output() {
  const artifact = renderFeatures('quantumultX').find(item => item.path === path);
  assert.ok(artifact, 'QX optional app-exceptions artifact must exist');
  return artifact.content;
}
function nativeRules() {
  const types = { host: 'domain', 'host-suffix': 'domain-suffix' };
  return rows(output()).map(line => {
    const [type, value, action, ...extras] = line.split(',');
    assert.ok(Object.hasOwn(types, type));
    assert.ok(['direct', 'reject'].includes(action));
    assert.deepEqual(extras, []);
    return { type: types[type], value, action };
  });
}

test('QX app exceptions retain all approved native rows, their order and each action', () => {
  const content = output();
  assert.deepEqual(rows(content), approvedRows);
  assert.equal(content, readFileSync(new URL('../../src/features/app-exceptions/quantumultX.list', import.meta.url), 'utf8'));
  assert.equal(parseRules(content, { sourceFormat: 'qx' }), approvedRows.join('\n') + '\n');
  assert.doesNotMatch(content, /^\s*(?:\[|final\s*,|force-policy\s*=)/im);
});

test('generated app exceptions retain exact and suffix boundaries with their own direct/reject actions', () => {
  const rules = nativeRules();
  for (const rule of rules) {
    assert.equal(matchesEntry(rule, { host: rule.value }), true);
    assert.equal(matchesEntry(rule, { host: 'sub.' + rule.value }), rule.type === 'domain-suffix');
    for (const host of [rule.value + '.evil', 'lookalike' + rule.value]) assert.equal(matchesEntry(rule, { host }), false);
  }
  const action = host => rules.find(rule => matchesEntry(rule, { host }))?.action;
  assert.equal(action('wxapp.tc.qq.com'), 'direct');
  assert.equal(action('chat.weixin.qq.com'), 'direct');
  assert.equal(action('mon.zijieapi.com'), 'direct');
  assert.equal(action('mobads.baidu.com'), 'reject');
  assert.equal(action('sub.toutiao-hl.fqnovel.com'), 'reject');
  assert.equal(action('core-lq.ecombdapi.com'), 'reject');
  for (const host of ['sub.wxapp.tc.qq.com', 'sub.mobads.baidu.com', 'www.baidu.com', 'fqnovel.com', 'ecombdapi.com']) assert.equal(action(host), undefined);
});

test('app exceptions are QX-only and are not automatically loaded by either public profile', () => {
  for (const client of ['surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']) {
    assert.ok(!renderFeatures(client).some(item => item.path === path));
  }
  for (const render of [renderManagedProfile, renderProfile]) assert.doesNotMatch(render('quantumultX').content, /app-exceptions/);
});

test('app exceptions are explicitly registered as an optional MIT native resource', () => {
  const registry = JSON.parse(readFileSync(new URL('../../metadata/features.json', import.meta.url), 'utf8'));
  const feature = registry.features.find(item => item.id === 'app-exceptions');
  assert.ok(feature, 'app-exceptions feature must be registered');
  assert.equal(feature.defaultEnabled, false);
  assert.equal(feature.license, 'MIT');
  assert.deepEqual(Object.keys(feature.clients), ['quantumultX']);
  assert.deepEqual(feature.clients.quantumultX.artifacts, [path]);
  assert.equal(feature.clients.quantumultX.kind, 'optional-filter-resource');
  assert.equal(feature.clients.quantumultX.nativeApp, 'not-run');
});
