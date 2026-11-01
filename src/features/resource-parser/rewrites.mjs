import { createTextMatcher } from './options.mjs';
import { stripComment } from './comments.mjs';
// Original NetAtlas conversion; scripts are referenced, never loaded/executed.
// https://github.com/crossutility/Quantumult-X/blob/master/sample.conf
// https://manual.nssurge.com/http/url-rewrite.html
// https://nsloon.app/en/docs/Rewrite/ and https://nsloon.app/en/docs/Script/
const fail = message => { throw new Error('Rewrite conversion: ' + message); };
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const BODIES = new Set(['reject-200', 'reject-img', 'reject-dict', 'reject-array']);
const SCRIPTS = new Set(['script-request-header', 'script-request-body', 'script-response-header', 'script-response-body', 'script-echo-response', 'script-analyze-echo-response']);

function httpsReference(value) {
  // Avoid relying on URL, which is absent in several QX JavaScriptCore hosts.
  if (typeof value !== 'string' || !/^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]{1,5})?\/[^\s,<>"'\\]*$/.test(value) || value.includes('@') || value.length > 8192) fail('script needs an external HTTPS URL without credentials');
  const authority = value.slice(8).split('/')[0];
  const hostname = authority.split(':')[0];
  if (hostname.length > 253 || hostname.split('.').some(label => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) fail('invalid HTTPS hostname');
  const port = authority.split(':')[1];
  if (port && (Number(port) < 1 || Number(port) > 65535)) fail('invalid HTTPS port');
  return value;
}

function pattern(value) {
  // Some QX lists wrap an HTTP regex in quotes. These are delimiters,
  // while quotes inside the regex (or non-HTTP matchers) remain literal.
  if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    let backslashes = 0;
    for (let index = value.length - 2; index >= 0 && value[index] === '\\'; index--) backslashes++;
    const unquoted = value.slice(1, -1).trim();
    if (backslashes % 2 === 0 && /^\^?https?\??:/i.test(unquoted)) value = unquoted;
  }
  if (typeof value !== 'string' || !value || /[\s\x00-\x1f]/.test(value) || value.length > 8192) fail('invalid URL pattern');
  // QX and upstream clients use different regex engines. Do not reinterpret
  // patterns or force them through JavaScript RegExp while only rearranging.
  return value;
}

