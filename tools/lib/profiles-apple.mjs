// Original adapters use documented native formats; no remote scripts or CA keys.
// Official Surge: https://manual.nssurge.com/policy-groups/policy-including.html
// Official Loon: https://github.com/Loon0x00/LoonExampleConfig/blob/master/example.conf
// Official Egern: https://egernapp.com/docs/configuration/policy_groups/
// Maintained MIT reference: https://github.com/Repcz/Tool/tree/14096d214d0f870ee11f8172b2f8be94e93d0663
// Shadowrocket fields cross-checked against that reference and LOWERTOP's actual
// configuration. Neither source is claimed to be a vendor grammar or GUI test.
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import { classicRoutingTypes, egernRoutingTypes } from './routing-extensions.mjs';

const header = '# NetAtlas — complete client configuration\n'
  + '# Add private nodes/subscriptions with the local profile command, or the native entry below.\n'
  + '# An unconfigured profile defaults to REJECT; no placeholder endpoint is contacted.\n';
const types = { ...classicRoutingTypes, domain: 'DOMAIN', 'domain-suffix': 'DOMAIN-SUFFIX', 'domain-keyword': 'DOMAIN-KEYWORD', 'ip-cidr': 'IP-CIDR', 'ip-cidr6': 'IP-CIDR6' };
const egernTypes = { ...egernRoutingTypes, domain: 'domain', 'domain-suffix': 'domain_suffix', 'domain-keyword': 'domain_keyword', 'ip-cidr': 'ip_cidr', 'ip-cidr6': 'ip_cidr6' };
const reserved = (groups) => new Set(['DIRECT', 'REJECT', ...groups.map(group => group.name)]);
const unique = values => [...new Set(values)];
const countryIp = entry => ['china-ipv4', 'china-ipv6'].includes(entry.rulesetId);
// Only server-based formats that can be represented by an individual native
// node are accepted. Executable/external/custom nodes and types needing extra
// profile sections are not silently treated as an ordinary proxy server.
// https://manual.nssurge.com/policies/overview.html
// https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/node.md
const lineProtocols = {
  surge: new Set(['http', 'https', 'h2-connect', 'socks5', 'socks5-tls', 'ss', 'snell', 'vmess', 'trojan', 'tuic', 'tuic-v5', 'hysteria2', 'masque', 'anytls', 'trust-tunnel', 'ssh']),
  loon: new Set(['http', 'https', 'shadowsocks', 'shadowsocksr', 'vmess', 'vless', 'trojan', 'hysteria2']),
  shadowrocket: new Set(['http', 'https', 'socks5', 'socks5-tls', 'ss', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'juicity', 'snell', 'anytls']),
};
const egernProtocols = new Set(['shadowsocks', 'snell', 'trojan', 'anytls', 'hysteria2', 'tuic', 'socks5', 'socks5_tls', 'ssh', 'http', 'https', 'vmess', 'vless', 'wireguard']);

function endpoint(server, port) {
  if (typeof server !== 'string' || !server || /[\s/\\?#@%,\u2028\u2029]/.test(server)) throw new Error('Invalid native node endpoint');
  const host = server.replace(/^\[|\]$/g, '');
  if ((server.includes('[') || server.includes(']')) && (!/^\[[^\]]+\]$/.test(server) || isIP(host) !== 6)) throw new Error('Invalid native node endpoint');
  if (!isIP(host)) {
    if (host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) throw new Error('Invalid native node endpoint');
    const ascii = domainToASCII(host).replace(/\.$/, '');
    if (!ascii || ascii.length > 253 || ascii.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error('Invalid native node endpoint');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid native node port');
}

function rejectExecutableFields(value) {
  const pending = [value], visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) throw new Error('Invalid cyclic native node');
    visited.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (/^(?:script|script[-_]path|script[-_]file|program|exec)$/i.test(key)) throw new Error('Executable script node fields are unsupported');
      if (child && typeof child === 'object') pending.push(child);
    }
  }
}

function name(value, used, kind) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || /[\r\n\u2028\u2029,=\[\]]/.test(value) || /^(?:#|;|\/\/)/.test(value)) throw new Error(`Invalid ${kind} name`);
  if (used.has(value) || ['direct', 'reject', 'proxy'].includes(value.toLowerCase())) throw new Error(`Duplicate or reserved ${kind} name`);
  used.add(value);
  return value;
}

