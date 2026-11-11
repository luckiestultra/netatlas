// SPDX-License-Identifier: MIT
// Local, atomic conversion. No downloads, storage, script execution or host changes.
import { createNodeParser, decodeBase64Text, looksLikeEncodedSubscription } from './nodes.mjs';
import { parseRules } from './rules.mjs';
import { parseRewrites } from './rewrites.mjs';
import { parseYaml } from './yaml.mjs';
import { parseOptions, applyNodeOptions } from './options.mjs';
import { subscriptionNotification } from './subscription-info.mjs';
import { splitRuleNote, isPlainRuleToken } from './resource-metadata.mjs';
import { encodeBase64Text, nativeBuild, quotaDetails, extractStatus, resourceImport, relayRules } from './host-options.mjs';

import { MAX_TEXT, MAX_LINES, MAX_RULE_TEXT, MAX_RULE_LINES } from './limits.mjs';
const fail = message => { throw new Error('Resource parser: ' + message); };
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const nodeParser = createNodeParser({parseYaml});

function isRewriteLine(value) {
  if (/^\[map local\]$/i.test(value) || /^http-(?:request|response)-jq\s/i.test(value) || /^\S+\s+(?:(?:request|response)-body-json-(?:jq|del|replace)|(?:response-)?header-(?:add|del|replace|replace-regex)|-)(?:\s|$)/i.test(value)) return true;
  return /^\[(?:url rewrite|rewrite|rewrite_local|script|mitm)\]$/i.test(value) || /^URL-REGEX\s*,/i.test(value) || /\surl(?:-and-header)?\s/.test(value) || /^hostname\s*=/i.test(value) || /^\S+\s+(?:302|307|reject(?:-\w+)?)(?:\s|$)/.test(value) || /^\S+\s+\S+\s+(?:302|307)$/.test(value);
}

function detect(text, data) {
  const kinds = new Set();
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) kinds.add('server');
    for (const key of ['proxies','outbounds','servers','nodes']) if (own(data,key)) kinds.add('server');
    if (own(data,'payload') || own(data,'rules') && own(data,'version')) kinds.add('filter');
  } else {
    for (const line of text.split('\n')) {
      let value=splitRuleNote(line.trim()).body;
      if (/^-\s*(?:DOMAIN|HOST|IP|GEOIP|FINAL|MATCH|USER-AGENT)/i.test(value)) value = value.replace(/^-\s*/, '');
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
      else if (isPlainRuleToken(value)) kinds.add('filter');
    }
  }
  // Since QX 1.5.2 build 844 a rewrite snippet may contain native filters.
  if (!data && kinds.size === 2 && kinds.has('filter') && kinds.has('rewrite')) return 'rewrite';
  if (kinds.size !== 1) fail(kinds.size ? 'mixed resource; select type explicitly' : 'unknown resource; select type and format explicitly');
  return [...kinds][0];
}

function validateOptions(type, options) {
  const nodeOptions=options.prefix || options.suffix || options.rename.length || options.sort !== 'none' || options.info || options.emoji && options.emoji !== '0';
  if (type !== 'rewrite' && (options.inhn.length || options.outhn.length)) fail('hostname options are not valid for this resource');
  const ruleOptions=own(options,'policy') || own(options,'domainSetMode') || options.allowResolve || options.sourceFormat !== 'auto';
  if (type !== 'server' && nodeOptions) fail('node options are not valid for this resource');
  if (type === 'server' && ruleOptions || type === 'rewrite' && (own(options,'domainSetMode') || options.sourceFormat !== 'auto')) fail('rule options are not valid for this resource');
  if (type !== 'rewrite' && own(options,'scriptCompatibility')) fail('script options are not valid for this resource');
  if (type !== 'rewrite' && own(options, 'moduleArguments')) fail('module arguments are not valid for this resource');
  const nodeKeys = ['rrname', 'delreg', 'ptn', 'npt', 'cap', 'sortx', 'del', 'udp', 'tfo', 'uot', 'cert', 'csha', 'psha', 'alpn', 'aead', 'host', 'obfs', 'tsession', 'checkurl', 'tls13', 'relay', 'b64', 'flow'];
  if (type !== 'server' && nodeKeys.some(key => own(options, key))) fail('node options are not valid for this resource');
  if (type === 'server' && ['pset', 'fcr', 'via', 'hide', 'dst'].some(key => own(options, key))) fail('rule options are not valid for this resource');
}

