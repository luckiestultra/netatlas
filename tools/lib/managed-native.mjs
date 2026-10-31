import * as inline from './profiles-native.mjs';

// Native schemas, verified with Mihomo 1.19.33 / sing-box 1.14.4:
// https://wiki.metacubex.one/en/config/rule-providers/
// https://wiki.metacubex.one/en/config/dns/
// https://stash.wiki/rules/rule-set
// https://stash.wiki/features/dns-server
// https://sing-box.sagernet.org/configuration/rule-set/
// https://sing-box.sagernet.org/configuration/shared/http-client/
// https://wiki.metacubex.one/en/config/inbound/tun/
// https://github.com/SagerNet/sing-box/blob/v1.14.4/docs/configuration/inbound/tun.md
const rootGroup = '节点选择';
const fallbackGroup = '漏网之鱼';
const lanDomains = ['home.arpa', 'local', 'localhost', 'lan'];
const testUrl = 'https://www.gstatic.com/generate_204';
const unique = values => [...new Set(values)];

function validate(model) {
  if (!Array.isArray(model?.groups) || !Array.isArray(model?.rules)) throw new Error('Invalid managed native model');
  const policies = new Set(['DIRECT', 'REJECT', ...model.groups.map(group => group.name)]);
  for (const rule of model.rules) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(rule.id) || !policies.has(rule.policy)) throw new Error('Invalid managed native rule');
    const url = new URL(rule.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash
      || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Invalid managed native rule URL');
  }
  for (const group of model.groups) {
    if (!Array.isArray(group.choices) || group.choices.some(choice => !policies.has(choice))) throw new Error('Invalid managed native group');
    if (group.regex) new RegExp(group.regex);
  }
  if (!policies.has(rootGroup) || !policies.has(fallbackGroup)) throw new Error('Managed native root and fallback groups are required');
}

function domainRule(rule) {
  return rule.id !== 'lan' && (rule.entryTypes ? rule.entryTypes.some(type => ['domain', 'domain-suffix', 'domain-keyword', 'domain-regex', 'domain-wildcard'].includes(type)) : !['china-ipv4', 'china-ipv6'].includes(rule.id));
}

function directPolicies(model) {
  return new Set(['DIRECT', ...model.groups.filter(group => group.choices[0] === 'DIRECT').map(group => group.name)]);
}

function clashGroups(model, config, options, client) {
  const names = config.proxies.map(node => node.name);
  const providers = Object.keys(config['proxy-providers'] ?? {});
  const selected = options.selectedProxy ?? names[0] ?? 'REJECT';
  return model.groups.map(group => {
    if (group.kind === 'auto' || group.kind === 'region') {
      const filtered = group.regex ? names.filter(name => new RegExp(group.regex).test(name)) : names;
      return {
        name: group.name, type: 'url-test',
        // An empty native group otherwise becomes DIRECT in Stash. An explicit
        // REJECT keeps a region without imported nodes closed.
        proxies: filtered.length ? filtered : ['REJECT'],
        'include-all': true,
        ...(group.regex ? { filter: group.regex } : {}),
        ...(providers.length ? { use: providers } : {}),
        url: testUrl, interval: 300, tolerance: 50, lazy: true,
      };
    }
    return {
      name: group.name, type: 'select',
      proxies: group.name === rootGroup ? unique([selected, ...group.choices, ...names, ...model.groups.filter(item => item.kind === 'auto' || item.kind === 'region').map(item => item.name)]) : [...group.choices],
      ...(group.name === rootGroup ? {
        'include-all': true,
        ...(client === 'mihomo' ? { 'default-selected': selected } : {}),
        ...(providers.length ? { use: providers } : {}),
      } : {}),
    };
  });
}

function clash(client, model, options) {
  validate(model);
  if (options.captureTraffic !== undefined && typeof options.captureTraffic !== 'boolean') throw new Error('Invalid native captureTraffic option');
  // Reuse the established private input validation, native node serialization,
  // DNS transport parsing and loopback-only listener options. No source rule is
  // expanded into the managed profile.
  const config = inline[client]([], model.groups, options);
  if (client === 'mihomo' && options.captureTraffic !== false) {
    config.tun = {
      enable: true, stack: 'mixed', 'auto-route': true, 'auto-detect-interface': true,
      'dns-mode': 'hijack', 'dns-hijack': ['any:53', 'tcp://any:53'], 'strict-route': true, mtu: 1500,
    };
  }
  config['proxy-groups'] = clashGroups(model, config, options, client);
  config['rule-providers'] = Object.fromEntries(model.rules.map(rule => [rule.id, {
    ...(client === 'mihomo' ? { type: 'http', proxy: 'DIRECT' } : {}),
    behavior: 'classical', format: 'yaml', url: rule.url,
    path: `./rules/netatlas-${rule.id}.yaml`, interval: 86400,
  }]));
  config.rules = [...model.rules.map(rule => `RULE-SET,${rule.id},${rule.policy}`), `MATCH,${fallbackGroup}`];
  const direct = directPolicies(model);
  const domestic = client === 'mihomo' ? config.dns['direct-nameserver'][0] : options.dnsUpstreams?.domestic ?? 'https://223.5.5.5/dns-query';
  const remote = config.dns.nameserver[0].replace('#Proxy', `#${rootGroup}`);
  const local = config.dns['nameserver-policy']['+.home.arpa'];
  config.dns.nameserver = [remote];
  // Each policy points at the actual remote provider, rather than copying its
  // domains into a second many-thousand-line DNS list.
  config.dns['nameserver-policy'] = {
    ...Object.fromEntries(lanDomains.map(domain => [`+.${domain}`, local])),
    ...Object.fromEntries(model.rules.filter(rule => domainRule(rule) && rule.policy !== 'REJECT').map(rule => [
      `rule-set:${rule.id}`, [direct.has(rule.policy) ? domestic : remote],
    ])),
  };
  // Stash routes DNS transport with follow-rule; resolver addresses themselves
  // stay literals and node-domain bootstrap uses its independent native field.
  return config;
}

