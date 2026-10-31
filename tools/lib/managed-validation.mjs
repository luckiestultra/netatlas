import { parse } from 'yaml';
import { managedModel } from './managed-profiles.mjs';
import { profileRulesetsFor } from './policies.mjs';

function sections(text) {
  const result = {}; let current;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^[#;]/.test(line)) continue;
    const heading = /^\[([^\]]+)\]$/.exec(line);
    if (heading) {
      current = heading[1].toLowerCase();
      if (result[current]) throw new Error('Duplicate managed section');
      result[current] = [];
    } else {
      if (!current) throw new Error('Content before managed section');
      result[current].push(line);
    }
  }
  return result;
}
const builtin = value => /^(direct|reject|proxy)$/i.test(value) ? value.toUpperCase() : value;
function fields(line) {
  const values = []; let value = '', quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('Unclosed native field quote');
  values.push(value.trim()); return values;
}

export function validateManagedProfile(clientId, text, rulesets, { baseUrl } = {}) {
  const model = managedModel(clientId, { rulesets, ...(baseUrl ? { baseUrl } : {}) });
  let resources = [], groups = [], fallback, extras = [], object;
  if (['quantumultX', 'surge', 'loon', 'shadowrocket'].includes(clientId)) {
    const ini = sections(text), qx = clientId === 'quantumultX';
    extras = (ini[qx ? 'server_local' : 'proxy'] ?? []).map(line => qx ? /(?:^|,)\s*tag\s*=\s*([^,]+)/.exec(line)?.[1]?.trim() : line.split('=')[0].trim());
    extras.push(...(ini['remote proxy'] ?? []).map(line => line.split('=')[0].trim()));
    extras.push(...(ini['remote filter'] ?? []).map(line => line.split('=')[0].trim()));
    groups = (ini[qx ? 'policy' : 'proxy group'] ?? []).map(line => {
      const match = qx ? /^(static|url-latency-benchmark)\s*=\s*([^,]+),(.*)$/.exec(line) : /^([^=]+)=\s*(select|url-test|smart|fallback)\s*,(.*)$/.exec(line);
      if (!match) throw new Error('Invalid managed native group');
      const name = match[qx ? 2 : 1].trim(), choices = [], dependencies = [];
      for (const member of fields(match[3])) {
        const option = /^([a-z][a-z-]*)=(.*)$/.exec(member);
        if (!option) choices.push(builtin(member));
        else if (option[1] === 'include-other-group') dependencies.push(...option[2].replace(/^"|"$/g, '').split(',').map(value => value.trim()));
        else if (option[1].includes('regex')) new RegExp(option[2]);
      }
      return { name, choices, dependencies };
    });
    if (qx) {
      for (const line of ini.filter_remote ?? []) {
        const [url, ...options] = line.split(',').map(value => value.trim());
        const fields = Object.fromEntries(options.map(value => { const pos = value.indexOf('='); return [value.slice(0, pos), value.slice(pos + 1)]; }));
        if (fields.enabled !== 'true' || fields['update-interval'] !== '86400' || fields['opt-parser'] !== 'false') throw new Error('Invalid managed resource update options');
        resources.push({ id: fields.tag, url, policy: builtin(fields['force-policy']) });
      }
      if (ini.filter_local?.length !== 1 || !/^final,/i.test(ini.filter_local[0])) throw new Error('QX local rules must contain only the final fallback');
      fallback = ini.filter_local[0].split(',')[1];
    } else if (clientId === 'loon') {
      for (const line of ini['remote rule'] ?? []) {
        const [url, ...options] = line.split(',').map(value => value.trim());
        const fields = Object.fromEntries(options.map(value => { const pos = value.indexOf('='); return [value.slice(0, pos).trim(), value.slice(pos + 1).trim()]; }));
        if (fields.enabled !== 'true') throw new Error('Disabled managed Loon resource');
        resources.push({ id: fields.tag, url, policy: builtin(fields.policy) });
      }
      if (ini.rule?.length !== 1) throw new Error('Loon local rules must contain only final');
      fallback = ini.rule[0].split(',')[1]?.trim();
    } else {
      for (const line of ini.rule ?? []) {
        const [type, url, policy] = line.split(',').map(value => value.trim());
        if (type === 'FINAL') { if (fallback) throw new Error('Repeated final'); fallback = url; }
        else {
          if (type !== 'RULE-SET' || fallback) throw new Error('Unexpected managed native rule');
          resources.push({ url, policy: builtin(policy) });
        }
      }
    }
  } else if (clientId === 'egern') {
    object = parse(text);
    if (object.allow_external_connections !== false) throw new Error('External Egern listener');
    groups = (object.policy_groups ?? []).map(item => { const value = item.select ?? item.auto_test ?? item.external ?? item.smart; if (!value) throw new Error('Invalid Egern policy'); return { name: value.name, choices: value.policies ?? [], dependencies: [] }; });
    extras = (object.proxies ?? []).flatMap(item => Object.values(item).map(value => value.name));
    for (const rule of object.rules ?? []) {
      if (rule.default) { if (fallback) throw new Error('Repeated Egern final'); fallback = rule.default.policy; }
      else if (rule.rule_set && !fallback) resources.push({ id: rule.rule_set.name, url: rule.rule_set.match, policy: rule.rule_set.policy });
      else throw new Error('Unexpected managed Egern rule');
    }
  } else if (clientId === 'singBox') {
    object = JSON.parse(text);
    if (!Array.isArray(object.inbounds) || object.inbounds.some(item => item.type === 'tun'
      ? item.tag !== 'tun-in' || item.auto_route !== true || item.strict_route !== true || item.stack !== 'mixed' || item.dns_mode !== 'hijack'
        || JSON.stringify(item.address) !== JSON.stringify(['172.19.0.1/30', 'fdfe:dcba:9876::1/126'])
      : item.type !== 'mixed' || item.listen !== '127.0.0.1' || item.set_system_proxy !== false)) throw new Error('Unexpected sing-box listener');
    groups = object.outbounds.filter(item => ['selector', 'urltest'].includes(item.type)).map(item => ({ name: item.tag, choices: item.outbounds, dependencies: [] }));
    extras = object.outbounds.filter(item => !['selector', 'urltest'].includes(item.type)).map(item => item.tag);
    const providers = new Map((object.route.rule_set ?? []).map(item => [item.tag, item]));
    for (const item of object.route.rules ?? []) {
      if (object.inbounds.some(item => item.type === 'tun') && JSON.stringify(item) === JSON.stringify({ inbound: ['tun-in'], port: 53, action: 'hijack-dns' })) continue;
      if (object.inbounds.some(item => item.type === 'tun') && JSON.stringify(item) === JSON.stringify({ inbound: ['tun-in'], action: 'sniff' })) continue;
      if (item.action === 'resolve' && Object.keys(item).length === 1) continue;
      if (item.action === 'resolve' && Object.keys(item).length === 2 && JSON.stringify(item.domain_suffix) === JSON.stringify(['home.arpa', 'local', 'localhost', 'lan'])) continue;
      if (!Array.isArray(item.rule_set) || item.rule_set.length !== 1 || !['route', 'reject'].includes(item.action)) throw new Error('Unexpected managed sing-box rule');
      const source = providers.get(item.rule_set[0]);
      if (!source || source.type !== 'remote' || source.format !== 'source' || source.update_interval !== '1d') throw new Error('Missing native sing-box remote rules');
      resources.push({ id: source.tag, url: source.url, policy: item.action === 'reject' ? 'REJECT' : item.outbound });
    }
    if (providers.size !== resources.length) throw new Error('Unused or duplicate sing-box provider');
    fallback = object.route.final;
  } else {
    object = parse(text);
    if (object['allow-lan'] !== false || object['bind-address'] !== '127.0.0.1') throw new Error('Unexpected Clash listener');
    groups = (object['proxy-groups'] ?? []).map(item => ({ name: item.name, choices: item.proxies ?? [], dependencies: [] }));
    extras = (object.proxies ?? []).map(item => item.name);
    for (const line of object.rules ?? []) {
      const [type, id, policy] = line.split(',');
      if (type === 'MATCH') { if (fallback) throw new Error('Repeated MATCH'); fallback = id; }
      else {
        if (type !== 'RULE-SET' || fallback) throw new Error('Unexpected managed Clash rule');
        const source = object['rule-providers']?.[id];
        if (!source || source.behavior !== 'classical' || source.format !== 'yaml' || source.interval !== 86400) throw new Error('Missing native Clash rule provider');
        resources.push({ id, url: source.url, policy });
      }
    }
    if (Object.keys(object['rule-providers'] ?? {}).length !== resources.length) throw new Error('Unused or duplicate Clash provider');
  }
  const known = new Set(['DIRECT', 'REJECT', 'PROXY', ...extras]), byName = new Map();
  for (const group of groups) {
    if (!group.name || known.has(group.name)) throw new Error('Duplicate or missing managed policy');
    known.add(group.name); byName.set(group.name, group);
  }
  for (const group of groups) for (const choice of [...group.choices, ...group.dependencies]) if (!known.has(builtin(choice))) throw new Error('Unknown managed group member');
  for (const group of model.groups) if (!byName.has(group.name)) throw new Error(`Missing managed policy: ${group.name}`);
  function visit(name, path = []) {
    if (path.includes(name)) throw new Error('Managed policy cycle');
    const group = byName.get(name);
    for (const choice of [...group?.choices ?? [], ...group?.dependencies ?? []]) if (byName.has(choice)) visit(choice, [...path, name]);
  }
  for (const group of groups) visit(group.name);
  if (fallback !== model.fallback) throw new Error('Wrong managed final fallback');
  if (resources.length !== model.rules.length) throw new Error('Missing or extra managed resource');
  resources.forEach((resource, index) => {
    const expected = model.rules[index];
    if (resource.url !== expected.url || resource.policy !== expected.policy || (resource.id !== undefined && resource.id !== expected.id)) throw new Error(`Managed resource order, URL or policy mismatch: ${expected.id}`);
  });
  return { level: 'managed-resources-and-references', resources: resources.length, entries: profileRulesetsFor(rulesets).reduce((sum, rule) => sum + rule.entries.length, 0), groups: groups.length, native: 'not-run' };
}
