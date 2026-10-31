import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import { loadNativeRouting, nativeRoutingFor, nativeRoutingRegistry, nativeRoutingSettings, parseAsnSource, renderNativeRoutingFragment } from '../../tools/lib/native-routing.mjs';

const root = new URL('../..', import.meta.url).pathname;
const supported = ['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo'];

test('all 5231 active source ASN rules are retained with license, Git blob and canonical data checks', async () => {
  const registry = await loadNativeRouting(root);
  assert.equal(registry.asn.count, 5231);
  assert.equal(registry.asns.length, 5231);
  assert.ok(registry.asns.includes(4134));
  assert.ok(!registry.asns.includes(13335));
  const source = await readFile(root + '/src/vendor/rule-sources/missuo/ASN.China.list', 'utf8');
  assert.deepEqual(parseAsnSource(source), registry.asns);
});

test('ASN source accepts only active exact integer IP-ASN conditions and fails closed on drift', () => {
  assert.deepEqual(parseAsnSource('// source\nIP-ASN,4134 // China Telecom\nIP-ASN,9808\n'), [4134, 9808]);
  for (const source of ['IP-CIDR,1.0.0.0/8', 'IP-ASN,0', 'IP-ASN,4294967296', 'IP-ASN,1.5', 'IP-ASN,04134', 'IP-ASN,4134,no-resolve', 'IP-ASN,4134\nIP-ASN,4134']) {
    assert.throws(() => parseAsnSource(source), /ASN/);
  }
});

test('seven clients export actual ASN and country database conditions, never generated CIDR substitutes', () => {
  for (const client of supported) {
    const resources = nativeRoutingFor(client);
    assert.deepEqual(resources.map(resource => resource.id), ['china-asn', 'geoip-cn']);
    for (const resource of resources) {
      assert.equal(resource.sourceId, 'china-ipv4');
      assert.equal(resource.domainOnly, false);
      assert.equal(resource.policy, 'DIRECT');
      assert.ok(resource.content.endsWith('\n'));
      assert.ok(!/IP-CIDR|ip_cidr/.test(resource.content));
    }
    assert.equal(resources[0].entries.length, 5231);
    assert.deepEqual(resources[1].entries, [{ type: 'geoip', value: 'CN' }]);
    if (client === 'egern') {
      assert.deepEqual(parse(resources[0].content).asn_set, nativeRoutingRegistry.asns.map(asn => `AS${asn}`));
      assert.deepEqual(parse(resources[1].content).geoip_set, ['CN']);
    } else if (['mihomo', 'stash'].includes(client)) {
      assert.deepEqual(parse(resources[0].content).payload, nativeRoutingRegistry.asns.map(asn => `IP-ASN,${asn}`));
      assert.deepEqual(parse(resources[1].content).payload, ['GEOIP,CN']);
    } else {
      const lines = resources[0].content.split('\n').filter(line => line && !line.startsWith('#'));
      assert.equal(lines.length, 5231);
      assert.equal(lines[0], client === 'quantumultX' ? `ip-asn, ${nativeRoutingRegistry.asns[0]}, direct` : `IP-ASN,${nativeRoutingRegistry.asns[0]}`);
    }
  }
});

test('sing-box has a clear native unsupported result and no empty/fake generated ruleset', () => {
  assert.deepEqual(nativeRoutingFor('singBox'), []);
  assert.equal(nativeRoutingSettings('singBox').supported, false);
  const fragment = renderNativeRoutingFragment('singBox');
  assert.equal(fragment.path, 'fragments/native-routing.md');
  assert.match(fragment.content, /removed.*1\.12/);
  assert.match(fragment.content, /not ASN or dynamic GeoIP/);
  assert.throws(() => nativeRoutingFor('clash'), /Unknown/);
});

test('database refresh settings are native per client, not Mihomo keys copied to other clients', () => {
  assert.deepEqual(nativeRoutingSettings('surge').iniFields, { 'disable-geoip-db-auto-update': false });
  assert.ok(nativeRoutingSettings('loon').iniFields['geoip-url']);
  assert.ok(nativeRoutingSettings('loon').iniFields['ipasn-url']);
  assert.ok(nativeRoutingSettings('egern').configFields.geoip_db_url);
  assert.ok(nativeRoutingSettings('egern').configFields.asn_db_url);
  assert.equal(nativeRoutingSettings('mihomo').configFields['geo-auto-update'], true);
  assert.equal(nativeRoutingSettings('mihomo').configFields['geo-update-interval'], 24);
  for (const client of ['quantumultX', 'shadowrocket', 'stash']) {
    assert.deepEqual(nativeRoutingSettings(client).iniFields, {});
    assert.deepEqual(nativeRoutingSettings(client).configFields, {});
  }
});

test('native fragments honor a custom publication mirror in every supported client', () => {
  for (const client of ['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo']) {
    const fragment = renderNativeRoutingFragment(client, undefined, { baseUrl: 'https://mirror.example/netatlas/' });
    assert.ok(fragment.content.includes(`https://mirror.example/netatlas/clients/${client}/rules/china-asn.`), client);
    assert.ok(fragment.content.includes(`https://mirror.example/netatlas/clients/${client}/rules/geoip-cn.`), client);
    assert.doesNotMatch(fragment.content, /raw\.githubusercontent\.com\/luckiestultra\/netatlas/);
  }
});
