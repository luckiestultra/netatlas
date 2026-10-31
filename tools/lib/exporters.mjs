import { parse, stringify } from 'yaml';
import { getClient } from './clients.mjs';
import { normalizeEntry, normalizeRuleset } from './rules.mjs';
import { policyForRuleset } from './policies.mjs';

const classical = { domain: 'DOMAIN', 'domain-suffix': 'DOMAIN-SUFFIX', 'ip-cidr': 'IP-CIDR', 'ip-cidr6': 'IP-CIDR6' };
const quantumult = { domain: 'host', 'domain-suffix': 'host-suffix', 'ip-cidr': 'ip-cidr', 'ip-cidr6': 'ip6-cidr' };
const egern = { domain: 'domain_set', 'domain-suffix': 'domain_suffix_set', 'ip-cidr': 'ip_cidr_set', 'ip-cidr6': 'ip_cidr6_set' };
const singBox = { domain: 'domain', 'domain-suffix': 'domain_suffix', 'ip-cidr': 'ip_cidr', 'ip-cidr6': 'ip_cidr' };
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export function renderRuleset(clientId, input) {
  const client = getClient(clientId);
  const ruleset = normalizeRuleset(input);
  let content;
  if (client.ruleFormat === 'quantumultX') {
    const policy = policyForRuleset(ruleset);
    const nativePolicy = ['DIRECT', 'REJECT'].includes(policy) ? policy.toLowerCase() : policy;
    content = `${ruleset.entries.map(entry => `${quantumult[entry.type]},${entry.value},${nativePolicy}`).join('\n')}\n`;
  } else if (client.ruleFormat === 'classical' || client.ruleFormat === 'classical-yaml') {
    const resolveIp = ['china-ipv4', 'china-ipv6'].includes(ruleset.id);
    const lines = ruleset.entries.map(entry => `${classical[entry.type]},${entry.value}${entry.type.startsWith('ip-') && !resolveIp ? ',no-resolve' : ''}`);
    content = client.ruleFormat === 'classical' ? `${lines.join('\n')}\n` : stringify({ payload: lines }, { lineWidth: 0 });
  } else {
    const fields = {};
    const names = client.ruleFormat === 'egern' ? egern : singBox;
    for (const entry of ruleset.entries) (fields[names[entry.type]] ??= []).push(entry.value);
    content = client.ruleFormat === 'egern' ? stringify({ no_resolve: !['china-ipv4', 'china-ipv6'].includes(ruleset.id), ...fields }, { lineWidth: 0 }) : json({ version: 3, rules: [fields] });
  }
  return { path: `rules/${ruleset.id}.${client.ruleExtension}`, content };
}

export function decodeRuleset(clientId, text) {
  const client = getClient(clientId);
  const entries = [];
  if (client.ruleFormat === 'egern' || client.ruleFormat === 'singBox') {
    const object = client.ruleFormat === 'egern' ? parse(text) : JSON.parse(text);
    const objects = client.ruleFormat === 'egern' ? [object] : object.rules;
    if (!Array.isArray(objects) || objects.length === 0) throw new Error('Missing native rule conditions');
    for (const item of objects) {
      const mapping = client.ruleFormat === 'egern' ? { domain_set: 'domain', domain_suffix_set: 'domain-suffix', ip_cidr_set: 'ip-cidr', ip_cidr6_set: 'ip-cidr6' } : { domain: 'domain', domain_suffix: 'domain-suffix', ip_cidr: null };
      for (const [field, values] of Object.entries(item)) {
        if (field === 'no_resolve' && client.ruleFormat === 'egern') continue;
        if (!(field in mapping) || !Array.isArray(values)) throw new Error(`Unsupported native condition: ${field}`);
        for (const value of values) entries.push(normalizeEntry({ type: mapping[field] || (value.includes(':') ? 'ip-cidr6' : 'ip-cidr'), value }));
      }
    }
  } else {
    const lines = client.ruleFormat === 'classical-yaml' ? parse(text)?.payload : text.trim().split(/\r?\n/);
    if (!Array.isArray(lines)) throw new Error('Missing classical payload');
    const mapping = Object.fromEntries(Object.entries(client.ruleFormat === 'quantumultX' ? quantumult : classical).map(([a, b]) => [b, a]));
    for (const line of lines) {
      const [type, value] = line.split(',').map(part => part.trim());
      entries.push(normalizeEntry({ type: mapping[type], value }));
    }
  }
  return entries.sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`, 'en'));
}
