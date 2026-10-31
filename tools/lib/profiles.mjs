import { stringify as stringifyYaml } from 'yaml';
import { policyGroupsFor, policyForRuleset, profileRulesetsFor } from './policies.mjs';

export const profileFormats = Object.freeze({
  quantumultX: { extension: 'conf', format: 'ini' },
  surge: { extension: 'conf', format: 'ini' },
  loon: { extension: 'conf', format: 'ini' },
  shadowrocket: { extension: 'conf', format: 'ini' },
  egern: { extension: 'yaml', format: 'yaml' },
  stash: { extension: 'yaml', format: 'yaml' },
  mihomo: { extension: 'yaml', format: 'yaml' },
  singBox: { extension: 'json', format: 'json' },
});

const nativeRuleTypes = {
  domain: 'DOMAIN',
  'domain-suffix': 'DOMAIN-SUFFIX',
  'ip-cidr': 'IP-CIDR',
  'ip-cidr6': 'IP-CIDR6',
};
const qxRuleTypes = {
  domain: 'host',
  'domain-suffix': 'host-suffix',
  'ip-cidr': 'ip-cidr',
  'ip-cidr6': 'ip6-cidr',
};
const egernRuleTypes = {
  domain: 'domain',
  'domain-suffix': 'domain_suffix',
  'ip-cidr': 'ip_cidr',
  'ip-cidr6': 'ip_cidr6',
};
const singBoxRuleTypes = {
  domain: 'domain',
  'domain-suffix': 'domain_suffix',
  'ip-cidr': 'ip_cidr',
  'ip-cidr6': 'ip_cidr',
};

const preamble = '# NetAtlas — standalone profile\n'
  + '# Proxy defaults to REJECT. Add your own nodes and select them before use.\n'
  + '# DIRECT is an explicit alternative. Rules are inline; no remote rule files are needed.\n';

function flattenRules(rulesets) {
  return rulesets.flatMap(ruleset => ruleset.entries.map(entry => {
    if (!Object.hasOwn(nativeRuleTypes, entry.type)) {
      throw new Error(`Unsupported profile rule type: ${entry.type}`);
    }
    if (typeof entry.value !== 'string' || !entry.value || /[\r\n,]/.test(entry.value)) {
      throw new Error(`Invalid profile rule value in ${ruleset.id}`);
    }
    return { ...entry, policy: policyForRuleset(ruleset) };
  }));
}

function classicRules(entries, final = 'FINAL') {
  return [...entries.map(({ type, value, policy }) => {
    const noResolve = type === 'ip-cidr' || type === 'ip-cidr6' ? ',no-resolve' : '';
    return `${nativeRuleTypes[type]},${value},${policy}${noResolve}`;
  }), `${final},Proxy`].join('\n');
}

function iniGroups(groups) {
  return groups.map(({ name, choices }) => `${name} = select, ${choices.join(', ')}`).join('\n');
}

function qxBuiltin(policy) {
  return policy === 'DIRECT' || policy === 'REJECT' ? policy.toLowerCase() : policy;
}

// Official sample: https://github.com/crossutility/Quantumult-X/blob/master/sample.conf
function quantumultX(entries, groups) {
  const nativeGroups = groups.map(({ name, choices }) => `static=${name},${choices.map(qxBuiltin).join(',')}`).join('\n');
  const rules = entries.map(({ type, value, policy }) => `${qxRuleTypes[type]},${value},${qxBuiltin(policy)}`);
  return `${preamble}
[general]
server_check_timeout=3000

[policy]
${nativeGroups}

[server_local]
# Add private nodes here locally; this repository contains no node credentials.

[filter_local]
${[...rules, 'final,Proxy'].join('\n')}
`;
}

// https://manual.nssurge.com/profile/general.html
// https://manual.nssurge.com/policy-groups/overview.html
function surge(entries, groups) {
  return `${preamble}
[General]
loglevel = notify
ipv6 = true
allow-wifi-access = false
allow-hotspot-access = false
http-listen = 127.0.0.1:6152
socks5-listen = 127.0.0.1:6153

[Proxy]
# Add private nodes here locally.

[Proxy Group]
${iniGroups(groups)}

[Rule]
${classicRules(entries)}
`;
}

