// SPDX-License-Identifier: MIT
import { createNodeParser } from './nodes.mjs';
import { safePattern } from './safe-pattern.mjs';
import { nativeOptionValue, applyNativeOverrides, validateNativeReplacement } from './native-options.mjs';
import { styleNodeName, protocolLabel, prepareNameTemplate, nameValue, joinName, sliceName, trimName, replaceNameLiteral, replaceNamePattern } from './name-options.mjs';
// Original, bounded declarative resource options for the QX host.
// Each decoded term is an OR branch; unescaped dots join literal AND operands.
export function createKeywordMatcher(terms) {
  const fail = () => { throw new Error('Resource parser options: invalid parameters'); };
  if (!Array.isArray(terms) || terms.length > 128) fail();
  let count = 0;
  const groups = terms.map(term => {
    if (typeof term !== 'string' || !term || term.length > 512 || /[\x00-\x1f\x7f\u2028\u2029]/.test(term)) fail();
    const parts = []; let part = '';
    for (let index = 0; index < term.length; index++) {
      if (term[index] === '\\' && term[index + 1] === '.') { part += '.'; index++; }
      else if (term[index] === '.') { if (!part) fail(); parts.push(part.toUpperCase()); part = ''; }
      else part += term[index];
    }
    if (!part) fail();
    parts.push(part.toUpperCase()); count += parts.length;
    if (count > 128) fail();
    return parts;
  });
  return value => {
    if (typeof value !== 'string') fail();
    const upper = value.toUpperCase();
    return groups.some(parts => parts.every(part => upper.includes(part)));
  };
}

// Rules and rewrites use literal terms, not the node-name dot/AND grammar.
export function createTextMatcher(terms, caseSensitive = false) {
  const fail = () => { throw new Error('Resource parser options: invalid parameters'); };
  if (!Array.isArray(terms) || terms.length > 128) fail();
  const values = terms.map(term => {
    if (typeof term !== 'string' || !term || term.length > 512 || /[\x00-\x1f\x7f\u2028\u2029]/.test(term)) fail();
    return caseSensitive ? term : term.toUpperCase();
  });
  return value => {
    if (typeof value !== 'string') fail();
    const text = caseSensitive ? value : value.toUpperCase();
    return values.some(term => text.includes(term));
  };
}

