// Original compact adapters; native field references (not copied templates):
// https://manual.nssurge.com/policy-groups/policy-including.html
// https://manual.nssurge.com/rules/ruleset.html
// https://github.com/Loon0x00/LoonExampleConfig/blob/master/example.conf
// https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/nodefilter.md
// https://egernapp.com/docs/configuration/policy_groups/
// https://egernapp.com/docs/configuration/dns/
// Shadowrocket has no public vendor grammar. Its PROXY/regex fields and Loon's
// source-less NameRegex were cross-checked against the maintained MIT reference:
// https://github.com/Repcz/Tool (1194 stars, checked 2026-10-31).
import * as inline from './profiles-apple.mjs';

const unique = values => [...new Set(values)];
const rootName = model => model.root ?? '节点选择';
const fallbackName = model => model.fallback ?? '漏网之鱼';
const checkUrl = model => model.checkUrl ?? 'https://www.gstatic.com/generate_204';
const updateInterval = model => model.updateInterval ?? 86400;
const sourceGroup = '节点订阅';
const allFilter = '全部节点';
const dynamic = group => group.kind === 'auto' || group.kind === 'region';
const section = (text, name) => text.split(`[${name}]\n`)[1]?.split(/^\[/m)[0].trim() ?? '';
const filterName = group => `${group.name}筛选`;
const regex = group => group.regex ?? '.+';

function header(client, steps) {
  return `# NetAtlas — ${client}\n# ${steps}\n# Rule resources update independently; private subscriptions stay in your app.\n`;
}

// Reuse the established native-node and DNS validators/serializers. No bulk rule
// entries are passed through this path; only the compact native sections survive.
function base(client, model, options) {
  const reservedFilters = client === 'loon'
    ? [allFilter, ...model.groups.filter(group => group.kind === 'region').map(filterName)] : [];
  const validationGroups = [
    ...model.groups.map(group => ({ ...group, choices: group.choices ?? [] })),
    ...reservedFilters.map(name => ({ name, choices: [] })),
  ];
  const text = inline[client]([], validationGroups, options);
  const proxy = section(text, 'Proxy');
  const nodes = proxy.split('\n').filter(line => line && !line.startsWith('#'));
  return {
    general: section(text, 'General'),
    proxy: nodes.join('\n') || '# Add native nodes here, or use the app subscription entry below.',
    nodeNames: nodes.map(line => line.split('=')[0].trim()),
    subscriptions: (options.subscriptions ?? []).map((source, index) => ({
      ...source, name: source.name ?? `Subscription-${index + 1}`, url: new URL(source.url).href,
    })),
  };
}

function members(group, model, nodes, options, extras = []) {
  const choices = [...(group.choices ?? [])];
  if (group.name !== rootName(model)) return choices;
  const selected = options.selectedProxy ?? nodes[0];
  return unique([...(selected ? [selected] : []), ...choices, ...extras]);
}

function classicRules(model) {
  return [...model.rules.map(rule => `RULE-SET,${rule.url},${rule.policy}${rule.id === 'lan' ? ',no-resolve' : ''},update-interval=${updateInterval(model)}`),
    `FINAL,${fallbackName(model)}`].join('\n');
}

function optionalSections(rewrite) {
  return `\n[${rewrite}]\n# Optional rewrites are disabled; add only resources you trust.\n\n[MITM]\n# Disabled: no hosts, certificate, or private key is configured.\n`;
}

export function surge(model, options = {}) {
  const { general, proxy, nodeNames, subscriptions } = base('surge', model, options);
  const sources = subscriptions.map(source => source.name);
  const groups = model.groups.map(group => {
    const choices = members(group, model, nodeNames, options, sources);
    const fields = dynamic(group)
      ? ['url-test', ...choices, 'include-all-proxies=true',
        ...(sources.length ? [`include-other-group="${sources.join(',')}"`] : []),
        `policy-regex-filter=${regex(group)}`, `url=${checkUrl(model)}`, 'interval=600', 'tolerance=50']
      : ['select', ...choices, ...(group.name === rootName(model) ? ['include-all-proxies=true'] : [])];
    return `${group.name} = ${fields.join(', ')}`;
  });
  for (const source of subscriptions) groups.push(`${source.name} = select, policy-path=${source.url}, update-interval=${source.interval ?? 86400}`);
  return `${header('Surge', 'Import this profile; add your subscription as a policy-path group, then select it in 节点选择.')}
[General]
${general}

[Proxy]
${proxy}

[Proxy Group]
${groups.join('\n')}
# Subscription example (inactive):
# 节点订阅 = select, policy-path=https://your-provider.example/subscription, update-interval=86400
# After adding a source in the app, include it in 节点选择 and in 自动选择/地区组 via include-other-group.

[Rule]
${classicRules(model)}
${optionalSections('URL Rewrite')}`;
}

export function loon(model, options = {}) {
  const { general, proxy, nodeNames, subscriptions } = base('loon', model, options);
  // Without an explicit source list, native NameRegex scans app-managed nodes
  // from all subscriptions; users need not edit six filters after adding one.
  const filters = [`${allFilter} = NameRegex, FilterKey = .+`,
    ...model.groups.filter(dynamic).filter(group => group.kind === 'region')
      .map(group => `${filterName(group)} = NameRegex, FilterKey = ${regex(group)}`)];
  const groups = model.groups.map(group => {
    if (dynamic(group)) {
      const target = group.kind === 'region' ? filterName(group) : allFilter;
      return `${group.name} = url-test, ${target}, url=${checkUrl(model)}, interval=600, tolerance=50`;
    }
    return `${group.name} = select, ${members(group, model, nodeNames, options, [allFilter]).join(', ')}`;
  });
  return `${header('Loon', 'Import this profile; add your subscription in Configuration → Remote Proxy, then select 节点选择.')}
[General]
${general}

[Proxy]
${proxy}

[Remote Proxy]
${subscriptions.map((source, index) => `${source.name ?? `Subscription-${index + 1}`} = ${source.url}`).join('\n') || '# 节点订阅 = https://your-provider.example/subscription'}
# Add a subscription here or in the app; the filters below discover its nodes.

[Remote Filter]
${filters.join('\n')}

[Proxy Group]
${groups.join('\n')}

[Rule]
FINAL,${fallbackName(model)}

[Remote Rule]
# Refresh is managed by Loon; this section has no documented update-interval field.
${model.rules.map(rule => `${rule.url}, policy=${rule.policy}, tag=${rule.id}, enabled=true`).join('\n')}
${optionalSections('Rewrite')}`;
}

export function shadowrocket(model, options = {}) {
  const { general, proxy, nodeNames } = base('shadowrocket', model, options);
  const groups = model.groups.map(group => {
    if (dynamic(group)) return `${group.name} = url-test, policy-regex-filter=${regex(group)}, url=${checkUrl(model)}, interval=600, tolerance=50`;
    const extras = group.name === rootName(model) ? ['PROXY'] : [];
    let choices = members(group, model, nodeNames, options, extras);
    // PROXY refers to the actual node selected on Home, including nodes from
    // app-managed subscriptions. It does not name an external policy-path.
    if (group.name === rootName(model) && !options.selectedProxy && !nodeNames.length) choices = unique(['PROXY', ...choices]);
    return `${group.name} = select, ${choices.join(', ')}${group.name === rootName(model) ? ', policy-regex-filter=.+' : ''}`;
  });
  return `${header('Shadowrocket', 'Import this profile in Configuration; add/select your node subscription on Home, then use Rule mode.')}
[General]
${general}

[Proxy]
${proxy}

[Proxy Group]
${groups.join('\n')}
# PROXY uses the Home selection; region/auto groups match all app-managed node names.
# Subscription example (Home only, inactive): https://your-provider.example/subscription

[Rule]
${classicRules(model)}
${optionalSections('URL Rewrite')}`;
}

export function egern(model, options = {}) {
  const config = inline.egern([], [
    ...model.groups.map(group => ({ ...group, choices: group.choices ?? [] })),
    { name: sourceGroup, choices: [] },
  ], options);
  const nodes = config.proxies.map(proxy => Object.values(proxy)[0].name);
  const subscriptions = options.subscriptions ?? [];
  const intervals = unique(subscriptions.map(source => source.interval ?? 86400));
  const groups = model.groups.map(group => {
    if (dynamic(group)) return { auto_test: {
      name: group.name, policies: [sourceGroup], flatten: true, filter: regex(group),
      interval: 600, tolerance: 50, latency_test_url: checkUrl(model),
    } };
    return { select: { name: group.name, policies: members(group, model, nodes, options, [sourceGroup]) } };
  });
  groups.push({ select: {
    name: sourceGroup, policies: unique([...nodes, 'REJECT']),
    urls: subscriptions.map(source => source.url), update_interval: intervals[0] ?? 86400,
  } });
  const direct = policy => policy === 'DIRECT'
    || model.groups.find(group => group.name === policy)?.choices?.[0] === 'DIRECT';
  config.dns.forward = [
    ...['localhost', 'local', 'home.arpa', 'lan'].map(match => ({ domain_suffix: { match, value: 'local' } })),
    ...model.rules.filter(rule => rule.entryTypes
      ? rule.entryTypes.some(type => type.startsWith('domain'))
      : !['china-ipv4', 'china-ipv6', 'china-asn', 'geoip-cn'].includes(rule.id)).map(rule => ({ proxy_rule_set: {
      match: rule.url, value: rule.id === 'lan' ? 'local' : rule.policy === 'REJECT' ? 'reject' : direct(rule.policy) ? 'domestic' : 'remote',
      update_interval: updateInterval(model),
    } })),
    { domain_wildcard: { match: '*', value: 'remote' } },
  ];
  config.policy_groups = groups;
  config.rules = [...model.rules.map(rule => ({ rule_set: {
    match: rule.url, policy: rule.policy, update_interval: updateInterval(model),
  } })), { default: { policy: fallbackName(model) } }];
  // YAML comments describing the native subscription entry are added by the
  // public profile renderer; no fake endpoint or MITM material is active here.
  return config;
}
