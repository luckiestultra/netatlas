// SPDX-License-Identifier: MIT
import { safePattern } from './safe-pattern.mjs';
import { decodeBase64Text } from './nodes.mjs';

const fail = () => { throw new Error('Rewrite conversion: unsupported or invalid declarative action'); };
const base = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/scripts/rewrite-actions.js';
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const quote = value => JSON.stringify(value).replaceAll("'", '\\u0027');
function url(config) {
  const result = base + '#na=' + encodeURIComponent(JSON.stringify({ v: 1, ...config })).replaceAll("'", '%27');
  if (result.length > 8192) throw new Error('Rewrite conversion: inline action exceeds script reference size limit');
  return result;
}
function pattern(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!value || /[\s\x00-\x1f]/.test(value) || value.length > 8192) fail();
  return value;
}

// Space-delimited key=value fields, with source-style quoted JSON data.
export function parseMapFields(text) {
  const result = Object.create(null);
  while (text.trim()) {
    const key = /^\s*([a-z][a-z-]*)\s*=\s*/i.exec(text);
    if (!key || own(result, key[1].toLowerCase())) fail();
    const name = key[1].toLowerCase(); text = text.slice(key[0].length);
    let value;
    if (text[0] === '"' || text[0] === "'") {
      const delimiter = text[0]; let end = 1;
      for (; end < text.length; end++) {
        // Text data is a byte-preserving source string, not a JS literal.
        if (text[end] === delimiter && /^\s*(?:$|\s+[a-z][a-z-]*\s*=)/i.test(text.slice(end + 1))) break;
      }
      if (end === text.length) fail();
      value = text.slice(1, end); text = text.slice(end + 1);
    } else {
      const field = /^\S+/.exec(text); if (!field) fail();
      value = field[0]; text = text.slice(value.length);
    }
    result[name] = value;
  }
  return result;
}

export function mapLocalAction(line) {
  const match = /^("[^\n]*?"|'[^\n]*?'|\S+)\s+(.+)$/.exec(line);
  if (!match) fail();
  const sourcePattern = pattern(match[1]), data = parseMapFields(match[2]);
  if (Object.keys(data).some(key => !['data', 'data-type', 'status-code', 'header'].includes(key))) fail();
  const type = data['data-type'] ?? 'file';
  if (!['file', 'text', 'tiny-gif', 'base64'].includes(type)) fail();
  const status = Number(data['status-code'] ?? 200);
  if (!/^\d{3}$/.test(String(status)) || status < 200 || status > 999) fail();
  const headers = Object.create(null);
  if (own(data, 'header')) {
    let text = data.header;
    if (!text.includes(':')) text = decodeBase64Text(text);
    for (const header of text.split(/\||\r?\n/)) {
      const offset = header.indexOf(':'); if (offset < 1) fail();
      const name = header.slice(0, offset).trim(), value = header.slice(offset + 1).trim();
      if (!token.test(name) || /[\r\n\x00]/.test(value) || Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase())) fail();
      headers[name] = value;
    }
  }
  if (type === 'file') {
    const file = data.data;
    if (status !== 200 || Object.keys(headers).length || typeof file !== 'string' || !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$/.test(file) || file.includes('..')) throw new Error('Rewrite conversion: Map Local file needs an existing QX Data filename with default response settings');
    const extension = file.split('.').at(-1).toLowerCase();
    const mime = { json: 'application/json', html: 'text/html', txt: 'text/plain', css: 'text/css', js: 'application/javascript', png: 'image/png', gif: 'image/gif' }[extension] ?? 'application/octet-stream';
    return sourcePattern + ' url echo-response ' + mime + ' echo-response ' + file;
  }
  let body = data.data;
  const binary = type === 'base64' || type === 'tiny-gif';
  if (type === 'tiny-gif') body = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  if (typeof body !== 'string' || body.length > 131072 || /[\x00\r\n]/.test(body)) fail();
  if (binary && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body)) fail();
  if (!Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) headers['Content-Type'] = type === 'tiny-gif' ? 'image/gif' : type === 'text' ? 'text/plain' : 'application/octet-stream';
  return sourcePattern + ' url script-echo-response ' + url({ action: 'response', status, headers, body, base64: binary });
}

