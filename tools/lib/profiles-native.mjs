import net from 'node:net';

// Native references (checked against Mihomo 1.19.33 / sing-box 1.14.4):
// https://wiki.metacubex.one/en/config/proxy-groups/
// https://wiki.metacubex.one/en/config/dns/
// https://stash.wiki/proxy-protocols/proxy-providers
// https://stash.wiki/proxy-protocols/proxy-groups
// https://stash.wiki/features/dns-server
// https://github.com/SagerNet/sing-box/blob/v1.14.4/docs/configuration/dns/server/https.md
// https://github.com/SagerNet/sing-box/blob/v1.14.4/docs/configuration/shared/dial.md
// The public profile has no private credentials. The local profile command
// supplies native node objects and/or native provider URLs through options.

const ruleTypes = { domain: 'DOMAIN', 'domain-suffix': 'DOMAIN-SUFFIX', 'domain-keyword': 'DOMAIN-KEYWORD', 'ip-cidr': 'IP-CIDR', 'ip-cidr6': 'IP-CIDR6' };
const lanDomains = ['home.arpa', 'local', 'localhost', 'lan'];
// Endpoint-style proxy types from each client's native protocol registry.
// Overlay/group/DNS/script objects are not user proxy nodes for this input API.
const proxyTypes = {
  mihomo: new Set(['ss', 'ssr', 'socks5', 'http', 'vmess', 'vless', 'snell', 'trojan', 'hysteria', 'hysteria2', 'wireguard', 'tuic', 'shadowquic', 'gost-relay', 'ssh', 'mieru', 'anytls', 'sudoku', 'masque', 'trusttunnel']),
  stash: new Set(['ss', 'ssr', 'socks5', 'http', 'vmess', 'vless', 'snell', 'trojan', 'hysteria', 'hysteria2', 'wireguard', 'tuic', 'ssh', 'anytls', 'juicity', 'trusttunnel']),
  singBox: new Set(['socks', 'http', 'shadowsocks', 'shadowsocksr', 'vmess', 'vless', 'snell', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'ssh', 'anytls', 'shadowtls']),
};
const defaults = Object.freeze({
  bootstrap: 'https://223.5.5.5/dns-query',
  domestic: 'https://223.5.5.5/dns-query',
  remote: 'https://1.1.1.1/dns-query',
  local: 'system',
});

function rejectExecutableNodeFields(value, seen = new Set(), depth = 0) {
  if (!value || typeof value !== 'object') return;
  if (depth > 32 || seen.has(value)) throw new Error('Invalid cyclic or excessively nested native node');
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (['script', 'script-path', 'script_path', 'script-file', 'script_file', 'program', 'exec', 'command', 'file'].includes(key.toLowerCase())) throw new Error('Executable or file node fields are not supported');
    rejectExecutableNodeFields(child, seen, depth + 1);
  }
  seen.delete(value);
}

function privateNodes(nodes = [], groups, kind) {
  if (!Array.isArray(nodes)) throw new Error('Native nodes must be an array');
  const key = kind === 'singBox' ? 'tag' : 'name';
  const names = new Set(['DIRECT', 'REJECT', ...groups.map(group => group.name)]);
  return nodes.map(node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('Invalid native node object');
    rejectExecutableNodeFields(node);
    const name = node[key];
    if (typeof name !== 'string' || !name.trim() || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Invalid native node name or tag');
    if (names.has(name)) throw new Error(`Duplicate or reserved native node ${key}`);
    names.add(name);
    if (!proxyTypes[kind]?.has(node.type)) {
      throw new Error('A native node must be a real proxy protocol, not a policy group');
    }
    if (typeof node.server !== 'string' || !node.server || /[\s\x00-\x1f\x7f]/.test(node.server)) throw new Error('Invalid native node server');
    const port = node[kind === 'singBox' ? 'server_port' : 'port'];
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid native node port');
    return structuredClone(node);
  });
}

function subscriptionsFor(subscriptions = []) {
  if (!Array.isArray(subscriptions)) throw new Error('Native subscriptions must be an array');
  const names = new Set();
  return subscriptions.map((item, index) => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || /[\x00-\x1f\x7f]/.test(item.name)) throw new Error('Invalid subscription name');
    if (names.has(item.name)) throw new Error('Duplicate subscription name');
    names.add(item.name);
    if (typeof item.url !== 'string' || /[\x00-\x20\x7f]/.test(item.url)) throw new Error('Invalid subscription URL control character');
    let url;
    try { url = new URL(item.url); } catch { throw new Error('Invalid subscription URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.hash || url.username || url.password) throw new Error('Native subscriptions require an HTTP(S) URL');
    if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Unencrypted native subscription HTTP is restricted to loopback fixtures');
    const interval = item.interval ?? 3600;
    if (!Number.isInteger(interval) || interval < 1 || interval > 2_592_000) throw new Error('Invalid native subscription interval');
    return { name: item.name, url: item.url, interval, path: `./providers/netatlas-subscription-${index + 1}.yaml` };
  });
}

