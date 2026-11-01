// SPDX-License-Identifier: MIT
// Local, atomic conversion. No downloads, storage, script execution or host changes.
import { createNodeParser, decodeBase64Text, looksLikeEncodedSubscription } from './nodes.mjs';
import { parseRules } from './rules.mjs';
import { parseRewrites } from './rewrites.mjs';
import { parseYaml } from './yaml.mjs';
import { parseOptions, applyNodeOptions } from './options.mjs';
import { subscriptionNotification } from './subscription-info.mjs';

const MAX_TEXT = 2 * 1024 * 1024;
const fail = message => { throw new Error('Resource parser: ' + message); };
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const nodeParser = createNodeParser({parseYaml});

function isRewriteLine(value) {
  return /^\[(?:url rewrite|rewrite|rewrite_local|script|mitm)\]$/i.test(value) || /\surl(?:-and-header)?\s/.test(value) || /^hostname\s*=/i.test(value) || /^\S+\s+(?:302|307|reject(?:-\w+)?)(?:\s|$)/.test(value) || /^\S+\s+\S+\s+(?:302|307)$/.test(value);
}

function detect(text, data) {
  const kinds = new Set();
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) kinds.add('server');
    for (const key of ['proxies','outbounds','servers','nodes']) if (own(data,key)) kinds.add('server');
    if (own(data,'payload') || own(data,'rules') && own(data,'version')) kinds.add('filter');
  } else {
    for (const line of text.split('\n')) {
      const value=line.trim();
      if (!value || /^[#;]/.test(value) || value.startsWith('//')) continue;
      const nativeNode = /^(?:shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=/i.test(value);
      const namedNode = /^[^=]+\s*=\s*(?:ss|ssr|shadowsocks|vmess|vless|trojan|http|https|socks5|anytls)\s*,/i.test(value);
      const uri = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
      // Names/fragments may contain the literal word "url". Node declarations
      // and tagged node URIs take precedence over rewrite heuristics.
      if (nativeNode || namedNode || uri && /^[^\s]*#/.test(value) || /^\[(?:proxy|server_local)\]$/i.test(value)) kinds.add('server');
      else if (isRewriteLine(value)) kinds.add('rewrite');
      else if (uri) kinds.add('server');
      else if (/^\[(?:rule|filter_local)\]$/i.test(value) || /^(?:DOMAIN|HOST|IP|GEOIP|USER-AGENT|FINAL|MATCH|PROCESS|AND|OR|NOT|DEST-PORT|DST-PORT)[A-Z0-9_-]*\s*,/i.test(value)) kinds.add('filter');
    }
  }
  if (kinds.size !== 1) fail(kinds.size ? 'mixed resource; select type explicitly' : 'unknown resource; select type and format explicitly');
  return [...kinds][0];
}

function validateOptions(type, options) {
  const nodeOptions=options.prefix || options.suffix || options.rename.length || options.sort !== 'none' || options.info || options.emoji && options.emoji !== '0';
  if (type !== 'rewrite' && (options.inhn.length || options.outhn.length)) fail('hostname options are not valid for this resource');
  const ruleOptions=own(options,'policy') || own(options,'domainSetMode') || options.allowResolve || options.sourceFormat !== 'auto';
  if (type !== 'server' && nodeOptions) fail('node options are not valid for this resource');
  if (type !== 'filter' && ruleOptions) fail('rule options are not valid for this resource');
  if (type !== 'rewrite' && own(options,'scriptCompatibility')) fail('script options are not valid for this resource');
}

function convertResource(resource) {
  if (!resource || typeof resource.content !== 'string' || resource.content.length > MAX_TEXT) fail('invalid or oversized resource');
  let link = resource.link ?? '';
  // Local files historically carry options in a first-line #key=value comment.
  // Explicit path/URL fragments win; remote content cannot enable options.
  if (typeof link === 'string' && link && (/^file:/i.test(link) || !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(link)) && !link.includes('#')) {
    const first = resource.content.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim();
    if (/^#[a-z][\w-]*=/i.test(first)) link += first;
  }
  const options=parseOptions(link);
  let text=resource.content.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if (!text || /[\x00\u2028\u2029]/.test(text) || text.split('\n').length > 20000) fail('empty, invalid or oversized resource');
  if (looksLikeEncodedSubscription(text)) text=decodeBase64Text(text).trim();
  if (text.length > MAX_TEXT) fail('decoded resource limit exceeded');
  // Some hosts expose a type; unknown host values are not guessed from numbers.
  const hostType=['server','filter','rewrite'].includes(resource.type) ? resource.type : null;
  const requestedType=options.type === 'auto' ? hostType : options.type;
  let data;
  // A leading regex character class is valid rewrite syntax, not a YAML array.
  const structured=/^[{[]/.test(text) && !/^\[[a-z_ ]+\]\s*(?:\n|$)/i.test(text) && !(text.startsWith('[') && isRewriteLine(text.split('\n')[0]));
  if (requestedType !== 'rewrite' && (structured || /^(?:proxies|outbounds|servers|nodes|payload)\s*:/m.test(text))) data=parseYaml(text);
  const type=requestedType ?? detect(text,data);
  validateOptions(type,options);
  let content, notice = null;
  if (type === 'server') {
    const adaptations = new Set();
    const nativeNodes = nodeParser.parseNodes(data ?? text, { adaptations });
    content = applyNodeOptions(nativeNodes,options);
    // Fixed notices contain no source values and bypass name filtering only
    // after the complete source and all node transformations have succeeded.
    const notes = [];
    if (adaptations.has('fp') || adaptations.has('client-fingerprint')) notes.push('# NetAtlas: QX uses its native TLS fingerprint; source fp/client-fingerprint preferences are not preserved.');
    if (adaptations.has('spx')) notes.push('# NetAtlas: QX has no Reality spider-path setting; source spx is omitted.');
    if (adaptations.has('support-x25519mlkem768')) notes.push('# NetAtlas: QX uses its native Reality handshake for X25519MLKEM768 support.');
    if (notes.length) content = notes.join('\n') + '\n' + content;
    if (options.info) notice = subscriptionNotification(resource,nativeNodes);
  }
  else if (type === 'filter') content=parseRules(text,options,{parseYaml});
  else content=parseRewrites(text,options,{parseYaml});
  if (typeof content !== 'string' || !content.trim() || content.length > MAX_TEXT || content.split('\n').length > 20002) fail('invalid or oversized output');
  return { content, notice };
}

export function parseResource(resource) {
  return { content: convertResource(resource).content };
}

export function completeResource(resource, done, notify) {
  let result, notice;
  try {
    const converted = convertResource(resource);
    result = { content: converted.content };
    notice = converted.notice;
  }
  catch (error) {
    // Only our converters' controlled diagnostic strings may reach the UI.
    // YAML/JSON/host exceptions can contain a whole subscription, so redact them.
    const message=error && typeof error.message === 'string' ? error.message : '';
    result={error:/^(?:Resource parser: |Node conversion failed: |Rule conversion: |Rewrite conversion: |Resource parser options: |Node options failed: |YAML resource: )/.test(message) && message.length < 240 ? message : 'NetAtlas: resource conversion failed; check the format and supported options.'};
  }
  // A disabled or unavailable notification API must not invalidate nodes.
  if (notice && typeof notify === 'function') {
    try { notify(notice.title, notice.subtitle, notice.message); } catch { /* Optional UI only. */ }
  }
  // Host completion is deliberately outside the catch: a host exception cannot
  // result in a second $done invocation or a partial-success fallback.
  done(result);
  return result;
}
