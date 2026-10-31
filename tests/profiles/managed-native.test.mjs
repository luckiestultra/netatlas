import assert from 'node:assert/strict';
import test from 'node:test';
import { mihomo, stash, singBox } from '../../tools/lib/managed-native.mjs';

const groups = [
  { name: '节点选择', kind: 'select', choices: ['REJECT', 'DIRECT'] },
  { name: '自动选择', kind: 'auto', choices: [] },
  { name: '香港节点', kind: 'region', choices: [], regex: 'HK|香港' },
  { name: '日本节点', kind: 'region', choices: [], regex: 'JP|日本' },
  { name: '苹果服务', kind: 'select', choices: ['DIRECT', '节点选择'] },
  { name: 'AI服务', kind: 'select', choices: ['节点选择', 'DIRECT'] },
  { name: '漏网之鱼', kind: 'select', choices: ['节点选择', 'DIRECT'] },
];
function model(client) {
  return { groups, rules: [
    { id: 'lan', policy: 'DIRECT', entryTypes: ['domain-suffix', 'ip-cidr'] },
    { id: 'adblock', policy: 'REJECT', entryTypes: ['domain'] },
    { id: 'ai', policy: 'AI服务', entryTypes: ['domain-suffix'] },
    { id: 'apple', policy: '苹果服务', entryTypes: ['domain-suffix'] },
    { id: 'china', policy: 'DIRECT', entryTypes: ['domain-suffix'] },
    { id: 'china-ipv4', policy: 'DIRECT', entryTypes: ['ip-cidr'] },
    { id: 'china-ipv6', policy: 'DIRECT', entryTypes: ['ip-cidr6'] },
  ].map(rule => ({ ...rule, url: `https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/${client}/rules/${rule.id}.${client === 'singBox' ? 'json' : 'yaml'}` })) };
}
const nodes = {
  clash: ['HK-A', 'JP-A'].map(name => ({ name, type: 'socks5', server: 'node.example', port: 1080 })),
  sing: ['HK-A', 'JP-A'].map(tag => ({ tag, type: 'socks', server: 'node.example', server_port: 1080 })),
};

for (const [client, render] of [['mihomo', mihomo], ['stash', stash]]) {
  test(`${client} publishes compact native remote providers with truthful empty node input`, () => {
    const input = model(client), snapshot = structuredClone(input), config = render(input);
    assert.deepEqual(input, snapshot);
    assert.deepEqual(config.proxies, []);
    assert.equal(config['proxy-providers'], undefined);
    assert.equal(config['proxy-groups'][0].proxies[0], 'REJECT');
    assert.equal(config.rules.length, input.rules.length + 1);
    assert.equal(config.rules.at(-1), 'MATCH,漏网之鱼');
    for (const rule of input.rules) {
      assert.equal(config['rule-providers'][rule.id].url, rule.url);
      assert.equal(config['rule-providers'][rule.id].behavior, 'classical');
      assert.equal(config['rule-providers'][rule.id].interval, 86400);
    }
    const policy = config.dns['nameserver-policy'];
    assert.equal(policy['+.home.arpa'], 'system');
    assert.match(policy['rule-set:apple'][0], /223\.5\.5\.5/);
    assert.match(policy['rule-set:ai'][0], /1\.1\.1\.1/);
    assert.equal(policy['rule-set:china-ipv4'], undefined);
    assert.ok(Object.keys(policy).length < 10);
    assert.doesNotMatch(JSON.stringify(config), /DOMAIN-SUFFIX,|geosite:|GEOIP/);
  });

  test(`${client} connects real nodes, native subscriptions and automatic region filters`, () => {
    const config = render(model(client), { nodes: nodes.clash, subscriptions: [{ name: 'Private', url: 'https://subscription.example/native.yaml' }] });
    assert.equal(config['proxy-providers'].Private.url, 'https://subscription.example/native.yaml');
    const root = config['proxy-groups'][0], hk = config['proxy-groups'].find(group => group.name === '香港节点');
    assert.equal(root.proxies[0], 'HK-A');
    assert.ok(root.proxies.includes('自动选择') && root.proxies.includes('日本节点'));
    assert.deepEqual(hk.proxies, ['HK-A']);
    assert.equal(hk.type, 'url-test');
    assert.equal(hk.filter, 'HK|香港');
    assert.deepEqual(hk.use, ['Private']);
    assert.equal(config['bind-address'], '127.0.0.1');
    assert.throws(() => render(model(client), { nodes: [{ ...nodes.clash[0], name: '节点选择' }] }), /reserved/);
  });
}