// https://nsloon.app/docs/Rule/ip_rule/
// https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/policygroup.md
function loon(entries, groups) {
  return `${preamble}
[General]
allow-wifi-access = false
dns-server = system

[Proxy]
# Add private nodes here locally.

[Proxy Group]
${iniGroups(groups)}

[Rule]
${classicRules(entries)}
`;
}

// The vendor publishes capabilities, but no complete public configuration grammar:
// https://apps.apple.com/us/app/shadowrocket/id932747118
// Native app import must therefore be verified separately from text validation.
function shadowrocket(entries, groups) {
  return `${preamble}
[General]
dns-server = system
ipv6 = true

[Proxy Group]
${iniGroups(groups)}

[Rule]
${classicRules(entries)}
`;
}

// https://egernapp.com/docs/configuration/rules/
// https://egernapp.com/docs/configuration/policy_groups/
function egern(entries, groups) {
  return {
    ipv6: true,
    allow_external_connections: false,
    http_port: 3080,
    socks_port: 3090,
    policy_groups: groups.map(({ name, choices }) => ({ select: { name, policies: [...choices] } })),
    rules: [...entries.map(({ type, value, policy }) => ({
      [egernRuleTypes[type]]: {
        match: value,
        policy,
        ...(type.startsWith('ip-cidr') ? { no_resolve: true } : {}),
      },
    })), { default: { policy: 'Proxy' } }],
  };
}

// https://stash.wiki/configuration/example-config
// https://stash.wiki/proxy-protocols/proxy-groups
function stash(entries, groups) {
  return {
    mode: 'rule',
    'log-level': 'info',
    'allow-lan': false,
    'bind-address': '127.0.0.1',
    ipv6: true,
    proxies: [],
    'proxy-groups': groups.map(({ name, choices }) => ({ name, type: 'select', proxies: [...choices] })),
    rules: classicRules(entries, 'MATCH').split('\n'),
  };
}

// https://wiki.metacubex.one/en/config/general/
// https://wiki.metacubex.one/en/config/rules/
function mihomo(entries, groups) {
  return {
    'mixed-port': 7890,
    'allow-lan': false,
    'bind-address': '127.0.0.1',
    mode: 'rule',
    'log-level': 'info',
    ipv6: true,
    proxies: [],
    'proxy-groups': groups.map(({ name, choices }) => ({ name, type: 'select', proxies: [...choices] })),
    rules: classicRules(entries, 'MATCH').split('\n'),
  };
}

// Pinned 1.14.4 source registers the real block outbound, selectable by tag:
// https://github.com/SagerNet/sing-box/blob/v1.14.4/include/registry.go
// https://sing-box.sagernet.org/configuration/route/rule_action/
function singBox(entries, groups) {
  return {
    log: { level: 'info' },
    dns: { servers: [{ type: 'local', tag: 'local' }], final: 'local' },
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 7890, set_system_proxy: false }],
    outbounds: [
      { type: 'direct', tag: 'DIRECT' },
      { type: 'block', tag: 'REJECT' },
      ...groups.map(({ name, choices }) => ({ type: 'selector', tag: name, outbounds: [...choices], default: choices[0] })),
    ],
    route: {
      default_domain_resolver: 'local',
      rules: entries.map(({ type, value, policy }) => ({
        [singBoxRuleTypes[type]]: [value],
        ...(policy === 'REJECT' ? { action: 'reject' } : { action: 'route', outbound: policy }),
      })),
      final: 'Proxy',
    },
  };
}

const renderers = { quantumultX, surge, loon, shadowrocket, egern, stash, mihomo, singBox };

export function renderProfile(client, { rulesets = [] } = {}) {
  rulesets = profileRulesetsFor(rulesets);
  if (!Object.hasOwn(profileFormats, client)) throw new Error(`Unknown profile client: ${client}`);
  const { extension, format } = profileFormats[client];
  const rendered = renderers[client](flattenRules(rulesets), policyGroupsFor(rulesets));
  let content;
  if (format === 'json') content = `${JSON.stringify(rendered, null, 2)}\n`;
  else if (format === 'yaml') content = `${preamble}\n${stringifyYaml(rendered, { lineWidth: 0 })}`;
  else content = rendered;
  return { path: `profiles/default.${extension}`, content, format };
}
