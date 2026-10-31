import assert from 'node:assert/strict';
import test from 'node:test';
import { mihomo, stash, singBox } from '../../tools/lib/profiles-native.mjs';

const groups = [
  { name: 'Proxy', choices: ['REJECT', 'DIRECT'] },
  { name: 'service', choices: ['Proxy', 'DIRECT'] },
  { name: 'apple', choices: ['DIRECT', 'Proxy'] },
];
const entries = [
  { type: 'domain-suffix', value: 'home.arpa', policy: 'DIRECT' },
  { type: 'domain', value: 'blocked.example', policy: 'REJECT' },
  { type: 'domain-suffix', value: 'service.example', policy: 'service' },
  { type: 'domain-suffix', value: 'google.cn', policy: 'service' },
  { type: 'domain-suffix', value: 'apple.example', policy: 'apple' },
  { type: 'domain-suffix', value: 'domestic.example', policy: 'DIRECT' },
  { type: 'domain-suffix', value: 'cn', policy: 'DIRECT' },
  { type: 'domain-suffix', value: 'google.cn', policy: 'DIRECT' },
  { type: 'ip-cidr', value: '223.5.5.0/24', policy: 'DIRECT' },
  { type: 'ip-cidr6', value: '2400:3200::/32', policy: 'DIRECT' },
];
const clashNode = { name: 'Private-Node', type: 'socks5', server: 'node.example', port: 1080, udp: false };
const singNode = { tag: 'Private-Node', type: 'socks', server: 'node.example', server_port: 1080, version: '5' };