function sources(options, used) {
  if (options.subscriptions !== undefined && !Array.isArray(options.subscriptions)) throw new Error('Subscriptions must be an array');
  return (options.subscriptions ?? []).map((source, index) => {
    if (!source || typeof source !== 'object') throw new Error('Invalid subscription');
    const sourceName = name(source.name ?? `Subscription-${index + 1}`, used, 'subscription');
    let parsed;
    try { parsed = new URL(source.url); } catch { throw new Error('Invalid subscription URL'); }
    if (typeof source.url !== 'string' || /[\s,\r\n]/.test(source.url) || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) throw new Error('Invalid subscription URL');
    const interval = source.interval ?? 86400;
    if (!Number.isInteger(interval) || interval < 1 || interval > 2_592_000) throw new Error('Invalid subscription interval');
    return { name: sourceName, url: parsed.href, interval };
  });
}

function lineInputs(client, groups, options) {
  if (options.nodes !== undefined && !Array.isArray(options.nodes)) throw new Error('Nodes must be an array');
  const used = reserved(groups);
  const nodes = (options.nodes ?? []).map(line => {
    if (typeof line !== 'string' || /[\r\n\u2028\u2029]/.test(line)) throw new Error('Invalid native node line');
    const match = /^\s*([^=]+?)\s*=\s*([^,]+),(.+)$/.exec(line);
    if (!match) throw new Error('Invalid native node line');
    if (!lineProtocols[client].has(match[2].trim().toLowerCase()) || /(?:^|,)\s*(?:script|script[-_]path|script[-_]file|program|exec)\s*=/i.test(line)) throw new Error('Unsupported or executable native node protocol');
    const [server, rawPort] = match[3].split(',').map(part => part.trim());
    if (!/^\d+$/.test(rawPort ?? '')) throw new Error('Invalid native node port');
    if (server.startsWith('"') !== server.endsWith('"')) throw new Error('Invalid native node endpoint');
    endpoint(server.replace(/^"|"$/g, ''), Number(rawPort));
    const nodeName = name(match[1].trim(), used, 'node');
    return { name: nodeName, line: line.trim() };
  });
  const subscriptions = sources(options, used);
  return { nodes, subscriptions };
}

function proxyChoices(group, localNames, subscriptionNames, selected) {
  const names = [...localNames, ...subscriptionNames];
  // A native source is asynchronous. Do not preselect an empty source before
  // the app has loaded its nodes. The local importer materializes source nodes
  // first, so its ordinary local-node path can select the first actual node.
  const choice = selected ?? localNames[0];
  if (choice !== undefined && !names.includes(choice) && !['DIRECT', 'REJECT'].includes(choice)) throw new Error('Unknown selected Proxy member');
  return group.name === 'Proxy' ? unique([...(choice ? [choice] : []), ...group.choices, ...names]) : [...group.choices];
}

function list(value, fallback) {
  const values = value === undefined ? fallback : Array.isArray(value) ? value : [value];
  if (!values.length || values.some(item => typeof item !== 'string' || !item || /[\s,\r\n]/.test(item))) throw new Error('Invalid DNS upstream');
  return [...values];
}

function plainDns(value) {
  if (value === 'system' || isIP(value)) return value;
  const endpoint = /^(\[[a-fA-F0-9:]+\]|[^:]+):(\d+)$/.exec(value);
  if (endpoint && isIP(endpoint[1].replace(/^\[|\]$/g, '')) && Number(endpoint[2]) >= 1 && Number(endpoint[2]) <= 65535) return value;
  if (value.startsWith('udp://')) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('Invalid DNS URL'); }
    if (!isIP(parsed.hostname.replace(/^\[|\]$/g, '')) || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error('Invalid DNS URL');
    return parsed.host;
  }
  return null;
}