test('sing-box uses native remote source rules and region outbounds without invented subscriptions', () => {
  const config = singBox(model('singBox'), { nodes: nodes.sing });
  assert.equal(config.outbounds.find(outbound => outbound.tag === '节点选择').default, 'HK-A');
  assert.deepEqual(config.outbounds.find(outbound => outbound.tag === '香港节点').outbounds, ['HK-A']);
  assert.deepEqual(config.outbounds.find(outbound => outbound.tag === '日本节点').outbounds, ['JP-A']);
  assert.equal(config.route.final, '漏网之鱼');
  assert.ok(config.route.rule_set.every(rule => rule.type === 'remote' && rule.format === 'source' && rule.update_interval === '1d' && rule.http_client === 'netatlas-resources'));
  assert.equal(config.http_clients[0].detour, undefined);
  assert.equal(config.http_clients[0].domain_resolver, 'bootstrap');
  assert.equal(config.dns.servers.find(server => server.tag === 'remote').detour, '节点选择');
  assert.ok(config.dns.rules.some(rule => rule.rule_set?.includes('adblock') && rule.action === 'reject'));
  assert.ok(config.dns.rules.some(rule => rule.rule_set?.includes('apple') && rule.server === 'domestic'));
  assert.ok(config.route.rules.findIndex(rule => rule.action === 'resolve' && !rule.domain_suffix) > config.route.rules.findIndex(rule => rule.rule_set?.includes('adblock')));
  const empty = singBox(model('singBox'));
  assert.equal(empty.outbounds.find(outbound => outbound.tag === '节点选择').default, 'REJECT');
  assert.deepEqual(empty.outbounds.find(outbound => outbound.tag === '香港节点').outbounds, ['REJECT']);
  assert.equal(config.inbounds[0].set_system_proxy, false);
  assert.throws(() => singBox(model('singBox'), { subscriptions: [{ name: 'private', url: 'https://subscription.example/native.json' }] }), /no native subscription provider/);
});

test('managed native inputs retain loopback listeners and private validation', () => {
  const config = mihomo(model('mihomo'), { listenerPorts: { mixed: 31871, dns: 31872 }, dnsUpstreams: { domestic: 'tcp://127.0.0.1:31873' } });
  assert.equal(config['mixed-port'], 31871);
  assert.equal(config.dns.listen, '127.0.0.1:31872');
  assert.equal(config.dns['nameserver-policy']['rule-set:china'][0], 'tcp://127.0.0.1:31873#DIRECT');
  assert.throws(() => mihomo(model('mihomo'), { listenerPorts: { host: '0.0.0.0' } }), /listener/);
  assert.throws(() => singBox(model('singBox'), { nodes: [{ ...nodes.sing[0], command: 'unsafe' }] }), /Executable/);
  const unsafe = model('stash'); unsafe.rules[0].url = 'file:///private/rules';
  assert.throws(() => stash(unsafe), /URL/);
});

test('public Mihomo profile declares native VPN capture and automatic interface selection', () => {
  const config = mihomo(model('mihomo'));
  assert.equal(config.tun.enable, true);
  assert.equal(config.tun['auto-route'], true);
  assert.equal(config.tun['auto-detect-interface'], true);
  assert.deepEqual(config.tun['dns-hijack'], ['any:53', 'tcp://any:53']);
  assert.equal(config.tun['dns-mode'], 'hijack');
  assert.equal(config.tun['strict-route'], true);
  assert.equal(config.tun.stack, 'mixed');
  assert.equal(config.tun.device, undefined);
  assert.equal(config['bind-address'], '127.0.0.1');
  assert.equal(mihomo(model('mihomo'), { captureTraffic: false }).tun, undefined);
  assert.throws(() => mihomo(model('mihomo'), { captureTraffic: 'false' }), /captureTraffic/);
});

test('public sing-box profile declares native VPN capture, DNS hijacking and sniffing', () => {
  const config = singBox(model('singBox'));
  const tun = config.inbounds.find(inbound => inbound.type === 'tun');
  assert.equal(tun.auto_route, true);
  assert.equal(tun.strict_route, true);
  assert.equal(tun.dns_mode, 'hijack');
  assert.equal(tun.stack, 'mixed');
  assert.deepEqual(tun.address, ['172.19.0.1/30', 'fdfe:dcba:9876::1/126']);
  assert.equal(tun.interface_name, undefined);
  assert.equal(config.route.auto_detect_interface, true);
  assert.equal(config.dns.reverse_mapping, true);
  assert.ok(config.route.rules.some(rule => rule.action === 'hijack-dns' && rule.port === 53 && rule.inbound.includes(tun.tag)));
  assert.ok(config.route.rules.some(rule => rule.action === 'sniff' && rule.inbound.includes(tun.tag)));
  const fixture = singBox(model('singBox'), { captureTraffic: false });
  assert.ok(fixture.inbounds.every(inbound => inbound.type !== 'tun'));
  assert.equal(fixture.route.auto_detect_interface, undefined);
  assert.equal(fixture.inbounds[0].listen, '127.0.0.1');
  assert.equal(fixture.inbounds[0].set_system_proxy, false);
  assert.throws(() => singBox(model('singBox'), { captureTraffic: 'false' }), /captureTraffic/);
});
