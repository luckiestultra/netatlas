import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { matchesEntry, normalizeEntry } from '../../tools/lib/rules.mjs';
import { clients } from '../../tools/lib/clients.mjs';
import { renderRuleset, decodeRuleset } from '../../tools/lib/exporters.mjs';
import { parseClassicalYaml } from '../../tools/lib/classical-source.mjs';
import { loadRuleSupplement } from '../../tools/lib/rule-supplements.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('the first-party connectivity repair selection remains a separate three-probe source', async () => {
  const filename = path.join(root, 'src/rules/network/connectivity-probes.json');
  const text = await readFile(filename, 'utf8');
  const rules = JSON.parse(text);
  const hosts = ['captive.apple.com', 'dns.msftncsi.com', 'www.msftconnecttest.com'];
  assert.deepEqual(rules.entries, hosts.map(value => ({ type: 'domain', value })));
  for (const host of hosts) {
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host })), true, host);
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host: 'ads.' + host })), false, host);
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host: host + '.unrelated.example' })), false, host);
  }
  for (const host of ['apple.com', 'ads.apple.com', 'microsoft.com', 'msftconnecttest.com', 'msftncsi.com']) {
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host })), false, host);
  }
  const metadata = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const record = metadata.rulesets.find(item => item.id === 'connectivity-probes');
  assert.equal(record.source.type, 'local');
  assert.equal(record.source.license, 'MIT');
  assert.equal(record.entryCount, 3);
  assert.equal(record.outputSha256, createHash('sha256').update(text).digest('hex'));
  assert.deepEqual(record.source.references, [
    'https://support.apple.com/en-ie/101555',
    'https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/troubleshoot-ncsi-guidance'
  ]);
});

test('all eight native resource formats preserve every Unbreak match condition from licensed inputs', async () => {
  const registry = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const source = registry.rulesets.find(item => item.id === 'unbreak');
  const original = await readFile(path.join(root, 'src/vendor/rule-sources/blackmatrix7', source.source.path), 'utf8');
  const licensed = parseClassicalYaml(original, source.source.path, source.source.selectPayload).entries;
  const originalSupplement = await loadRuleSupplement(root, source.source.localSupplement, 'unbreak');
  const expected = [...licensed, ...originalSupplement.entries].sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`, 'en'));
  const rules = JSON.parse(await readFile(path.join(root, 'src/rules/network/unbreak.json'), 'utf8'));
  assert.deepEqual(rules.entries, expected);
  assert.equal(licensed.length, 48);
  assert.equal(originalSupplement.entries.length, 2);
  for (const client of clients) assert.deepEqual(decodeRuleset(client.id, renderRuleset(client.id, rules).content), expected, client.id);
});

test('underscore candidates can reach the native wb_ad keyword without weakening canonical hostname input', () => {
  const keyword = { type: 'domain-keyword', value: 'wb_ad' };
  for (const host of ['wb_ad.example', 'cdn.WB_AD.example.', '_wb_ad.example']) assert.equal(matchesEntry(keyword, { host }), true, host);
  for (const host of ['wbad.example', 'wb-ad.example', 'example.com']) assert.equal(matchesEntry(keyword, { host }), false, host);
  for (const type of ['domain', 'domain-suffix']) assert.throws(() => normalizeEntry({ type, value: 'wb_ad.example' }), /Invalid domain/);
  for (const host of ['https://wb_ad.example', 'wb_ad.example/path', 'wb_ad.example?x', 'wb_ad..example', '-wb_ad.example', 'wb_ad-.example', 'wb_ad.example:80', 'user@wb_ad.example']) assert.throws(() => matchesEntry(keyword, { host }), /Invalid domain/, host);
});

test('Unbreak preserves the complete 50-condition exception policy without widening exact hosts', async () => {
  const rules = JSON.parse(await readFile(path.join(root, 'src/rules/network/unbreak.json'), 'utf8'));
  assert.equal(rules.entries.length, 50);
  assert.equal(rules.entries.filter(entry => entry.type === 'domain').length, 35);
  assert.equal(rules.entries.filter(entry => entry.type === 'domain-suffix').length, 14);
  assert.deepEqual(rules.entries.filter(entry => entry.type === 'domain-keyword'), [{ type: 'domain-keyword', value: 'wb_ad' }]);
  const matches = host => rules.entries.some(entry => matchesEntry(entry, { host }));
  for (const host of ['ad.10010.com', 'ci.android.com', 'redirector.gvt1.com', 'alt8-mtalk.google.com', 'analytics.strava.com', 'a.f.video.weibocdn.com', 'cdn.bootcss.com', 'x-wb_ad.example']) assert.equal(matches(host), true, host);
  for (const host of ['ads.ci.android.com', 'ads.redirector.gvt1.com', 'analytics.strava.com.evil.example', 'notbootcss.com', 'captive.apple.com', 'dns.msftncsi.com', 'www.msftconnecttest.com', 'ads.example']) assert.equal(matches(host), false, host);
  const metadata = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const source = metadata.rulesets.find(item => item.id === 'unbreak');
  assert.equal(source.source.repository, 'ios-rule-script');
  assert.equal(source.source.selectPayload.length, 48);
  assert.equal(source.source.localSupplement.license, 'MIT');
  assert.deepEqual(source.appliedExclusions, []);
});