function split(text, delimiter) {
  const values = []; let start = 0, quote = '', escaped = false, stack = [];
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (escaped) { escaped = false; continue; }
    if (character === '\\' && quote) { escaped = true; continue; }
    if (quote) { if (quote === character) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if ('[{('.includes(character)) stack.push(character);
    else if (']})'.includes(character)) { const before = stack.pop(); if ('[{('.indexOf(before) !== ']})'.indexOf(character)) fail(); }
    else if (!stack.length && (delimiter === 'space' ? /\s/.test(character) : character === delimiter)) {
      if (text.slice(start, index).trim()) values.push(text.slice(start, index).trim()); start = index + 1;
    }
  }
  if (quote || stack.length) fail();
  if (text.slice(start).trim()) values.push(text.slice(start).trim());
  return values;
}
const unquote = value => value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0] ? value.slice(1, -1) : value;
function pathParts(value) {
  value = unquote(value).replace(/^\$\.?/, '').replace(/^\./, '');
  if (value.startsWith('[')) {
    let parts; try { parts = JSON.parse(value); } catch { fail(); }
    if (!Array.isArray(parts) || !parts.length || parts.some(part => typeof part !== 'string' && (!Number.isInteger(part) || part < 0))) fail();
    return parts;
  }
  const parts = []; let rest = value;
  while (rest) {
    const match = /^(?:([A-Za-z_$][A-Za-z0-9_$-]*)|\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]|\['([^']*)'\])/.exec(rest);
    if (!match) fail();
    if (match[1] !== undefined) parts.push(match[1]);
    else if (match[2] !== undefined) { if (Number(match[2]) > 1000000) fail(); parts.push(Number(match[2])); }
    else if (match[3] !== undefined) { try { parts.push(JSON.parse('"' + match[3] + '"')); } catch { fail(); } }
    else parts.push(match[4]);
    rest = rest.slice(match[0].length);
    if (rest.startsWith('.')) { rest = rest.slice(1); if (!rest) fail(); }
    else if (rest && !rest.startsWith('[')) fail();
    if (parts.length > 32) fail();
  }
  if (!parts.length) fail();
  return parts;
}
function setExisting(path, value) {
  const parts = pathParts(path), parent = parts.slice(0, -1), key = parts.at(-1);
  return 'if (getpath(' + quote(parent) + ')? | type == "' + (typeof key === 'number' ? 'array' : 'object') + '" and has(' + quote(key) + ')) then setpath(' + quote(parts) + '; ' + value + ') else . end';
}

export function jsonRewriteAction(line) {
  const surge = /^http-(request|response)-jq\s+(\S+)\s+(.+)$/i.exec(line);
  const match = surge ? [null, surge[2], surge[1] + '-body-json-jq', surge[3]] : /^("[^\n]*?"|'[^\n]*?'|\S+)\s+((?:request|response)-body-json-(?:jq|del|replace))\s+(.+)$/i.exec(line);
  if (!match) return null;
  const sourcePattern = pattern(match[1]), action = match[2].toLowerCase(), payload = unquote(match[3].trim());
  let expression;
  if (action.endsWith('-jq')) expression = payload;
  else if (action.endsWith('-del')) {
    let paths;
    if (payload.startsWith('[[')) { try { paths = JSON.parse(payload); } catch { fail(); } if (!Array.isArray(paths) || paths.some(path => !Array.isArray(path) || !path.length || path.some(part => typeof part !== 'string' && (!Number.isInteger(part) || part < 0)))) fail(); }
    else { let items = split(payload, ','); if (items.length === 1) items = split(payload, ';'); if (items.length === 1) items = split(payload, 'space'); paths = items.map(pathParts); }
    expression = 'delpaths(' + quote(paths) + ')';
  } else {
    const updates = [];
    if (payload.startsWith('{')) {
      let data; try { data = JSON.parse(payload); } catch { fail(); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) fail();
      for (const [key, value] of Object.entries(data)) updates.push(setExisting(key, quote(value)));
    } else {
      let items = split(payload, ','); if (items.length === 1) items = split(payload, ';');
      for (const item of items) {
        const pair = /^(\S+?)\s*(?:=>|=|\s)\s*(.+)$/.exec(item); if (!pair) fail();
        let value; try { value = quote(JSON.parse(pair[2])); } catch { value = quote(unquote(pair[2])); }
        updates.push(setExisting(pair[1], value));
      }
    }
    if (!updates.length || updates.length > 100) fail();
    expression = updates.join(' | ');
  }
  if (!expression || expression.length > 8192 || /[\r\n\x00]/.test(expression) || expression.includes("'")) fail();
  return sourcePattern + ' url jsonjq-' + (action.startsWith('request') ? 'request' : 'response') + "-body '" + expression + "'";
}

export function headerRewriteAction(line) {
  const match = /^(\S+)\s+((?:response-)?header-(?:add|del|replace|replace-regex))\s+(.+)$/i.exec(line);
  if (!match) return null;
  const sourcePattern = pattern(match[1]), action = match[2].toLowerCase(), values = split(match[3], 'space').map(unquote);
  const operation = action.endsWith('-replace-regex') ? 'regex' : action.endsWith('-replace') ? 'replace' : action.endsWith('-add') ? 'add' : 'delete';
  // Surge's Header-Name: value spelling is accepted alongside Loon pairs.
  if (operation === 'replace' && values[0]?.endsWith(':')) { values[0] = values[0].slice(0, -1); values.splice(1, values.length - 1, values.slice(1).join(' ')); }
  const width = operation === 'delete' ? 1 : operation === 'regex' ? 3 : 2;
  if (!values.length || values.length % width || values.length / width > 32) fail();
  const operations = [];
  for (let index = 0; index < values.length; index += width) {
    const name = values[index]; if (!token.test(name)) fail();
    if (operation === 'regex') safePattern(values[index + 1], true);
    operations.push([operation, name, values[index + 1] ?? '', values[index + 2] ?? '']);
  }
  const direction = action.startsWith('response-') ? 'response' : 'request';
  return sourcePattern + ' url script-' + direction + '-header ' + url({ action: 'headers', direction, operations });
}
