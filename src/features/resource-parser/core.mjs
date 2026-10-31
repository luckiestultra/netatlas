// SPDX-License-Identifier: MIT
// Local, atomic conversion. No downloads, storage, script execution or host changes.
import { createNodeParser, decodeBase64Text, looksLikeEncodedSubscription } from './nodes.mjs';
import { parseRules } from './rules.mjs';
import { parseRewrites } from './rewrites.mjs';
import { parseYaml } from './yaml.mjs';
import { parseOptions, applyNodeOptions } from './options.mjs';

const MAX_TEXT = 2 * 1024 * 1024;
const fail = message => { throw new Error('Resource parser: ' + message); };
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const nodeParser = createNodeParser({parseYaml});

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
      if (/^\[(?:proxy|server_local)\]$/i.test(value) || /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(?:shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=/i.test(value)) kinds.add('server');
      else if (/^\[(?:rule|filter_local)\]$/i.test(value) || /^(?:DOMAIN|HOST|IP|GEOIP|USER-AGENT|FINAL|MATCH|PROCESS|AND|OR|NOT|DEST-PORT|DST-PORT)[A-Z0-9_-]*\s*,/i.test(value)) kinds.add('filter');
      else if (/^\[(?:url rewrite|rewrite|rewrite_local|script|mitm)\]$/i.test(value) || /\surl(?:-and-header)?\s/.test(value) || /^hostname\s*=/i.test(value) || /^\S+\s+(?:302|307|reject(?:-\w+)?)(?:\s|$)/.test(value) || /^\S+\s+\S+\s+(?:302|307)$/.test(value)) kinds.add('rewrite');
      // Surge/Loon node declarations have a leading name and protocol.
      else if (/^[^=]+\s*=\s*(?:ss|ssr|shadowsocks|vmess|vless|trojan|http|https|socks5|anytls)\s*,/i.test(value)) kinds.add('server');
    }
  }
  if (kinds.size !== 1) fail(kinds.size ? 'mixed resource; select type explicitly' : 'unknown resource; select type and format explicitly');
  return [...kinds][0];
}

function validateOptions(type, options) {
  const nodeOptions=options.in.length || options.out.length || options.prefix || options.suffix || options.rename.length || options.sort !== 'none';
  const ruleOptions=own(options,'policy') || own(options,'domainSetMode') || options.allowResolve || options.sourceFormat !== 'auto';
  if (type !== 'server' && nodeOptions) fail('node options are not valid for this resource');
  if (type !== 'filter' && ruleOptions) fail('rule options are not valid for this resource');
  if (type !== 'rewrite' && own(options,'scriptCompatibility')) fail('script options are not valid for this resource');
}

export function parseResource(resource) {
  if (!resource || typeof resource.content !== 'string' || resource.content.length > MAX_TEXT) fail('invalid or oversized resource');
  const options=parseOptions(resource.link ?? '');
  let text=resource.content.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if (!text || /[\x00\u2028\u2029]/.test(text) || text.split('\n').length > 20000) fail('empty, invalid or oversized resource');
  if (looksLikeEncodedSubscription(text)) text=decodeBase64Text(text).trim();
  if (text.length > MAX_TEXT) fail('decoded resource limit exceeded');
  let data;
  if (/^[{[]/.test(text) && !/^\[[a-z_ ]+\]\s*(?:\n|$)/i.test(text) || /^(?:proxies|outbounds|servers|nodes|payload)\s*:/m.test(text)) data=parseYaml(text);
  // Some hosts expose a type; unknown host values are not guessed from numbers.
  const hostType=['server','filter','rewrite'].includes(resource.type) ? resource.type : null;
  const type=options.type === 'auto' ? hostType ?? detect(text,data) : options.type;
  validateOptions(type,options);
  let content;
  if (type === 'server') content=applyNodeOptions(nodeParser.parseNodes(data ?? text),options);
  else if (type === 'filter') content=parseRules(text,options,{parseYaml});
  else content=parseRewrites(text,options,{parseYaml});
  if (typeof content !== 'string' || !content.trim() || content.length > MAX_TEXT || content.split('\n').length > 20002) fail('invalid or oversized output');
  return {content};
}

export function completeResource(resource, done) {
  let result;
  try { result=parseResource(resource); }
  catch (error) {
    // Only our converters' controlled diagnostic strings may reach the UI.
    // YAML/JSON/host exceptions can contain a whole subscription, so redact them.
    const message=error && typeof error.message === 'string' ? error.message : '';
    result={error:/^(?:Resource parser: |Node conversion failed: |Rule conversion: |Rewrite conversion: |Resource parser options: |Node options failed: |YAML resource: )/.test(message) && message.length < 240 ? message : 'NetAtlas: resource conversion failed; check the format and supported options.'};
  }
  // Host completion is deliberately outside the catch: a host exception cannot
  // result in a second $done invocation or a partial-success fallback.
  done(result);
}
