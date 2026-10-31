import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import configuration from '../../metadata/regex-routing.json' with { type: 'json' };
import upstreams from '../../metadata/upstreams.json' with { type: 'json' };
import { policyForRuleset } from './policies.mjs';
import assert from 'node:assert/strict';

const nativeClients = new Set(['egern', 'stash', 'mihomo', 'singBox']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const compare = (a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`, 'en');
const unique = entries => [...new Map(entries.map(entry => [`${entry.type}:${entry.value}`, entry])).values()].sort(compare);

function registryFrom(config, sources) {
  if (config.version !== 1 || config.license !== 'MIT' || !Array.isArray(config.expressions)) throw new Error('Invalid regular-expression registry');
  const source = sources.repositories.find(item => item.id === 'domain-list-community');
  if (source?.revision !== config.sourceRevision || source.license !== 'MIT') throw new Error('Regular-expression source revision/license mismatch');
  if (Object.keys(config.clients).sort().join(',') !== 'egern,loon,mihomo,quantumultX,shadowrocket,singBox,stash,surge') throw new Error('Invalid regular-expression clients');
  for (const [id, client] of Object.entries(config.clients)) {
    if (client.nativeRegex !== nativeClients.has(id) || !Array.isArray(client.documentation) || client.documentation.some(url => !/^https:\/\//.test(url))) throw new Error('Invalid native regular-expression capability');
  }
  const registered = new Map();
  for (const definition of config.expressions) {
    if (!/^[a-z0-9-]+$/.test(definition.file) || typeof definition.rule !== 'string' || !definition.rule.startsWith('regexp:') || /[\r\n]/.test(definition.rule) || !Array.isArray(definition.positive) || !Array.isArray(definition.negative)) throw new Error('Invalid registered regular expression');
    const key = `${definition.file}:${definition.rule}`;
    if (registered.has(key)) throw new Error('Duplicate registered regular expression');
    new RegExp(definition.rule.slice(7));
    registered.set(key, definition);
  }
  const used = new Set();
  const rulesets = [];
  for (const record of sources.rulesets) {
    const expressions = record.appliedExclusions ?? [];
    if (!expressions.length) continue;
    if (record.source.repository !== source.id) throw new Error('Unregistered regular-expression source');
    for (const expression of expressions) {
      const key = `${expression.file}:${expression.rule}`;
      if (!registered.has(key) || !record.exclusions?.some(item => item.file === expression.file && item.rule === expression.rule) || !record.files?.some(item => item.path === `data/${expression.file}` && /^[a-f0-9]{64}$/.test(item.sha256))) throw new Error('Unregistered regular-expression exclusion/source');
      used.add(key);
    }
    rulesets.push({ id: record.id, category: record.category, policy: policyForRuleset(record), expressions, files: record.files });
  }
  if ([...registered.keys()].some(key => !used.has(key))) throw new Error('Unused regular-expression registration');
  return { ...config, source, rulesets };
}

export const regexRegistry = registryFrom(configuration, upstreams);

// Existing five-type files remain portable projections. These resources restore
// source conditions only when the client's domain matcher has exact semantics.
export async function loadRegexRouting(root) {
  const [config, sources] = await Promise.all([
    readFile(path.join(root, 'metadata/regex-routing.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'metadata/upstreams.json'), 'utf8').then(JSON.parse)
  ]);
  const registry = registryFrom(config, sources);
  const directory = path.join(root, 'src/vendor/rule-sources/domain-list-community/regex');
  const license = await readFile(path.join(directory, 'LICENSE'));
  if (sha256(license) !== registry.source.licenseSha256) throw new Error('Regular-expression source license digest mismatch');
  const originals = new Map();
  for (const definition of registry.expressions) {
    if (!originals.has(definition.file)) originals.set(definition.file, await readFile(path.join(directory, `${definition.file}.txt`)));
  }
  for (const set of registry.rulesets) for (const expression of set.expressions) {
    const original = originals.get(expression.file);
    const reference = set.files.find(file => file.path === `data/${expression.file}`);
    if (sha256(original) !== reference.sha256) throw new Error('Regular-expression source digest mismatch');
    const line = original.toString('utf8').split(/\r?\n/)[expression.line - 1]?.split('#', 1)[0].trim();
    if (line !== expression.sourceLine || !line.startsWith(expression.rule) || !new RegExp(`^${escapeRegex(expression.rule)}(?:\\s|$)`).test(line)) throw new Error('Regular-expression source line mismatch');
  }
  assert.deepEqual(registry, regexRegistry, 'Regex metadata differs from the loaded registry; restart after changing source inputs');
  return registry;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Go RE2's Perl classes are ASCII, unlike several PCRE configurations. Preserve
// that language explicitly; also avoid commas interpreted as CSV separators.
export function nativeRegexExpression(rule) {
  if (!rule.startsWith('regexp:')) throw new Error('Expected source regular expression');
  const expression = rule.slice(7)
    .replaceAll('\\d', '[0-9]')
    .replaceAll('\\w', '[A-Za-z0-9_]')
    .replaceAll('\\S', '[^\\x09\\x0a\\x0c\\x0d\\x20]')
    .replaceAll('[a-z]{2,6}', '[a-z][a-z][a-z]?[a-z]?[a-z]?[a-z]?');
  if (/[,\r\n]/.test(expression)) throw new Error('Unreviewed CSV regular-expression syntax');
  return expression;
}

function wildcardValues(rule, classes) {
  // Literal equality is intentional: a new upstream regex cannot reuse an
  // approximate converter merely because its prefix looks similar.
  const netflix = [
    'apiproxy-device-prod-nlb-', 'apiproxy-website-nlb-prod-',
    'dualstack.apiproxy-', 'dualstack.ichnaea-web-'
  ];
  for (const prefix of netflix) {
    const expression = `regexp:(^|\\.)${prefix.replaceAll('.', '\\.')}.+\\.amazonaws\\.com$`;
    if (rule === expression) return { proof: 'Root-or-dot-boundary plus one-or-more arbitrary characters is exactly two whole-host glob patterns.', values: [`${prefix}?*.amazonaws.com`, `*.${prefix}?*.amazonaws.com`] };
  }
  if (rule === 'regexp:^.+-mihayo\\.akamaized\\.net$') return { proof: 'The anchored one-or-more arbitrary prefix is exactly ?*; all remaining characters are literal.', values: ['?*-mihayo.akamaized.net'] };
  const numeric = [
    ['regexp:.+\\.awsdns-[0-9][0-9]\\.(co\\.uk|com|net|org)$', 'awsdns-', '0123456789', ['co.uk', 'com', 'net', 'org']],
    ['regexp:.+\\.awsdns-cn-[0-9][0-9]\\.(biz|com|net|top)$', 'awsdns-cn-', '0123456789', ['biz', 'com', 'net', 'top']],
    ['regexp:.+\\.awsdns-cn-[0-9][a-e0-9]\\.cn$', 'awsdns-cn-', 'abcde0123456789', ['cn']]
  ];
  for (const [expression, prefix, second, suffixes] of numeric) if (rule === expression) {
    const values = [];
    if (classes) for (const suffix of suffixes) values.push(`?*.${prefix}[0-9]${second.startsWith('abcde') ? '[a-e0-9]' : '[0-9]'}.${suffix}`);
    else for (const digit of '0123456789') for (const other of second) for (const suffix of suffixes) values.push(`?*.${prefix}${digit}${other}.${suffix}`);
    return { proof: 'The fixed two-character classes and finite suffix alternatives are preserved by native classes or complete literal enumeration; the nonempty host prefix is ?*.', values };
  }
  if (classes && rule === 'regexp:^speed\\.(coe|open)\\.ad\\.[a-z]{2,6}\\.prod\\.hosts\\.ooklaserver\\.net$') {
    return { proof: 'Two literal alternatives times each of the five allowed lengths, retaining every ASCII letter class.', values: ['coe', 'open'].flatMap(part => [2, 3, 4, 5, 6].map(length => `speed.${part}.ad.${'[a-z]'.repeat(length)}.prod.hosts.ooklaserver.net`)) };
  }
  return null;
}

export function regexRoutingFor(clientId, registry = regexRegistry) {
  const client = registry.clients[clientId];
  if (!client) throw new Error(`Unknown regular-expression client: ${clientId}`);
  const registered = new Map(registry.expressions.map(item => [`${item.file}:${item.rule}`, item]));
  const expressions = [];
  const resources = [];
  for (const set of registry.rulesets) {
    const conditions = [];
    for (const source of set.expressions) {
      if (!registered.has(`${source.file}:${source.rule}`)) throw new Error('Unregistered regular-expression source condition');
      const converted = client.wildcard && wildcardValues(source.rule, client.wildcard === 'classes');
      const entries = client.nativeRegex
        ? [{ type: 'domain-regex', value: nativeRegexExpression(source.rule) }]
        : converted ? converted.values.map(value => ({ type: 'domain-wildcard', value })) : [];
      expressions.push({ sourceId: set.id, ...source, status: entries.length ? client.nativeRegex ? 'native-regex' : 'exact-wildcard' : 'unsupported', proof: client.nativeRegex ? 'Same RE2 search language with explicit ASCII shorthand and CSV-safe bounded repetition.' : converted?.proof ?? client.limitation, entries });
      conditions.push(...entries);
    }
    if (conditions.length) {
      const entries = unique(conditions);
      const id = `${set.id}-regex`;
      const extension = ['egern', 'classical-yaml'].includes(client.format) ? 'yaml' : client.format === 'singBox' ? 'json' : 'list';
      resources.push({ id, sourceId: set.id, category: set.category, policy: set.policy, path: `rules/${id}.${extension}`, content: renderRegexRuleset(clientId, entries, set.policy, registry), entries, domainOnly: true, license: 'MIT', sourceRevision: registry.sourceRevision });
    }
  }
  return { resources, expressions, supportedExpressions: expressions.filter(item => item.status !== 'unsupported').length, unsupportedExpressions: expressions.filter(item => item.status === 'unsupported').length };
}

function renderRegexRuleset(clientId, entries, policy, registry) {
  const client = registry.clients[clientId];
  if (client.format === 'qx') return `${entries.map(entry => `host-wildcard,${entry.value},${['DIRECT', 'REJECT'].includes(policy) ? policy.toLowerCase() : policy}`).join('\n')}\n`;
  if (client.format === 'classical' || client.format === 'classical-yaml') {
    const payload = entries.map(entry => `${entry.type === 'domain-regex' ? 'DOMAIN-REGEX' : 'DOMAIN-WILDCARD'},${entry.value}`);
    return client.format === 'classical' ? `${payload.join('\n')}\n` : stringify({ payload }, { lineWidth: 0 });
  }
  if (client.format === 'egern') return stringify({ domain_regex_set: entries.map(entry => entry.value) }, { lineWidth: 0 });
  if (client.format === 'singBox') return json({ version: 3, rules: [{ domain_regex: entries.map(entry => entry.value) }] });
  throw new Error('Unsupported regular-expression format');
}

export function decodeRegexRuleset(clientId, text, registry = regexRegistry) {
  const client = registry.clients[clientId];
  if (!client) throw new Error('Unknown regular-expression client');
  let entries;
  if (client.format === 'egern') {
    const object = parse(text);
    if (Object.keys(object).join(',') !== 'domain_regex_set' || !Array.isArray(object.domain_regex_set)) throw new Error('Unexpected regex resource field');
    entries = object.domain_regex_set.map(value => ({ type: 'domain-regex', value }));
  } else if (client.format === 'singBox') {
    const object = JSON.parse(text);
    if (object.version !== 3 || Object.keys(object).sort().join(',') !== 'rules,version' || object.rules?.length !== 1 || Object.keys(object.rules[0]).join(',') !== 'domain_regex' || !Array.isArray(object.rules[0].domain_regex)) throw new Error('Unexpected regex resource field');
    entries = object.rules[0].domain_regex.map(value => ({ type: 'domain-regex', value }));
  } else {
    const lines = client.format === 'classical-yaml' ? parse(text)?.payload : text.trim().split(/\r?\n/);
    if (!Array.isArray(lines)) throw new Error('Missing regex resource payload');
    entries = lines.map(line => {
      const [type, value, policy, ...remaining] = line.split(',');
      if (remaining.length || (client.format !== 'qx' && policy !== undefined) || (client.format === 'qx' && !policy)) throw new Error('Unexpected regex resource parameters');
      const condition = type === 'DOMAIN-REGEX' ? 'domain-regex' : ['DOMAIN-WILDCARD', 'host-wildcard'].includes(type) ? 'domain-wildcard' : null;
      if (!condition) throw new Error('Unexpected regex resource condition');
      return { type: condition, value };
    });
  }
  for (const entry of entries) {
    if (typeof entry.value !== 'string' || /[,\r\n]/.test(entry.value)) throw new Error('Invalid regex resource value');
    matchesRegexCondition(entry, 'validation.example');
  }
  return unique(entries);
}

export function matchesRegexCondition(entry, host) {
  if (entry.type === 'domain-regex') return new RegExp(entry.value).test(host);
  if (entry.type !== 'domain-wildcard') throw new Error('Unsupported domain condition');
  let expression = '^';
  for (let i = 0; i < entry.value.length; i++) {
    const char = entry.value[i];
    if (char === '*') expression += '.*';
    else if (char === '?') expression += '.';
    else if (char === '[') {
      const close = entry.value.indexOf(']', i + 1);
      const content = entry.value.slice(i + 1, close);
      if (close === -1 || !['0-9', 'a-e0-9', 'a-z'].includes(content)) throw new Error('Unregistered wildcard character class');
      expression += `[${content}]`; i = close;
    } else expression += escapeRegex(char);
  }
  return new RegExp(expression + '$').test(host);
}
