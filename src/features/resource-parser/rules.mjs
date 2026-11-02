import { createTextMatcher } from './options.mjs';
import { stripComment } from './comments.mjs';
import { createDomainAndCompiler, parseDomainAnd } from './domain-and.mjs';
// Original NetAtlas converter. Only documented QX conditions are emitted.
// QX: https://github.com/crossutility/Quantumult-X/blob/master/sample.conf
// Headless OR/AND semantics: https://sing-box.sagernet.org/configuration/rule-set/headless-rule/
import { MAX_TEXT, MAX_LINES, MAX_RULE_TEXT, MAX_RULE_LINES } from './limits.mjs';
const TYPES = {
  DOMAIN: 'host', HOST: 'host', 'DOMAIN-SUFFIX': 'host-suffix', 'HOST-SUFFIX': 'host-suffix',
  'DOMAIN-KEYWORD': 'host-keyword', 'HOST-KEYWORD': 'host-keyword', 'DOMAIN-WILDCARD': 'host-wildcard', 'HOST-WILDCARD': 'host-wildcard',
  'IP-CIDR': 'ip-cidr', 'IP-CIDR6': 'ip6-cidr', 'IP6-CIDR': 'ip6-cidr', GEOIP: 'geoip', 'IP-ASN': 'ip-asn',
  'USER-AGENT': 'user-agent', FINAL: 'final', MATCH: 'final',
};
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fail = message => { throw new Error('Rule conversion: ' + message); };
const record = value => value && typeof value === 'object' && !Array.isArray(value);

