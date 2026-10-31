import { readFile, mkdir, writeFile, rename, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { assertManagedPaths } from './managed-paths.mjs';
import { loadCatalog } from './build.mjs';
import { renderProfile } from './profiles.mjs';
import { clientIds } from './clients.mjs';

const maxBytes=8*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const proxyTypes=new Set(['socks','http','shadowsocks','vmess','vless','trojan','hysteria','hysteria2','tuic','ssh','anytls','shadowtls']);
function fail(message){throw new Error(message);}
function urlFor(value){
 let url;try{url=new URL(value);}catch{fail('Invalid subscription URL');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.hash||/[\x00-\x20\x7f]/.test(value))fail('Invalid subscription URL');
 if(url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))fail('Subscription requires HTTPS except loopback fixtures');
 return url;
}
export async function fetchSubscriptionText(value){
 let url=urlFor(value);const initialLoopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 for(let redirects=0;redirects<4;redirects++){
  let response;try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'netatlas-local-profile'}});}catch{fail('Subscription connection failed');}
  if(response.status>=300&&response.status<400){
   const location=response.headers.get('location');await response.body?.cancel();if(!location)fail('Subscription redirect is missing a destination');
   const next=urlFor(new URL(location,url).href);
   if(!initialLoopback&&['127.0.0.1','localhost','[::1]'].includes(next.hostname))fail('Subscription redirect to loopback is not allowed');url=next;continue;
  }
  if(!response.ok){await response.body?.cancel();fail('Subscription HTTP request failed');}
  if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();fail('Subscription response exceeds size limit');}
  const chunks=[];let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>maxBytes)fail('Subscription response exceeds size limit');chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
 }
 fail('Subscription redirect limit exceeded');
}
function decoded64(text){try{return Buffer.from(text.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');}catch{fail('Invalid encoded subscription');}}
function transport(type,host,pathValue){
 if(!type||type==='tcp')return undefined;
 if(type==='ws'){
  const headers=typeof host==='string'?{Host:host}:host??{};
  for(const [key,value] of Object.entries(headers))if(!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key)||typeof value!=='string'||/[\r\n]/.test(value))fail('Invalid WebSocket subscription headers');
  return {type:'ws',path:pathValue||'/',...(Object.keys(headers).length?{headers:structuredClone(headers)}:{})};
 }
 if(type==='grpc')return {type:'grpc',service_name:pathValue||''};
 fail('Unsupported subscription transport; provide native sing-box outbounds instead');
}
function uriNode(line,index){
 if(line.startsWith('vmess://')){
  let item;try{item=JSON.parse(decoded64(line.slice(8)));}catch{fail('Invalid VMess subscription node');}
  if((!item.net||item.net==='tcp')&&item.type&&!['none',''].includes(item.type))fail('VMess TCP header obfuscation requires native sing-box outbounds');
  return {type:'vmess',tag:item.ps||`Subscription-${index+1}`,server:item.add,server_port:Number(item.port),uuid:item.id,security:item.scy||'auto',alter_id:Number(item.aid||0),...(item.tls==='tls'?{tls:{enabled:true,server_name:item.sni||item.host||item.add}}:{}),...(item.net&&item.net!=='tcp'?{transport:transport(item.net,item.host,item.path)}:{})};
 }
 if(line.startsWith('ss://')){
  const raw=line.slice(5).split('#')[0];let credentials,endpoint;
  if(raw.includes('@')){const pivot=raw.lastIndexOf('@');credentials=raw.slice(0,pivot);endpoint=raw.slice(pivot+1);if(!credentials.includes(':'))credentials=decoded64(credentials);}
  else {const decoded=decoded64(raw);const pivot=decoded.lastIndexOf('@');if(pivot<0)fail('Invalid Shadowsocks subscription node');credentials=decoded.slice(0,pivot);endpoint=decoded.slice(pivot+1);}
  const parsed=new URL('socks://'+endpoint);if(parsed.search)fail('Shadowsocks plugins require native sing-box outbounds');
  const pivot=credentials.indexOf(':');if(pivot<0)fail('Invalid Shadowsocks credentials');
  return {type:'shadowsocks',tag:decodeURIComponent(line.split('#')[1]||`Subscription-${index+1}`),server:parsed.hostname.replace(/^\[|\]$/g,''),server_port:Number(parsed.port),method:decodeURIComponent(credentials.slice(0,pivot)),password:decodeURIComponent(credentials.slice(pivot+1))};
 }
 let uri;try{uri=new URL(line);}catch{fail('Invalid subscription node URI');}
 const type=uri.protocol.slice(0,-1);if(!['vless','trojan'].includes(type))fail('Unsupported subscription node URI');
 const q=uri.searchParams;const security=q.get('security')||(type==='trojan'?'tls':'none');
 if(q.get('headerType')&&q.get('headerType')!=='none')fail('TCP header obfuscation requires native sing-box outbounds');
 if(q.get('allowInsecure')==='1'||q.get('insecure')==='1')fail('Subscription requests disabled TLS verification');
 const tls=security==='none'?undefined:{enabled:true,server_name:q.get('sni')||q.get('peer')||uri.hostname,...(q.get('fp')?{utls:{enabled:true,fingerprint:q.get('fp')}}:{}),...(security==='reality'?{reality:{enabled:true,public_key:q.get('pbk'),short_id:q.get('sid')||''},utls:{enabled:true,fingerprint:q.get('fp')||'chrome'}}:{})};
 if(!['none','tls','reality'].includes(security))fail('Unsupported subscription TLS mode');
 const trans=transport(q.get('type'),q.get('host'),q.get('serviceName')||q.get('path'));
 return {type,tag:decodeURIComponent(uri.hash.slice(1)||`Subscription-${index+1}`),server:uri.hostname.replace(/^\[|\]$/g,''),server_port:Number(uri.port)||(tls?443:0),[type==='vless'?'uuid':'password']:decodeURIComponent(uri.username),...(type==='vless'&&q.get('flow')?{flow:q.get('flow')}:{}),...(tls?{tls}:{}),...(trans?{transport:trans}:{})};
}
function clashNode(item){
 const map={ss:'shadowsocks',socks5:'socks',http:'http',vmess:'vmess',vless:'vless',trojan:'trojan',hysteria2:'hysteria2',tuic:'tuic',anytls:'anytls'};
 const type=map[item.type];if(!type)fail('Unsupported Clash subscription protocol; provide native sing-box outbounds');
 if(item.plugin||item['plugin-opts'])fail('Shadowsocks plugins require native sing-box outbounds');
 if(item.obfs||item['obfs-password'])fail('Subscription obfuscation requires native sing-box outbounds');
 if(type==='socks'&&item.tls)fail('TLS-wrapped SOCKS requires native sing-box outbounds');
 if(item['ws-opts']?.['v2ray-http-upgrade']||item['ws-opts']?.['v2ray-http-upgrade-fast-open'])fail('HTTP upgrade subscriptions require native sing-box outbounds');
 if(item['skip-cert-verify'])fail('Subscription requests disabled TLS verification');
 const tls=item.tls||['trojan','hysteria2','tuic','anytls'].includes(type)||item['reality-opts']?{enabled:true,server_name:item.servername||item.sni||item.server,...(item['client-fingerprint']?{utls:{enabled:true,fingerprint:item['client-fingerprint']}}:{}),...(item['reality-opts']?{reality:{enabled:true,public_key:item['reality-opts']['public-key'],short_id:item['reality-opts']['short-id']||''}}:{})}:undefined;
 const trans=item.network&&item.network!=='tcp'?transport(item.network,item['ws-opts']?.headers,item['ws-opts']?.path||item['grpc-opts']?.['grpc-service-name']):undefined;
 if(trans?.type==='ws'){
  if(item['ws-opts']?.['max-early-data']!==undefined){const size=item['ws-opts']['max-early-data'];if(!Number.isSafeInteger(size)||size<0)fail('Invalid WebSocket early data size');trans.max_early_data=size;}
  if(item['ws-opts']?.['early-data-header-name']!==undefined){const key=item['ws-opts']['early-data-header-name'];if(typeof key!=='string'||/[\r\n]/.test(key))fail('Invalid WebSocket early data header');trans.early_data_header_name=key;}
 }
 return {type,tag:item.name,server:item.server,server_port:Number(item.port),...(type==='shadowsocks'?{method:item.cipher,password:item.password}:{}),...(['vmess','vless'].includes(type)?{uuid:item.uuid}:{}),...(type==='vmess'?{security:item.cipher||'auto',alter_id:Number(item.alterId||0)}:{}),...(type==='vless'&&item.flow?{flow:item.flow}:{}),...(['trojan','hysteria2','tuic','anytls'].includes(type)?{password:item.password}:{}),...(type==='tuic'?{uuid:item.uuid}:{}),...(type==='socks'?{version:'5',...(item.username?{username:item.username,password:item.password}:{})}:{}),...(type==='http'&&item.username?{username:item.username,password:item.password}:{}),...(tls?{tls}:{}),...(trans?{transport:trans}:{})};
}
export function materializeSubscription(client,text){
 if(typeof text!=='string'||Buffer.byteLength(text)>maxBytes||!text.trim())fail('Empty or oversized subscription payload');
 let body=text.trim();if(/^[a-zA-Z0-9+/_=\r\n-]+$/.test(body)&&!body.includes('://'))body=decoded64(body.replace(/\s/g,''));
 if(client==='shadowrocket'){
  if(body.startsWith('{')||body.startsWith('[')&&!body.startsWith('[Proxy]')){let value;try{value=JSON.parse(body);}catch{fail('Invalid Shadowrocket subscription JSON');}if(!Array.isArray(value.nodes)||!value.nodes.length||value.nodes.length>2000||!value.nodes.every(x=>typeof x==='string'))fail('Empty or invalid Shadowrocket node collection');return value.nodes;}
  let section=body.includes('[Proxy]')?'outside':'proxy';const nodes=[];
  for(const raw of body.split(/\r?\n/)){const line=raw.trim();if(!line||/^(#|;|\/\/)/.test(line))continue;if(/^\[/.test(line)){section=line.toLowerCase()==='[proxy]'?'proxy':'outside';continue;}if(section==='proxy'){if(!/^[^=,\r\n]+\s*=\s*[a-z0-9-]+\s*,/i.test(line))fail('Shadowrocket subscription must use native Proxy lines; import URI subscriptions in the app');nodes.push(line);}}
  if(!nodes.length)fail('Empty Shadowrocket node subscription');return nodes;
 }
 if(client!=='singBox')fail('This client uses native subscriptions');
 let parsed;try{parsed=body.startsWith('{')||body.startsWith('[')?JSON.parse(body):body.includes('proxies:')?parseYaml(body):undefined;}catch{fail('Invalid subscription JSON or YAML');}
 let nodes;
 if(parsed){
  if(Array.isArray(parsed.proxies))nodes=parsed.proxies.map(clashNode);
  else {const candidates=Array.isArray(parsed)?parsed:parsed.outbounds||parsed.nodes;if(!Array.isArray(candidates))fail('Subscription contains no native nodes');nodes=candidates.filter(node=>proxyTypes.has(node?.type));}
 } else nodes=body.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')).map(uriNode);
 if(!nodes?.length||nodes.length>2000)fail('Subscription contains no supported nodes or exceeds the node limit');return nodes;
}
function privatePath(root,value){
 if(typeof value!=='string'||!value)fail('Private input and output paths are required');const resolved=path.resolve(root,value),rel=path.relative(path.resolve(root,'private'),resolved);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))fail('Profile inputs and outputs must be inside the ignored private directory');return resolved;
}
async function snapshot(file){try{const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())fail('Private profile path must be a regular file');return await readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function createPrivateProfile({root,client,inputFile,outputFile,fetchText=fetchSubscriptionText}={}){
 if(!clientIds.includes(client))fail('Unknown profile client');
 root=path.resolve(root);const input=privatePath(root,inputFile),output=privatePath(root,outputFile);
 if(input===output)fail('Private input cannot be overwritten by its output');
 await assertManagedPaths(root,[input,output]);const original=await snapshot(input),previous=await snapshot(output);
 if(previous){const a=await lstat(input),b=await lstat(output);if(a.dev===b.dev&&a.ino===b.ino)fail('Private input cannot be used as a hardlinked output');}
 if(!original)fail('Missing private input file');if(original.length>maxBytes)fail('Private input exceeds size limit');
 let options;try{options=JSON.parse(original);}catch{fail('Invalid private input JSON');}
 if(!options||options.version!==1||Array.isArray(options)||typeof options!=='object')fail('Private input version must be 1');
 if(Object.keys(options).some(k=>!['version','nodes','subscriptions','selectedProxy','dnsUpstreams','listenerPorts'].includes(k)))fail('Unknown private profile option');
 if(options.nodes!==undefined&&!Array.isArray(options.nodes)||options.subscriptions!==undefined&&!Array.isArray(options.subscriptions))fail('Private nodes and subscriptions must be arrays');
 if((options.nodes?.length||0)>2000||(options.subscriptions?.length||0)>32)fail('Private profile input exceeds node or subscription limits');
 const nodes=[...(options.nodes||[])],subscriptions=options.subscriptions||[];
 if(!nodes.length&&!subscriptions.length)fail('Add a private node or subscription before generating a connected profile');
 for(const item of subscriptions){if(!item||typeof item.name!=='string'||!item.name.trim())fail('Invalid subscription name');urlFor(item.url);}
 if(['singBox','shadowrocket'].includes(client)){
  for(const item of subscriptions){let text;try{text=await fetchText(item.url);}catch{fail('Subscription could not be loaded');}nodes.push(...materializeSubscription(client,text));}
  options={...options,nodes,subscriptions:[]};
 }
 const {rulesets}=await loadCatalog(root);let profile;
 try{profile=renderProfile(client,{rulesets,...options,nodes});}catch{fail('Native profile rendering failed; check node names, source format and DNS options');}
 await assertManagedPaths(root,[input,output]);if(digest(await readFile(input))!==digest(original))fail('Private input changed while subscriptions were loading');
 const now=await snapshot(output);if((now?digest(now):null)!==(previous?digest(previous):null))fail('Private output changed while subscriptions were loading');
 await mkdir(path.dirname(output),{recursive:true,mode:0o700});const staged=output+'.pending-'+randomUUID();await assertManagedPaths(root,[staged]);
 await writeFile(staged,profile.content,{flag:'wx',mode:0o600});
 if(previous)await writeFile(output+'.previous-'+randomUUID(),previous,{flag:'wx',mode:0o600});
 await rename(staged,output);
 return {client,path:output,counts:{nodes:nodes.length,subscriptions:subscriptions.length},format:profile.format};
}