function selectedName(options, names) {
  const selected = options.selectedProxy ?? names[0] ?? 'REJECT';
  if (!['REJECT', 'DIRECT', ...names].includes(selected)) throw new Error('Unknown selected native proxy; import the node before selecting it');
  return selected;
}

function upstreamsFor(options) {
  const values = { ...defaults, ...(options.dnsUpstreams ?? {}) };
  for (const key of Object.keys(values)) {
    if (!Object.hasOwn(defaults, key)) throw new Error('Unknown DNS upstream role');
    const value = values[key];
    if (typeof value !== 'string' || !value || /[\x00-\x20\x7f#]/.test(value)) throw new Error('Invalid DNS upstream URL');
    if (value === 'system' && key === 'local') continue;
    let url;
    try { url = new URL(value.includes('://') ? value : `udp://${value}`); } catch { throw new Error('Invalid DNS upstream URL'); }
    if (!['udp:', 'tcp:', 'tls:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search) throw new Error('Invalid DNS upstream protocol or credentials');
    if (!net.isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new Error('DNS upstream servers must use IP literals to avoid bootstrap recursion');
  }
  return values;
}

function domainPolicies(entries, groups, domestic, remote, local = 'system') {
  const direct = new Set(['DIRECT', ...groups.filter(group => group.choices[0] === 'DIRECT').map(group => group.name)]);
  const policy = {};
  for (const entry of entries) {
    if (!['domain', 'domain-suffix'].includes(entry.type) || entry.policy === 'REJECT') continue;
    const key = (entry.type === 'domain-suffix' ? '+.' : '') + entry.value;
    // Keep an earlier explicit service when a later CN list repeats its key.
    if (!Object.hasOwn(policy, key)) policy[key] = [direct.has(entry.policy) ? domestic : remote];
  }
  for (const domain of lanDomains) policy['+.' + domain] = local === 'system' ? 'system' : [local];
  return policy;
}

function classicRules(entries) {
  return [...entries.map(({ type, value, policy, rulesetId }) => {
    if (!Object.hasOwn(ruleTypes, type)) throw new Error('Unsupported native profile rule type');
    const isIp = type === 'ip-cidr' || type === 'ip-cidr6';
    // LAN must not force DNS. The final CN-IP fallback must resolve an
    // otherwise unmatched domain before it can classify the destination.
    const noResolve = isIp && !['china-ipv4', 'china-ipv6'].includes(rulesetId) ? ',no-resolve' : '';
    return `${ruleTypes[type]},${value},${policy}${noResolve}`;
  }), 'MATCH,Proxy'];
}

function clashGroups(groups, names, selected, subscriptions, client) {
  return groups.map(({ name, choices }) => {
    if (name !== 'Proxy') return { name, type: 'select', proxies: [...choices] };
    const members = [...new Set([selected, ...choices, ...names])];
    return {
      name, type: 'select', proxies: members, 'include-all': true,
      ...(client === 'mihomo' ? { 'default-selected': selected } : {}),
      ...(subscriptions.length ? { use: subscriptions.map(subscription => subscription.name) } : {}),
    };
  });
}

function listenerPortsFor(options, client) {
  const ports = options.listenerPorts ?? {};
  if (!ports || typeof ports !== 'object' || Array.isArray(ports)) throw new Error('Invalid native listener ports');
  const allowed = client === 'mihomo' ? ['mixed', 'dns'] : client === 'singBox' ? ['mixed'] : [];
  for (const [key, port] of Object.entries(ports)) {
    if (!allowed.includes(key) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid or unsupported native listener port');
  }
  return ports;
}

function clashConfig(client, entries, groups, options) {
  const ports = listenerPortsFor(options, client);
  const nodes = privateNodes(options.nodes, groups, client);
  const names = nodes.map(node => node.name);
  const subscriptions = subscriptionsFor(options.subscriptions);
  const upstreams = upstreamsFor(options);
  const selected = selectedName(options, names);
  const dns = {
    ...(client === 'mihomo' ? { enable: true, listen: `127.0.0.1:${ports.dns ?? 1053}`, 'enhanced-mode': 'redir-host', ipv6: true } : {}),
    'default-nameserver': [upstreams.bootstrap],
    'proxy-server-nameserver': [upstreams.bootstrap + (client === 'mihomo' ? '#DIRECT' : '')],
    nameserver: [upstreams.remote + (client === 'mihomo' ? '#Proxy' : '')],
    'nameserver-policy': domainPolicies(entries, groups, upstreams.domestic + (client === 'mihomo' ? '#DIRECT' : ''), upstreams.remote + (client === 'mihomo' ? '#Proxy' : ''), upstreams.local === 'system' ? 'system' : upstreams.local + (client === 'mihomo' ? '#DIRECT' : '')),
    ...(client === 'mihomo'
      ? { 'direct-nameserver': [upstreams.domestic + '#DIRECT'], 'direct-nameserver-follow-policy': true, 'respect-rules': false }
      : { 'follow-rule': true }),
  };
  return {
    ...(client === 'mihomo' ? { 'mixed-port': ports.mixed ?? 7890 } : {}),
    mode: 'rule', 'log-level': 'info', 'allow-lan': false, 'bind-address': '127.0.0.1', ipv6: true,
    dns, proxies: nodes,
    ...(subscriptions.length ? {
      'proxy-providers': Object.fromEntries(subscriptions.map(item => [item.name, {
        ...(client === 'mihomo' ? { type: 'http', proxy: 'DIRECT' } : {}),
        url: item.url, path: item.path, interval: item.interval,
      }])),
    } : {}),
    'proxy-groups': clashGroups(groups, names, selected, subscriptions, client),
    rules: classicRules(entries),
  };
}

export function mihomo(entries, groups, options = {}) {
  return clashConfig('mihomo', entries, groups, options);
}

export function stash(entries, groups, options = {}) {
  return clashConfig('stash', entries, groups, options);
}

function singDnsServer(tag, value, detour) {
  if (value === 'system') return { type: 'local', tag };
  const url = new URL(value.includes('://') ? value : `udp://${value}`);
  const type = url.protocol.slice(0, -1);
  return {
    type, tag, server: url.hostname.replace(/^\[|\]$/g, ''),
    ...(url.port ? { server_port: Number(url.port) } : {}),
    ...(type === 'https' ? { path: url.pathname === '/' ? '/dns-query' : url.pathname } : {}),
    ...(detour ? { detour } : {}),
  };
}

function singDnsRules(entries, groups) {
  const direct = new Set(['DIRECT', ...groups.filter(group => group.choices[0] === 'DIRECT').map(group => group.name)]);
  const result = [{ domain_suffix: [...lanDomains], action: 'route', server: 'local' }];
  // Preserve routing order for domain rules: service-specific policies precede CN.
  for (const entry of entries) {
    if (!['domain', 'domain-suffix', 'domain-keyword'].includes(entry.type)) continue;
    const field = entry.type === 'domain' ? 'domain' : entry.type === 'domain-keyword' ? 'domain_keyword' : 'domain_suffix';
    const action = entry.policy === 'REJECT' ? 'reject' : 'route';
    const server = action === 'route' ? direct.has(entry.policy) ? 'domestic' : 'remote' : undefined;
    const last = result.at(-1);
    if (last.action === action && last.server === server && Array.isArray(last[field])) last[field].push(entry.value);
    else result.push({ [field]: [entry.value], action, ...(server ? { server } : {}) });
  }
  return result;
}

export function singBox(entries, groups, options = {}) {
  if (options.subscriptions?.length) throw new Error('Materialize sing-box subscriptions with the local importer before rendering native outbounds');
  const ports = listenerPortsFor(options, 'singBox');
  const nodes = privateNodes(options.nodes, groups, 'singBox');
  const names = nodes.map(node => node.tag);
  const selected = selectedName(options, names);
  const upstreams = upstreamsFor(options);
  return {
    log: { level: 'info' },
    dns: {
      servers: [
        singDnsServer('local', upstreams.local),
        singDnsServer('bootstrap', upstreams.bootstrap),
        singDnsServer('domestic', upstreams.domestic),
        singDnsServer('remote', upstreams.remote, 'Proxy'),
      ],
      rules: singDnsRules(entries, groups), final: 'remote', strategy: 'prefer_ipv4',
    },
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: ports.mixed ?? 7890, set_system_proxy: false }],
    outbounds: [
      { type: 'direct', tag: 'DIRECT' }, { type: 'block', tag: 'REJECT' },
      ...nodes,
      ...groups.map(({ name, choices }) => ({
        type: 'selector', tag: name,
        outbounds: name === 'Proxy' ? [...new Set([...choices, ...names])] : [...choices],
        default: name === 'Proxy' ? selected : choices[0],
      })),
    ],
    route: {
      default_domain_resolver: 'bootstrap',
      rules: [{ action: 'resolve' }, ...entries.map(({ type, value, policy }) => {
        if (!Object.hasOwn(ruleTypes, type)) throw new Error('Unsupported native profile rule type');
        const field = type === 'domain' ? 'domain' : type === 'domain-suffix' ? 'domain_suffix' : type === 'domain-keyword' ? 'domain_keyword' : 'ip_cidr';
        return { [field]: [value], ...(policy === 'REJECT' ? { action: 'reject' } : { action: 'route', outbound: policy }) };
      })], final: 'Proxy',
    },
  };
}