function policy(value) {
  if (typeof value !== 'string' || !value.trim() || /[,"\r\n\x00-\x1f=]/.test(value) || value.length > 128) fail('invalid or quoted policy');
  value = value.trim();
  return ['DIRECT', 'REJECT'].includes(value) ? value.toLowerCase() : value;
}

function domain(value, wildcard = false) {
  if (typeof value !== 'string') fail('invalid domain');
  value = value.toLowerCase().replace(/\.$/, '');
  if (!value || value.length > 253 || /[^a-z0-9.*?_-]/.test(value) || (!wildcard && /[*?]/.test(value))) fail('invalid domain');
  if (value.split('.').some(label => !label || label.length > 63 || !/^[a-z0-9*?_](?:[a-z0-9*?_-]*[a-z0-9*?_])?$/.test(label))) fail('invalid domain label');
  return value;
}

function ipAddress(value, family) {
  if (family === 4) {
    const parts = value.split('.');
    return parts.length === 4 && parts.every(part => /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255);
  }
  if (!/^[a-fA-F0-9:.]+$/.test(value)) return false;
  if (value.includes('.')) {
    const boundary = value.lastIndexOf(':');
    if (boundary < 0) return false;
    const tail = value.slice(boundary + 1);
    if (!ipAddress(tail, 4)) return false;
    value = value.slice(0, boundary) + ':0:0';
  }
  if (value.includes(':::') || value.split('::').length > 2) return false;
  const compressed = value.includes('::');
  if (!compressed && (value.startsWith(':') || value.endsWith(':'))) return false;
  const parts = value.split(':').filter(Boolean);
  return parts.every(part => /^[a-fA-F0-9]{1,4}$/.test(part)) && (compressed ? parts.length < 8 : parts.length === 8);
}

function cidr(value, family) {
  if (typeof value !== 'string' || /\s/.test(value)) fail('invalid IP condition');
  const pieces = value.split('/');
  const max = family === 4 ? 32 : 128;
  if (pieces.length > 2 || !ipAddress(pieces[0], family) || (pieces.length === 2 && (!/^(0|[1-9][0-9]{0,2})$/.test(pieces[1]) || Number(pieces[1]) > max))) fail('invalid IP prefix');
  return pieces[0].toLowerCase() + '/' + (pieces[1] ?? max);
}

// These are reviewed literal expressions from the MIT-licensed NetAtlas regex
// registry. No general regex-to-glob approximation is attempted.
function regexGlobs(expression) {
  for (const prefix of ['apiproxy-device-prod-nlb-', 'apiproxy-website-nlb-prod-', 'dualstack.apiproxy-', 'dualstack.ichnaea-web-']) {
    if (expression === `(^|\\.)${prefix.replaceAll('.', '\\.')}.+\\.amazonaws\\.com$`) return [`${prefix}?*.amazonaws.com`, `*.${prefix}?*.amazonaws.com`];
  }
  if (expression === '^.+-mihayo\\.akamaized\\.net$') return ['?*-mihayo.akamaized.net'];
  const finite = [
    ['.+\\.awsdns-[0-9][0-9]\\.(co\\.uk|com|net|org)$', 'awsdns-', '0123456789', ['co.uk', 'com', 'net', 'org']],
    ['.+\\.awsdns-cn-[0-9][0-9]\\.(biz|com|net|top)$', 'awsdns-cn-', '0123456789', ['biz', 'com', 'net', 'top']],
    ['.+\\.awsdns-cn-[0-9][a-e0-9]\\.cn$', 'awsdns-cn-', 'abcde0123456789', ['cn']],
  ];
  for (const [pattern, prefix, second, suffixes] of finite) if (pattern === expression) {
    const result = [];
    for (const a of '0123456789') for (const b of second) for (const suffix of suffixes) result.push(`?*.${prefix}${a}${b}.${suffix}`);
    return result;
  }
  fail('unsupported DOMAIN-REGEX; no lossless QX mapping is registered');
}

export function parseRules(text, options = {}, utils = {}) {
  if (typeof text !== 'string' || /\0/.test(text)) fail('invalid resource');
  const format = options.sourceFormat ?? 'auto';
  if (!['auto', 'classical', 'qx', 'domain-set', 'clash', 'sing-box'].includes(format)) fail('unknown source format');
  if (options.domainSetMode !== undefined && !['exact', 'suffix'].includes(options.domainSetMode)) fail('unknown domain-set mode');
  if (text.length > MAX_RULE_TEXT) fail('input limit exceeded');
  const trimmed = text.trim();
  const structured = format === 'sing-box' || format === 'clash' || format === 'auto' && (trimmed.startsWith('{') || /^(?:#.*\n|\s)*payload\s*:/m.test(trimmed));
  const textLimit = structured ? MAX_TEXT : MAX_RULE_TEXT;
  const lineLimit = structured ? MAX_LINES : MAX_RULE_LINES;
  if (text.length > textLimit || text.trimEnd().split(/\r\n?|\n/).length > lineLimit) fail('input limit exceeded');
  const replacement = own(options, 'policy') ? policy(options.policy) : null;
  const include = options.in ?? [], exclude = options.out ?? [];
  const keep = createTextMatcher(include, true), remove = createTextMatcher(exclude, true);
  const output = [], excluded = [];
  let sourceRow = null, outputSize = 0;
  let finalSeen = false;
  let resolveWarning = false;
  const domainAnd = typeof utils.domainAndCompiler === 'function' ? utils.domainAndCompiler : createDomainAndCompiler();
  const emit = line => {
    outputSize += line.length + 1;
    if (output.length >= lineLimit || outputSize > textLimit) fail('output limit exceeded');
    output.push(line);
    // KOP out matches the source body before policy replacement; in matches
    // converted text. Headless conditions without source rows use native text.
    excluded.push(remove(sourceRow ?? line));
  };
  function add(type, value, sourcePolicy, extras = []) {
    if (finalSeen) fail('condition follows final');
    const native = TYPES[type.toUpperCase()];
    if (!native && type.toUpperCase() !== 'DOMAIN-REGEX') fail('unsupported condition type');
    if (replacement === null && /^(?:REJECT-(?:TINYGIF|DROP|NO-DROP)|CELLULAR(?:-ONLY)?|HYBRID|NO-HYBRID)$/i.test(sourcePolicy ?? '')) fail('unsupported built-in policy; choose an explicit target policy');
    const selected = replacement ?? policy(sourcePolicy ?? 'proxy');
    const flags = [];
    for (const item of extras) {
      if (item === 'no-resolve') {
        if (!['ip-cidr', 'ip6-cidr', 'geoip', 'ip-asn'].includes(native)) fail('no-resolve on non-IP condition');
        if (options.allowResolve !== true) fail('no-resolve cannot be preserved by documented QX native rules');
        resolveWarning = true;
      } else if (['force-cellular', 'multi-interface', 'multi-interface-balance'].includes(item) && type === native) flags.push(item);
      else if (/^via-interface=[a-zA-Z0-9._-]+$/.test(item) && type === native) flags.push(item);
      else fail('unsupported condition option');
    }
    if (type.toUpperCase() === 'DOMAIN-REGEX') {
      for (const glob of regexGlobs(value)) emit(`host-wildcard,${glob},${selected}`);
      return;
    }
    if (native === 'final') {
      if (value !== null || extras.length) fail('invalid final condition');
      finalSeen = true;
      emit('final,' + selected);
      return;
    }
    if (native === 'host' || native === 'host-suffix') value = domain(value);
    else if (native === 'host-wildcard') value = domain(value, true);
    else if (native === 'host-keyword') {
      if (typeof value !== 'string' || !/^[a-zA-Z0-9._-]{1,253}$/.test(value)) fail('invalid domain keyword');
      value = value.toLowerCase();
    } else if (native === 'ip-cidr' || native === 'ip6-cidr') value = cidr(value, native === 'ip-cidr' ? 4 : 6);
    else if (native === 'geoip') {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(value)) fail('invalid GEOIP category');
      value = value.toLowerCase();
    } else if (native === 'ip-asn') {
      value = String(value).replace(/^AS/i, '');
      if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > 4294967295) fail('invalid ASN');
    } else if (native === 'user-agent' && (typeof value !== 'string' || !value || /[,\r\n\x00-\x1f]/.test(value))) fail('invalid user-agent');
    emit([native, value, selected, ...flags].join(','));
  }
  function classical(line) {
    sourceRow = line;
    if (/^AND\s*,/i.test(line)) {
      if (finalSeen) fail('condition follows final');
      const parsed = parseDomainAnd(line);
      if (replacement === null) {
        policy(parsed.policy);
        if (/^(?:REJECT-(?:TINYGIF|DROP|NO-DROP)|CELLULAR(?:-ONLY)?|HYBRID|NO-HYBRID)$/i.test(parsed.policy)) fail('unsupported built-in policy; choose an explicit target policy');
      }
      for (const value of domainAnd(parsed.conditions)) add('host-wildcard', value, parsed.policy);
      return;
    }
    const parts = line.split(',').map(part => part.trim());
    const type = parts.shift();
    if (['FINAL', 'MATCH'].includes(type.toUpperCase())) {
      if (parts.length !== 1) fail('invalid final condition');
      add(type, null, parts[0]);
      return;
    }
    if (parts.length < 1 || !parts[0]) fail('missing condition value');
    const value = parts.shift();
    let selected;
    if (parts.length && !['no-resolve', 'extended-matching', 'pre-matching'].includes(parts[0]) && !/^(force-cellular|multi-interface(?:-balance)?|via-interface=)/.test(parts[0])) selected = parts.shift();
    add(type, value, selected, parts);
  }
  function domainLine(value, clash = false) {
    sourceRow = value;
    if (typeof value !== 'string' || !value) fail('invalid domain-set row');
    if (/[*?]/.test(value)) fail(clash ? 'Clash single-label wildcards cannot be preserved by QX cross-dot globs' : 'wildcards are not part of the documented DOMAIN-SET format');
    if (value.startsWith('+.')) {
      if (!clash) fail('Clash domain syntax requires Clash source format');
      add('host-suffix', value.slice(2));
    } else if (value.startsWith('.')) add(clash ? 'host-wildcard' : 'host-suffix', clash ? '*' + value : value.slice(1));
    else add(options.domainSetMode === 'suffix' ? 'host-suffix' : 'host', value);
  }
  function headless(rule, depth = 0) {
    if (!record(rule) || depth > 20) fail('invalid headless condition');
    if (rule.type === 'logical') {
      if (Object.keys(rule).some(key => !['type', 'mode', 'rules', 'invert'].includes(key)) || (rule.invert !== undefined && rule.invert !== false) || rule.mode !== 'or' || !Array.isArray(rule.rules) || !rule.rules.length) fail('unsupported logical condition');
      for (const child of rule.rules) headless(child, depth + 1);
      return;
    }
    const fields = { domain: 'host', domain_suffix: 'host-suffix', domain_keyword: 'host-keyword', domain_regex: 'DOMAIN-REGEX', ip_cidr: 'ip-cidr' };
    if (rule.invert !== undefined && rule.invert !== false) fail('unsupported invert condition');
    if (rule.type !== undefined && rule.type !== 'default') fail('unsupported headless type');
    if (Object.keys(rule).some(key => !own(fields, key) && !['type', 'invert'].includes(key))) fail('unsupported conjunctive headless condition');
    let count = 0;
    for (const [key, type] of Object.entries(fields)) if (own(rule, key)) {
      const values = Array.isArray(rule[key]) ? rule[key] : [rule[key]];
      if (!values.length) fail('empty headless condition');
      for (let value of values) {
        if (typeof value !== 'string') fail('invalid headless value');
        // sing/common/domain.Matcher keeps a label boundary for a suffix
        // without a leading dot. A leading dot excludes the root domain.
        if (key === 'domain_suffix') {
          if (value.startsWith('.')) {
            // A leading dot excludes the root in sing-box: use *.domain.
            add('host-wildcard', '*' + value);
            count++;
            continue;
          }
          add('host-suffix', value);
          count++;
          continue;
        }
        add(key === 'ip_cidr' && value.includes(':') ? 'ip6-cidr' : type, value);
        count++;
      }
    }
    if (!count) fail('empty headless condition');
  }
  if (!trimmed) fail('empty resource');
  if (format === 'sing-box' || (format === 'auto' && trimmed.startsWith('{'))) {
    let data;
    try { data = JSON.parse(trimmed); } catch { fail('invalid JSON'); }
    if (!record(data) || ![1, 2, 3].includes(data.version) || !Array.isArray(data.rules) || Object.keys(data).some(key => !['version', 'rules'].includes(key))) fail('unsupported headless document');
    for (const rule of data.rules) headless(rule);
  } else if (format === 'clash' || (format === 'auto' && /^(?:#.*\n|\s)*payload\s*:/m.test(trimmed))) {
    if (options.domainSetMode === 'suffix') fail('Clash domain payload requires exact mode; suffix mode changes its semantics');
    if (typeof utils.parseYaml !== 'function') fail('YAML reader unavailable');
    let data;
    try { data = utils.parseYaml(trimmed); } catch { fail('invalid YAML'); }
    if (!record(data) || !Array.isArray(data.payload) || Object.keys(data).some(key => key !== 'payload')) fail('unsupported YAML rules document');
    for (const line of data.payload) {
      if (typeof line !== 'string') fail('invalid YAML payload row');
      if (line.includes(',')) classical(line);
      else if (options.domainSetMode) domainLine(line, true);
      else fail('domain payload requires explicit domain-set mode');
    }
  } else {
    let section = null;
    for (let line of text.split(/\r?\n/)) {
      line = line.trim();
      line = stripComment(line, fail);
      if (!line) continue;
      if (/^\[.*\]$/.test(line)) {
        section = line.slice(1, -1).toLowerCase();
        if (section !== 'rule' && section !== 'filter_local') fail('unsupported configuration section');
        continue;
      }
      if (format === 'domain-set') domainLine(line);
      else if (line.includes(',')) classical(line);
      else fail('bare domain needs explicit domain-set format');
    }
  }
  const selected = output.filter((line, index) => (!include.length || keep(line)) && !excluded[index]);
  if (!selected.length) {
    if (utils.allowEmpty === true && output.length === 0) return '';
    fail('empty resource after filtering');
  }
  const warnings = [];
  if (replacement !== null) warnings.push('# NetAtlas: explicit policy override replaces every source policy.');
  if (resolveWarning) warnings.push('# NetAtlas: explicit allow-resolve removes no-resolve; DNS lookup behavior changes.');
  if (warnings.length + selected.length > lineLimit) fail('output limit exceeded');
  const content = [...warnings, ...selected].join('\n') + '\n';
  if (content.length > textLimit) fail('output limit exceeded');
  return content;
}
