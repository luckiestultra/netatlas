import assert from 'node:assert/strict';
import test from 'node:test';
import { surge, loon, shadowrocket, egern } from '../../tools/lib/managed-apple.mjs';

const root = '节点选择';
const groups = [
  { name: root, kind: 'select', choices: ['REJECT', 'DIRECT', '自动选择', '香港节点'] },
  { name: '自动选择', kind: 'auto', choices: [] },
  { name: '香港节点', kind: 'region', choices: [], regex: '(?i)香港|HK|🇭🇰' },
  { name: 'AI服务', kind: 'select', choices: [root, '香港节点', 'DIRECT'] },
  { name: '苹果服务', kind: 'select', choices: ['DIRECT', root] },
  { name: '漏网之鱼', kind: 'select', choices: [root, 'DIRECT'] },
];
const model = client => ({
  groups,
  rules: ['lan', 'adblock', 'openai', 'apple', 'china', 'china-ipv4', 'china-ipv6'].map((id, index) => ({
    id, policy: ['DIRECT', 'REJECT', 'AI服务', '苹果服务', 'DIRECT', 'DIRECT', 'DIRECT'][index],
    url: `https://rules.example.test/clients/${client}/rules/${id}.${client === 'egern' ? 'yaml' : 'list'}`,
  })),
});
const source = { name: '个人订阅', url: 'https://private.example.test/nodes', interval: 3600 };
const node = 'HK Fixture = http, 127.0.0.1, 18080';
const section = (text, name) => text.split(`[${name}]\n`)[1]?.split(/^\[/m)[0].trim() ?? '';
const active = text => text.split('\n').filter(line => line.trim() && !/^\s*[#;]/.test(line)).join('\n');

for (const [id, render] of [['surge', surge], ['loon', loon], ['shadowrocket', shadowrocket]]) {
  test(`managed ${id} keeps rules remote and optional rewrites/MITM inactive`, () => {
    const text = render(model(id));
    assert.doesNotMatch(active(text), /your-provider|password|ca-p12|script-path|DOMAIN-SUFFIX|^IP-CIDR/m);
    assert.match(section(text, 'Proxy Group'), /^AI服务 = select, 节点选择, 香港节点, DIRECT$/m);
    assert.match(section(text, 'Rule'), /^FINAL,漏网之鱼$/m);
    assert.equal(active(section(text, 'MITM')), '');
    assert.equal(active(section(text, id === 'loon' ? 'Rewrite' : 'URL Rewrite')), '');
    const remote = section(text, id === 'loon' ? 'Remote Rule' : 'Rule');
    const urls = [...remote.matchAll(/https:\/\/rules\.example\.test\/[^,\s]+/g)].map(match => match[0]);
    assert.deepEqual(urls, model(id).rules.map(rule => rule.url));
    assert.ok(text.split('\n').length < 110, 'compact profile stays readable');
  });
}

test('managed Surge wires subscription policies into app-native root/auto/region selectors', () => {
  const text = surge(model('surge'), { nodes: [node], subscriptions: [source] });
  const policy = section(text, 'Proxy Group');
  assert.match(policy, /^节点选择 = select, HK Fixture, REJECT, DIRECT, 自动选择, 香港节点, 个人订阅, include-all-proxies=true$/m);
  assert.match(policy, /^自动选择 = url-test, include-all-proxies=true, include-other-group="个人订阅", policy-regex-filter=\.\+, url=https:\/\/www\.gstatic\.com\/generate_204, interval=600, tolerance=50$/m);
  assert.match(policy, /^香港节点 = url-test, .*policy-regex-filter=\(\?i\)香港\|HK\|🇭🇰/m);
  assert.match(policy, /^个人订阅 = select, policy-path=https:\/\/private\.example\.test\/nodes, update-interval=3600$/m);
  assert.match(section(text, 'Rule'), /lan\.list,DIRECT,no-resolve,update-interval=86400/);
  assert.match(section(text, 'Rule'), /china-ipv4\.list,DIRECT,update-interval=86400/);
  assert.doesNotMatch(section(text, 'Rule'), /china-ipv[46]\.list[^\n]*no-resolve/);
  assert.match(section(text, 'General'), /encrypted-dns-follow-outbound-mode = false/);
});

test('managed Loon discovers app subscriptions through native source-less NameRegex filters', () => {
  const text = loon(model('loon'), { subscriptions: [source] });
  assert.match(section(text, 'Remote Proxy'), /^个人订阅 = https:\/\/private\.example\.test\/nodes$/m);
  assert.match(section(text, 'Remote Filter'), /^全部节点 = NameRegex, FilterKey = \.\+$/m);
  assert.match(section(text, 'Remote Filter'), /^香港节点筛选 = NameRegex, FilterKey = \(\?i\)香港\|HK\|🇭🇰$/m);
  assert.match(section(text, 'Proxy Group'), /^自动选择 = url-test, 全部节点, url=/m);
  assert.match(section(text, 'Proxy Group'), /^香港节点 = url-test, 香港节点筛选, url=/m);
  assert.match(section(text, 'Proxy Group'), /^节点选择 = select, REJECT, DIRECT, 自动选择, 香港节点, 全部节点$/m);
  assert.match(section(text, 'Remote Rule'), /openai\.list, policy=AI服务, tag=openai, enabled=true/);
  assert.doesNotMatch(active(text), /RULE-SET|policy-path|update-interval/);
  assert.match(section(text, 'General'), /doh-server = https:\/\/dns\.alidns\.com\/dns-query/);
});

test('managed Shadowrocket uses the Home PROXY selection and native node-name matchers', () => {
  const text = shadowrocket(model('shadowrocket'));
  assert.match(section(text, 'Proxy Group'), /^节点选择 = select, PROXY, REJECT, DIRECT, 自动选择, 香港节点, policy-regex-filter=\.\+$/m);
  assert.match(section(text, 'Proxy Group'), /^香港节点 = url-test, policy-regex-filter=\(\?i\)香港\|HK\|🇭🇰, url=/m);
  assert.doesNotMatch(active(text), /policy-path|Remote Proxy|Remote Filter/);
  assert.match(section(text, 'General'), /proxy-dns-server = system, 223\.5\.5\.5/);
  assert.throws(() => shadowrocket(model('shadowrocket'), { subscriptions: [source] }), /import|materializ/i);
});

test('managed Egern flattens a native subscription selector without a root/auto cycle', () => {
  const nativeNode = { http: { name: 'HK Fixture', server: '127.0.0.1', port: 18080 } };
  const config = egern(model('egern'), { nodes: [nativeNode], subscriptions: [source] });
  const find = name => config.policy_groups.map(group => Object.values(group)[0]).find(group => group.name === name);
  assert.deepEqual(config.proxies, [nativeNode]);
  assert.deepEqual(find('节点订阅'), { name: '节点订阅', policies: ['HK Fixture', 'REJECT'], urls: [source.url], update_interval: 3600 });
  assert.deepEqual(find(root).policies, ['HK Fixture', 'REJECT', 'DIRECT', '自动选择', '香港节点', '节点订阅']);
  assert.equal(find('香港节点').filter, '(?i)香港|HK|🇭🇰');
  assert.equal(find('香港节点').flatten, true);
  assert.deepEqual(find('自动选择').policies, ['节点订阅']);
  assert.deepEqual(config.rules.slice(0, -1).map(rule => rule.rule_set.match), model('egern').rules.map(rule => rule.url));
  assert.ok(config.rules.slice(0, -1).every(rule => rule.rule_set.update_interval === 86400));
  assert.deepEqual(config.rules.at(-1), { default: { policy: '漏网之鱼' } });
  assert.deepEqual(config.dns.bootstrap, ['system', '223.5.5.5']);
  assert.deepEqual(config.dns.proxy_nameservers, ['https://dns.alidns.com/dns-query']);
  assert.equal(config.dns.skip_tls_verify, false);
  assert.equal(config.dns.forward.find(rule => rule.proxy_rule_set?.match.endsWith('/apple.yaml')).proxy_rule_set.value, 'domestic');
  assert.equal(config.dns.forward.find(rule => rule.proxy_rule_set?.match.endsWith('/openai.yaml')).proxy_rule_set.value, 'remote');
  assert.equal(config.dns.forward.find(rule => rule.proxy_rule_set?.match.endsWith('/lan.yaml')).proxy_rule_set.value, 'local');
});

test('managed Apple adapters preserve established private-node and DNS input validation', () => {
  for (const [id, render] of [['surge', surge], ['loon', loon], ['shadowrocket', shadowrocket]]) {
    assert.throws(() => render(model(id), { nodes: ['bad = exec, file, 1'] }), /protocol|executable/i);
    assert.throws(() => render(model(id), { dnsUpstreams: { bootstrap: 'https://dns.test/query' } }), /bootstrap/i);
    assert.match(section(render(model(id), { nodes: [node] }), 'Proxy Group'), /^节点选择 = select, HK Fixture/m);
  }
  const config = egern(model('egern'));
  assert.deepEqual(config.policy_groups.at(-1).select.urls, []);
  assert.equal(JSON.stringify(config).includes('your-provider'), false);
});