export function mihomo(model, options = {}) { return clash('mihomo', model, options); }
export function stash(model, options = {}) { return clash('stash', model, options); }

export function singBox(model, options = {}) {
  validate(model);
  if (options.captureTraffic !== undefined && typeof options.captureTraffic !== 'boolean') throw new Error('Invalid native captureTraffic option');
  if (options.subscriptions?.length) throw new Error('sing-box core has no native subscription provider; add native outbounds or merge subscriptions in a supporting GUI frontend');
  const config = inline.singBox([], model.groups, options);
  const captureTraffic = options.captureTraffic !== false;
  if (captureTraffic) {
    config.inbounds.push({
      type: 'tun', tag: 'tun-in', address: ['172.19.0.1/30', 'fdfe:dcba:9876::1/126'],
      mtu: 1500, auto_route: true, strict_route: true, stack: 'mixed', dns_mode: 'hijack',
    });
    config.dns.reverse_mapping = true;
  }
  const nodes = config.outbounds.filter(outbound => !['DIRECT', 'REJECT', ...model.groups.map(group => group.name)].includes(outbound.tag));
  const names = nodes.map(node => node.tag);
  const selected = options.selectedProxy ?? names[0] ?? 'REJECT';
  config.outbounds = [
    { type: 'direct', tag: 'DIRECT' }, { type: 'block', tag: 'REJECT' }, ...nodes,
    ...model.groups.map(group => {
      if (group.kind === 'auto' || group.kind === 'region') {
        const members = group.regex ? names.filter(name => new RegExp(group.regex).test(name)) : names;
        return { type: 'urltest', tag: group.name, outbounds: members.length ? members : ['REJECT'], url: testUrl, interval: '5m', tolerance: 50 };
      }
      return {
        type: 'selector', tag: group.name,
        outbounds: group.name === rootGroup ? unique([selected, ...group.choices, ...names, ...model.groups.filter(item => item.kind === 'auto' || item.kind === 'region').map(item => item.name)]) : [...group.choices],
        default: group.name === rootGroup ? selected : group.choices[0],
      };
    }),
  ];
  config.dns.servers.find(server => server.tag === 'remote').detour = rootGroup;
  const direct = directPolicies(model);
  config.dns.rules = [
    { domain_suffix: [...lanDomains], action: 'route', server: 'local' },
    ...model.rules.filter(domainRule).map(rule => ({
      rule_set: [rule.id], action: rule.policy === 'REJECT' ? 'reject' : 'route',
      ...(rule.policy === 'REJECT' ? {} : { server: direct.has(rule.policy) ? 'domestic' : 'remote' }),
    })),
  ];
  // HTTP clients use their own direct dialer when detour is absent. A detour
  // to an otherwise empty direct outbound is rejected by sing-box 1.14.4.
  config.http_clients = [{ tag: 'netatlas-resources', domain_resolver: 'bootstrap' }];
  config.experimental = { cache_file: { enabled: true, path: 'netatlas-cache.db' } };
  let resolved = false;
  const routingRules = model.rules.flatMap(rule => {
    const resolve = !resolved && rule.id !== 'lan' && rule.policy !== 'REJECT';
    if (resolve) resolved = true;
    return [
      ...(resolve ? [{ action: 'resolve' }] : []),
      { rule_set: [rule.id], ...(rule.policy === 'REJECT' ? { action: 'reject' } : { action: 'route', outbound: rule.policy }) },
    ];
  });
  if (!resolved) routingRules.push({ action: 'resolve' });
  config.route = {
    ...(captureTraffic ? { auto_detect_interface: true } : {}),
    default_domain_resolver: 'bootstrap',
    rule_set: model.rules.map(rule => ({
      type: 'remote', tag: rule.id, format: 'source', url: rule.url,
      http_client: 'netatlas-resources', update_interval: '1d',
    })),
    // LAN names use their native DNS policy before the early LAN route. Ads
    // are rejected before any public resolver is consulted. Resolving the
    // remaining names through DNS rules ensures direct outbounds use domestic
    // DNS and supplies addresses for the terminal CN-IP providers.
    rules: [
      ...(captureTraffic ? [
        { inbound: ['tun-in'], port: 53, action: 'hijack-dns' },
        { inbound: ['tun-in'], action: 'sniff' },
      ] : []),
      { domain_suffix: [...lanDomains], action: 'resolve' },
      ...routingRules,
    ], final: fallbackGroup,
  };
  return config;
}