for (const [id, render] of [['mihomo', mihomo], ['stash', stash]]) {
  test(`${id} connects local native nodes and selects one without hand-editing groups`, () => {
    const nodes = [structuredClone(clashNode)];
    const config = render(entries, groups, { nodes });
    assert.deepEqual(nodes, [clashNode], 'rendering must not mutate private input');
    assert.deepEqual(config.proxies, [clashNode]);
    const proxy = config['proxy-groups'].find(group => group.name === 'Proxy');
    assert.equal(proxy['include-all'], true);
    assert.ok(proxy.proxies.includes('Private-Node'));
    assert.equal(proxy.proxies[0], 'Private-Node');
    if (id === 'mihomo') assert.equal(proxy['default-selected'], 'Private-Node');
    assert.equal(config.rules.at(-1), 'MATCH,Proxy');
    assert.ok(config.rules.includes('IP-CIDR,223.5.5.0/24,DIRECT,no-resolve'));
    assert.equal(config['allow-lan'], false);
    assert.equal(config['bind-address'], '127.0.0.1');
  });

  test(`${id} declares real native subscriptions and automatically includes them`, () => {
    const config = render(entries, groups, { subscriptions: [{ name: 'Primary', url: 'https://subscription.example/native.yaml' }] });
    const provider = config['proxy-providers'].Primary;
    assert.equal(provider.url, 'https://subscription.example/native.yaml');
    assert.equal(provider.interval, 3600);
    const proxy = config['proxy-groups'].find(group => group.name === 'Proxy');
    assert.equal(proxy['include-all'], true);
    assert.ok(proxy.use.includes('Primary'));
    assert.equal(proxy.proxies[0], 'REJECT', 'no remote node is invented before its source loads');
    const empty = render(entries, groups);
    assert.equal(empty['proxy-providers'], undefined);
    assert.equal(empty['proxy-groups'][0].proxies[0], 'REJECT');
  });

  test(`${id} separates LAN, domestic, remote and node-bootstrap DNS`, () => {
    const config = render(entries, groups, { nodes: [clashNode] });
    assert.ok(config.dns['default-nameserver'].length);
    assert.ok(config.dns['proxy-server-nameserver'].length);
    assert.equal(config.dns['nameserver-policy']['+.home.arpa'], 'system');
    assert.match(config.dns['nameserver-policy']['+.domestic.example'][0], /223\.5\.5\.5/);
    assert.match(config.dns['nameserver-policy']['+.google.cn'][0], /1\.1\.1\.1/);
    assert.match(config.dns['nameserver-policy']['+.cn'][0], /223\.5\.5\.5/);
    assert.match(config.dns['nameserver-policy']['+.apple.example'][0], /223\.5\.5\.5/);
    if (id === 'mihomo') {
      assert.equal(config.dns.enable, true);
      assert.match(config.dns.nameserver[0], /#Proxy$/);
      assert.match(config.dns['proxy-server-nameserver'][0], /#DIRECT$/);
      assert.match(config.dns['direct-nameserver'][0], /#DIRECT$/);
      assert.equal(config.dns['direct-nameserver-follow-policy'], true);
    } else assert.equal(config.dns['follow-rule'], true);
    assert.doesNotMatch(JSON.stringify(config), /geosite:|GEOIP/);
  });
}

test('sing-box local and materialized subscription nodes are connected to its selector', () => {
  const nodes = [structuredClone(singNode)];
  const config = singBox(entries, groups, { nodes });
  assert.deepEqual(nodes, [singNode]);
  const proxy = config.outbounds.find(outbound => outbound.tag === 'Proxy');
  assert.ok(proxy.outbounds.includes('Private-Node'));
  assert.equal(proxy.default, 'Private-Node');
  assert.equal(config.route.default_domain_resolver, 'bootstrap');
  assert.equal(config.route.final, 'Proxy');
  assert.deepEqual(config.route.rules[0], { action: 'resolve' });
  assert.equal(config.inbounds[0].listen, '127.0.0.1');
  assert.equal(config.inbounds[0].set_system_proxy, false);
  assert.throws(() => singBox(entries, groups, { subscriptions: [{ name: 'remote', url: 'https://subscription.example/native.json' }] }), /materializ|import|expand/i);
  const empty = singBox(entries, groups);
  assert.equal(empty.outbounds.find(outbound => outbound.tag === 'Proxy').default, 'REJECT');
});

test('sing-box explicit DNS roles avoid node-domain bootstrap loops', () => {
  const config = singBox(entries, groups, { nodes: [singNode] });
  const dns = new Map(config.dns.servers.map(server => [server.tag, server]));
  assert.equal(dns.get('local').type, 'local');
  assert.equal(dns.get('bootstrap').type, 'https');
  assert.equal(dns.get('bootstrap').server, '223.5.5.5');
  assert.equal(dns.get('bootstrap').detour, undefined);
  assert.equal(dns.get('domestic').detour, undefined);
  assert.equal(dns.get('remote').detour, 'Proxy');
  assert.equal(config.dns.final, 'remote');
  assert.ok(config.dns.rules.some(rule => rule.domain_suffix?.includes('domestic.example') && rule.server === 'domestic'));
  assert.ok(config.dns.rules.some(rule => rule.domain_suffix?.includes('home.arpa') && rule.server === 'local'));
  assert.ok(config.route.rules.some(rule => rule.ip_cidr?.includes('223.5.5.0/24') && rule.outbound === 'DIRECT'));
  assert.doesNotMatch(JSON.stringify(config), /geosite|geoip|outbound-providers/);
});

for (const [id, render, node] of [['mihomo', mihomo, clashNode], ['stash', stash, clashNode], ['singBox', singBox, singNode]]) {
  test(`${id} rejects colliding names, dangling selected nodes and unsafe sources`, () => {
    const key = id === 'singBox' ? 'tag' : 'name';
    assert.throws(() => render(entries, groups, { nodes: [{ ...node, [key]: 'Proxy' }] }), /name|tag|collision|reserved/i);
    assert.throws(() => render(entries, groups, { nodes: [node, node] }), /duplicate/i);
    for (const type of ['script', 'custom', 'select', 'null']) assert.throws(() => render(entries, groups, { nodes: [{ ...node, type }] }), /protocol/i);
    for (const field of ['script', 'script-path', 'script_path', 'program', 'exec', 'command', 'file']) {
      assert.throws(() => render(entries, groups, { nodes: [{ ...node, [field]: 'not-executed' }] }), /executable|file/i);
      assert.throws(() => render(entries, groups, { nodes: [{ ...node, nested: { [field]: 'not-executed' } }] }), /executable|file/i);
    }
    assert.throws(() => render(entries, groups, { nodes: [node], selectedProxy: 'Missing' }), /select|unknown/i);
    if (id !== 'singBox') {
      assert.throws(() => render(entries, groups, { subscriptions: [{ name: 'bad', url: 'file:///private/nodes' }] }), /https|http|url/i);
      assert.throws(() => render(entries, groups, { subscriptions: [{ name: 'bad', url: 'https://user:password@subscription.example/native.yaml' }] }), /url/i);
      assert.throws(() => render(entries, groups, { subscriptions: [{ name: 'bad', url: 'https://subscription.example/\nother' }] }), /url|control/i);
    }
  });
}

for (const [id, render] of [['mihomo', mihomo], ['stash', stash]]) {
  test(`${id} resolves unmatched hosts for the terminal CN-IP fallback without resolving LAN rules`, () => {
    const config = render([
      { type: 'ip-cidr', value: '10.0.0.0/8', policy: 'DIRECT', rulesetId: 'lan' },
      { type: 'ip-cidr', value: '223.5.5.0/24', policy: 'DIRECT', rulesetId: 'china-ipv4' },
      { type: 'ip-cidr6', value: '2400:3200::/32', policy: 'DIRECT', rulesetId: 'china-ipv6' },
    ], groups);
    assert.deepEqual(config.rules, [
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,223.5.5.0/24,DIRECT',
      'IP-CIDR6,2400:3200::/32,DIRECT',
      'MATCH,Proxy',
    ]);
  });
}

for (const [id, render] of [['mihomo', mihomo], ['singBox', singBox]]) {
  test(`${id} accepts only loopback listener port numbers for private render inputs`, () => {
    const config = render(entries, groups, { listenerPorts: { mixed: 31234, ...(id === 'mihomo' ? { dns: 31235 } : {}) } });
    assert.equal(id === 'mihomo' ? config['mixed-port'] : config.inbounds[0].listen_port, 31234);
    if (id === 'mihomo') assert.equal(config.dns.listen, '127.0.0.1:31235');
    else assert.throws(() => render(entries, groups, { listenerPorts: { dns: 31235 } }), /listener/i);
    for (const bad of [-1, 0, 65536, '31234', null]) assert.throws(() => render(entries, groups, { listenerPorts: { mixed: bad } }), /listener/i);
    assert.throws(() => render(entries, groups, { listenerPorts: { host: '0.0.0.0' } }), /listener/i);
  });
}
