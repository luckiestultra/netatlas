import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { profileFormats, renderProfile } from '../../tools/lib/profiles.mjs';

const clients = ['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox'];
const rulesets = [
  { version: 1, id: 'lan', category: 'network', entries: [
    { type: 'domain', value: 'localhost' },
    { type: 'ip-cidr', value: '192.168.0.0/16' },
    { type: 'ip-cidr6', value: 'fc00::/7' },
  ] },
  { version: 1, id: 'adblock', category: 'privacy', entries: [{ type: 'domain', value: 'blocked.example.test' }] },
  { version: 1, id: 'test-ai', category: 'ai', entries: [{ type: 'domain-suffix', value: 'ai.example.test' }] },
];

function iniSection(text, name) {
  const marker = `[${name}]`;
  const section = text.slice(text.indexOf(marker) + marker.length).split(/^\[/m)[0];
  return section.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
}

for (const client of clients) {
  test(`${client}: emits a deterministic standalone native profile`, () => {
    const profile = renderProfile(client, { rulesets, baseUrl: 'https://not-published.invalid/repository' });
    assert.match(profile.path, /^profiles\/default\.(conf|yaml|json)$/);
    assert.equal(profile.format, profileFormats[client].format);
    assert.ok(profile.content.length > 100);
    assert.equal(profile.content, renderProfile(client, { rulesets, baseUrl: 'https://another.invalid' }).content);
    assert.doesNotMatch(profile.content, /not-published|another\.invalid|your-service-provider|access_token|password\s*[=:]/i);
    if (profile.format === 'json') assert.ok(JSON.parse(profile.content).route.rules.length);
    if (profile.format === 'yaml') assert.ok(parseYaml(profile.content).rules.length);
    if (profile.format === 'ini') assert.match(profile.content, /\[(filter_local|Rule)\]/);
  });
}

test('quantumultX uses native host/IP6 types and lowercase builtins without renaming groups', () => {
  const text = renderProfile('quantumultX', { rulesets }).content;
  assert.deepEqual(iniSection(text, 'filter_local'), [
    'host,localhost,direct',
    'ip-cidr,192.168.0.0/16,direct',
    'ip6-cidr,fc00::/7,direct',
    'host,blocked.example.test,reject',
    'host-suffix,ai.example.test,test-ai',
    'final,Proxy',
  ]);
  assert.ok(iniSection(text, 'policy').includes('static=Proxy,reject,direct,server-tag-regex=.+'));
  assert.match(text, /^\[server_remote\]$/m);
  assert.doesNotMatch(text, /^no-ipv6$/m);
});

for (const client of ['surge', 'loon', 'shadowrocket']) {
  test(`${client}: explicit policy membership and ordered native IPv4/IPv6 rules`, () => {
    const text = renderProfile(client, { rulesets }).content;
    const proxyLine=iniSection(text,'Proxy Group').find(line=>line.startsWith('Proxy ='));
    assert.deepEqual(proxyLine.split(',').slice(1).map(x=>x.trim()).filter(x=>!x.includes('=')),['REJECT','DIRECT']);
    if(client==='surge')assert.match(proxyLine,/include-all-proxies=true/);
    if(client==='shadowrocket')assert.match(proxyLine,/policy-regex-filter=\.\+/);
    const lines = iniSection(text, 'Rule');
    assert.equal(lines[0], 'DOMAIN,localhost,DIRECT');
    assert.equal(lines[1], 'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve');
    assert.match(lines[2], /^IP-CIDR6,fc00::\/7,DIRECT,no-resolve$/);
    assert.equal(lines[3], 'DOMAIN,blocked.example.test,REJECT');
    assert.equal(lines[4], 'DOMAIN-SUFFIX,ai.example.test,test-ai');
    assert.equal(lines.at(-1), 'FINAL,Proxy');
  });
}

test('Egern uses native typed policy groups and rule objects, not Clash YAML', () => {
  const data = parseYaml(renderProfile('egern', { rulesets }).content);
  assert.equal(data.allow_external_connections, false);
  assert.deepEqual(data.policy_groups.find(group => group.select.name === 'Proxy').select.policies, ['REJECT', 'DIRECT']);
  assert.deepEqual(data.rules, [
    { domain: { match: 'localhost', policy: 'DIRECT' } },
    { ip_cidr: { match: '192.168.0.0/16', policy: 'DIRECT', no_resolve: true } },
    { ip_cidr6: { match: 'fc00::/7', policy: 'DIRECT', no_resolve: true } },
    { domain: { match: 'blocked.example.test', policy: 'REJECT' } },
    { domain_suffix: { match: 'ai.example.test', policy: 'test-ai' } },
    { default: { policy: 'Proxy' } },
  ]);
  assert.equal(data['proxy-groups'], undefined);
});

for (const client of ['stash', 'mihomo']) {
  test(`${client}: local listener and reject-first selector, no unpublished rule providers`, () => {
    const data = parseYaml(renderProfile(client, { rulesets }).content);
    assert.equal(data['allow-lan'], false);
    assert.equal(data['bind-address'], '127.0.0.1');
    assert.deepEqual(data['proxy-groups'].find(group => group.name === 'Proxy').proxies, ['REJECT', 'DIRECT']);
    assert.deepEqual(data.proxies, []);
    assert.equal(data['rule-providers'], undefined);
    assert.deepEqual(data.rules, [
      'DOMAIN,localhost,DIRECT',
      'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
      'IP-CIDR6,fc00::/7,DIRECT,no-resolve',
      'DOMAIN,blocked.example.test,REJECT',
      'DOMAIN-SUFFIX,ai.example.test,test-ai',
      'MATCH,Proxy',
    ]);
  });
}

test('singBox uses native 1.14 actions, explicit builtins and local mixed inbound', () => {
  const data = JSON.parse(renderProfile('singBox', { rulesets }).content);
  assert.equal(data.inbounds[0].type, 'mixed');
  assert.equal(data.inbounds[0].listen, '127.0.0.1');
  assert.equal(data.inbounds[0].set_system_proxy, false);
  assert.deepEqual(data.outbounds.find(outbound => outbound.tag === 'Proxy'), {
    type: 'selector', tag: 'Proxy', outbounds: ['REJECT', 'DIRECT'], default: 'REJECT',
  });
  assert.ok(data.outbounds.some(outbound => outbound.type === 'direct' && outbound.tag === 'DIRECT'));
  assert.ok(data.outbounds.some(outbound => outbound.type === 'block' && outbound.tag === 'REJECT'));
  assert.deepEqual(data.route.rules[0],{action:'resolve'});
  assert.deepEqual(data.route.rules.slice(1), [
    { domain: ['localhost'], action: 'route', outbound: 'DIRECT' },
    { ip_cidr: ['192.168.0.0/16'], action: 'route', outbound: 'DIRECT' },
    { ip_cidr: ['fc00::/7'], action: 'route', outbound: 'DIRECT' },
    { domain: ['blocked.example.test'], action: 'reject' },
    { domain_suffix: ['ai.example.test'], action: 'route', outbound: 'test-ai' },
  ]);
  assert.equal(data.route.final, 'Proxy');
  assert.equal(data.route.rule_set, undefined);
  assert.ok(data.dns.servers.every(server => server.type && !server.address));
  assert.ok(data.outbounds.every(outbound => outbound.type !== 'dns'));
  assert.equal(data.experimental, undefined);
});

test('profiles reject unknown client IDs and unsupported rules instead of discarding input', () => {
  assert.throws(() => renderProfile('not-a-client', { rulesets }), /client/i);
  const invalid = [{ ...rulesets[0], entries: [{ type: 'url-regex', value: '.*' }] }];
  for (const client of clients) assert.throws(() => renderProfile(client, { rulesets: invalid }), /unsupported|rule type/i);
});

test('empty input still emits explicit fallback policies for every client', () => {
  for (const client of clients) {
    assert.match(renderProfile(client, { rulesets: [] }).content, /Proxy/);
  }
});

test('a newly added service gets a referenced native selector without renderer changes', () => {
  const expanded = [...rulesets, {
    version: 1, id: 'new-system-service', category: 'system',
    entries: [{ type: 'domain-suffix', value: 'system.example.test' }],
  }];
  for (const client of clients) {
    const { content } = renderProfile(client, { rulesets: expanded });
    let groups;
    if (client === 'singBox') {
      groups = JSON.parse(content).outbounds.filter(item => item.type === 'selector')
        .map(item => ({ name: item.tag, choices: item.outbounds }));
    } else if (client === 'egern') {
      groups = parseYaml(content).policy_groups.map(({ select }) => ({ name: select.name, choices: select.policies }));
    } else if (client === 'mihomo' || client === 'stash') {
      groups = parseYaml(content)['proxy-groups'].map(item => ({ name: item.name, choices: item.proxies }));
    } else if (client === 'quantumultX') {
      groups = iniSection(content, 'policy').map(line => {
        const [name, ...choices] = line.replace(/^static=/, '').split(',');
        return { name, choices };
      });
    } else {
      groups = iniSection(content, 'Proxy Group').map(line => {
        const [name, values] = line.split(' = select, ');
        return { name, choices: values.split(', ') };
      });
    }
    assert.equal(groups.find(group => group.name === 'test-ai').choices[0], 'Proxy', client);
    const system = groups.find(group => group.name === 'new-system-service');
    assert.ok(system, client);
    assert.equal(system.choices[0], 'Proxy', client);
    assert.ok(system.choices.includes('Proxy'), client);
    assert.ok(!groups.some(group => group.name === 'AI'), client);
  }
});

test('Mihomo does not open an unnecessary management listener', () => {
  const data = parseYaml(renderProfile('mihomo', { rulesets }).content);
  assert.equal(data['external-controller'], undefined);
});