function validateUpstream(value) {
  const plain = plainDns(value);
  if (plain) return plain;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Invalid DNS upstream'); }
  if (!['https:', 'h3:', 'tls:', 'quic:', 'tcp:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.hash) throw new Error('Invalid DNS upstream URL');
  return value;
}

function dnsOptions(options) {
  const input = options.dnsUpstreams ?? {};
  return {
    bootstrap: list(input.bootstrap, ['223.5.5.5']).map(value => {
      const plain = plainDns(value);
      if (!plain) throw new Error('DNS bootstrap must be an IP endpoint or system');
      return plain;
    }),
    domestic: list(input.domestic, ['https://dns.alidns.com/dns-query']).map(validateUpstream),
    remote: list(input.remote, ['https://1.1.1.1/dns-query']).map(validateUpstream),
    local: list(input.local, ['system']).map(value => {
      const plain = plainDns(value);
      if (!plain) throw new Error('Local DNS must be an IP endpoint or system');
      return plain;
    }),
  };
}

function classicRules(entries) {
  return [...entries.map(entry => {
    const { type, value, policy } = entry;
    if (!types[type] || typeof value !== 'string' || /[\r\n,]/.test(value)) throw new Error('Invalid native rule');
    return `${types[type]},${value},${policy}${type.startsWith('ip-cidr') && !countryIp(entry) ? ',no-resolve' : ''}`;
  }), 'FINAL,Proxy'].join('\n');
}

export function surge(entries, groups, options = {}) {
  const { nodes, subscriptions } = lineInputs('surge', groups, options);
  const dns = dnsOptions(options);
  const encrypted = dns.domestic.filter(value => !plainDns(value));
  const plain = dns.domestic.filter(value => plainDns(value));
  const policy = groups.map(group => {
    const members = proxyChoices(group, nodes.map(node => node.name), subscriptions.map(source => source.name), options.selectedProxy);
    return `${group.name} = select, ${members.join(', ')}${group.name === 'Proxy' ? ', include-all-proxies=true' : ''}`;
  });
  // Use the documented native source group. The unconfigured parent remains
  // REJECT until the user loads/selects a source, or the local importer has
  // fetched a nonempty source and materialized its real nodes above.
  for (const source of subscriptions) policy.push(`${source.name} = select, policy-path=${source.url}, update-interval=${source.interval}`);
  return `${header}
[General]
loglevel = notify
ipv6 = true
allow-wifi-access = false
allow-hotspot-access = false
http-listen = 127.0.0.1:6152
socks5-listen = 127.0.0.1:6153
# Startup resolvers use IP endpoints; encrypted DNS does not depend on Proxy.
dns-server = ${unique([...dns.local, ...dns.bootstrap, ...plain]).join(', ')}
${encrypted.length ? `encrypted-dns-server = ${encrypted.join(', ')}\n` : ''}# Direct encrypted DNS avoids a resolver -> hostname proxy -> resolver cycle.
encrypted-dns-follow-outbound-mode = false
encrypted-dns-skip-cert-verification = false
udp-policy-not-supported-behaviour = REJECT

[Proxy]
${nodes.map(node => node.line).join('\n') || '# Native nodes added here are included by Proxy automatically.'}

[Proxy Group]
${policy.join('\n')}
# Native source alternative: add policy-path to a separate select group and reference it from Proxy.

[Rule]
${classicRules(entries)}
`;
}

export function loon(entries, groups, options = {}) {
  const { nodes, subscriptions } = lineInputs('loon', groups, options);
  const dns = dnsOptions(options);
  const encrypted = dns.domestic.filter(value => !plainDns(value));
  if (encrypted.some(value => !value.startsWith('https://'))) throw new Error('Loon DNS adapter requires HTTPS for its doh-server field');
  const plain = dns.domestic.filter(value => plainDns(value));
  const policy = groups.map(group => `${group.name} = select, ${proxyChoices(group, nodes.map(node => node.name), subscriptions.map(source => source.name), options.selectedProxy).join(', ')}`);
  return `${header}
[General]
allow-wifi-access = false
ipv6 = true
dns-server = ${unique([...dns.local, ...dns.bootstrap, ...plain]).join(', ')}
${encrypted.length ? `doh-server = ${encrypted.join(', ')}\n` : ''}# Proxy traffic keeps its domain destination for remote resolution; bootstrap DNS stays direct.

[Proxy]
${nodes.map(node => node.line).join('\n') || '# Add native nodes using the local profile command; their names are wired into Proxy.'}

[Remote Proxy]
${subscriptions.map(source => `${source.name} = ${source.url}`).join('\n') || '# Add your private native subscription here, then regenerate so its alias is connected to Proxy.'}
# Remote Proxy refresh interval is controlled by the application; re-run local import to refresh materialized input.

[Proxy Group]
${policy.join('\n')}

[Rule]
${classicRules(entries)}
`;
}

export function shadowrocket(entries, groups, options = {}) {
  const { nodes, subscriptions } = lineInputs('shadowrocket', groups, options);
  if (subscriptions.length) throw new Error('Shadowrocket sources must be imported in the app or materialized to native nodes by the local importer');
  const dns = dnsOptions(options);
  const policy = groups.map(group => `${group.name} = select, ${proxyChoices(group, nodes.map(node => node.name), [], options.selectedProxy).join(', ')}${group.name === 'Proxy' ? ', policy-regex-filter=.+' : ''}`);
  return `${header}
[General]
dns-server = ${dns.domestic.join(', ')}
direct-dns-server = ${dns.domestic.join(', ')}
fallback-dns-server = ${dns.local.join(', ')}
proxy-dns-server = ${unique([...dns.local, ...dns.bootstrap]).join(', ')}
dns-direct-system = false
dns-direct-fallback-proxy = false
ipv6 = true
prefer-ipv6 = false
private-ip-answer = true
udp-policy-not-supported-behaviour = REJECT

[Proxy]
${nodes.map(node => node.line).join('\n') || '# Native local nodes can be materialized here; app-managed node subscriptions are matched by Proxy.'}

[Proxy Group]
${policy.join('\n')}
# Add/update native node subscriptions in Shadowrocket Home; Proxy matches their node names.
# Do not put a Surge policy-path or Loon Remote Proxy field in this profile.

[Rule]
${classicRules(entries)}
`;
}

export function egern(entries, groups, options = {}) {
  if (options.nodes !== undefined && !Array.isArray(options.nodes)) throw new Error('Nodes must be an array');
  const used = reserved(groups);
  const nodes = (options.nodes ?? []).map(proxy => {
    if (!proxy || typeof proxy !== 'object' || Array.isArray(proxy) || Object.keys(proxy).length !== 1) throw new Error('Invalid native Egern node');
    const [protocol] = Object.keys(proxy);
    if (!egernProtocols.has(protocol)) throw new Error('Unsupported native Egern node protocol');
    const [settings] = Object.values(proxy);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid native Egern node');
    name(settings.name, used, 'node');
    endpoint(settings.server, settings.port);
    rejectExecutableFields(settings);
    const node = structuredClone(proxy);
    if (protocol === 'anytls') {
      // Egern's AnyTLS has a historical insecure unset default. Enable normal
      // CA verification unless private native input explicitly opts out.
      // https://egernapp.com/docs/configuration/proxies/#anytls
      if (settings.skip_tls_verify !== undefined && typeof settings.skip_tls_verify !== 'boolean') throw new Error('AnyTLS skip_tls_verify must be boolean');
      node.anytls.skip_tls_verify = settings.skip_tls_verify ?? false;
    }
    return node;
  });
  const subscriptions = sources(options, used);
  const dns = dnsOptions(options);
  const nodeNames = nodes.map(proxy => Object.values(proxy)[0].name);
  if (options.selectedProxy !== undefined && !nodeNames.includes(options.selectedProxy) && !['DIRECT', 'REJECT'].includes(options.selectedProxy)) throw new Error('Unknown selected Proxy member');
  const intervals = unique(subscriptions.map(source => source.interval));
  if (intervals.length > 1) throw new Error('Egern merged subscription URLs must share one update interval');
  const policyGroups = groups.map(group => ({ select: {
    name: group.name,
    policies: proxyChoices(group, nodeNames, [], options.selectedProxy),
    ...(group.name === 'Proxy' ? { urls: subscriptions.map(source => source.url), update_interval: intervals[0] ?? 86400 } : {}),
  } }));
  const domainEntries = entries.filter(entry => ['domain', 'domain-suffix', 'domain-keyword', 'domain-regex'].includes(entry.type));
  const localEntries = [
    ...['localhost', 'local', 'home.arpa', 'lan'].map(value => ({ type: 'domain-suffix', value })),
    ...domainEntries.filter(entry => entry.rulesetId === 'lan'),
  ];
  const direct = new Set(['DIRECT', ...groups.filter(group => group.choices[0] === 'DIRECT').map(group => group.name)]);
  return {
    ipv6: true,
    allow_external_connections: false,
    http_port: 3080,
    socks_port: 3090,
    dns: {
      bootstrap: unique([...dns.local, ...dns.bootstrap]),
      upstreams: { local: dns.local, domestic: dns.domestic, remote: dns.remote },
      forward: [
        // Forward is first-match. Local names must stay local, and service
        // exceptions must retain their position ahead of broad CN suffixes.
        // https://egernapp.com/docs/configuration/dns/#forward-dns-forwarding-rules
        ...localEntries.map(entry => ({ [egernTypes[entry.type]]: { match: entry.value, value: 'local' } })),
        ...domainEntries.map(entry => ({ [egernTypes[entry.type]]: { match: entry.value, value: entry.policy === 'REJECT' ? 'reject' : direct.has(entry.policy) ? 'domestic' : 'remote' } })),
        { domain_wildcard: { match: '*', value: 'remote' } },
      ],
      // Forced-direct proxy DNS bypasses Forward; bootstrap resolves this
      // encrypted resolver's hostname without consulting the remote group.
      // https://egernapp.com/docs/configuration/dns/#proxy-nameservers-forced-upstream-for-proxy-dns
      proxy_nameservers: dns.domestic,
      skip_tls_verify: false,
    },
    proxies: nodes,
    policy_groups: policyGroups,
    rules: [...entries.map(entry => {
      const { type, value, policy } = entry;
      if (!egernTypes[type]) throw new Error('Invalid native Egern rule');
      return { [egernTypes[type]]: { match: type === 'ip-asn' ? `AS${value}` : value, policy, ...(type.startsWith('ip-cidr') && !countryIp(entry) ? { no_resolve: true } : {}) } };
    }), { default: { policy: 'Proxy' } }],
  };
}
