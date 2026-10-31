import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import * as native from '../../tools/lib/native.mjs';
import { renderAntiAd } from '../../tools/lib/anti-ad.mjs';
import { renderRuleset } from '../../tools/lib/exporters.mjs';
import { normalizeRuleset } from '../../tools/lib/rules.mjs';

const baseUrl = 'https://example.test/netatlas/main';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'netatlas-optional-native-'));
  const ruleset = normalizeRuleset({ version: 1, id: 'anti-ad', category: 'privacy', entries: [{ type: 'domain-suffix', value: 'blocked.provider.test' }] });
  const bytes = JSON.stringify(ruleset, null, 2) + '\n';
  await mkdir(path.join(root, 'src/rules/privacy'), { recursive: true });
  await mkdir(path.join(root, 'metadata'));
  await writeFile(path.join(root, 'src/rules/privacy/anti-ad.json'), bytes);
  await writeFile(path.join(root, 'metadata/upstreams.json'), JSON.stringify({ version: 1, repositories: [], rulesets: [{ id: 'anti-ad', category: 'privacy', outputSha256: digest(bytes), entryCount: 1, source: { repository: 'anti-ad' } }] }));
  for (const id of ['mihomo', 'singBox']) {
    const rule = renderRuleset(id, ruleset);
    const fragment = renderAntiAd(id, { baseUrl })[0];
    for (const item of [rule, fragment]) {
      const file = path.join(root, 'clients', id, item.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, item.content);
    }
    await writeFile(path.join(root, 'clients', id, 'manifest.json'), JSON.stringify({ baseUrl }));
  }
  return { root, ruleset, bytes };
}

test('optional AntiAD preparation requires the synced source before attempting native execution', async () => {
  assert.equal(typeof native.prepareAntiAdNativeInputs, 'function');
  const root = await mkdtemp(path.join(tmpdir(), 'netatlas-missing-optional-'));
  await assert.rejects(() => native.prepareAntiAdNativeInputs({ root }), /anti-ad.*sync.*build/i);
});

test('optional AntiAD preparation rejects an edited source independently of rendered artifacts', async () => {
  assert.equal(typeof native.prepareAntiAdNativeInputs, 'function');
  const { root } = await fixture();
  await writeFile(path.join(root, 'src/rules/privacy/anti-ad.json'), 'tampered source');
  await assert.rejects(() => native.prepareAntiAdNativeInputs({ root }), /source.*checksum|source.*SHA/i);
});

test('optional AntiAD preparation requires published rules and rejects stale rules or installer fragments', async () => {
  assert.equal(typeof native.prepareAntiAdNativeInputs, 'function');
  for (const [file, value] of [
    ['clients/mihomo/rules/anti-ad.yaml', 'payload: [DOMAIN-SUFFIX,wrong.test]\n'],
    ['clients/singBox/rules/anti-ad.json', '{"version":3,"rules":[{"domain_suffix":["wrong.test"]}]}\n'],
    ['clients/mihomo/fragments/anti-ad.yaml', 'rules: [MATCH,DIRECT]\n'],
    ['clients/singBox/fragments/anti-ad.json', '{"route":{"rules":[{"action":"route","outbound":"DIRECT"}]}}\n'],
  ]) {
    const { root } = await fixture();
    await writeFile(path.join(root, file), value);
    await assert.rejects(() => native.prepareAntiAdNativeInputs({ root }), /anti-ad.*stale.*build/i);
  }
  const { root } = await fixture();
  // Point a manifest at a new public base without rebuilding its fragment.
  await writeFile(path.join(root, 'clients/mihomo/manifest.json'), '{"baseUrl":"https://changed.test/main"}');
  await assert.rejects(() => native.prepareAntiAdNativeInputs({ root }), /anti-ad.*stale.*build/i);
  const missing = await fixture();
  await rename(path.join(missing.root, 'clients/mihomo/rules/anti-ad.yaml'), path.join(missing.root, 'clients/mihomo/rules/anti-ad.saved'));
  await assert.rejects(() => native.prepareAntiAdNativeInputs({ root: missing.root }), /anti-ad.*missing.*sync.*build/i);
});

test('optional AntiAD configs retain genuine native provider semantics with only file transport substituted', async () => {
  assert.equal(typeof native.prepareAntiAdNativeInputs, 'function');
  const { root, bytes } = await fixture();
  const plan = await native.prepareAntiAdNativeInputs({ root });
  assert.equal(plan.selectedDomain, 'blocked.provider.test');
  assert.equal(plan.source.sha256, digest(bytes));
  assert.equal(plan.source.entries, 1);
  assert.deepEqual(plan.targets.map(item => [item.behavior, item.permitted]), [
    ['optional-suffix-root-reject', false], ['optional-suffix-child-reject', false],
    ['optional-suffix-similar-direct', true], ['optional-suffix-tail-direct', true],
  ]);
  for (const item of plan.inputs) {
    assert.match(item.artifact, /^clients\/(mihomo|singBox)\/rules\/anti-ad\./);
    assert.match(item.artifactSha256, /^[a-f0-9]{64}$/);
    assert.match(item.fragmentSha256, /^[a-f0-9]{64}$/);
    assert.equal(digest(await readFile(path.join(root, item.checkedSnapshot))), item.artifactSha256);
    assert.equal(path.relative(root, item.providerPath).startsWith('.cache/native-check/'), true);
    const config = item.config;
    if (item.client === 'mihomo') {
      const provider = config['rule-providers']['netatlas-anti-ad'];
      assert.equal(provider.type, 'file');
      assert.equal(provider.behavior, 'classical');
      assert.equal(provider.format, 'yaml');
      assert.equal(provider.path, item.providerPath);
      assert.equal(Object.hasOwn(provider, 'url'), false);
      assert.equal(config.rules[0], 'RULE-SET,netatlas-anti-ad,REJECT');
      assert.equal(config['proxy-groups'].find(group => group.name === 'Proxy').proxies[0], 'DIRECT');
      assert.equal(parseYaml(await readFile(item.providerPath, 'utf8')).payload.length, 1);
    } else {
      assert.deepEqual(config.route.rule_set, [{ type: 'local', tag: 'netatlas-anti-ad', format: 'source', path: item.providerPath }]);
      assert.deepEqual(config.route.rules[0], { rule_set: ['netatlas-anti-ad'], action: 'reject' });
      assert.equal(config.outbounds.find(outbound => outbound.tag === 'Proxy').default, 'DIRECT');
      assert.deepEqual(JSON.parse(await readFile(item.providerPath, 'utf8')).rules[0].domain_suffix, ['blocked.provider.test']);
    }
  }
});

test('optional native routing is an explicit integration opt-in and reports source, provider and target evidence', {
  skip: process.env.PROXY_ATLAS_NATIVE_INTEGRATION !== '1', timeout: 60_000,
}, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const result = await native.testOptionalRulesets({ root, binaries: { mihomo: path.join(root, '.cache/bin/mihomo'), singBox: path.join(root, '.cache/bin/sing-box') } });
  assert.equal(result.status, 'passed');
  assert.equal(result.cases.length, 16);
  assert.equal(result.targetRequests, 8);
  assert.equal(result.inputs.length, 2);
  assert.match(result.source.sha256, /^[a-f0-9]{64}$/);
  for (const item of result.cases) assert.equal(item.targetRequests, item.permitted ? 1 : 0);
});
