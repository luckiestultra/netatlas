// SPDX-License-Identifier: MIT
import { safePattern } from '../resource-parser/safe-pattern.mjs';

export function runRewriteAction(environment, request, response, done, log) {
  let result = {};
  try {
    const path = environment?.sourcePath;
    if (typeof path !== 'string' || path.length > 16384 || !path.includes('#na=')) throw new Error();
    const config = JSON.parse(decodeURIComponent(path.slice(path.indexOf('#') + 4)));
    if (config.v !== 1 || !['response', 'headers'].includes(config.action)) throw new Error();
    if (config.action === 'response') {
      if (!Number.isInteger(config.status) || config.status < 200 || config.status > 999 || typeof config.body !== 'string' || !config.headers || typeof config.headers !== 'object') throw new Error();
      const phrases = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 307: 'Temporary Redirect', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };
      result = { status: 'HTTP/1.1 ' + config.status + ' ' + (phrases[config.status] ?? 'Mock Response'), headers: config.headers };
      if (!config.base64) result.body = config.body;
      else {
        if (config.body.length > 131072 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(config.body)) throw new Error();
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const bytes = []; let bits = 0, buffer = 0;
        for (const character of config.body.replace(/=+$/, '')) {
          buffer = (buffer << 6) | alphabet.indexOf(character); bits += 6;
          if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); }
        }
        result.bodyBytes = new Uint8Array(bytes).buffer;
      }
    } else {
      if (!['request', 'response'].includes(config.direction) || !Array.isArray(config.operations) || config.operations.length > 32) throw new Error();
      const source = config.direction === 'request' ? request : response;
      const headers = Object.assign(Object.create(null), source?.headers ?? {});
      const regexBudget = { remaining: 2097152 };
      for (const [action, name, expression, replacement] of config.operations) {
        if (!['replace', 'add', 'delete', 'regex'].includes(action) || typeof name !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) throw new Error();
        const keys = Object.keys(headers).filter(key => key.toLowerCase() === name.toLowerCase());
        if (action === 'delete') for (const key of keys) delete headers[key];
        else if (action === 'add') headers[keys[0] ?? name] = expression;
        else if (action === 'replace') for (const key of keys) headers[key] = expression;
        else {
          const matcher = safePattern(expression, true, regexBudget);
          for (const key of keys) headers[key] = matcher.replace(String(headers[key]), replacement);
        }
      }
      if (Object.values(headers).some(value => typeof value !== 'string' || /[\r\n\x00]/.test(value))) throw new Error();
      result = { headers };
    }
  } catch {
    result = {};
    if (typeof log === 'function') log('NetAtlas: invalid static rewrite action');
  }
  done(result);
  return result;
}

if (typeof $done === 'function') runRewriteAction(typeof $environment === 'object' ? $environment : undefined, typeof $request === 'object' ? $request : undefined, typeof $response === 'object' ? $response : undefined, $done, typeof console === 'object' ? console.log : undefined);
