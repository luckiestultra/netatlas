// SPDX-License-Identifier: MIT
import { decodeBase64Text } from './nodes.mjs';
import { stripComment } from './comments.mjs';

const fail = message => { throw new Error('Resource parser: ' + message); };
export function encodeBase64Text(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  for (const character of text) {
    const value = character.codePointAt(0);
    if (value >= 0xd800 && value <= 0xdfff) fail('invalid UTF-8 output');
    if (value < 128) bytes.push(value);
    else if (value < 2048) bytes.push(192 | value >> 6, 128 | value & 63);
    else if (value < 65536) bytes.push(224 | value >> 12, 128 | value >> 6 & 63, 128 | value & 63);
    else bytes.push(240 | value >> 18, 128 | value >> 12 & 63, 128 | value >> 6 & 63, 128 | value & 63);
  }
  const result = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const value = bytes[index] << 16 | (bytes[index + 1] ?? 0) << 8 | (bytes[index + 2] ?? 0);
    result.push(alphabet[value >>> 18 & 63] + alphabet[value >>> 12 & 63] + (index + 1 < bytes.length ? alphabet[value >>> 6 & 63] : '=') + (index + 2 < bytes.length ? alphabet[value & 63] : '='));
  }
  return result.join('');
}

export function nativeBuild(environment) {
  if (Number.isSafeInteger(environment?.build) && environment.build > 0) return environment.build;
  return Number(/\bbuild\s*(\d+)/i.exec(String(environment?.version ?? ''))?.[1] ?? 0);
}

export function quotaDetails(resource, flow) {
  const values = Object.create(null);
  if (flow && flow !== '1') {
    const parts = flow.split(':');
    values.expire = Date.parse(parts[0] + 'T00:00:00Z') / 1000;
    values.total = Math.round(Number(parts[1]) * 1073741824); values.download = Math.round(Number(parts[2]) * 1073741824); values.upload = 0;
  } else {
    if (typeof resource.info !== 'string' || resource.info.length > 8192 || /[\x00-\x1f\x7f]/.test(resource.info)) return null;
    for (const field of resource.info.split(/[;,]/)) {
      const match = /^\s*(upload|download|total|expire)\s*=\s*(.*?)\s*$/i.exec(field);
      if (!match) continue;
      const key = match[1].toLowerCase();
      if (Object.prototype.hasOwnProperty.call(values, key) || !/^\d+$/.test(match[2]) || !Number.isSafeInteger(Number(match[2]))) return null;
      values[key] = Number(match[2]);
    }
  }
  const used = (values.upload ?? 0) + (values.download ?? 0);
  if (!Number.isSafeInteger(values.total) || !Number.isSafeInteger(values.download) || !Number.isSafeInteger(used) || !Number.isSafeInteger(values.expire ?? 0)) return null;
  return { bytes_used: used, bytes_remaining: Math.max(0, values.total - used), expire_date: values.expire ?? 0 };
}

export function extractStatus(text) {
  let status = null;
  const rows = [];
  for (const row of text.split('\n')) {
    if (!/^STATUS=/i.test(row.trim())) { rows.push(row); continue; }
    if (status !== null || row.length > 512) fail('invalid quota pseudo-node');
    const match = /↑\s*:\s*(\d+(?:\.\d+)?)\s*GB.*?↓\s*:\s*(\d+(?:\.\d+)?)\s*GB.*?TOT\s*:\s*(\d+(?:\.\d+)?)\s*GB.*?Expires\s*:\s*(\d{4}-\d{2}-\d{2})/i.exec(row);
    if (!match || new Date(match[4] + 'T00:00:00Z').toISOString().slice(0, 10) !== match[4]) fail('invalid quota pseudo-node');
    const [upload, download, total] = match.slice(1, 4).map(value => Math.round(Number(value) * 1073741824));
    if (![upload, download, total].every(Number.isSafeInteger)) fail('invalid quota pseudo-node');
    status = `upload=${upload};download=${download};total=${total};expire=${Date.parse(match[4] + 'T00:00:00Z') / 1000}`;
  }
  return { text: rows.join('\n'), info: status };
}

function subscriptionLink(content) {
  let value = content.trim(), wrapped = false;
  if (/^subs?:\/\//i.test(value)) { value = decodeBase64Text(value.replace(/^subs?:\/\//i, '').split('#')[0]); wrapped = true; }
  if (value.length > 8192 || /[\s\x00-\x1f<>"\\]/.test(value)) return null;
  const match = /^(https?:\/\/(?:[a-z0-9-]+(?:\.[a-z0-9-]+)+|\[[a-f0-9:.]+\])(?::\d{1,5})?)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i.exec(value);
  if (!match) return null;
  const path = match[2] ?? '', query = match[3] ?? '';
  if (wrapped || /(?:^|\/)(?:sub|subscribe|subscription|link)(?:[/.]|$)|\.(?:txt|list|yaml|yml|conf|json|snippet)$/i.test(path) || /[?&](?:token|access_token|subscription|subscribe|sub|target)=/i.test(query)) return value;
  return null;
}

export function resourceImport(resource, options) {
  if (typeof resource?.content !== 'string') return null;
  const selected = Object.create(null);
  if (options.profile) {
    const sections = { server_remote: options.profile[0] === '1', filter_remote: options.profile[1] === '1', rewrite_remote: options.profile[2] === '1' };
    let section = '';
    for (let line of resource.content.split(/\r?\n/)) {
      line = stripComment(line.trim(), fail); if (!line) continue;
      const heading = /^\[([a-z_]+)\]$/i.exec(line);
      if (heading) { section = heading[1].toLowerCase(); continue; }
      if (!sections[section]) continue;
      if (!/^https?:\/\/[^\s,<>"\\]+(?:\s*,[^\r\n]*)?$/.test(line) || /[\x00-\x1f]/.test(line)) fail('invalid remote resource in profile import');
      (selected[section] ??= []).push(line);
    }
    if (!Object.keys(selected).length) fail('profile has no selected remote resources');
  } else {
    if (options.type !== 'auto' && options.type !== 'server' || resource.type === 'filter' || resource.type === 'rewrite') return null;
    const link = subscriptionLink(resource.content);
    if (!link) return null;
    selected.server_remote = [link.replaceAll(',', '%2C') + ', opt-parser=true, tag=NetAtlas-scan'];
  }
  const action = 'quantumult-x:///add-resource?remote-resource=' + encodeURIComponent(JSON.stringify(selected));
  if (action.length > 32768) fail('local resource import action exceeds limit');
  return {
    result: { error: 'NetAtlas: resource links need confirmation in the local add-resource action.' },
    notice: { title: '添加远程资源', subtitle: '需要在应用中确认', message: '点击此本地操作后核对资源；未自动下载或修改配置。', options: { 'open-url': action } },
  };
}

export function relayRules(content, policy) {
  if (typeof policy !== 'string' || !policy || /[,=\r\n"\x00-\x1f]/.test(policy)) fail('invalid relay policy');
  const rows = new Set();
  for (const line of content.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const match = /^[a-z0-9]+\s*=\s*(\[[^\]]+\]|[^:,\s]+):\d+\s*,/i.exec(line);
    if (!match) fail('invalid relay endpoint');
    const host = match[1].replace(/^\[|\]$/g, '');
    rows.add((host.includes(':') ? 'IP-CIDR6,' + host + '/128' : /^[0-9.]+$/.test(host) ? 'IP-CIDR,' + host + '/32' : 'DOMAIN,' + host) + ',' + policy);
  }
  if (!rows.size) fail('relay resource has no nodes');
  return [...rows].join('\n');
}