function optionsFor(resource) {
  if (!resource || typeof resource.content !== 'string' || resource.content.length > MAX_RULE_TEXT) fail('invalid or oversized resource');
  let link = resource.link ?? '';
  // Local files historically carry options in a first-line #key=value comment.
  // Explicit path/URL fragments win; remote content cannot enable options.
  if (typeof link === 'string' && link && (/^file:/i.test(link) || !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(link)) && !link.includes('#')) {
    const first = resource.content.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim();
    if (/^#[a-z][\w-]*=/i.test(first)) link += first;
  }
  return parseOptions(link);
}

function convertResource(resource, environment = {}, options = optionsFor(resource)) {
  const build = nativeBuild(environment);
  let text=resource.content.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if (!text || /[\x00\u2028\u2029]/.test(text) || text.split('\n').length > MAX_RULE_LINES) fail('empty, invalid or oversized resource');
  // Reject oversized Base64-shaped input before the decoder allocates its copy.
  if (text.length > MAX_TEXT && /^[A-Za-z0-9+/_=\s-]+$/.test(text)) fail('encoded resource limit exceeded');
  const encoded = looksLikeEncodedSubscription(text);
  if (encoded) {
    if (resource.content.length > MAX_TEXT) fail('encoded resource limit exceeded');
    text=decodeBase64Text(text).trim();
  }
  if (text.length > MAX_RULE_TEXT || /[\x00\u2028\u2029]/.test(text)) fail('decoded resource limit exceeded');
  // Some hosts expose a type; unknown host values are not guessed from numbers.
  const hostType=['server','filter','rewrite'].includes(resource.type) ? resource.type : null;
  if (options.dst && options.type !== 'auto' && options.type !== options.dst) fail('conflicting explicit resource destinations');
  const requestedType=options.dst ?? (options.type === 'auto' ? hostType : options.type);
  let data;
  // A leading regex character class is valid rewrite syntax, not a YAML array.
  const structured=/^[{[]/.test(text) && !text.startsWith('{#') && !/^\[[a-z_ ]+\]\s*(?:\n|$)/i.test(text) && !(text.startsWith('[') && isRewriteLine(text.split('\n')[0]));
  const document = requestedType !== 'rewrite' && (structured || /^(?:proxies|outbounds|servers|nodes|payload)\s*:/m.test(text));
  const lines = text.split('\n').length;
  if ((document || encoded || requestedType === 'server' || requestedType === 'rewrite') && (resource.content.length > MAX_TEXT || text.length > MAX_TEXT || lines > MAX_LINES)) fail('resource limit exceeded');
  if (document) data=parseYaml(text);
  const type=requestedType ?? detect(text,data);
  const largeRules = type === 'filter' && !document && !encoded;
  const textLimit = largeRules ? MAX_RULE_TEXT : MAX_TEXT;
  const lineLimit = largeRules ? MAX_RULE_LINES : MAX_LINES;
  if (resource.content.length > textLimit || text.length > textLimit || lines > lineLimit) fail('resource limit exceeded');
  validateOptions(type,options);
  let content, notice = null;
  if (type === 'server') {
    const adaptations = new Set();
    const skipped = { count: 0 };
    const status = data ? { text, info: null } : extractStatus(text);
    const nativeNodes = nodeParser.parseNodes(data ?? status.text, { adaptations, skipped, allowDuplicateNames: true });
    content = applyNodeOptions(nativeNodes,options,{ tag: resource.tag });
    nodeParser.validateNative(content, { adaptations });
    // Fixed notices contain no source values and bypass name filtering only
    // after the complete source and all node transformations have succeeded.
    const notes = [];
    if (skipped.count) notes.push('# NetAtlas: skipped ' + skipped.count + ' unsupported Hysteria2 nodes.');
    if (adaptations.has('fp') || adaptations.has('client-fingerprint')) notes.push('# NetAtlas: QX uses its native TLS fingerprint; source fp/client-fingerprint preferences are not preserved.');
    if (adaptations.has('spx')) notes.push('# NetAtlas: QX has no Reality spider-path setting; source spx is omitted.');
    if (adaptations.has('support-x25519mlkem768')) notes.push('# NetAtlas: QX uses its native Reality handshake for X25519MLKEM768 support.');
    if (adaptations.has('tls-verification-domain')) notes.push('# NetAtlas: certificate verification by domain requires Quantumult X 1.7.0 build 938 or later.');
    if (options.tls13 !== undefined) notes.push('# NetAtlas: tls13 is deprecated in QX; its value does not disable native TLS 1.3 support.');
    if (options.uot === '1') notes.push('# NetAtlas: uot=1 selects the legacy ShadowsocksR Python framing; it is not the Xray or sing-box framing.');
    if (notes.length) content = notes.join('\n') + '\n' + content;
    const quotaResource = { ...resource, info: resource.info || status.info };
    const info = options.flow ? quotaDetails(quotaResource, options.flow) : null;
    const noticeResource = options.flow && options.flow !== '1' && info ? { ...quotaResource, info: `upload=0;download=${info.bytes_used};total=${info.bytes_used + info.bytes_remaining};expire=${info.expire_date}` } : quotaResource;
    if (options.info || options.flow) notice = subscriptionNotification(noticeResource,nativeNodes);
    if (skipped.count) {
      const message = '已跳过 ' + skipped.count + ' 条 Quantumult X 不支持的 Hysteria2 节点。';
      notice = notice ? { ...notice, message: notice.message + '\n' + message } : { title: '部分节点不受支持', subtitle: '其余节点已转换', message };
    }
    if (options.relay) content = parseRules(relayRules(content, options.relay), {}, { build });
    const rows = content.split('\n').filter(row => row && !row.startsWith('#')).length;
    if (options.b64) content = encodeBase64Text(content);
    if (typeof content !== 'string' || !content.trim() || content.length > textLimit || content.trimEnd().split('\n').length > lineLimit) fail('invalid or oversized output');
    return { content, notice, info, rows, kind: options.relay ? 'filter' : type };
  }
  else if (type === 'filter') content=options.dst === 'filter' ? parseRewrites(text,options,{parseYaml,build}) : parseRules(text,options,{parseYaml,build});
  else content=parseRewrites(text,options,{parseYaml,build});
  if (typeof content !== 'string' || !content.trim() || content.length > textLimit || content.trimEnd().split('\n').length > lineLimit) fail('invalid or oversized output');
  return { content, notice, rows: content.split('\n').filter(row => row && !row.startsWith('#')).length, kind: type };
}

export function parseResource(resource, environment = {}) {
  return { content: convertResource(resource, environment).content };
}

export function completeResource(resource, done, notify, environment = {}) {
  let result, notice, options;
  try {
    options = optionsFor(resource);
    const imported = resourceImport(resource, options);
    if (imported) { result = imported.result; notice = imported.notice; }
    else {
      const converted = convertResource(resource, environment, options);
      result = { content: converted.content };
      if (converted.info) result.info = converted.info;
      notice = converted.notice;
      if (options.cnt || options.dbg) {
        const message = '类型: ' + converted.kind + '\n输出条目: ' + converted.rows + (options.dbg ? '\n输入长度: ' + resource.content.length + '\n输出长度: ' + converted.content.length : '');
        notice = notice ? { ...notice, message: notice.message + '\n' + message } : { title: '资源转换统计', subtitle: '转换完成', message };
      }
    }
  }
  catch (error) {
    // Only our converters' controlled diagnostic strings may reach the UI.
    // YAML/JSON/host exceptions can contain a whole subscription, so redact them.
    const message=error && typeof error.message === 'string' ? error.message : '';
    result={error:/^(?:Resource parser: |Node conversion failed: |Rule conversion: |Rewrite conversion: |Resource parser options: |Node options failed: |YAML resource: )/.test(message) && message.length < 240 ? message : 'NetAtlas: resource conversion failed; check the format and supported options.'};
  }
  if (options?.userAgentRetry && !(typeof resource.user_agent === 'string' && resource.user_agent.length)) result.retry = { user_agent: 'Shadowrocket/3218' };
  // A disabled or unavailable notification API must not invalidate nodes.
  if (notice && options?.ntf !== '0' && typeof notify === 'function') {
    try {
      if (notice.options) notify(notice.title, notice.subtitle, notice.message, notice.options);
      else notify(notice.title, notice.subtitle, notice.message);
    } catch { /* Optional UI only. */ }
  }
  // Host completion is deliberately outside the catch: a host exception cannot
  // result in a second $done invocation or a partial-success fallback.
  done(result);
  return result;
}
