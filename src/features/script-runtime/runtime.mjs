// SPDX-License-Identifier: Apache-2.0
// Original, statically compiled Surge HTTP contract on a captured Quantumult X host.
// No runtime source loading or evaluation. This is deliberately not a host emulator.
// Official contracts: crossutility/Quantumult-X sample-{task,bytes-rewrite,rewrite-with-script}.js
// https://manual.nssurge.com/scripting/{api,overview,http-request,http-response}.html
export function createScriptRuntime(host, fixed) {
  let completed = false;
  const started = Date.now();
  const log = message => host.log('NetAtlas script runtime: ' + message);
  const finish = value => {
    if (completed) return;
    completed = true;
    host.done(value);
  };
  const fail = message => { log(message); finish({}); };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const bytes = value => {
    if (value instanceof ArrayBuffer) return value.slice(0);
    if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    throw new Error('expected binary body');
  };
  let config;
  try {
    config = { v: 1, kind: fixed.kind, binary: true, maxSize: -1, timeout: 5, name: fixed.name, worker: false };
    const path = host.environment?.sourcePath ?? '';
    if (typeof path !== 'string' || path.length > 65536) throw new Error();
    const hash = path.includes('#') ? path.slice(path.indexOf('#') + 1) : '';
    const matches = hash.split('&').filter(part => part.startsWith('na='));
    if (matches.length > 1) throw new Error();
    if (matches.length) {
      const input = JSON.parse(decodeURIComponent(matches[0].slice(3)));
      if (!record(input) || Object.keys(input).some(key => !['v', 'kind', 'argument', 'binary', 'maxSize', 'timeout', 'name', 'worker', 'sourceUrl'].includes(key))) throw new Error();
      Object.assign(config, input);
    }
    if (config.v !== 1 || config.kind !== fixed.kind || config.worker !== false || fixed.worker === true ||
        typeof config.binary !== 'boolean' || !Number.isInteger(config.maxSize) || config.maxSize < -1 || config.maxSize > 9999999999 ||
        typeof config.timeout !== 'number' || !Number.isFinite(config.timeout) || config.timeout <= 0 || config.timeout > 999999 ||
        typeof config.name !== 'string' || config.name.length > 200 || /[\x00-\x1f]/.test(config.name) ||
        (own(config, 'argument') && config.argument !== null && typeof config.argument !== 'string' && !record(config.argument)) ||
        (own(config, 'sourceUrl') && (!Array.isArray(fixed.sourceUrls) || !fixed.sourceUrls.includes(config.sourceUrl)))) throw new Error();
  } catch {
    fail('invalid or incompatible wrapper configuration');
    return { active: false };
  }
  const deadline = started + config.timeout * 1000;
  const timely = () => {
    if (completed) return false;
    if (Date.now() >= deadline) { fail('script deadline exceeded; synchronous execution cannot be preempted'); return false; }
    return true;
  };
  const schedule = (callback, delay) => host.timer(() => {
    if (!timely()) return;
    try { callback(); } catch { fail('script callback failed'); }
  }, delay);
  // This timer gates asynchronous completion; QX alone controls engine termination and buffering.
  host.timer(() => { if (!completed) fail('script deadline exceeded; synchronous execution cannot be preempted'); }, config.timeout * 1000);
  const nativeBody = fixed.kind === 'request' ? host.request : host.response;
  let bodyLength = 0;
  try {
    if (nativeBody?.bodyBytes !== undefined) bodyLength = bytes(nativeBody.bodyBytes).byteLength;
    else if (typeof nativeBody?.body === 'string') {
      for (let index = 0; index < nativeBody.body.length; index++) {
        const code = nativeBody.body.charCodeAt(index);
        if (code < 0x80) bodyLength++;
        else if (code < 0x800) bodyLength += 2;
        else if (code >= 0xd800 && code <= 0xdbff && nativeBody.body.charCodeAt(index + 1) >= 0xdc00 && nativeBody.body.charCodeAt(index + 1) <= 0xdfff) { bodyLength += 4; index++; }
        else bodyLength += 3;
      }
    }
  } catch {
    fail('invalid native binary body');
    return { active: false };
  }
  if (config.maxSize !== -1 && bodyLength > config.maxSize) {
    fail(fixed.kind === 'request'
      ? 'request limit cannot reproduce native connection termination; script skipped after QX buffering'
      : 'response size limit exceeded; script skipped after QX buffering');
    return { active: false };
  }
  if (fixed.kind === 'request' && /^https?:\/\/[\w-]+\.googlevideo\.com\/initplayback/i.test(host.request?.url ?? '')) {
    fail('initplayback requires the separate explicit Worker opt-in; default adapter skipped');
    return { active: false };
  }
  const input = value => {
    if (!value) return undefined;
    const mapped = { ...value, headers: { ...value.headers } };
    delete mapped.bodyBytes;
    delete mapped.statusCode;
    delete mapped.sessionIndex;
    if (value.sessionIndex !== undefined) mapped.id = String(value.sessionIndex);
    if (value.statusCode !== undefined) mapped.status = value.statusCode;
    if (config.binary) {
      delete mapped.body;
      if (value.bodyBytes !== undefined) mapped.body = new Uint8Array(bytes(value.bodyBytes));
    }
    return mapped;
  };
  const request = input(host.request), response = input(host.response);
  const status = value => {
    if (!Number.isInteger(value) || value < 100 || value > 599) throw new Error();
    const reasons = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 413: 'Content Too Large', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };
    return 'HTTP/1.1 ' + value + ' ' + (reasons[value] ?? 'Status');
  };
  function output(value, synthetic = false) {
    if (!record(value)) throw new Error();
    const allowed = synthetic || fixed.kind === 'response' ? ['status', 'headers', 'body'] : ['url', 'headers', 'body', 'response'];
    if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error();
    if (own(value, 'response')) {
      if (Object.keys(value).length !== 1) throw new Error();
      return output(value.response, true);
    }
    const mapped = {};
    if (own(value, 'url')) {
      const parse = url => /^(https?):\/\/([^/?#]+)([^#]*)$/.exec(url);
      const before = parse(host.request?.url ?? ''), after = parse(value.url);
      if (!before || !after || before[1].toLowerCase() !== after[1].toLowerCase() || before[2].toLowerCase() !== after[2].toLowerCase()) {
        throw new Error('unverified cross-origin URL rewriting is outside this adapter contract');
      }
      mapped.path = after[3] || '/';
      if (mapped.path.startsWith('?')) mapped.path = '/' + mapped.path;
    }
    if (own(value, 'status')) mapped.status = status(value.status);
    else if (synthetic) mapped.status = status(200);
    if (own(value, 'headers')) {
      if (!record(value.headers)) throw new Error();
      mapped.headers = { ...value.headers };
    }
    if (own(value, 'body')) {
      if (typeof value.body === 'string') mapped.body = value.body;
      else mapped.bodyBytes = bytes(value.body);
    } else if (!synthetic && fixed.kind === 'response' && (own(value, 'headers') || own(value, 'status'))) {
      // QX script-response-body ignores a headers-only result. Preserve its original bytes.
      if (nativeBody?.bodyBytes !== undefined) mapped.bodyBytes = bytes(nativeBody.bodyBytes);
      else if (typeof nativeBody?.body === 'string') mapped.body = nativeBody.body;
      else throw new Error();
    }
    return mapped;
  }
  const done = value => {
    if (!timely()) return;
    try { finish(value === undefined ? {} : output(value)); }
    catch (error) { fail(error?.message === 'unverified cross-origin URL rewriting is outside this adapter contract' ? error.message : 'unsupported script completion result'); }
  };
  const defaultKey = 'NetAtlas.ScriptRuntime.default:' + (config.sourceUrl ?? fixed.name);
  const keyName = key => typeof key === 'string' && key && key.length <= 1024 && !/[\/\\\x00-\x1f\x7f]/.test(key) ? key : null;
  const persistentStore = {
    read(key) { if (!timely()) return null; const selected = key === undefined ? defaultKey : keyName(key); return selected === null ? null : host.prefs.valueForKey(selected) ?? null; },
    write(value, key) {
      if (!timely()) return false;
      const selected = key === undefined ? defaultKey : keyName(key);
      if (selected === null) return false;
      if (value === null) return host.prefs.removeValueForKey(selected);
      if (typeof value !== 'string') return false;
      return host.prefs.setValueForKey(value, selected);
    },
  };
  const notification = { post(title = '', subtitle = '', message = '', options = {}) {
    if (!timely()) return;
    const mapped = {};
    if (!record(options) || Object.keys(options).some(key => !['url', 'action'].includes(key)) ||
        (own(options, 'url') && typeof options.url !== 'string') ||
        (own(options, 'action') && options.action !== 'open-url' && !(record(options.action) && Object.keys(options.action).length === 1 && typeof options.action['open-url'] === 'string')) ||
        options.action === 'open-url' && !own(options, 'url')) {
      fail('unsupported notification options');
      return;
    }
    if (typeof options.url === 'string') mapped['open-url'] = options.url;
    else if (typeof options.action?.['open-url'] === 'string') mapped['open-url'] = options.action['open-url'];
    host.notify(String(title), String(subtitle), String(message), mapped);
  } };
  const httpClient = {};
  for (const method of ['get', 'post', 'put', 'delete', 'head', 'options', 'patch']) httpClient[method] = (options, callback) => {
    if (!timely()) return;
    let requestOptions, binary, requestTimeout;
    try {
      options = typeof options === 'string' ? { url: options } : options;
      if (!record(options) || Object.keys(options).some(key => !['url', 'headers', 'body', 'timeout', 'policy', 'binary-mode', 'auto-redirect', 'auto-cookie', 'insecure'].includes(key)) ||
          typeof options.url !== 'string' || !/^https?:\/\/[^/?#@\s]+(?:[/?#][^\s]*)?$/.test(options.url) || typeof callback !== 'function') throw new Error();
      requestOptions = { url: options.url, method: method.toUpperCase() };
      binary = options['binary-mode'] === true;
      requestTimeout = options.timeout ?? 5;
      if (typeof requestTimeout !== 'number' || !Number.isFinite(requestTimeout) || requestTimeout <= 0 || requestTimeout > 999999) throw new Error();
      for (const key of ['binary-mode', 'auto-redirect', 'auto-cookie', 'insecure']) if (own(options, key) && typeof options[key] !== 'boolean') throw new Error();
      // Before QX build 934 false is ignored. Only a known supporting build may disable the jar.
      const build = Number(/\bbuild\s*(\d+)/i.exec(String(host.environment?.version ?? ''))?.[1] ?? 0);
      if (options['auto-cookie'] === false && build < 934) throw new Error();
      if (own(options, 'headers')) { if (!record(options.headers)) throw new Error(); requestOptions.headers = { ...options.headers }; }
      if (own(options, 'body')) {
        if (typeof options.body === 'string') requestOptions.body = options.body;
        else if (options.body instanceof ArrayBuffer || ArrayBuffer.isView(options.body)) requestOptions.bodyBytes = bytes(options.body);
        else { requestOptions.body = JSON.stringify(options.body); requestOptions.headers = { 'Content-Type': 'application/json', ...requestOptions.headers }; }
      }
      // Surge defaults to a cookie jar; QX build 934+ defaults to no jar.
      const opts = { 'auto-cookie': true };
      if (own(options, 'policy')) { if (typeof options.policy !== 'string') throw new Error(); opts.policy = options.policy; }
      if (own(options, 'auto-redirect')) opts.redirection = options['auto-redirect'];
      if (own(options, 'auto-cookie')) opts['auto-cookie'] = options['auto-cookie'];
      if (own(options, 'insecure')) opts['skip-cert-verify'] = options.insecure;
      if (Object.keys(opts).length) requestOptions.opts = opts;
    } catch { if (typeof callback === 'function') callback('unsupported HTTP request options', undefined, undefined); else fail('invalid HTTP callback'); return; }
    let settled = false;
    const respond = (error, value, data) => {
      if (settled || !timely()) return;
      settled = true;
      try { callback(error, value, data); } catch { fail('HTTP callback failed'); }
    };
    // QX offers no documented cancellation API: this suppresses late callbacks, not the native request.
    schedule(() => respond('HTTP request deadline exceeded', undefined, undefined), requestTimeout * 1000);
    try {
      Promise.resolve(host.fetch(requestOptions)).then(value => {
        try { respond(null, { status: value.statusCode, headers: value.headers }, binary ? new Uint8Array(bytes(value.bodyBytes)) : value.body); }
        catch { respond('invalid HTTP response', undefined, undefined); }
      }, () => respond('HTTP request failed', undefined, undefined));
    } catch { respond('HTTP request failed', undefined, undefined); }
  };
  return {
    // Maasea's Surge branch accepts a JSON string, while its Loon branch also accepts an object.
    // Preserve object values for that registered source without changing generic argument transport.
    active: true, request, response, argument: fixed.argumentMode === 'json-object' && record(config.argument) ? JSON.stringify(config.argument) : config.argument,
    script: { name: config.name, type: 'http-' + fixed.kind, startTime: started / 1000, binaryBodyMode: config.binary },
    persistentStore, notification, httpClient, done, timer: schedule, fail,
  };
}
