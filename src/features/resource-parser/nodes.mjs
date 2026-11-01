// Original, side-effect-free node conversion for Quantumult X's JavaScriptCore host.
// Unsupported transport/security options are errors: a subscription is atomic.
import { stripComment } from './comments.mjs';
const TYPES = new Set(['shadowsocks','vmess','vless','trojan','http','socks5','anytls']);
const CIPHERS = new Set(['aes-128-gcm','aes-192-gcm','aes-256-gcm','aes-128-cfb','aes-192-cfb','aes-256-cfb','chacha20','chacha20-ietf','chacha20-poly1305','chacha20-ietf-poly1305','xchacha20-ietf-poly1305','rc4-md5','2022-blake3-aes-128-gcm','2022-blake3-aes-256-gcm','2022-blake3-chacha20-poly1305']);
const NATIVE_KEYS = new Set('method password username ssr-protocol ssr-protocol-param obfs obfs-host obfs-uri over-tls tls-host tls-verification tls-cert-sha256 tls-pubkey-sha256 tls-alpn tls-no-session-ticket tls-no-session-reuse reality-base64-pubkey reality-hex-shortid vless-flow udp-relay udp-over-tcp fast-open aead tls13 server_check_url server_check_user_agent tag'.split(' '));
const BOOL_KEYS = new Set('over-tls tls-verification tls-no-session-ticket tls-no-session-reuse udp-relay fast-open aead tls13'.split(' '));
const error = reason => { throw new Error('Node conversion failed: '+reason); };
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const object = o => o !== null && typeof o === 'object' && !Array.isArray(o);
function text(value, empty=false) {
  if (typeof value !== 'string' && typeof value !== 'number') error('invalid scalar');
  const result=String(value);
  if ((!empty&&!result)||result!==result.trim()||/[\u0000-\u001f\u007f,]/.test(result)) error('unrepresentable field');
  return result;
}
function bool(value) {
  if(value===true||value===1||value==='1'||value==='true')return true;
  if(value===false||value===0||value==='0'||value==='false')return false;
  error('invalid boolean');
}
// Only registered public schema names can reach diagnostics; arbitrary keys and
// all values may contain credentials. Context strings below are internal literals.
const REALITY_MLKEM_HINT = 'support-x25519mlkem768';
const DIAGNOSTIC_FIELDS = new Set('support-x25519mlkem768 fp spx fingerprint client-fingerprint utls ech mux multiplex packetEncoding packet-encoding certificate certificate_path certificate_public_key_sha256 certificates headers Host host path mode enabled server_name public_key short_id public-key short-id v ps add aid scy net allowInsecure encryption headerType peer pbk sid insecure udpport uot obfsparam protoparam group encrypt-method obfs-name tls-name ws ws-path ws-headers vmess-aead alterid'.split(' '));
function keys(o, allowed, context='node options') {
  for(const k of Object.keys(o))if(!(allowed instanceof Set?allowed.has(k):allowed.includes(k))){
    const name=NATIVE_KEYS.has(k)||OBJECT_KEYS.includes(k)||DIAGNOSTIC_FIELDS.has(k)?k:'[unrecognized name]';
    error('unsupported field in '+context+': '+name);
  }
}
// These source-only client preferences have no native QX field. Values are
// bounded and discarded on a copy; only fixed names become internal metadata.
const NATIVE_PREFERENCES = { fp: 128, spx: 2048, 'client-fingerprint': 128 };
function nativePreferences(input, fields) {
  const source={...input},adaptations=[];
  for(const key of fields)if(own(source,key)){
    const value=source[key];
    if(typeof value!=='string'||value.length>NATIVE_PREFERENCES[key]||/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(value))error('invalid QX native preference: '+key);
    delete source[key];adaptations.push(key);
  }
  return {source,adaptations};
}
// Current QX Reality natively uses a handshake with X25519MLKEM768 support.
// This true-only source hint confirms that capability; it is not a QX switch.
function realityMlkemCapability(input, enabled, uri=false) {
  const adaptations=[];
  if(!input||!own(input,REALITY_MLKEM_HINT))return {source:input,adaptations};
  if(!enabled)error(REALITY_MLKEM_HINT+' requires Reality');
  const value=input[REALITY_MLKEM_HINT];
  if(!(value==='true'||value==='1'||!uri&&(value===true||value===1)))error('unsupported value for '+REALITY_MLKEM_HINT+'; QX native Reality requires true');
  const source={...input};delete source[REALITY_MLKEM_HINT];adaptations.push(REALITY_MLKEM_HINT);
  return {source,adaptations};
}
function aliases(o,groups){for(const group of groups)if(group.filter(key=>own(o,key)).length>1)error('duplicate alias options');}
function strictJson(input){
  let result;try{result=JSON.parse(input);}catch{error('invalid JSON document');}
  let p=0,count=0;
  const space=()=>{while(/[\t\r\n ]/.test(input[p]||'!'))p++;};
  function string(){const start=p++;while(p<input.length){if(input[p++]==='"')return JSON.parse(input.slice(start,p));if(input[p-1]==='\\')p++;}error('invalid JSON document');}
  function value(depth){
    space();if(depth>32||++count>100000)error('JSON resource limit exceeded');const c=input[p];
    if(c==='{'){
      p++;space();const seen=new Set();if(input[p]==='}'){p++;return;}
      while(true){space();const key=string();if(seen.has(key)||['__proto__','constructor','prototype'].includes(key))error('duplicate or unsafe JSON key');seen.add(key);space();p++;value(depth+1);space();if(input[p++]==='}')return;}
    }else if(c==='['){p++;space();if(input[p]===']'){p++;return;}while(true){value(depth+1);space();if(input[p++]===']')return;}}
    else if(c==='"')string();else{while(p<input.length&&!/[\t\r\n ,}\]]/.test(input[p]))p++;}
  }
  value(0);space();if(p!==input.length)error('invalid JSON document');return result;
}
function port(value) { if(!/^\d+$/.test(String(value))||+value<1||+value>65535)error('invalid port');return +value; }
function host(value) {
  const h=text(value).replace(/^\[([^\]]+)\]$/,'$1');
  if(!/^[a-zA-Z0-9_.:-]+$/.test(h)||h.includes('..')||h.startsWith('.')||h.endsWith('.'))error('invalid server');
  if(h.includes(':')){
    if(!/^[0-9a-fA-F:.]+$/.test(h)||h.includes(':::')||!h.includes('::')&&(h.startsWith(':')||h.endsWith(':')))error('invalid server');let address=h;
    if(h.includes('.')){const p=h.lastIndexOf(':'),v4=h.slice(p+1);if(!/^\d+\.\d+\.\d+\.\d+$/.test(v4)||v4.split('.').some(v=>+v>255))error('invalid IPv6');address=h.slice(0,p)+':0:0';}
    const halves=address.split('::');if(halves.length>2)error('invalid IPv6');const groups=address.split(':').filter(Boolean);if(groups.some(v=>!/^[0-9a-fA-F]{1,4}$/.test(v))||(halves.length===1?groups.length!==8:groups.length>=8))error('invalid IPv6');
  }else if(/^\d+\.\d+\.\d+\.\d+$/.test(h)&&h.split('.').some(v=>+v>255))error('invalid IPv4');
  return h;
}
function endpoint(value) {
  const match=/^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(value);if(!match)error('invalid endpoint');return {host:host(match[1]),port:port(match[2])};
}
function csv(value) {
  const out=[];let item='',quote=false;
  for(let i=0;i<value.length;i++){
    const c=value[i];
    if(c==='"'){if(quote&&value[i+1]==='"'){item+='"';i++;}else quote=!quote;}
    else if(c===','&&!quote){out.push(item.trim());item='';}else item+=c;
  }
  if(quote)error('unterminated quoted field');out.push(item.trim());return out;
}
function assignment(fields) {
  const out=Object.create(null);
  for(const field of fields){const p=field.indexOf('=');if(p<1)error('invalid option');const key=field.slice(0,p).trim().toLowerCase();if(own(out,key))error('duplicate option');out[key]=field.slice(p+1).trim();}
  return out;
}
function decode(value) {try{return decodeURIComponent(value);}catch{error('invalid percent encoding');}}
export function decodeBase64Text(input) {
  if(typeof input!=='string')error('invalid base64');
  const raw=input.replace(/\s/g,'').replace(/-/g,'+').replace(/_/g,'/');
  if(!raw||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)||raw.length%4===1||(/=/.test(raw)&&raw.length%4!==0))error('invalid base64');
  const clean=raw.replace(/=+$/,'');if(clean.length%4===1)error('invalid base64');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let value=0,bits=0,encoded='';
  for(const c of clean){value=(value<<6)|alphabet.indexOf(c);bits+=6;if(bits>=8){bits-=8;encoded+='%'+((value>>>bits)&255).toString(16).padStart(2,'0');}}
  if(bits&&(value&((1<<bits)-1)))error('invalid base64');
  try{return decodeURIComponent(encoded);}catch{error('invalid UTF-8');}
}
export function looksLikeEncodedSubscription(input) {
  if(typeof input!=='string'||input.includes('://')||input.length>4194304)return false;
  try {return /(?:^|\n)\s*(?:[a-z][a-z0-9+.-]*:\/\/|(?:shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=|\[Proxy\])|^\s*(?:\{|\[|proxies:)/i.test(decodeBase64Text(input));}catch{return false;}
}
function uri(input) {
  const match=/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(input);if(!match)error('invalid URI');
  let rest=match[2],tag='',query=Object.create(null);const hash=rest.indexOf('#');if(hash>=0){tag=decode(rest.slice(hash+1));rest=rest.slice(0,hash);}
  const qm=rest.indexOf('?');if(qm>=0){for(const pair of rest.slice(qm+1).split('&')){if(!pair)continue;const p=pair.indexOf('=');const key=decode(p<0?pair:pair.slice(0,p));if(own(query,key))error('duplicate query option');query[key]=decode(p<0?'':pair.slice(p+1));}rest=rest.slice(0,qm);}
  return {scheme:match[1].toLowerCase(),authority:rest.replace(/\/$/,''),query,tag};
}
function authAddress(authority,defaultPort) {
  const p=authority.lastIndexOf('@'),credentials=p<0?'':authority.slice(0,p),address=p<0?authority:authority.slice(p+1);
  let ep;if(/^\[[^\]]+\]$/.test(address)||!address.includes(':'))ep={host:host(address),port:defaultPort};else ep=endpoint(address);
  if(!ep.port)error('missing port');return {...ep,credentials};
}
function node(type, address, name) {if(!TYPES.has(type))error('unsupported protocol');return {type,host:host(address.host),port:port(address.port),fields:{},name};}
function put(n,k,v) {if(v!==undefined&&v!==null&&v!=='')n.fields[k]=text(v);}
function putBool(n,k,v) {if(v!==undefined)n.fields[k]=String(bool(v));}
function uuid(value) {const v=text(value);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))error('invalid UUID');return v;}
function alpn(value) {
  const list=Array.isArray(value)?value:String(value).split(',');let out='';
  for(const item of list){const v=text(item);if(v.length>255||/[^\x21-\x7e]/.test(v))error('invalid ALPN');out+=v.length.toString(16).padStart(2,'0');for(let i=0;i<v.length;i++)out+=v.charCodeAt(i).toString(16).padStart(2,'0');}return out;
}
function tlsTransport(n,options={}) {
  const network=options.network||'tcp',security=options.security||'none';
  if(!['tcp','ws','http'].includes(network)||!['none','tls','reality'].includes(security))error('unsupported transport');
  const encrypted=security!=='none';if((n.type==='trojan'||n.type==='anytls')&&!encrypted)error('TLS required');
  if(n.type==='anytls'&&network!=='tcp')error('unsupported transport');
  if(network==='ws'&&!['vmess','vless','trojan'].includes(n.type))error('unsupported transport');
  if(options.headers){keys(options.headers,['Host','host'],'WebSocket headers');if(own(options.headers,'Host')&&own(options.headers,'host'))error('duplicate Host header');}
  const headerHost=options.headers&&(options.headers.Host||options.headers.host);
  if(options.host!==undefined&&headerHost!==undefined)error('duplicate websocket Host options');
  const wsHost=options.host||headerHost;
  if(network==='http'){
    if(encrypted||!['vmess','vless'].includes(n.type)||options.flow||options.sni||options.insecure!==undefined||options.alpn||options.publicKey||options.shortId)error('unsupported HTTP-header transport');
    put(n,'obfs','http');put(n,'obfs-host',wsHost);put(n,'obfs-uri',options.path||'/');
  }else if(network==='ws'){
    if(options.flow)error('unsupported transport');
    // Each importer supplies its source-specific defaults before this check.
    // QX obfs-host controls both; either mismatch would change the connection.
    if(encrypted&&(wsHost||n.host)!==(options.sni||n.host))error('separate TLS and websocket names unsupported');
    if(n.type==='trojan'&&!encrypted)error('TLS required');
    put(n,'obfs',encrypted?'wss':'ws');put(n,'obfs-host',wsHost||options.sni);put(n,'obfs-uri',options.path||'/');
  }else{
    if(options.path||wsHost)error('unused transport option');
    if(encrypted){if(n.type==='vmess'||n.type==='vless'){put(n,'obfs','over-tls');put(n,'obfs-host',options.sni);}else{put(n,'over-tls','true');put(n,'tls-host',options.sni);}}
  }
  if(encrypted){put(n,'tls-verification',options.insecure===undefined?'true':String(!bool(options.insecure)));if(options.alpn)put(n,'tls-alpn',alpn(options.alpn));}
  else if(options.sni||options.insecure!==undefined||options.alpn||options.publicKey||options.shortId)error('TLS option without TLS');
  if(security==='reality'){
    if(!/^[A-Za-z0-9_-]{43}=?$/.test(options.publicKey||''))error('invalid Reality key');
    put(n,'reality-base64-pubkey',options.publicKey);if(options.shortId!==undefined&&options.shortId!==''){if(!/^(?:[0-9a-fA-F]{2}){1,8}$/.test(options.shortId))error('invalid Reality short ID');put(n,'reality-hex-shortid',options.shortId);}
  }else if(options.publicKey||options.shortId)error('Reality option without Reality');
  if(options.flow){if(n.type!=='vless'||options.flow!=='xtls-rprx-vision'||!encrypted||network!=='tcp')error('unsupported flow');put(n,'vless-flow',options.flow);}
}
function pluginParts(input) {
  const result=[];let value='';
  for(let i=0;i<input.length;i++){
    if(input[i]==='\\'){if(i+1===input.length||!':;=\\'.includes(input[i+1]))error('invalid plugin escape');value+=input[++i];}
    else if(input[i]===';'){result.push(value);value='';}else value+=input[i];
  }result.push(value);return result;
}
function ssPluginValues(n,name,values,clash=false) {
  if(name==='obfs-local'||name==='simple-obfs'){
    keys(values,['obfs','obfs-host'],'SS plugin options');if(!['http','tls'].includes(values.obfs))error('unsupported plugin mode');put(n,'obfs',values.obfs);put(n,'obfs-host',values['obfs-host']);
  }else if(name==='v2ray-plugin'){
    keys(values,['mode','tls','host','path','mux'],'SS plugin options');if(values.mode&&values.mode!=='websocket')error('unsupported plugin mode');if(values.mux===undefined||bool(values.mux))error('plugin multiplexing unsupported');
    const encrypted=values.tls!==undefined&&bool(values.tls);
    if(!clash&&values.tls!==undefined&&!encrypted)error('conflicting plugin TLS flag');
    // Clash/Mihomo's structured plugin defaults differ from SIP003 v2ray-plugin.
    put(n,'obfs',encrypted?'wss':'ws');put(n,'obfs-host',values.host||(clash?'bing.com':'cloudfront.com'));put(n,'obfs-uri',values.path||'/');if(encrypted)put(n,'tls-verification','true');
  }else error('unsupported plugin');
}
function ssPlugin(n,plugin,options) {
  if(!plugin){if(options)error('plugin options without plugin');return;}
  const pieces=pluginParts(String(plugin));let name=pieces.shift(),values=Object.create(null);
  for(const part of [...pieces,...(options?pluginParts(String(options)):[])]){if(!part)continue;const p=part.indexOf('='),key=p<0?part:part.slice(0,p);if(own(values,key))error('duplicate plugin option');values[key]=p<0?'true':part.slice(p+1);}
  ssPluginValues(n,name,values);
}
function ssPluginObject(n,plugin,options) {
  const values=Object.create(null);
  for(const key of Object.keys(options)){
    const name=plugin==='obfs'?(key==='mode'?'obfs':key==='host'?'obfs-host':key):key;
    if(own(values,name))error('duplicate plugin option');
    // Object values are literal fields, never a SIP003 option string.
    values[name]=['tls','mux'].includes(key)?bool(options[key]):text(options[key],true);
  }
  ssPluginValues(n,plugin==='obfs'?'obfs-local':plugin,values,true);
}
function parseSs(u) {
  keys(u.query,['plugin','udp','tfo'],'SS URI');let authority=u.authority;
  // Legacy whole-Base64 credentials are already plaintext, unlike raw SIP002 userinfo.
  // https://shadowsocks.org/doc/configs.html
  const legacy=!authority.includes('@');if(legacy)authority=decodeBase64Text(authority);
  const a=authAddress(authority),auth=legacy?a.credentials:a.credentials.includes(':')?decode(a.credentials):decodeBase64Text(a.credentials),p=auth.indexOf(':');if(p<1)error('invalid credentials');
  const n=node('shadowsocks',a,u.tag);put(n,'method',auth.slice(0,p));put(n,'password',auth.slice(p+1));ssPlugin(n,u.query.plugin);putBool(n,'udp-relay',u.query.udp);putBool(n,'fast-open',u.query.tfo);return n;
}
function parseSsr(u) {
  if(Object.keys(u.query).length)error('unsupported SSR URI');let body=decodeBase64Text(u.authority),p=body.indexOf('/?'),q=Object.create(null);
  if(p>=0){const options=body.slice(p+2);body=body.slice(0,p);for(const pair of options.split('&')){const at=pair.indexOf('=');if(at<1)error('invalid SSR option');const key=pair.slice(0,at);if(own(q,key))error('duplicate SSR option');q[key]=decode(pair.slice(at+1));}}
  keys(q,['remarks','obfsparam','protoparam','group','udpport','uot'],'SSR URI');if(q.udpport||q.uot)error('unsupported SSR transport');
  const m=/^(.*):(\d+):([^:]+):([^:]+):([^:]+):([^:]*)$/.exec(body);if(!m)error('invalid SSR node');
  const n=node('shadowsocks',{host:m[1],port:m[2]},q.remarks?decodeBase64Text(q.remarks):u.tag);put(n,'method',m[4]);put(n,'password',decodeBase64Text(m[6]));
  if(!['origin','auth_sha1_v4','auth_aes128_md5','auth_aes128_sha1','auth_chain_a','auth_chain_b'].includes(m[3]))error('unsupported SSR protocol');
  if(m[3]!=='origin')put(n,'ssr-protocol',m[3]);if(q.protoparam)put(n,'ssr-protocol-param',decodeBase64Text(q.protoparam));
  if(!['plain','tls1.2_ticket_auth','tls1.2_ticket_fastauth'].includes(m[5]))error('unsupported SSR obfuscation');
  if(m[5]!=='plain')put(n,'obfs',m[5]);if(q.obfsparam)put(n,'obfs-host',decodeBase64Text(q.obfsparam));return n;
}
function parseVmess(u) {
  if(Object.keys(u.query).length)error('unsupported VMess URI');const preferences=nativePreferences(strictJson(decodeBase64Text(u.authority)),['fp']),o=preferences.source;
  keys(o,['v','ps','add','port','id','aid','scy','net','type','host','path','tls','sni','alpn','allowInsecure','skip-cert-verify'],'VMess URI');
  aliases(o,[['allowInsecure','skip-cert-verify']]);
  if(o.v!==undefined&&String(o.v)!=='2')error('unsupported VMess version');if(o.net&&!['tcp','ws'].includes(o.net))error('unsupported transport');if(o.type&&!['none','http'].includes(o.type))error('unsupported TCP header');if(o.type==='http'&&o.net&&o.net!=='tcp')error('unsupported TCP header');
  const n=node('vmess',{host:o.add,port:o.port},o.ps||u.tag);put(n,'password',uuid(o.id));const method=o.scy||'auto';put(n,'method',method==='auto'?'chacha20-poly1305':method==='chacha20-ietf-poly1305'?'chacha20-poly1305':method);
  if(o.aid!==undefined){if(!/^\d+$/.test(String(o.aid)))error('invalid alter ID');if(+o.aid!==0)error('legacy VMess alter ID unsupported');}
  tlsTransport(n,{network:o.type==='http'?'http':o.net||'tcp',security:o.tls==='tls'?'tls':o.tls?o.tls:'none',host:o.host,path:o.path,sni:o.sni,alpn:o.alpn,insecure:o.allowInsecure??o['skip-cert-verify']});n.adaptations=preferences.adaptations;return n;
}
function parseGenericUri(u) {
  const type=({https:'http',socks:'socks5',socks5s:'socks5'})[u.scheme]||u.scheme;if(!TYPES.has(type))error('unsupported protocol');
  const preferences=nativePreferences(u.query,['fp','spx']);
  const capability=realityMlkemCapability(preferences.source,u.query.security==='reality',true);u={...u,query:capability.source};
  keys(u.query,['encryption','security','type','headerType','host','path','sni','peer','pbk','sid','flow','alpn','allowInsecure','insecure','udp','tfo'],'URI options');
  aliases(u.query,[['sni','peer'],['allowInsecure','insecure']]);
  if(u.query.type&&!['tcp','ws'].includes(u.query.type))error('unsupported transport');
  if(u.query.headerType&&!['none','http'].includes(u.query.headerType))error('unsupported TCP header');if(u.query.headerType==='http'&&u.query.type&&u.query.type!=='tcp')error('unsupported TCP header');
  if(u.query.encryption&&!(type==='vless'&&u.query.encryption==='none'))error('unsupported encryption');
  if(u.query.sni&&u.query.peer&&u.query.sni!==u.query.peer)error('conflicting TLS names');if(u.query.allowInsecure!==undefined&&u.query.insecure!==undefined)error('duplicate TLS option');
  const defaults={http:u.scheme==='https'?443:80,socks5:u.scheme==='socks5s'?443:1080,trojan:443,vless:443,anytls:443};
  const a=authAddress(u.authority,defaults[type]),n=node(type,a,u.tag);
  if(type==='vless'){put(n,'method','none');put(n,'password',uuid(decode(a.credentials)));}
  else if(type==='trojan'||type==='anytls')put(n,'password',decode(a.credentials));
  else if(a.credentials){const p=a.credentials.indexOf(':');if(p<0)error('invalid credentials');put(n,'username',decode(a.credentials.slice(0,p)));put(n,'password',decode(a.credentials.slice(p+1)));}
  const defaultTls=['trojan','anytls','https','socks5s'].includes(u.scheme);
  if(defaultTls&&u.query.security==='none')error('TLS required by URI scheme');
  tlsTransport(n,{network:u.query.headerType==='http'?'http':u.query.type||'tcp',security:u.query.security||(defaultTls?'tls':'none'),host:u.query.host,path:u.query.path,sni:u.query.sni||u.query.peer,publicKey:u.query.pbk,shortId:u.query.sid,flow:u.query.flow,alpn:u.query.alpn,insecure:u.query.allowInsecure??u.query.insecure});
  putBool(n,'udp-relay',u.query.udp);putBool(n,'fast-open',u.query.tfo);n.adaptations=preferences.adaptations.concat(capability.adaptations);return n;
}
function fromUri(line) {const u=uri(line);return u.scheme==='ss'?parseSs(u):u.scheme==='ssr'?parseSsr(u):u.scheme==='vmess'?parseVmess(u):parseGenericUri(u);}
const OBJECT_KEYS='name tag type server port server_port password username uuid cipher method remarks plugin plugin-opts plugin_opts udp udp-relay tfo fast-open tls servername sni skip-cert-verify network ws-opts flow reality-opts alpn alterId alter-id security version id transport tcp-fast-open udp_over_tcp protocol protocol-param obfs obfs-param'.split(' ');
function fromObject(o,context='node object') {
  if(!object(o))error('invalid node object');
  // SIP008 omits type; sing-box and Clash share their basic server fields.
  if(object(o.tls))return fromSingbox(o);
  const preferences=context==='SIP008 node'?{source:o,adaptations:[]}:nativePreferences(o,['client-fingerprint']);o=preferences.source;
  keys(o,OBJECT_KEYS,context);const type=({ss:'shadowsocks',ssr:'shadowsocks',https:'http',socks:'socks5'})[o.type]||o.type||(o.method?'shadowsocks':undefined);
  aliases(o,[['name','tag','remarks'],['port','server_port'],['uuid','id'],['cipher','method','security'],['plugin-opts','plugin_opts'],['udp','udp-relay'],['tfo','fast-open','tcp-fast-open'],['servername','sni'],['alterId','alter-id']]);
  const common=['name','tag','type','server','port','server_port','remarks','udp','udp-relay','tfo','fast-open','tcp-fast-open','udp_over_tcp'];
  const protocolFields=type==='shadowsocks'?['cipher','method','password',...(o.type==='ssr'?['protocol','protocol-param','obfs','obfs-param']:['plugin','plugin-opts','plugin_opts'])]:['tls','servername','sni','skip-cert-verify','network','ws-opts','alpn',...(type==='vmess'?['uuid','id','cipher','security','alterId','alter-id','reality-opts']:type==='vless'?['uuid','id','flow','reality-opts']:['username','password'])];
  keys(o,[...common,...protocolFields],context);
  const n=node(type,{host:o.server,port:o.port??o.server_port},o.name||o.tag||o.remarks);let capabilityAdaptations=[];
  if(type==='shadowsocks'){
    put(n,'method',o.cipher||o.method);put(n,'password',o.password);
    if(o.type==='ssr'){
      put(n,'ssr-protocol',o.protocol);put(n,'ssr-protocol-param',o['protocol-param']);if(o.obfs&&o.obfs!=='plain')put(n,'obfs',o.obfs);put(n,'obfs-host',o['obfs-param']);
    }else if(object(o['plugin-opts']))ssPluginObject(n,o.plugin,o['plugin-opts']);
    else ssPlugin(n,o.plugin,o.plugin_opts||o['plugin-opts']);
    for(const k of ['tls','network','ws-opts','servername','sni','flow','reality-opts','alpn','skip-cert-verify'])if(own(o,k))error('unsupported Shadowsocks field');
  }else{
    if(type==='vmess'||type==='vless'){put(n,'password',uuid(o.uuid||o.id));const method=o.cipher||o.security||'auto';put(n,'method',type==='vless'?'none':method==='auto'?'chacha20-poly1305':method==='chacha20-ietf-poly1305'?'chacha20-poly1305':method);if(+(o.alterId??o['alter-id']??0)!==0)error('legacy VMess alter ID unsupported');}
    else {put(n,'username',o.username);put(n,'password',o.password);}
    const ws=o['ws-opts']||{};keys(ws,['path','headers'],context+' WebSocket');if(o.network&&!['tcp','ws'].includes(o.network))error('unsupported transport');
    const enabled=o.tls===undefined?(type==='trojan'||type==='anytls'||o.type==='https'):bool(o.tls);
    const capability=context==='SIP008 node'?{source:o['reality-opts'],adaptations:[]}:realityMlkemCapability(o['reality-opts'],enabled),reality=capability.source;capabilityAdaptations=capability.adaptations;
    if(reality)keys(reality,['public-key','short-id'],context+' Reality');
    if(o.type==='https'&&!enabled)error('TLS required by protocol');
    if(reality&&!enabled)error('Reality requires enabled TLS');
    let sni=o.servername||o.sni,protocols=o.alpn;
    if(enabled&&o.network==='ws'&&['vmess','vless'].includes(type)){
      if(reality)error('Reality over Clash websocket unsupported');
      // Mihomo WSS defaults SNI to Host and fixes ALPN to HTTP/1.1.
      // https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/vmess.go#L183-L218
      // https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/vless.go#L167-L197
      if(o.alpn)alpn(o.alpn);sni=sni||(ws.headers&&(ws.headers.Host||ws.headers.host));protocols=['http/1.1'];
    }
    tlsTransport(n,{network:o.network||'tcp',security:reality?'reality':enabled?'tls':'none',sni,headers:ws.headers,path:ws.path,flow:o.flow,alpn:protocols,insecure:o['skip-cert-verify'],publicKey:reality&&reality['public-key'],shortId:reality&&reality['short-id']});
    for(const k of ['plugin','plugin_opts','plugin-opts','method'])if(own(o,k))error('unsupported protocol field');
  }
  putBool(n,'udp-relay',o.udp??o['udp-relay']);putBool(n,'fast-open',o.tfo??o['fast-open']??o['tcp-fast-open']);if(o.udp_over_tcp!==undefined)putBool(n,'udp-over-tcp',o.udp_over_tcp);n.adaptations=preferences.adaptations.concat(capabilityAdaptations);return n;
}
function fromSip008(o) {
  if(!object(o))error('invalid SIP008 server');
  if(!own(o,'id'))return fromObject(o,'SIP008 node');
  keys(o,['id','remarks','server','server_port','method','password','plugin','plugin_opts'],'SIP008 node');
  // SIP008 id identifies updates. Only this envelope can remove it as metadata;
  // VMess and other formats still validate id as a protocol-specific field.
  uuid(o.id);
  const connection={...o};delete connection.id;
  return fromObject(connection,'SIP008 node');
}
function fromSingbox(o) {
  keys(o,['type','tag','server','server_port','method','password','uuid','security','alter_id','username','tls','transport','tcp_fast_open','udp_over_tcp','multiplex','flow','version'],'sing-box node');
  if(o.multiplex)error('multiplexing unsupported');
  if(o.tls!==undefined&&!object(o.tls))error('invalid TLS object');
  const tls=o.tls||{};keys(tls,['enabled','server_name','insecure','alpn','reality'],'sing-box TLS');if(tls.reality)keys(tls.reality,['enabled','public_key','short_id'],'sing-box Reality');
  const tlsEnabled=bool(tls.enabled??false),realityEnabled=tls.reality?bool(tls.reality.enabled??false):false;
  if(realityEnabled&&!tlsEnabled)error('Reality requires enabled TLS');
  const tr=o.transport||{};keys(tr,['type','path','headers'],'sing-box transport');const n=node(({shadowsocks:'shadowsocks',socks:'socks5'})[o.type]||o.type,{host:o.server,port:o.server_port},o.tag);
  if(tr.type&&tr.type!=='ws')error('unsupported transport');
  keys(o,['type','tag','server','server_port','tcp_fast_open','udp_over_tcp',...(n.type==='shadowsocks'?['method','password']:['tls','transport',...(n.type==='vless'?['uuid','flow']:n.type==='vmess'?['uuid','security','alter_id']:['username','password',...(n.type==='socks5'?['version']:[])])])],'sing-box node');
  if(o.version!==undefined&&(n.type!=='socks5'||String(o.version)!=='5'))error('unsupported SOCKS version');
  if(n.type==='shadowsocks'){
    keys(o,['type','tag','server','server_port','method','password','tcp_fast_open','udp_over_tcp'],'sing-box node');put(n,'method',o.method);put(n,'password',o.password);
  }else{
    if(n.type==='vless'||n.type==='vmess'){put(n,'password',uuid(o.uuid));put(n,'method',n.type==='vless'?'none':(o.security==='auto'||!o.security?'chacha20-poly1305':o.security));if(o.alter_id)error('legacy VMess alter ID unsupported');}else{put(n,'username',o.username);put(n,'password',o.password);}
    tlsTransport(n,{network:tr.type||'tcp',security:realityEnabled?'reality':tlsEnabled?'tls':'none',sni:tls.server_name,insecure:tls.insecure,alpn:tls.alpn,path:tr.path,headers:tr.headers,flow:o.flow,publicKey:tls.reality&&tls.reality.public_key,shortId:tls.reality&&tls.reality.short_id});
  }
  putBool(n,'fast-open',o.tcp_fast_open);
  // sing-box's boolean shorthand uses SagerNet UoT v2; QX true is a different protocol.
  // https://sing-box.sagernet.org/configuration/shared/udp-over-tcp/
  if(object(o.udp_over_tcp)){keys(o.udp_over_tcp,['enabled','version'],'sing-box UoT');if(bool(o.udp_over_tcp.enabled??false)){const v=o.udp_over_tcp.version??2;if(![1,2].includes(v))error('unsupported UDP mode');put(n,'udp-over-tcp','sp.v'+v);}else put(n,'udp-over-tcp','false');}
  else if(o.udp_over_tcp!==undefined)put(n,'udp-over-tcp',bool(o.udp_over_tcp)?'sp.v2':'false');return n;
}
function fromProxy(line) {
  const p=line.indexOf('=');if(p<1)error('invalid proxy line');const name=line.slice(0,p).trim(),parts=csv(line.slice(p+1)),typeName=parts.shift().toLowerCase();
  const type=({ss:'shadowsocks',shadowsocks:'shadowsocks',shadowsocksr:'shadowsocks',https:'http',socks:'socks5','socks5-tls':'socks5'})[typeName]||typeName;
  const n=node(type,{host:parts.shift(),port:parts.shift()},name),pos=[];while(parts.length&&!parts[0].includes('='))pos.push(parts.shift());const o=assignment(parts);
  keys(o,['udp-relay','udp','fast-open','tfo',...(type==='shadowsocks'?['encrypt-method','password',...(typeName==='shadowsocksr'?['obfs','obfs-param','protocol','protocol-param']:['obfs','obfs-host','obfs-name'])]:['username','password','tls','over-tls','sni','tls-name','skip-cert-verify','ws','ws-path','ws-headers','transport','path','host','tls13',...(type==='vmess'?['vmess-aead','aead','encrypt-method','alterid']:[])])],'Surge/Loon node');
  aliases(o,[['udp-relay','udp'],['fast-open','tfo'],['tls','over-tls'],['sni','tls-name'],['ws','transport'],['path','ws-path'],['aead','vmess-aead'],['obfs','obfs-name']]);
  function credential(index,names){if(pos[index]!==undefined&&names.some(key=>own(o,key)))error('duplicate positional and named options');aliases(o,[names]);return pos[index]!==undefined?pos[index]:o[names.find(key=>own(o,key))];}
  if(type==='shadowsocks'){
    put(n,'method',credential(0,['encrypt-method']));put(n,'password',credential(1,['password']));
    if(typeName==='shadowsocksr'){put(n,'ssr-protocol',o.protocol);put(n,'ssr-protocol-param',o['protocol-param']);if(o.obfs&&o.obfs!=='plain')put(n,'obfs',o.obfs);put(n,'obfs-host',o['obfs-param']);}
    else {put(n,'obfs',o['obfs-name']||o.obfs);put(n,'obfs-host',o['obfs-host']);}
    if(pos.length>2)error('unexpected positional option');
  }else{
    if(type==='vmess'){
      const loon=pos.length>0,method=credential(0,['encrypt-method'])||(loon?'auto':'aes-128-gcm');put(n,'method',method==='auto'?'chacha20-poly1305':method==='chacha20-ietf-poly1305'?'chacha20-poly1305':method);put(n,'password',uuid(credential(1,['username','password'])));
      if(o.alterid!==undefined){if(!/^0$/.test(o.alterid))error('legacy VMess alter ID unsupported');if(o.aead!==undefined||o['vmess-aead']!==undefined)error('duplicate handshake options');if(!loon)error('unsupported Surge alter ID');}
      putBool(n,'aead',o.aead??o['vmess-aead']??loon);
    }
    else if(type==='vless'){put(n,'method','none');put(n,'password',uuid(credential(0,['username','password'])));}
    else if(type==='trojan'||type==='anytls'){if(o.username!==undefined)error('unsupported username');put(n,'password',credential(0,['password']));}
    else {put(n,'username',credential(0,['username']));put(n,'password',credential(1,['password']));}
    let headers;if(o['ws-headers']){const h=o['ws-headers'];if(!/^Host:/i.test(h)||h.includes('|'))error('unsupported websocket headers');headers={Host:h.slice(5)};}
    const encrypted=o['over-tls']!==undefined?bool(o['over-tls']):o.tls!==undefined?bool(o.tls):['trojan','anytls'].includes(type)||['https','socks5-tls'].includes(typeName);
    if(['https','socks5-tls'].includes(typeName)&&!encrypted)error('TLS required by protocol');
    tlsTransport(n,{network:o.transport||(o.ws!==undefined&&bool(o.ws)?'ws':'tcp'),security:encrypted?'tls':'none',path:o.path||o['ws-path'],host:o.host,headers,sni:o.sni||o['tls-name'],insecure:o['skip-cert-verify']});
    const maxPos=type==='vmess'||type==='http'||type==='socks5'?2:1;if(pos.filter(Boolean).length>maxPos)error('unexpected positional option');
  }
  putBool(n,'udp-relay',o['udp-relay']??o.udp);putBool(n,'fast-open',o['fast-open']??o.tfo);if(o.tls13!==undefined)putBool(n,'tls13',o.tls13);return n;
}
function validate(n,index) {
  const f=n.fields;
  keys(f,NATIVE_KEYS,'QX native');
  for(const k of Object.keys(f)){text(f[k]);if(BOOL_KEYS.has(k)&&!['true','false'].includes(f[k]))error('invalid native boolean');}
  if(n.type==='shadowsocks'){if(!CIPHERS.has(f.method)||!f.password)error('unsupported cipher or credentials');}
  if(n.type==='vmess'||n.type==='vless'){uuid(f.password);if(n.type==='vless'&&f.method!=='none')error('unsupported VLESS method');if(n.type==='vmess'&&!['none','aes-128-gcm','chacha20-poly1305','chacha20-ietf-poly1305'].includes(f.method))error('unsupported VMess method');}
  if(['trojan','anytls'].includes(n.type)&&!f.password)error('missing password');
  if(f.obfs&&!['http','tls','ws','wss','over-tls','tls1.2_ticket_auth','tls1.2_ticket_fastauth','vmess-http','shadowsocks-http'].includes(f.obfs))error('unsupported obfuscation');
  if(f.obfs==='vmess-http'&&n.type!=='shadowsocks'||f.obfs==='shadowsocks-http'&&n.type!=='vmess')error('unsupported native obfuscation');
  if(['http','socks5','anytls'].includes(n.type)&&f.obfs)error('unsupported native transport');
  if(['vmess','vless'].includes(n.type)&&(f['over-tls']||f['tls-host']))error('conflicting native TLS fields');
  if(n.type==='trojan'&&f.obfs&&f.obfs!=='wss')error('unsupported Trojan transport');
  if(f.obfs==='wss'&&n.type==='trojan'&&(f['over-tls']||f['tls-host']))error('conflicting native TLS fields');
  if((f['ssr-protocol']||f['ssr-protocol-param']||f.obfs&&f.obfs.startsWith('tls1.2_'))&&n.type!=='shadowsocks')error('unsupported SSR fields');
  if(f['ssr-protocol']&&!['origin','auth_sha1_v4','auth_aes128_md5','auth_aes128_sha1','auth_chain_a','auth_chain_b'].includes(f['ssr-protocol']))error('unsupported SSR protocol');
  if(f['udp-over-tcp']&&!['true','false','sp.v1','sp.v2'].includes(f['udp-over-tcp']))error('unsupported UDP mode');
  if(f['tls-alpn']){
    const value=f['tls-alpn'].replace(/:/g,'');if(!/^(?:[0-9a-fA-F]{2})+$/.test(value)||f['tls-alpn'].includes(':')&&!/^[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2})*$/.test(f['tls-alpn']))error('invalid native ALPN');
    let p=0;while(p<value.length){const length=parseInt(value.slice(p,p+2),16);if(!length)error('invalid native ALPN');p+=2+length*2;}if(p!==value.length)error('invalid native ALPN');
  }
  for(const key of ['tls-cert-sha256','tls-pubkey-sha256'])if(f[key]&&!/^[0-9a-fA-F]{64}$/.test(f[key]))error('invalid TLS pin');
  if(f['reality-base64-pubkey']&&!/^[A-Za-z0-9_-]{43}=?$/.test(f['reality-base64-pubkey']))error('invalid Reality key');
  if(f['reality-hex-shortid']&&!/^(?:[0-9a-fA-F]{2}){1,8}$/.test(f['reality-hex-shortid']))error('invalid Reality short ID');
  if(f['vless-flow']&&(n.type!=='vless'||f['vless-flow']!=='xtls-rprx-vision'))error('unsupported flow');
  const name=text(f.tag||n.name||n.type+'-'+(index+1));f.tag=name;return n;
}
function fromNative(line) {
  const parts=csv(line),p=parts[0].indexOf('='),type=parts[0].slice(0,p).trim().toLowerCase();const n=node(type,endpoint(parts[0].slice(p+1).trim()));n.fields=assignment(parts.slice(1));keys(n.fields,NATIVE_KEYS,'QX native');if(n.fields.tag)n.original=line;return n;
}
function lines(input) {
  const nativePattern=/^(?:shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=\s*(?:\[[^\]]+\]|[^,:]+):\d+(?:\s*,|\s*$)/i,uriPattern=/^[a-z][a-z0-9+.-]*:\/\//i;
  // Native fields and URI fragments may contain literal comment-like text.
  // Validate directives in every source, but strip inline comments only from Proxy declarations.
  const raw=input.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>{line=line.trim();const stripped=stripComment(line,error).trim();return !stripped?'':uriPattern.test(line)||nativePattern.test(line)?line:stripped;}),hasSections=raw.some(l=>/^\[[^\]]+\]$/.test(l));let section='',out=[];
  for(const line of raw){if(!line)continue;const m=/^\[([^\]]+)\]$/.exec(line);if(m){section=m[1].toLowerCase();continue;}
    if(hasSections&&!['proxy','server_local'].includes(section))continue;
    if(uriPattern.test(line))out.push(fromUri(line));
    else if(section!=='proxy'&&nativePattern.test(line))out.push(fromNative(line));else out.push(fromProxy(line));
    if(out.length>2000)error('node limit exceeded');
  }return out;
}
export function createNodeParser(utils={}) {
  function parseNodes(input,options={}) {
    try {
      let value=input;
      if(typeof value==='string'){
        if(value.length>4194304)error('resource limit exceeded');value=value.trim();if(looksLikeEncodedSubscription(value))value=decodeBase64Text(value).trim();
        if(/^[{[]/.test(value)&&!/^\[(?:Proxy|server_local|General|general)\]/.test(value)){
          try{value=strictJson(value);}catch(e){if(e.message!=='Node conversion failed: invalid JSON document')throw e;if(!utils.parseYaml)error('invalid document');value=utils.parseYaml(value);}
        }
        else if(/^(?:proxies|outbounds|servers|nodes)\s*:/m.test(value)){if(!utils.parseYaml)error('YAML unavailable');value=utils.parseYaml(value);}
      }
      let result;
      if(typeof value==='string')result=lines(value);
      else{
        let source=Array.isArray(value)?value:object(value)?value.proxies||value.servers||value.nodes||value.outbounds:null;if(!Array.isArray(source))error('missing nodes');
        if(source.length>2000)error('node limit exceeded');result=[];
        const serversEnvelope=object(value)&&source===value.servers;
        if(serversEnvelope&&own(value,'version')&&value.version!==1)error('unsupported SIP008 version');
        const sip008=serversEnvelope&&value.version===1;
        for(const item of source){const singbox=object(value)&&source===value.outbounds;if(object(item)&&['selector','urltest','direct','block','dns'].includes(item.type)&&singbox)continue;result.push(sip008?fromSip008(item):typeof item==='string'?fromUri(item):singbox?fromSingbox(item):fromObject(item,object(value)&&source===value.proxies?'Clash node':'node object'));}
      }
      if(!result.length||result.length>2000)error('empty or oversized subscription');const names=new Set();
      const output=result.map((n,i)=>{validate(n,i);if(names.has(n.fields.tag))error('duplicate node name');names.add(n.fields.tag);return n.original||n.type+'='+(n.host.includes(':')?'['+n.host+']':n.host)+':'+n.port+', '+Object.keys(n.fields).map(k=>k+'='+n.fields[k]).join(', ');}).join('\n')+'\n';
      // Publish metadata only after the complete subscription has validated.
      if(options&&options.adaptations instanceof Set)for(const n of result)for(const key of n.adaptations||[])if(own(NATIVE_PREFERENCES,key)||key===REALITY_MLKEM_HINT)options.adaptations.add(key);
      return output;
    }catch(e){if(e instanceof Error&&e.message.startsWith('Node conversion failed: '))throw e;error('invalid node resource');}
  }
  return {parseNodes,decodeBase64Text,looksLikeEncodedSubscription};
}