export function parseOptions(link) {
  const fail = () => { throw new Error('Resource parser options: invalid parameters'); };
  const decode = value => { try { return decodeURIComponent(value); } catch { return fail(); } };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const safeText = (value, limit = 512) => typeof value === 'string' && value.length <= limit && !/[\x00-\x1f\x7f\u2028\u2029]/.test(value);
  const tagPart = value => safeText(value) && !/[,\"]/.test(value);
  const result = { type: 'auto', sourceFormat: 'auto', in: [], out: [], inhn: [], outhn: [], prefix: '', suffix: '', rename: [], sort: 'none', allowResolve: false };
  if (typeof link !== 'string' || link.length > 65536) fail();
  const boundary = link.indexOf('#');
  const hash = boundary < 0 ? '' : link.slice(boundary + 1);
  if (!hash) return result;
  if (hash.length > 32768) fail();
  const seen = Object.create(null);
  let domainSet = false;
  const allowed = ['arguments', 'regex', 'regout', 'rrname', 'replace', 'delreg', 'ptn', 'npt', 'cap', 'sortx', 'del', 'udp', 'tfo', 'uot', 'cert', 'tls-verification', 'csha', 'psha', 'alpn', 'aead', 'host', 'obfs', 'tsession', 'checkurl', 'tls13', 'pset', 'fcr', 'via', 'relay', 'hide', 'dst', 'cnt', 'dbg', 'ntf', 'flow', 'b64', 'UA', 'profile', 'type', 'format', 'domain-mode', 'policy', 'allow-resolve', 'script-compat', 'in', 'out', 'inhn', 'outhn', 'prefix', 'suffix', 'rename', 'sort', 'info', 'emoji'];
  for (const pair of hash.split('&')) {
    const equal = pair.indexOf('=');
    if (equal < 1) fail();
    const key = decode(pair.slice(0, equal));
    if (!allowed.includes(key) || own(seen, key)) fail();
    seen[key] = true;
    const raw = pair.slice(equal + 1);
    // Split before decoding: an encoded %2B is a literal plus in one term.
    if (['in', 'out', 'inhn', 'outhn'].includes(key)) {
      const terms = raw === '' ? [] : raw.split('+').map(decode);
      if (terms.length > 128 || terms.some(term => !term || !safeText(term))) fail();
      createTextMatcher(terms);
      result[key] = terms;
      continue;
    }
    const value = decode(raw);
    if (!safeText(value, key === 'arguments' ? 8192 : ['rename', 'rrname', 'replace', 'pset'].includes(key) ? 16384 : 2048)) fail();
    const placeholderText = text => {
      for (const match of text.matchAll(/\$[A-Za-z][A-Za-z0-9_]*/g)) if (!/^\$(?:type[0-8]?|index[0-8]?|emoji[12]?|tag[0-8]{0,2})$/.test(match[0])) fail();
    };
    const replacementText = text => placeholderText(text.replace(/\$(?:\$|&|`|'|[1-9][0-9]?)/g, ''));
    if (key === 'arguments') {
      let argumentsObject;
      try { argumentsObject = JSON.parse(value); } catch { fail(); }
      if (!argumentsObject || typeof argumentsObject !== 'object' || Array.isArray(argumentsObject) || Object.keys(argumentsObject).length > 64) fail();
      for (const [name, item] of Object.entries(argumentsObject)) {
        if (!name || !safeText(name, 128) || /[\x7f-\x9f]/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name)) fail();
        if (typeof item === 'string' ? !safeText(item, 2048) || /[\x7f-\x9f]/.test(item) : typeof item === 'number' ? !Number.isFinite(item) : item !== null && typeof item !== 'boolean') fail();
      }
      result.moduleArguments = argumentsObject; continue;
    }
    if (['regex', 'regout', 'delreg'].includes(key)) {
      safePattern(value); result[key] = value; continue;
    }
    if (key === 'replace' || key === 'pset') {
      const steps = raw.split('+'); if (!raw || steps.length > 100) fail();
      result[key] = steps.map(step => {
        const fields = step.split('@'); if (fields.length !== 2) fail();
        const pattern = decode(fields[0]), replacement = decode(fields[1]);
        if (!safeText(pattern) || !safeText(replacement)) fail(); safePattern(pattern, key === 'pset');
        if (key === 'pset' && (!replacement || replacement !== replacement.trim() || replacement.length > 128 || /[,\"=]/.test(replacement))) fail();
        if (key === 'replace') replacementText(replacement);
        return [pattern, replacement];
      }); continue;
    }
    if (['udp', 'tfo', 'uot', 'cert', 'tls-verification', 'csha', 'psha', 'alpn', 'aead', 'host', 'obfs', 'tsession', 'checkurl', 'tls13'].includes(key)) {
      const name = key === 'tls-verification' ? 'cert' : key;
      if (Object.prototype.hasOwnProperty.call(result, name)) fail();
      result[name] = nativeOptionValue(name, value); continue;
    }
    if (['ptn', 'npt'].includes(key)) { if (!/^[0-8]$/.test(value)) fail(); result[key] = value; continue; }
    if (key === 'cap') { if (!['-1', '0', '1'].includes(value)) fail(); result.cap = value; continue; }
    if (key === 'sortx') { if (!['-1', '0', '1'].includes(value)) fail(); result.sortx = value; continue; }
    if (['del', 'hide', 'cnt', 'dbg', 'b64', 'UA'].includes(key)) { if (!['0', '1'].includes(value)) fail(); result[key === 'UA' ? 'userAgentRetry' : key] = value === '1'; continue; }
    if (key === 'ntf') { if (!['0', '1', '2'].includes(value)) fail(); result.ntf = value; continue; }
    if (key === 'profile') { if (!/^[01]{3}$/.test(value)) fail(); result.profile = value; continue; }
    if (key === 'flow') {
      if (value !== '1') {
        const parts = /^(\d{4}-\d{2}-\d{2}):(\d{1,7}(?:\.\d{1,3})?):(\d{1,7}(?:\.\d{1,3})?)$/.exec(value);
        if (!parts || Number(parts[3]) > Number(parts[2])) fail();
        const date = new Date(parts[1] + 'T00:00:00Z'); if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== parts[1]) fail();
      }
      result.flow = value; continue;
    }
    if (key === 'fcr') { if (!['1', '2', '3'].includes(value)) fail(); result.fcr = value; continue; }
    if (key === 'via') { if (!/^(?:0|%TUN%|[A-Za-z][A-Za-z0-9_.:-]{0,63})$/.test(value)) fail(); result.via = value === '0' ? '%TUN%' : value; continue; }
    if (key === 'relay') { if (!value || !tagPart(value) || value.length > 128 || value !== value.trim() || /[=]/.test(value)) fail(); result.relay = value; continue; }
    if (key === 'dst') { if (!['rewrite', 'filter'].includes(value)) fail(); result.dst = value; continue; }
    if (key === 'type') {
      const aliases = { nodes: 'server', list: 'server', rule: 'filter', module: 'rewrite', 'domain-set': 'filter' };
      if (!['auto', 'server', 'filter', 'rewrite'].includes(value) && !own(aliases, value)) fail();
      result.type = aliases[value] || value;
      domainSet = value === 'domain-set';
    } else if (key === 'format') {
      if (!['auto', 'classical', 'qx', 'domain-set', 'clash', 'sing-box'].includes(value)) fail();
      result.sourceFormat = value;
    } else if (key === 'domain-mode') {
      if (!['exact', 'suffix'].includes(value)) fail();
      result.domainSetMode = value;
    } else if (key === 'policy') {
      if (!value || value !== value.trim() || value.length > 128 || /[,\"=]/.test(value)) fail();
      result.policy = value;
    } else if (key === 'allow-resolve') {
      if (value !== '0' && value !== '1') fail();
      result.allowResolve = value === '1';
    } else if (key === 'script-compat') {
      if (value !== 'qx') fail();
      result.scriptCompatibility = value;
    } else if (key === 'info') {
      if (value !== '0' && value !== '1') fail();
      result.info = value === '1';
    } else if (key === 'emoji') {
      if (!['0', '1', '2', '-1'].includes(value)) fail();
      result.emoji = value;
    } else if (key === 'prefix' || key === 'suffix') {
      if (!tagPart(value)) fail(); placeholderText(value);
      result[key] = value;
    } else if (key === 'rename' || key === 'rrname') {
      result[key] = [];
      let pairs, json = false;
      if (value.startsWith('[')) {
        try { pairs = JSON.parse(value); json = true; } catch { if (!raw.includes('@')) fail(); }
      }
      if (json) {
        if (!Array.isArray(pairs) || pairs.length > 100 || pairs.some(pair => !Array.isArray(pair) || pair.length !== 2 || !pair[0] || !tagPart(pair[0]) || !tagPart(pair[1]))) fail();
        pairs.forEach(pair => replacementText(pair[1])); result[key] = pairs;
      } else {
        // Operators are identified before decoding, so %40/%2B stay literal.
        const steps = raw.split('+');
        if (!raw || steps.length > 100) fail();
        for (const step of steps) {
          if (!step) fail();
          const fields = step.split('@');
          if (fields.length === 2) {
            const from = decode(fields[0]), to = decode(fields[1]);
            if (!tagPart(from) || !tagPart(to)) fail();
            if (from && to) { replacementText(to); result[key].push([from, to]); }
            else if (from) { placeholderText(from); result[key].push({ prefix: from }); }
            else if (to) { placeholderText(to); result[key].push({ suffix: to }); }
            else result[key].push(['@', '']);
          } else if (fields.length === 1) {
            const deletion = decode(step);
            if (!deletion.endsWith('☠️')) fail();
            const expression = deletion.slice(0, -2), parts = []; let part = '';
            for (let index = 0; index < expression.length; index++) {
              if (expression[index] === '\\' && expression[index + 1] === '.') { part += '.'; index++; }
              else if (expression[index] === '.') { if (!part) fail(); parts.push(part); part = ''; }
              else part += expression[index];
            }
            if (!part) fail();
            parts.push(part);
            for (const from of parts) { if (!tagPart(from)) fail(); result[key].push([from, '']); }
          } else fail();
          if (result[key].length > 100) fail();
        }
      }
    } else if (key === 'sort') {
      if (['none', 'name', 'name-desc', '0', '1', '-1', 'x', 'random'].includes(value)) result.sort = value === '1' ? 'name' : value === '-1' ? 'name-desc' : value === '0' ? 'none' : value === 'x' ? 'random' : value;
      else { const groups = value.split(/[<>]/); if (!value || groups.length > 32 || value.includes('<') && value.includes('>') || groups.some(group => !group)) fail(); groups.forEach(group => safePattern(group)); result.sort = value; }
    }
  }
  if (domainSet) {
    if (seen.format && !['auto', 'domain-set'].includes(result.sourceFormat) || seen['domain-mode'] && result.domainSetMode !== 'exact') fail();
    result.sourceFormat = 'domain-set'; result.domainSetMode = 'exact';
  }
  if (result.sortx && result.sortx !== '0' && ['none', 'name', 'name-desc', 'random'].includes(result.sort)) fail();
  return result;
}

// Match the complete native declaration, after the resource's literal filters.
export function createDeclarationMatcher(options = {}, budget = { remaining: 2097152 }) {
  const include = options.regex === undefined ? null : safePattern(options.regex, false, budget);
  const exclude = options.regout === undefined ? null : safePattern(options.regout, false, budget);
  return value => (!include || include.test(value)) && (!exclude || !exclude.test(value));
}

// Callers must validate their transformed native syntax before publishing it.
export function createDeclarationReplacer(options = {}, budget = { remaining: 2097152 }) {
  if (options.replace === undefined) return value => value;
  if (!Array.isArray(options.replace) || options.replace.length > 100) throw new Error('Resource parser options: invalid parameters');
  const replacements = options.replace.map(pair => {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error('Resource parser options: invalid parameters');
    return [safePattern(pair[0], false, budget), pair[1]];
  });
  const replace = value => { for (const [pattern, replacement] of replacements) value = pattern.replace(value, replacement); return value; };
  replace.tracked = value => { for (const [pattern, replacement] of replacements) value = replaceNamePattern(value, pattern, replacement); return value; };
  return replace;
}

export function replaceDeclaration(value, options = {}, budget) {
  return createDeclarationReplacer(options, budget)(value);
}

export function applyNodeOptions(content, options = {}, context = {}) {
  const fail = () => { throw new Error('Node options failed: invalid node names or parameters'); };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const part = value => typeof value === 'string' && value.length <= 512 && !/[,"\x00-\x1f\x7f\u2028\u2029]/.test(value);
  const validName = value => part(value) && value !== '' && value === value.trim();
  if (typeof content !== 'string' || !content || content.length > 4194304 || !options || typeof options !== 'object' || Array.isArray(options)) fail();
  const supported = ['type', 'sourceFormat', 'domainSetMode', 'policy', 'allowResolve', 'scriptCompatibility', 'in', 'out', 'inhn', 'outhn', 'prefix', 'suffix', 'rename', 'sort', 'info', 'emoji', 'regex', 'regout', 'rrname', 'replace', 'delreg', 'ptn', 'npt', 'cap', 'sortx', 'del', 'udp', 'tfo', 'uot', 'cert', 'csha', 'psha', 'alpn', 'aead', 'host', 'obfs', 'tsession', 'checkurl', 'tls13', 'pset', 'fcr', 'via', 'relay', 'hide', 'dst', 'cnt', 'dbg', 'ntf', 'flow', 'b64', 'userAgentRetry', 'profile', 'moduleArguments'];
  if (Object.keys(options).some(key => !supported.includes(key))) fail();
  const include = own(options, 'in') ? options.in : [];
  const exclude = own(options, 'out') ? options.out : [];
  const rename = own(options, 'rename') ? options.rename : [];
  const rrname = own(options, 'rrname') ? options.rrname : [];
  const prefix = own(options, 'prefix') ? options.prefix : '';
  const suffix = own(options, 'suffix') ? options.suffix : '';
  const sort = own(options, 'sort') ? options.sort : 'none';
  const emoji = own(options, 'emoji') ? options.emoji : '0';
  if (!['0', '1', '2', '-1'].includes(emoji) || own(options, 'info') && typeof options.info !== 'boolean' || own(options, 'del') && typeof options.del !== 'boolean') fail();
  for (const key of ['ptn', 'npt']) if (own(options, key) && !/^[0-8]$/.test(options[key])) fail();
  for (const key of ['cap', 'sortx']) if (own(options, key) && !['-1', '0', '1'].includes(options[key])) fail();
  const places = [
    ['TW', /台湾|台灣|台北|新北|台中|高雄|Taiwan|Taipei/i],
    ['HK', /香港|Hong[ -]?Kong/i], ['MO', /澳门|澳門|Macao|Macau/i],
    ['JP', /日本|东京|東京|大阪|Japan|Tokyo|Osaka/i],
    ['US', /美国|美國|洛杉矶|洛杉磯|圣荷西|聖荷西|西雅图|西雅圖|United[ -]?States|America|Los[ -]?Angeles|San[ -]?Jose|Seattle/i],
    ['SG', /新加坡|狮城|獅城|Singapore/i], ['KR', /韩国|韓國|首尔|首爾|Korea|Seoul/i],
    ['GB', /英国|英國|伦敦|倫敦|United[ -]?Kingdom|Britain|London/i],
    ['DE', /德国|德國|法兰克福|法蘭克福|Germany|Frankfurt/i], ['FR', /法国|法國|巴黎|France|Paris/i],
    ['CA', /加拿大|Canada|Toronto|Vancouver/i], ['AU', /澳大利亚|澳大利亞|澳洲|悉尼|Australia|Sydney/i],
    ['CN', /中国|中國|大陆|大陸|北京|上海|广州|廣州|深圳|China/i],
    ['NL', /荷兰|荷蘭|Netherlands|Amsterdam/i], ['RU', /俄罗斯|俄羅斯|Russia|Moscow/i],
    ['IN', /印度|India/i], ['VN', /越南|Vietnam/i], ['TH', /泰国|泰國|Thailand|Bangkok/i],
    ['MY', /马来西亚|馬來西亞|Malaysia/i], ['PH', /菲律宾|菲律賓|Philippines/i], ['ID', /印度尼西亚|印度尼西亞|印尼|Indonesia/i],
    ['TR', /土耳其|Türkiye|Turkey/i], ['BR', /巴西|Brazil/i], ['AR', /阿根廷|Argentina/i],
    ['CH', /瑞士|Switzerland/i], ['SE', /瑞典|Sweden/i], ['FI', /芬兰|芬蘭|Finland/i],
    ['NO', /挪威|Norway/i], ['DK', /丹麦|丹麥|Denmark/i], ['IE', /爱尔兰|愛爾蘭|Ireland/i],
    ['IT', /意大利|義大利|Italy/i], ['ES', /西班牙|Spain/i], ['PT', /葡萄牙|Portugal/i],
    ['NZ', /新西兰|紐西蘭|New[ -]?Zealand/i], ['IS', /冰岛|冰島|Iceland/i],
    ['ZA', /南非|South[ -]?Africa/i], ['AE', /阿联酋|阿聯酋|迪拜|Emirates|Dubai/i],
    ['IL', /以色列|Israel/i], ['PL', /波兰|波蘭|Poland/i], ['UA', /乌克兰|烏克蘭|Ukraine/i],
  ];
  const decorate = (name, mode = emoji) => {
    if (mode === '0') return name;
    const flags = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g;
    const supplied = name.match(flags);
    const plain = name.replace(flags, '').trim();
    if (mode === '-1') return plain;
    // Prefer the longest alias, and require English word boundaries. This
    // separates 印度尼西亚 from 印度 and Indiana from India without IP lookup.
    let best = null;
    for (const [candidate, pattern] of places) {
      const matches = new RegExp(pattern.source, 'ig'); let match;
      while ((match = matches.exec(plain))) {
        const word = match[0], start = match.index, end = start + word.length;
        if (/^[A-Za-z]/.test(word) && /[A-Za-z]/.test(plain[start - 1] || '') || /[A-Za-z]$/.test(word) && /[A-Za-z]/.test(plain[end] || '')) continue;
        if (!best || word.length > best.length) best = { code: candidate, length: word.length };
      }
    }
    let code = best?.code;
    if (!code) code = /(?:^|[^A-Za-z])(UK)(?=$|[^A-Za-z])/i.test(plain) ? 'GB'
      : places.find(([candidate]) => new RegExp('(?:^|[^A-Za-z])' + candidate + '(?=$|[^A-Za-z])', 'i').test(plain))?.[0];
    if (mode === '2' && code === 'TW') code = 'CN';
    let flag = code ? String.fromCodePoint(127397 + code.charCodeAt(0), 127397 + code.charCodeAt(1)) : supplied?.[0] || '🏴‍☠️';
    if (mode === '2' && flag === '🇹🇼') flag = '🇨🇳';
    return flag + ' ' + plain;
  };
  const renameStep = step => Array.isArray(step) ? step.length === 2 && !!step[0] && part(step[0]) && part(step[1]) : step && typeof step === 'object' && Object.keys(step).length === 1 && (own(step, 'prefix') && !!step.prefix && part(step.prefix) || own(step, 'suffix') && !!step.suffix && part(step.suffix));
  if (![include, exclude].every(list => Array.isArray(list) && list.length <= 128 && list.every(term => typeof term === 'string' && term && term.length <= 512 && !/[\x00-\x1f\x7f\u2028\u2029]/.test(term))) || ![rename, rrname].every(list => Array.isArray(list) && list.length <= 100 && list.every(renameStep)) || !part(prefix) || !part(suffix) || typeof sort !== 'string') fail();
  const groupSort = !['none', 'name', 'name-desc', 'random'].includes(sort);
  const workBudget = { remaining: 2097152 };
  let groups = [], declarationMatch = () => true, deletePattern, replacement;
  let includeMatch, excludeMatch;
  try {
    includeMatch = createKeywordMatcher(include); excludeMatch = createKeywordMatcher(exclude);
    if (options.regex !== undefined || options.regout !== undefined) declarationMatch = createDeclarationMatcher(options, workBudget);
    if (options.delreg !== undefined) deletePattern = safePattern(options.delreg, false, workBudget);
    if (options.replace !== undefined) replacement = createDeclarationReplacer(options, workBudget);
    if (groupSort) { const terms = sort.split(/[<>]/); if (!sort || terms.length > 32 || sort.includes('<') && sort.includes('>') || terms.some(term => !term)) fail(); groups = terms.map(term => safePattern(term, false, workBudget)); }
    if (!groupSort && options.sortx && options.sortx !== '0') fail();
  } catch { fail(); }
  const insertedText = steps => steps.map(step => Array.isArray(step) ? step[1] : own(step, 'prefix') ? step.prefix : step.suffix);
  const usesPlaceholders = /\$(?:type|index|emoji|tag)/.test(JSON.stringify([prefix, suffix, insertedText(rename), insertedText(rrname), options.replace?.map(pair => pair[1])]));
  const subscriptionTag = context?.tag === undefined ? '' : context.tag;
  if (usesPlaceholders && !part(subscriptionTag)) fail();
  const transformName = (name, steps) => {
    for (const step of steps) {
      try { name = Array.isArray(step) ? replaceNameLiteral(name, step[0], step[1]) : own(step, 'prefix') ? joinName(nameValue(step.prefix, true), name) : joinName(name, nameValue(step.suffix, true)); } catch { fail(); }
      if (!part(name.text)) fail();
    }
    return name;
  };
  const decorateName = value => {
    if (emoji === '0') return value;
    const chunks = []; let copied = 0;
    for (const match of value.text.matchAll(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g)) { chunks.push(sliceName(value, copied, match.index)); copied = match.index + match[0].length; }
    chunks.push(sliceName(value, copied)); const plain = trimName(joinName(...chunks));
    const decorated = decorate(value.text);
    return joinName(nameValue(decorated.slice(0, decorated.length - plain.text.length)), plain);
  };
  const read = (line, templates) => {
    if (!/^(?:shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=/i.test(line.trim()) || /[\x00-\x1f\x7f\u2028\u2029]/.test(line)) fail();
    const fields = []; let start = 0, quote = false;
    for (let index = 0; index < line.length; index++) {
      if (line[index] === '"') { if (quote && line[index + 1] === '"') index++; else quote = !quote; }
      else if (line[index] === ',' && !quote) { fields.push(line.slice(start, index)); start = index + 1; }
    }
    if (quote) fail(); fields.push(line.slice(start));
    let position = -1, name = '', lead = '', tail = '', tracked;
    for (let index = 1; index < fields.length; index++) {
      const match = /^(\s*tag\s*=\s*)(.*?)(\s*)$/i.exec(fields[index]); if (!match) continue;
      if (position !== -1) fail(); position = index; lead = match[1]; tail = match[3]; name = match[2];
      const offset = fields.slice(0, index).reduce((length, field) => length + field.length + 1, 0) + lead.length;
      tracked = templates ? { text: name, templates: templates.slice(offset, offset + name.length), budget: workBudget } : nameValue(name, false, workBudget);
      if (name.startsWith('"') && name.endsWith('"')) { name = name.slice(1, -1).replace(/""/g, '"'); tracked = sliceName(tracked, 1, tracked.text.length - 1); }
    }
    if (position === -1 || !validName(name)) fail(); return { fields, position, name, lead, tail, tracked };
  };
  const nodes = [], inputLines = content.split(/\r?\n/).filter(line => line.trim());
  let inputCount = 0, replacementParser;
  for (const line of inputLines) {
    if (!line.trim()) continue;
    if (++inputCount > 2000) fail();
    let { fields, position, name, lead, tail, tracked } = read(line);
    let beforeReplacement;
    if ((include.length && !includeMatch(name)) || excludeMatch(name) || !declarationMatch(line)) continue;
    let changed = transformName(tracked, rrname);
    if (deletePattern) { try { changed = replaceNamePattern(changed, deletePattern, '', 512); } catch { fail(); } }
    if (options.replace !== undefined) {
      beforeReplacement = fields.slice();
      fields[position] = lead + changed.text + tail;
      try {
        const declaration = [];
        fields.forEach((field, index) => { if (index) declaration.push(nameValue(',')); declaration.push(index === position ? joinName(nameValue(lead), changed, nameValue(tail)) : nameValue(field)); });
        const replaced = replacement.tracked(joinName(...declaration));
        // Native validation happens before a replacement can be published, even
        // when another option later excludes or renames this declaration.
        (replacementParser ??= createNodeParser()).validateNative(replaced.text);
        const next = read(replaced.text, replaced.templates); fields = next.fields; position = next.position; lead = next.lead; tail = next.tail; changed = next.tracked;
      } catch { fail(); }
    }
    changed = trimName(transformName(changed, rename));
    const typeSuffix = ['-1', '0', '1'].includes(suffix);
    changed = decorateName(joinName(nameValue(prefix, true), changed, nameValue(typeSuffix ? '' : suffix, true)));
    if (suffix === '1') changed = joinName(changed, nameValue(' ' + protocolLabel(fields)));
    else if (suffix === '-1') changed = joinName(nameValue(protocolLabel(fields) + ' '), changed);
    const template = usesPlaceholders ? prepareNameTemplate(changed, fields, subscriptionTag, mode => decorate(changed.text, mode).split(' ')[0]) : null;
    changed = template ? template.text : changed.text;
    if (!validName(changed)) fail();
    const hasOverrides = ['udp', 'tfo', 'uot', 'cert', 'csha', 'psha', 'alpn', 'aead', 'host', 'obfs', 'tsession', 'checkurl', 'tls13'].some(key => own(options, key));
    if (hasOverrides) fields = applyNativeOverrides(fields, options);
    if (beforeReplacement) { try { validateNativeReplacement(beforeReplacement, fields); } catch { fail(); } }
    nodes.push({ name: changed, template, originalName: name, originalLine: line, fields, position, lead, tail, fieldName: read(fields.join(',')).name, index: nodes.length });
  }
  if (!nodes.length) fail();
  const byName = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.index - b.index;
  if (sort === 'name' || sort === 'name-desc') nodes.sort((a, b) => byName(a, b) * (sort === 'name-desc' ? -1 : 1));
  else if (sort === 'random') for (let index = nodes.length - 1; index > 0; index--) { const target = Math.floor(Math.random() * (index + 1)); [nodes[index], nodes[target]] = [nodes[target], nodes[index]]; }
  else if (groupSort) {
    const bucket = node => { const at = groups.findIndex(group => group.test(node.fields.map((field, index) => index === node.position ? node.lead + node.name + node.tail : field).join(','))); return at < 0 ? groups.length : at; };
    for (const node of nodes) node.bucket = bucket(node);
    const reverse = sort.includes('<');
    nodes.sort((a, b) => {
      if (a.bucket !== b.bucket) return reverse ? b.bucket - a.bucket : a.bucket - b.bucket;
      if (a.bucket === groups.length) return byName(a, b) * (reverse ? -1 : 1);
      return options.sortx === '1' ? byName(a, b) : options.sortx === '-1' ? -byName(a, b) : a.index - b.index;
    });
  }
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.template) node.name = node.template.render(index + 1);
    if (options.ptn !== undefined || options.npt !== undefined || options.cap !== undefined) node.name = styleNodeName(node.name, options.ptn ?? '', options.npt ?? '', options.cap ?? '');
    if (!validName(node.name)) fail();
  }
  // Reserve all supplied names before numbering, so a generated suffix cannot
  // steal a later source name. Only del=1 drops later duplicate declarations.
  const reserved = new Set(nodes.map(node => node.name)), finalNames = new Set(), result = [];
  for (const node of nodes) {
    const base = node.name;
    if (finalNames.has(base)) {
      if (options.del) continue;
      let number = 1;
      do { node.name = base + ' ' + styleNodeName(String(number++), '', '5'); } while (reserved.has(node.name) || finalNames.has(node.name));
      if (!validName(node.name)) fail();
    }
    finalNames.add(node.name);
    if (node.name !== node.fieldName) node.fields[node.position] = node.lead + node.name + node.tail;
    const output = node.fields.join(',');
    result.push({ line: output === node.originalLine ? node.originalLine : output, index: node.index });
  }
  if (result.length === inputCount && result.every((node, index) => node.index === index && node.line === inputLines[index])) return content;
  return result.map(node => node.line).join('\n') + '\n';
}