function target(value) {
  if (!/^https?:\/\/[^\s<>"']+$/.test(value) || value.includes('{{{') || value.length > 8192) fail('redirect needs an HTTP URL without unsupported placeholders');
  return value;
}

function hostnames(value) {
  value = value.replace(/^%APPEND%\s*/i, '');
  if (!value || value.includes('%')) fail('unsupported MITM hostname operation');
  const names = value.split(',').map(name => name.trim());
  if (names.length > 5000 || names.some(name => !name || name.length > 253 || name.split('.').some(label => !label || label.length > 63 || !/^[a-z0-9*?_-]+$/i.test(label)))) fail('invalid MITM hostname');
  return names;
}

// Script declarations use commas between key=value pairs; regex groups and
// quoted arguments may contain commas. Never use a naive comma split here.
function fields(value) {
  const chunks = [];
  let part = '', quote = '', escaped = false;
  let square = 0, round = 0, curly = 0;
  for (const character of value) {
    if (escaped) { part += character; escaped = false; continue; }
    if (character === '\\') { part += character; escaped = true; continue; }
    if (quote) { part += character; if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; part += character; continue; }
    if (character === '[') square++;
    else if (character === ']') square--;
    else if (character === '(' && !square) round++;
    else if (character === ')' && !square) round--;
    else if (character === '{' && !square) curly++;
    else if (character === '}' && !square) curly--;
    if (square < 0 || round < 0 || curly < 0) fail('invalid script declaration');
    if (character === ',' && !square && !round && !curly) { chunks.push(part.trim()); part = ''; }
    else part += character;
  }
  if (quote || square || round || curly || escaped) fail('invalid script declaration');
  chunks.push(part.trim());
  const result = {};
  for (const chunk of chunks) {
    const match = /^([a-z][a-z0-9-]*)\s*=\s*(.+)$/i.exec(chunk);
    if (!match || own(result, match[1].toLowerCase())) fail('invalid or duplicate script option');
    let data = match[2].trim();
    if (/^["']/.test(data)) {
      if (data[0] !== data.at(-1)) fail('invalid script quote');
      data = data.slice(1, -1);
    }
    result[match[1].toLowerCase()] = data;
  }
  return result;
}

export function parseRewrites(text, options = {}, utils = {}) {
  if (typeof text !== 'string' || /[\x00\x0b\x0c]/.test(text)) fail('invalid resource');
  if (options.scriptCompatibility !== undefined && options.scriptCompatibility !== 'qx') fail('unknown script compatibility declaration');
  let output = [];
  let hosts = [];
  let section = null;
  let compatibilityWarning = false;
  const emit = line => { if (output.length >= 20000) fail('output limit exceeded'); output.push(line); };
  function native(line) {
    const match = /^(\S+)(?:\s+(.+?))?\s+(url|url-and-header)\s+(\S+)(?:\s+(.+))?$/.exec(line);
    if (!match) fail('unsupported native rewrite');
    const [, sourceExpression, headers, mode, action, argument] = match;
    const expression = pattern(sourceExpression);
    if ((mode === 'url' && headers !== undefined) || (mode === 'url-and-header' && !headers)) fail('invalid native matcher mode');
    if (action === '302' || action === '307') {
      if (!argument) fail('missing redirect target');
      target(argument);
    } else if (action === 'reject' || BODIES.has(action)) {
      if (argument) fail('unexpected reject arguments');
    } else if (SCRIPTS.has(action)) httpsReference(argument);
    else if (['request-header', 'request-body', 'response-body'].includes(action)) {
      if (!argument || !argument.includes(' ' + action + ' ') || /\r|\n/.test(argument)) fail('invalid native replacement');
    } else if (['jsonjq-request-body', 'jsonjq-response-body'].includes(action)) {
      if (!argument) fail('invalid native JSON replacement');
    } else fail('unsupported native rewrite action');
    emit([expression, headers, mode, action, argument].filter(value => value !== undefined).join(' '));
  }
  function foreignScript(line) {
    if (options.scriptCompatibility !== 'qx') fail('cross-host script needs an explicit QX compatibility declaration');
    let data;
    const loon = /^(http-request|http-response)\s+(\S+)\s+(.+)$/.exec(line);
    if (loon) {
      data = fields(loon[3]);
      if (own(data, 'type') || own(data, 'pattern')) fail('duplicate Loon script trigger or pattern');
      data.type = loon[1];
      data.pattern = loon[2];
    }
    else {
      const surge = /^[^=,]+\s*=\s*(.+)$/.exec(line);
      if (!surge) fail('unsupported script declaration');
      data = fields(surge[1]);
    }
    const allowed = new Set(['type', 'pattern', 'requires-body', 'script-path', 'tag', 'enable']);
    if (Object.keys(data).some(key => !allowed.has(key))) fail('unsupported script option; preserving its semantics is not possible');
    if (!['http-request', 'http-response'].includes(data.type)) fail('unsupported script trigger');
    if (data.enable !== undefined && data.enable !== 'true') fail('disabled script cannot be emitted as active');
    if (data['requires-body'] !== undefined && !['true', 'false'].includes(data['requires-body'])) fail('invalid requires-body option');
    const direction = data.type === 'http-request' ? 'request' : 'response';
    const body = data['requires-body'] === 'true' ? 'body' : 'header';
    emit(`${pattern(data.pattern)} url script-${direction}-${body} ${httpsReference(data['script-path'])}`);
    compatibilityWarning = true;
  }
  function foreignRewrite(line, source) {
    if (source === 'url rewrite') {
      const match = /^(\S+)\s+(\S+)\s+(\S+)$/.exec(line);
      if (!match) fail('unsupported Surge URL Rewrite');
      const [, expression, destination, action] = match;
      if (!['302', '307'].includes(action)) fail('unsupported redirect or reject semantics');
      emit(`${pattern(expression)} url ${action} ${target(destination)}`);
      return;
    }
    const match = /^(\S+)\s+(\S+)(?:\s+(\S+))?$/.exec(line);
    if (!match) fail('unsupported Loon Rewrite');
    const [, expression, action, destination] = match;
    if (action === '302' || action === '307') emit(`${pattern(expression)} url ${action} ${target(destination ?? '')}`);
    else if (BODIES.has(action) && destination === undefined) emit(`${pattern(expression)} url ${action}`);
    else if (action === 'reject') fail('Loon reject closes the connection, while QX reject sends HTTP 404; semantics differ');
    else fail('unsupported Loon rewrite action');
  }
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    if (/^[#;]/.test(line) || line.startsWith('//')) { stripComment(line, fail); continue; }
    if (/^\[.*\]$/.test(line)) {
      section = line.slice(1, -1).trim().toLowerCase();
      if (!['url rewrite', 'rewrite', 'rewrite_local', 'script', 'mitm'].includes(section)) fail('unsupported executable or configuration section');
      continue;
    }
    if (section !== null && section !== 'rewrite_local' || section === null && !/\surl(?:-and-header)?\s/.test(line)) line = stripComment(line, fail);
    if (/^hostname\s*=/i.test(line)) {
      if (section !== null && section !== 'mitm' && section !== 'rewrite_local') fail('hostname in wrong section');
      hosts.push(...hostnames(line.slice(line.indexOf('=') + 1).trim()));
    } else if (section === 'mitm') fail('unsupported MITM option; certificate and verification settings are never imported');
    else if (section === 'script') foreignScript(line);
    else if (section === 'url rewrite' || section === 'rewrite') foreignRewrite(line, section);
    else if (/\surl(?:-and-header)?\s/.test(line)) native(line);
    else if (section === null && /^\S+\s+\S+\s+(?:302|307)$/.test(line)) foreignRewrite(line, 'url rewrite');
    else if (section === null && /^\S+\s+(?:302|307|reject(?:-200|-img|-dict|-array)?)(?:\s|$)/.test(line)) foreignRewrite(line, 'rewrite');
    else native(line);
  }
  const include = options.in ?? [], exclude = options.out ?? [];
  const keep = createTextMatcher(include), remove = createTextMatcher(exclude);
  const ruleCount = output.length;
  output = output.filter(line => (!include.length || keep(line)) && !remove(line));
  if (ruleCount && !output.length && (include.length || exclude.length)) fail('empty resource after filtering');
  const includeHosts = options.inhn ?? [], excludeHosts = options.outhn ?? [];
  const keepHost = createTextMatcher(includeHosts, true), removeHost = createTextMatcher(excludeHosts, true);
  hosts = hosts.filter(name => (!includeHosts.length || keepHost(name)) && !removeHost(name));
  if (!output.length && !hosts.length) fail('empty resource');
  if (hosts.length) emit('hostname = ' + [...new Set(hosts)].join(', '));
  if (compatibilityWarning && output.length >= 20000) fail('output limit exceeded');
  if (compatibilityWarning) output.unshift('# NetAtlas: user declares referenced scripts QX compatible; script APIs are not translated.');
  return output.join('\n') + '\n';
}
