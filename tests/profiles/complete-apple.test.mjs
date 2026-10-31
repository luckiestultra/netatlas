import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as yaml } from 'yaml';
import { surge, loon, shadowrocket, egern } from '../../tools/lib/profiles-apple.mjs';

const entries = [
  { type: 'domain-suffix', value: 'home.arpa', policy: 'DIRECT' },
  { type: 'domain-suffix', value: 'ads.test', policy: 'REJECT' },
  { type: 'domain-suffix', value: 'ai.test', policy: 'openai' },
  { type: 'domain-suffix', value: 'china.test', policy: 'DIRECT' },
  { type: 'ip-cidr', value: '1.0.1.0/24', policy: 'DIRECT', rulesetId: 'china-ipv4' },
  { type: 'ip-cidr', value: '192.168.0.0/16', policy: 'DIRECT', rulesetId: 'lan' },
];
const groups = [{ name: 'Proxy', choices: ['REJECT', 'DIRECT'] }, { name: 'openai', choices: ['Proxy', 'DIRECT'] }];
const lineNode = 'Self Hosted = http, 127.0.0.1, 18080';
const subscription = { name: 'Personal-Subscription', url: 'https://private.example.test/nodes?token=fixture', interval: 3600 };
const objectNode = { http: { name: 'Self Hosted', server: '127.0.0.1', port: 18080 } };
const section = (text, name) => text.split(`[${name}]`)[1]?.split(/^\[/m)[0].trim() ?? '';
const active = text => text.split('\n').filter(line => line.trim() && !/^\s*[#;]/.test(line)).join('\n');

for (const [client, render] of [['surge', surge], ['loon', loon], ['shadowrocket', shadowrocket]]) {
  test(`${client} materializes a supplied local node and makes it the active Proxy choice`, () => {
    const text = render(entries, groups, { nodes: [lineNode] });
    assert.match(section(text, 'Proxy'), /Self Hosted = http, 127\.0\.0\.1, 18080/);
    assert.match(section(text, 'Proxy Group'), /^Proxy = select, Self Hosted, REJECT, DIRECT/m);
    assert.match(section(text, 'Rule'), /DOMAIN-SUFFIX,ai\.test,openai/);
    assert.match(section(text, 'Rule'), /DOMAIN-SUFFIX,china\.test,DIRECT/);
    assert.match(section(text, 'Rule'), /^IP-CIDR,1\.0\.1\.0\/24,DIRECT$/m);
    assert.match(section(text, 'Rule'), /^IP-CIDR,192\.168\.0\.0\/16,DIRECT,no-resolve$/m);
    assert.equal(section(text, 'Rule').split('\n').at(-1), 'FINAL,Proxy');
    assert.doesNotMatch(text, /skip.*cert.*(?:true|1)|0\.0\.0\.0:|p12\s*=/i);
  });
  test(`${client} has no active fake endpoint and no proxy leak when private input is absent`, () => {
    const text = render(entries, groups);
    assert.match(section(text, 'Proxy Group'), /^Proxy = select, REJECT, DIRECT/m);
    assert.equal(section(text, 'Proxy').split('\n').filter(line => line && !line.startsWith('#')).length, 0);
    assert.doesNotMatch(active(text), /example\.(?:com|test)|password|your-service-provider/);
    assert.match(section(text, 'General'), /dns-server\s*=/);
  });
}

test('Surge connects native subscription policy-path sources and all profile-local proxies', () => {
  const text = surge(entries, groups, { subscriptions: [subscription] });
  const policy = section(text, 'Proxy Group');
  assert.match(policy, /^Proxy = select, REJECT, DIRECT, Personal-Subscription, include-all-proxies=true/m);
  assert.match(policy, /Personal-Subscription = select, policy-path=https:\/\/private\.example\.test\/nodes\?token=fixture, update-interval=3600/);
  assert.match(section(text, 'General'), /encrypted-dns-follow-outbound-mode = false/);
  assert.match(section(text, 'General'), /encrypted-dns-skip-cert-verification = false/);
});

test('Loon connects native Remote Proxy aliases instead of treating them as local node names', () => {
  const text = loon(entries, groups, { subscriptions: [subscription] });
  assert.match(section(text, 'Remote Proxy'), /^Personal-Subscription = https:\/\/private\.example\.test\/nodes\?token=fixture/m);
  assert.match(section(text, 'Proxy Group'), /^Proxy = select, REJECT, DIRECT, Personal-Subscription/m);
  assert.match(section(text, 'General'), /doh-server = https:\/\/dns\.alidns\.com\/dns-query/);
});

test('Shadowrocket discovers app-managed subscription nodes with its own supported matcher', () => {
  const text = shadowrocket(entries, groups, { nodes: [lineNode] });
  assert.match(section(text, 'Proxy Group'), /policy-regex-filter=\.\+/);
  assert.match(section(text, 'General'), /proxy-dns-server = system, 223\.5\.5\.5/);
  assert.match(section(text, 'General'), /direct-dns-server = https:\/\/dns\.alidns\.com\/dns-query/);
  assert.throws(() => shadowrocket(entries, groups, { subscriptions: [subscription] }), /materializ|import/i);
  assert.doesNotMatch(active(text), /policy-path|Remote Proxy/);
});

test('Egern connects typed local nodes and native subscription URLs to the actual Proxy selector', () => {
  const config = egern(entries, groups, { nodes: [objectNode], subscriptions: [subscription] });
  const proxy = config.policy_groups.find(group => group.select?.name === 'Proxy').select;
  assert.deepEqual(config.proxies, [objectNode]);
  assert.deepEqual(proxy.policies, ['Self Hosted', 'REJECT', 'DIRECT']);
  assert.deepEqual(proxy.urls, [subscription.url]);
  assert.equal(proxy.update_interval, 3600);
  assert.deepEqual(config.dns.bootstrap, ['system', '223.5.5.5']);
  assert.deepEqual(config.dns.proxy_nameservers, ['https://dns.alidns.com/dns-query']);
  assert.deepEqual(config.dns.forward.at(-1), { domain_wildcard: { match: '*', value: 'remote' } });
  assert.equal(config.dns.skip_tls_verify, false);
  assert.deepEqual(config.rules.at(-1), { default: { policy: 'Proxy' } });
  assert.equal(config.rules.find(rule => rule.ip_cidr?.match === '1.0.1.0/24').ip_cidr.no_resolve, undefined);
  assert.equal(config.rules.find(rule => rule.ip_cidr?.match === '192.168.0.0/16').ip_cidr.no_resolve, true);
  assert.equal(config.allow_external_connections, false);
  assert.ok(yaml(JSON.stringify(config)).policy_groups);
});

test('Apple renderers reject injected sections, ambiguous names, unselected nodes and unsafe source URLs', () => {
  for (const render of [surge, loon, shadowrocket]) {
    for (const node of ['Bad = http, 127.0.0.1, 80\n[Rule]', 'Proxy = http, 127.0.0.1, 80', '#Disabled = http, 127.0.0.1, 80', ';Disabled = http, 127.0.0.1, 80', '//Disabled = http, 127.0.0.1, 80']) {
      assert.throws(() => render(entries, groups, { nodes: [node] }), /node|name|line|reserved/i);
    }
    assert.throws(() => render(entries, groups, { nodes: [lineNode], selectedProxy: 'Missing' }), /selected|unknown/i);
  }
  for (const render of [surge, loon, egern]) {
    for (const url of ['https://good.test/\n[Rule]', 'https://user:pass@good.test/sub', 'file:///etc/passwd', 'https://good.test/x,y']) {
      assert.throws(() => render(entries, groups, { subscriptions: [{ ...subscription, url }] }), /URL|subscription/i);
    }
  }
  assert.throws(() => egern(entries, groups, { nodes: [{ http: { ...objectNode.http, name: 'Proxy' } }] }), /reserved|name/i);
});

test('a controlled plain DNS override stays in native plain-DNS fields rather than a DoH field', () => {
  const options = { dnsUpstreams: { bootstrap: '127.0.0.1:1053', domestic: 'udp://127.0.0.1:1053', local: 'system' } };
  for (const render of [surge, loon]) {
    const general = section(render(entries, groups, options), 'General');
    assert.match(general, /dns-server = system, 127\.0\.0\.1:1053/);
    assert.doesNotMatch(general, /(?:encrypted-dns-server|doh-server) = (?:udp:|127\.)/);
  }
  for (const render of [surge, loon, shadowrocket, egern]) {
    assert.throws(() => render(entries, groups, { dnsUpstreams: { bootstrap: 'dns.example.test' } }), /bootstrap|DNS/i);
  }
});

test('native node inputs must be supported network proxies with valid endpoints, never executable scripts', () => {
  for (const render of [surge, loon, shadowrocket]) {
    for (const line of [
      'Bad = script, https://evil.test/run.js, 443',
      'Bad = custom, node.test, 443, script-path=https://evil.test/run.js',
      'Bad = http, node.test, 99999',
      'Bad = http, node.test, 0',
      'Bad = http, https://node.test/path, 80',
      'Bad = http, node.test, 80, script-path=https://evil.test/run.js',
    ]) assert.throws(() => render(entries, groups, { nodes: [line] }), /node|protocol|port|endpoint|script/i);
    assert.match(render(entries, groups, { nodes: ['TLSNode = https, node.test, 443, username=fixture, password=fixture, sni=node.test, skip-cert-verify=false'] }), /TLSNode/);
  }
  for (const proxy of [
    { script: { name: 'Bad', script_path: 'https://evil.test/run.js' } },
    { http: { name: 'Bad', server: 'node.test', port: 99999 } },
    { http: { name: 'Bad', server: 'https://node.test/path', port: 80 } },
    { http: { name: 'Bad', server: 'node.test', port: 80, script_path: 'https://evil.test/run.js' } },
  ]) assert.throws(() => egern(entries, groups, { nodes: [proxy] }), /node|protocol|port|endpoint|script/i);
});

// Model only the documented ordered domain/suffix/wildcard contract. This is
// generated-config validation, not a claim that an Egern application was run.
function firstDnsTarget(forward, domain) {
  const query = domain.toLowerCase();
  for (const rule of forward) {
    const [type, { match, value }] = Object.entries(rule)[0];
    const pattern = match.toLowerCase();
    if (type === 'domain' && query === pattern
      || type === 'domain_suffix' && (query === pattern || query.endsWith(`.${pattern}`))
      || type === 'domain_wildcard' && pattern === '*') return value;
  }
  return undefined;
}

test('Egern DNS first-match preserves local names, blocked names, direct services and Proxy exceptions ahead of broad CN rules', () => {
  const dnsEntries = [
    { type: 'domain-suffix', value: 'private.home', policy: 'DIRECT', rulesetId: 'lan' },
    { type: 'domain', value: 'ads.google.cn', policy: 'REJECT', rulesetId: 'adblock' },
    { type: 'domain', value: 'scholar.google.cn', policy: 'google', rulesetId: 'google' },
    { type: 'domain-suffix', value: 'google.cn', policy: 'google', rulesetId: 'google' },
    { type: 'domain-suffix', value: 'apple.com', policy: 'apple', rulesetId: 'apple' },
    { type: 'domain-suffix', value: 'cn', policy: 'DIRECT', rulesetId: 'china' },
    { type: 'domain-suffix', value: 'google.cn', policy: 'DIRECT', rulesetId: 'china' },
  ];
  const dnsGroups = [
    ...groups,
    { name: 'google', choices: ['Proxy', 'DIRECT'] },
    { name: 'apple', choices: ['DIRECT', 'Proxy'] },
  ];
  const config = egern(dnsEntries, dnsGroups, { nodes: [{ http: { ...objectNode.http, server: 'proxy.google.cn' } }] });
  const expected = Object.fromEntries([
    ['localhost', 'local'],
    ['printer.local', 'local'],
    ['nas.home.arpa', 'local'],
    ['router.lan', 'local'],
    ['server.private.home', 'local'],
    ['ads.google.cn', 'reject'],
    ['google.cn', 'remote'],
    ['scholar.google.cn', 'remote'],
    ['docs.google.cn', 'remote'],
    ['apple.com', 'domestic'],
    ['support.apple.com', 'domestic'],
    ['ordinary.cn', 'domestic'],
    ['ordinary.test', 'remote'],
    ['notgoogle.cn.example', 'remote'],
  ]);
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map(host => [host, firstDnsTarget(config.dns.forward, host)])), expected);
  assert.deepEqual(config.dns.upstreams.local, ['system']);
  // Native proxy DNS explicitly bypasses Forward and connects directly; a
  // hostname proxy therefore never depends on remote default-DNS routing.
  assert.equal(firstDnsTarget(config.dns.forward, 'proxy.google.cn'), 'remote');
  assert.deepEqual(config.dns.proxy_nameservers, config.dns.upstreams.domestic);
  assert.deepEqual(config.dns.bootstrap, ['system', '223.5.5.5']);
});

test('Egern local DNS forwarding honors a controlled local resolver override', () => {
  const config = egern(entries, groups, { dnsUpstreams: { local: '127.0.0.1:1053' } });
  const target = firstDnsTarget(config.dns.forward, 'printer.home.arpa');
  assert.equal(target, 'local');
  assert.deepEqual(config.dns.upstreams[target], ['127.0.0.1:1053']);
  assert.deepEqual(config.dns.proxy_nameservers, ['https://dns.alidns.com/dns-query']);
});

test('Egern AnyTLS enables certificate verification unless private native input explicitly opts out', () => {
  const settings = { name: 'Secure AnyTLS', server: 'node.test', port: 443, password: 'fixture' };
  const input = { anytls: settings };
  const generated = egern(entries, groups, { nodes: [input] });
  assert.equal(generated.proxies[0].anytls.skip_tls_verify, false);
  assert.equal(Object.hasOwn(settings, 'skip_tls_verify'), false, 'private input must not be mutated');
  for (const value of [true, false]) {
    const explicit = egern(entries, groups, { nodes: [{ anytls: { ...settings, skip_tls_verify: value } }] });
    assert.equal(explicit.proxies[0].anytls.skip_tls_verify, value);
  }
  for (const invalid of [null, 1, 'false']) {
    assert.throws(() => egern(entries, groups, { nodes: [{ anytls: { ...settings, skip_tls_verify: invalid } }] }), /skip_tls_verify|boolean/i);
  }
});
