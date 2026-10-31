import { normalizeEntry } from './rules.mjs';
import { profileRulesetsFor, policyForRuleset } from './policies.mjs';
import { regexRoutingFor } from './regex-routing.mjs';
import { nativeRoutingFor, nativeRoutingSettings } from './native-routing.mjs';
import { parse } from 'yaml';
import { createHash } from 'node:crypto';
import upstreams from '../../metadata/upstreams.json' with { type: 'json' };

// Host-specific conditions stay outside the portable five-type catalog.
export const classicRoutingTypes = Object.freeze({ 'domain-regex': 'DOMAIN-REGEX', 'domain-wildcard': 'DOMAIN-WILDCARD', 'ip-asn': 'IP-ASN', geoip: 'GEOIP' });
export const qxRoutingTypes = Object.freeze({ 'domain-wildcard': 'host-wildcard', 'ip-asn': 'ip-asn', geoip: 'geoip' });
export const egernRoutingTypes = Object.freeze({ 'domain-regex': 'domain_regex', 'ip-asn': 'asn', geoip: 'geoip' });

export function normalizeRoutingEntry(entry) {
  if (!Object.hasOwn(classicRoutingTypes, entry?.type)) return normalizeEntry(entry);
  const { type, value } = entry;
  if (typeof value !== 'string' || !value || /[\r\n,]/.test(value)) throw new Error('Invalid native routing condition');
  if (type === 'ip-asn' && (!/^[1-9][0-9]*$/.test(value) || Number(value) > 4294967295)) throw new Error('Invalid native ASN');
  if (type === 'geoip' && !/^[A-Z]{2}$/.test(value)) throw new Error('Invalid native country');
  if (type === 'domain-regex') new RegExp(value);
  return { type, value };
}

export function profileRoutingResources(client, rulesets) {
  const active = new Set(rulesets.map(rule => rule.id));
  // A private caller may reuse an ID for a deliberately smaller rule fixture.
  // Restore exclusions only for the exact registered source projection.
  const exact = new Set(rulesets.filter(rule => {
    const registered = upstreams.rulesets.find(record => record.id === rule.id);
    return registered?.outputSha256 === createHash('sha256').update(JSON.stringify(rule, null, 2) + '\n').digest('hex');
  }).map(rule => rule.id));
  return [...regexRoutingFor(client).resources.filter(resource => exact.has(resource.sourceId)), ...nativeRoutingFor(client).filter(resource => active.has(resource.sourceId))];
}

export function expandedProfileEntries(client, rulesets) {
  const selected = profileRulesetsFor(rulesets);
  const additions = profileRoutingResources(client, selected);
  return selected.flatMap(ruleset => [
    ...additions.filter(resource => resource.sourceId === ruleset.id).flatMap(resource => resource.entries.map(entry => ({
      ...normalizeRoutingEntry(entry), policy: policyForRuleset(ruleset), rulesetId: resource.id,
    }))),
    ...ruleset.entries.map(entry => ({ ...normalizeEntry(entry), policy: policyForRuleset(ruleset), rulesetId: ruleset.id })),
  ]);
}

export function withNativeRoutingSettings(client, value, rulesets) {
  if (!profileRulesetsFor(rulesets).some(rule => rule.id === 'china-ipv4')) return value;
  const { iniFields, configFields } = nativeRoutingSettings(client);
  if (typeof value !== 'string') return { ...value, ...structuredClone(configFields) };
  const fields = Object.entries(iniFields).map(([key, setting]) => `${key}=${setting}`);
  return fields.length ? value.replace(/^(\[general\])$/im, `$1\n${fields.join('\n')}`) : value;
}

export function validateNativeRoutingSettings(client, text, rulesets) {
  if (!profileRulesetsFor(rulesets).some(rule => rule.id === 'china-ipv4')) return;
  const expected = nativeRoutingSettings(client);
  if (['egern', 'stash', 'mihomo', 'singBox'].includes(client)) {
    const value = client === 'singBox' ? JSON.parse(text) : parse(text);
    for (const [key, setting] of Object.entries(expected.configFields)) {
      if (JSON.stringify(value[key]) !== JSON.stringify(setting)) throw new Error(`Wrong native database setting: ${key}`);
    }
  } else {
    const general = text.split(/^\[general\]\s*$/im)[1]?.split(/^\[/m)[0] ?? '';
    const fields = general.split('\n').map(line => /^\s*([^#;=\s]+)\s*=\s*(.*?)\s*$/.exec(line)).filter(Boolean);
    for (const [key, setting] of Object.entries(expected.iniFields)) {
      const values = fields.filter(match => match[1] === key);
      if (values.length !== 1 || values[0][2] !== String(setting)) throw new Error(`Wrong native database setting: ${key}`);
    }
  }
}
