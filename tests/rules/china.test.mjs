import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { matchesEntry } from '../../tools/lib/rules.mjs';
import { orderedRulesets, policyForRuleset } from '../../tools/lib/policies.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const load = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const china = await load('src/rules/system/china.json');
const ipv4 = await load('src/rules/network/china-ipv4.json');
const ipv6 = await load('src/rules/network/china-ipv6.json');
const registry = await load('metadata/upstreams.json');
const matches = (ruleset, target) => ruleset.entries.some(entry => matchesEntry(entry, target));

test('the pinned CN domain closure covers unenumerated domestic services and real suffix boundaries', () => {
  assert.equal(china.entries.length, 8387);
  for (const host of ['www.meituan.com', 'www.gov.cn', 'www.baidu.com', 'www.bilibili.com', 'www.xiaohongshu.com', 'foo.中国']) {
    assert.equal(matches(china, { host }), true, host);
  }
  for (const host of ['www.google.com', 'github.com', 'openai.com', 'evilmeituan.com', 'meituan.com.invalid']) {
    assert.equal(matches(china, { host }), false, host);
  }
});

test('upstream negative-CN attributes do not bring the international service into domestic routing', () => {
  assert.equal(matches(china, { host: 'game.mihoyo.com' }), true);
  assert.equal(matches(china, { host: 'www.hoyoverse.com' }), false);
  const record = registry.rulesets.find(item => item.id === 'china');
  assert.equal(record.source.list, 'cn');
  assert.equal(record.files.length, 361);
  assert.equal(record.attributeFiltered, 482);
  assert.equal(record.affiliationDeclarations, 0);
});

test('CN IPv4 and IPv6 fallbacks include domestic resolvers and exclude foreign resolver addresses', () => {
  assert.equal(ipv4.entries.length, 6174);
  assert.equal(ipv6.entries.length, 3475);
  for (const ip of ['223.5.5.5', '119.29.29.29']) assert.equal(matches(ipv4, { ip }), true, ip);
  for (const ip of ['1.1.1.1', '8.8.8.8', '203.0.113.1']) assert.equal(matches(ipv4, { ip }), false, ip);
  for (const ip of ['2400:3200::1', '2402:4e00::']) assert.equal(matches(ipv6, { ip }), true, ip);
  for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(matches(ipv6, { ip }), false, ip);
  assert.equal(ipv4.entries.every(entry => entry.type === 'ip-cidr'), true);
  assert.equal(ipv6.entries.every(entry => entry.type === 'ip-cidr6'), true);
});

test('CN network data retain pinned MIT provenance and a complete original license', async () => {
  const repository = registry.repositories.find(item => item.id === 'china-operator-ip');
  assert.equal(repository.repository, 'gaoyifan/china-operator-ip');
  assert.equal(repository.revision, 'f7533065e164cbe0cf24b488a77ca75b8e897923');
  assert.equal(repository.license, 'MIT');
  const license = await readFile(path.join(root, 'src/vendor/china-operator-ip/LICENSE'));
  assert.equal(createHash('sha256').update(license).digest('hex'), repository.licenseSha256);
  for (const id of ['china-ipv4', 'china-ipv6']) {
    const record = registry.rulesets.find(item => item.id === id);
    assert.equal(record.source.repository, repository.id);
    assert.equal(record.source.format, 'cidr-lines');
    assert.equal(record.exclusions.length, 0);
  }
});

test('all three nonportable CN expressions are retained as exact reviewed exceptions', () => {
  const record = registry.rulesets.find(item => item.id === 'china');
  assert.deepEqual(record.appliedExclusions.map(item => [item.file, item.line, item.rule]), [
    ['aws-cn', 31, 'regexp:.+\\.awsdns-cn-[0-9][0-9]\\.(biz|com|net|top)$'],
    ['aws-cn', 32, 'regexp:.+\\.awsdns-cn-[0-9][a-e0-9]\\.cn$'],
    ['mihoyo-cn', 31, 'regexp:^.+-mihayo\\.akamaized\\.net$'],
  ]);
  assert.equal(record.exclusions.length, 3);
  assert.equal(record.appliedExclusions.every(item => item.sourceLine && item.reason.includes('no equivalent')), true);
});

test('domestic fallbacks are DIRECT and remain after explicit service decisions', async () => {
  const google = await load('src/rules/system/google.json');
  const ordered = orderedRulesets([china, ipv4, ipv6, google]);
  for (const ruleset of [china, ipv4, ipv6]) assert.equal(policyForRuleset(ruleset), 'DIRECT', ruleset.id);
  assert.equal(ordered[0].id, 'google', 'A CN TLD must not swallow the explicit Google service selector');
  const selected = ordered.find(ruleset => matches(ruleset, { host: 'www.google.cn' }));
  assert.equal(selected.id, 'google');
  assert.equal(policyForRuleset(selected), 'google');
});
