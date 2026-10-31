import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parse as parseYaml } from 'yaml';
import { createNodeParser, decodeBase64Text, looksLikeEncodedSubscription } from '../../src/features/resource-parser/nodes.mjs';

const parser=createNodeParser({parseYaml});
const parse=(input)=>parser.parseNodes(input);
const encode=text=>Buffer.from(text).toString('base64url');
const uuid='12345678-1234-1234-1234-123456789abc';
const fields=line=>Object.fromEntries(line.split(',').slice(1).map(field=>{const p=field.indexOf('=');return [field.slice(0,p).trim(),field.slice(p+1).trim()];}));

test('native nodes preserve all documented options and do not leak source data on failure',()=>{
  const line=`vless=example.com:443, method=none, password=${uuid}, obfs=over-tls, obfs-host=example.com, reality-base64-pubkey=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG, reality-hex-shortid=0123, vless-flow=xtls-rprx-vision, tag=日本`;
  assert.equal(parse(line),line+'\n');
  assert.match(parse('http=example.com:443, over-tls=true, tls-verification=false, tag=explicit-insecure'),/tls-verification=false/);
  for(const line of ['http=example.com:80, command=LEAK-ME, tag=x','http=example.com:80, password=secret, password=other, tag=x']){
    assert.throws(()=>parse(line),error=>!error.message.includes('LEAK-ME')&&!error.message.includes('secret')&&!error.message.includes('example.com'));
  }
});

test('SIP002 credentials, UTF-8 tags, URL-safe base64 and whole encoded subscriptions',()=>{
  const ss=`ss://${encode('aes-128-gcm:p@ss:word')}@example.com:8388#${encodeURIComponent('日本 节点')}`;
  const line=parse(ss).trim();assert.match(line,/^shadowsocks=example.com:8388,/);assert.equal(fields(line).password,'p@ss:word');assert.equal(fields(line).tag,'日本 节点');
  assert.equal(parse(encode(ss)),parse(ss));
  assert.equal(decodeBase64Text(encode('日本 😀')),'日本 😀');
  assert.ok(looksLikeEncodedSubscription(encode(ss)));assert.equal(looksLikeEncodedSubscription(ss),false);
  assert.throws(()=>decodeBase64Text('%%%%'));
});

test('SIP002 simple-obfs and v2ray websocket plugins preserve transport parameters',()=>{
  const base=`ss://${encode('aes-128-gcm:test-password')}@example.com:8388/`;
  const obfs=parse(base+'?plugin='+encodeURIComponent('obfs-local;obfs=http;obfs-host=front.example')+'#ss');
  assert.equal(fields(obfs.trim()).obfs,'http');assert.equal(fields(obfs.trim())['obfs-host'],'front.example');
  const ws=parse(base+'?plugin='+encodeURIComponent('v2ray-plugin;mode=websocket;mux=0;tls;host=front.example;path=/ws')+'#ws');
  assert.equal(fields(ws.trim()).obfs,'wss');assert.equal(fields(ws.trim())['obfs-uri'],'/ws');
  assert.throws(()=>parse(base+'?plugin='+encodeURIComponent('v2ray-plugin;mode=websocket;mux=8')));
  assert.throws(()=>parse(base+'?plugin='+encodeURIComponent('v2ray-plugin;mode=websocket')));
});

test('VMess JSON and VLESS Reality preserve their native fields',()=>{
  const vmess={v:'2',ps:'VMess',add:'example.com',port:'443',id:uuid,aid:'0',scy:'auto',net:'ws',type:'none',host:'front.example',path:'/ws',tls:'tls',sni:'front.example',alpn:'h2,http/1.1'};
  const line=parse('vmess://'+encode(JSON.stringify(vmess))).trim(),f=fields(line);
  assert.equal(f.password,uuid);assert.equal(f.obfs,'wss');assert.equal(f['tls-verification'],'true');assert.equal(f['obfs-host'],'front.example');assert.equal(f['tls-alpn'],'02683208687474702f312e31');
  const vless=parse(`vless://${uuid}@example.com:443?encryption=none&security=reality&pbk=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&sid=0123&flow=xtls-rprx-vision&sni=front.example#Reality`).trim();
  assert.equal(fields(vless)['reality-hex-shortid'],'0123');assert.equal(fields(vless)['vless-flow'],'xtls-rprx-vision');
  assert.throws(()=>parse(`vless://${uuid}@example.com:443?security=reality&pbk=abc&fp=chrome`));
});

test('Trojan, HTTP, SOCKS and AnyTLS URI conversion uses the correct TLS modes',()=>{
  const trojan=fields(parse('trojan://test-password@example.com:443?sni=front.example#Trojan').trim());assert.equal(trojan['over-tls'],'true');assert.equal(trojan['tls-host'],'front.example');
  const http=fields(parse('https://user:p%40ss@example.com:443#HTTP').trim());assert.equal(http.username,'user');assert.equal(http.password,'p@ss');assert.equal(http['over-tls'],'true');
  assert.match(parse('socks5://user:pass@[2001:db8::1]:1080#SOCKS'),/^socks5=\[2001:db8::1\]:1080,/);
  const anytls=fields(parse('anytls://test-password@example.com:443?peer=front.example#AnyTLS').trim());assert.equal(anytls['over-tls'],'true');assert.equal(anytls['tls-host'],'front.example');
});

test('SSR preserves cipher, protocol and supported obfuscation',()=>{
  const body=`example.com:443:auth_chain_a:aes-256-cfb:tls1.2_ticket_auth:${encode('test-password')}/?remarks=${encode('SSR 日本')}&obfsparam=${encode('front.example')}&protoparam=${encode('123:test')}`;
  const f=fields(parse('ssr://'+encode(body)).trim());assert.equal(f.method,'aes-256-cfb');assert.equal(f['ssr-protocol'],'auth_chain_a');assert.equal(f['ssr-protocol-param'],'123:test');assert.equal(f['obfs-host'],'front.example');assert.equal(f.tag,'SSR 日本');
});

test('Clash YAML/JSON and SIP008 objects convert without executing input',()=>{
  const node={name:'Clash',type:'vless',server:'example.com',port:443,uuid,tls:true,servername:'front.example',network:'ws','ws-opts':{path:'/ws',headers:{Host:'front.example'}}};
  assert.equal(fields(parse({proxies:[node]}).trim()).obfs,'wss');
  assert.equal(fields(parse({version:1,servers:[{server:'example.com',server_port:8388,method:'aes-128-gcm',password:'test-password',remarks:'SIP008'}]}).trim()).tag,'SIP008');
  assert.equal(fields(parse('proxies:\n  - name: YAML\n    type: http\n    server: example.com\n    port: 80\n').trim()).tag,'YAML');
});

test('Surge and Loon Proxy sections retain native-compatible data only',()=>{
  const surge='[General]\ndns-server=system\n[Proxy]\nSurge = ss, example.com, 8388, encrypt-method=aes-128-gcm, password=test-password, udp-relay=true\n[Rule]\nFINAL,DIRECT';
  const f=fields(parse(surge).trim());assert.equal(f.tag,'Surge');assert.equal(f.method,'aes-128-gcm');assert.equal(f['udp-relay'],'true');
  const loon=`[Proxy]\nLoon = VLESS,example.com,443,"${uuid}",transport=ws,path=/ws,host=front.example,over-tls=true,tls-name=front.example,skip-cert-verify=false`;
  assert.equal(fields(parse(loon).trim()).obfs,'wss');
});

test('unknown protocols, unsupported transport/security fields and mixed good/bad input fail as a whole',()=>{
  for(const input of [
    'hysteria2://secret@example.com:443#bad',
    `vless://${uuid}@example.com:443?type=grpc&serviceName=test`,
    `trojan://secret@example.com:443?security=none`,
    {proxies:[{name:'bad',type:'vless',server:'example.com',port:443,uuid,tls:true,servername:'sni.example',network:'ws','ws-opts':{headers:{Host:'other.example'}}}]},
    {proxies:[{name:'bad',type:'vmess',server:'example.com',port:443,uuid,network:'ws','ws-opts':{headers:{Authorization:'secret'}}}]},
    'http://example.com:80#ok\ntuic://secret@example.com:443#bad',
    {proxies:[{name:'bad',type:'http',server:'example.com',port:80,password:'bad,password'}]},
    {proxies:[{name:'bad',type:'http',server:'example.com',port:80,'unknown-security':true}]},
  ])assert.throws(()=>parse(input),error=>!error.message.includes('secret')&&!error.message.includes('example.com'));
});

test('duplicate node names and resource limits are explicit errors',()=>{
  assert.throws(()=>parse('http://example.com:80#same\nhttp://other.example:80#same'));
  assert.throws(()=>parse(Array.from({length:2001},(_,i)=>({name:'n'+i,type:'http',server:'example.com',port:80}))));
  assert.throws(()=>parse('http://example.com:65536#bad'));
  assert.throws(()=>parse('ss://'+encode('aes-128-gcm:bad,password')+'@example.com:443#bad'));
});

test('unrepresentable options cannot be misplaced onto another protocol',()=>{
  for(const input of [
    'https://example.com?type=ws',
    {proxies:[{name:'bad',type:'http',server:'example.com',port:80,uuid}]},
    '[Proxy]\nbad=http,example.com,80,vmess-aead=false',
    'http=example.com:80,obfs=ws,tag=bad',
    'vmess=example.com:443,method=none,password='+uuid+',obfs=wss,over-tls=true,tag=bad',
  ])assert.throws(()=>parse(input));
});

test('sing-box native objects preserve protocol, transport, TLS and UDP-over-TCP',()=>{
  const source={outbounds:[{type:'direct',tag:'direct'},{type:'shadowsocks',tag:'SS',server:'example.com',server_port:8388,method:'aes-128-gcm',password:'test-password'},{type:'vless',tag:'VLESS',server:'example.com',server_port:443,uuid,flow:'xtls-rprx-vision',tls:{enabled:true,server_name:'front.example'},udp_over_tcp:{enabled:true,version:2}}]};
  const result=parse(source).trim().split('\n');assert.equal(result.length,2);assert.equal(fields(result[1])['vless-flow'],'xtls-rprx-vision');assert.equal(fields(result[1])['udp-over-tcp'],'sp.v2');
  assert.throws(()=>parse({outbounds:[{type:'socks',tag:'socks4',server:'example.com',server_port:1080,version:'4'}]}));
});

test('SIP002 escaped plugin values and plaintext SS2022 keys are decoded exactly once',()=>{
  const plugin='v2ray-plugin;mode=websocket;mux=0;host=front.example;path=/a\\;b\\=c;tls';
  const line=parse('ss://aes-128-gcm:test-password@example.com:8388/?plugin='+encodeURIComponent(plugin)+'#SS');assert.equal(fields(line.trim())['obfs-uri'],'/a;b=c');
  const key='YctPZ6U7xPPcU+gp3u+0tx/tRizJN9K8y+uKlW2qjlI=';
  assert.equal(fields(parse('ss://2022-blake3-aes-256-gcm:'+encodeURIComponent(key)+'@example.com:443#SS2022').trim()).password,key);
});

test('pure host code works without Node, browser codec or network globals',async()=>{
  const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../../src/features/resource-parser/nodes.mjs',import.meta.url),'utf8');
  const sandbox={};vm.createContext(sandbox);vm.runInContext(source.replace(/export /g,'')+';this.parser=createNodeParser();',sandbox);
  assert.match(sandbox.parser.parseNodes('ss://'+encode('aes-128-gcm:test-password')+'@example.com:443#SS'),/^shadowsocks=/);
  for(const forbidden of ['Buffer','URL','atob','TextDecoder','fetch','eval('])assert.equal(source.includes(forbidden),false,forbidden);
});

test('native documented obfs aliases, ALPN encoding and VMess cipher alias survive',()=>{
  const inputs=[
    'shadowsocks=example.com:443,method=aes-128-gcm,password=test-password,obfs=vmess-http,obfs-uri=/path,tag=SS',
    'vmess=example.com:443,method=chacha20-ietf-poly1305,password='+uuid+',obfs=shadowsocks-http,tag=VMess',
    'http=example.com:443,over-tls=true,tls-alpn=02:68:32:08:68:74:74:70:2f:31:2e:31,tag=HTTP',
  ];for(const input of inputs)assert.equal(parse(input),input+'\n');
  assert.throws(()=>parse('http=example.com:443,over-tls=true,tls-alpn=036832,tag=bad'));
});

test('Reality with websocket is documented natively and preserves both fields',()=>{
  const f=fields(parse(`vless://${uuid}@example.com:443?security=reality&pbk=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&sid=0123&type=ws&host=front.example&sni=front.example&path=%2Fws#RealityWS`).trim());
  assert.equal(f.obfs,'wss');assert.equal(f['reality-hex-shortid'],'0123');
});

test('malformed literal IP addresses and lossy native quoting fail safely',()=>{
  for(const input of ['http://[a:b]:80#bad','http://[:1:2:3:4:5:6:7:8]:80#bad','http://[:::]:80#bad','http://999.999.1.1:80#bad','http=example.com:80,password="pass,word",tag=bad'])assert.throws(()=>parse(input));
});

test('Clash SSR and plaintext V2Ray TCP HTTP headers use QX native fields',()=>{
  const ssr=fields(parse({proxies:[{type:'ssr',name:'SSR',server:'example.com',port:443,cipher:'aes-256-cfb',password:'test-password',protocol:'auth_chain_a','protocol-param':'123:test',obfs:'tls1.2_ticket_auth','obfs-param':'front.example'}]}).trim());assert.equal(ssr['ssr-protocol'],'auth_chain_a');
  const vmess={v:'2',ps:'HTTP header',add:'example.com',port:'80',id:uuid,aid:'0',net:'tcp',type:'http',host:'front.example',path:'/request'};
  assert.equal(fields(parse('vmess://'+encode(JSON.stringify(vmess))).trim()).obfs,'http');
  assert.equal(fields(parse(`vless://${uuid}@example.com:80?type=tcp&headerType=http&host=front.example&path=%2Frequest#TCP`).trim())['obfs-uri'],'/request');
  assert.throws(()=>parse(`vless://${uuid}@example.com:443?security=tls&type=tcp&headerType=http&host=front.example#TCP`));
});

test('HTTP/2 transport is never confused with TCP HTTP-header obfuscation',()=>{
  for(const input of [
    `vless://${uuid}@example.com:80?type=http#H2`,
    'vmess://'+encode(JSON.stringify({v:'2',ps:'H2',add:'example.com',port:80,id:uuid,net:'http'})),
    {outbounds:[{type:'vless',tag:'H2',server:'example.com',server_port:80,uuid,transport:{type:'http',path:'/request'}}]},
    {outbounds:[{type:'http',tag:'bad',server:'example.com',server_port:80,security:'aes-128-gcm'}]},
    'http=example.com:443,over-tls=1,tag=bad',
  ])assert.throws(()=>parse(input));
});

test('red team: Proxy VMess handshake flags and source defaults are preserved',()=>{
  const explicit=fields(parse(`[Proxy]\nExample=vmess,example.com,80,none,"${uuid}",aead=false`).trim());assert.equal(explicit.aead,'false');
  const surge=fields(parse(`[Proxy]\nExample=vmess,example.com,80,username=${uuid}`).trim());assert.equal(surge.aead,'false');assert.equal(surge.method,'aes-128-gcm');
  const loon=fields(parse(`[Proxy]\nExample=vmess,example.com,80,aes-128-gcm,"${uuid}"`).trim());assert.equal(loon.aead,'true');
  assert.equal(fields(parse(`[Proxy]\nVMess=vmess,example.com,80,username=${uuid}`).trim()).tag,'VMess');
  for(const name of ['VLESS','trojan','http','socks5','anytls'])assert.equal(fields(parse(`[Proxy]\n${name}=http,example.com,80`).trim()).tag,name);
});

test('red team: SS cannot silently consume SSR-only fields',()=>{
  for(const option of ['protocol=auth_chain_a','protocol-param=123:test','obfs-param=front.example'])assert.throws(()=>parse('[Proxy]\nExample=ss,example.com,443,encrypt-method=aes-128-gcm,password=test-password,'+option));
});

test('red team: WSS Host and SNI defaults must both remain unchanged',()=>{
  const base={type:'vless',tag:'WSS',server:'example.com',server_port:443,uuid,tls:{enabled:true},transport:{type:'ws',path:'/ws'}};
  assert.throws(()=>parse({outbounds:[{...base,transport:{...base.transport,headers:{Host:'front.example'}}}]}));
  assert.throws(()=>parse({outbounds:[{...base,tls:{enabled:true,server_name:'tls.example'}}]}));
  const same=parse({outbounds:[{...base,transport:{...base.transport,headers:{Host:'example.com'}}}]});assert.equal(fields(same.trim())['obfs-host'],'example.com');
  assert.throws(()=>parse({proxies:[{type:'vless',name:'Clash',server:'example.com',port:443,uuid,tls:true,network:'ws','ws-opts':{headers:{Host:'front.example'}}}]}));
});

test('red team: conflicting aliases and VLESS-only incompatibilities are errors',()=>{
  const base={name:'Clash',type:'vmess',server:'example.com',port:443,uuid,tls:true};
  for(const delta of [{alterId:0,'alter-id':64},{servername:'one.example',sni:'two.example'},{port:80,server_port:443},{udp:false,'udp-relay':true},{cipher:'none',security:'aes-128-gcm'},{tfo:false,'fast-open':true},{uuid,id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}])assert.throws(()=>parse({proxies:[{...base,...delta}]}));
  for(const delta of [{cipher:'aes-128-gcm'},{security:'aes-128-gcm'},{alterId:0},{'alter-id':64}])assert.throws(()=>parse({proxies:[{...base,type:'vless',...delta}]}));
  for(const options of ['aead=false,vmess-aead=true','tls=true,over-tls=false','ws=true,transport=tcp','ws-path=/one,path=/two','sni=one.example,tls-name=two.example'])assert.throws(()=>parse(`[Proxy]\nExample=vmess,example.com,443,username=${uuid},${options}`));
});

test('red team: duplicate JSON keys cannot remove TLS or weaken verification',()=>{
  const inner=`{"v":"2","ps":"Duplicate","add":"example.com","port":443,"id":"${uuid}","tls":"tls","\\u0074ls":""}`;
  assert.throws(()=>parse('vmess://'+encode(inner)));
  assert.throws(()=>parse('{"proxies":[],"proxies":[{"type":"http","name":"HTTP","server":"example.com","port":80}]}'));
  const vmess={v:'2',ps:'Verification',add:'example.com',port:443,id:uuid,tls:'tls',allowInsecure:true,'skip-cert-verify':false};assert.throws(()=>parse('vmess://'+encode(JSON.stringify(vmess))));
});

test('red team: sing-box TLS master switch overrides nested Reality state',()=>{
  const base={type:'vless',tag:'TLS',server:'example.com',server_port:443,uuid};
  assert.throws(()=>parse({outbounds:[{...base,tls:{enabled:false,reality:{enabled:true,public_key:'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'}}}]}));
  const normal=fields(parse({outbounds:[{...base,tls:{enabled:true,reality:{enabled:'false'}}}]}).trim());assert.equal(normal.obfs,'over-tls');assert.equal(normal['reality-base64-pubkey'],undefined);
  assert.throws(()=>parse({outbounds:[{...base,tls:{enabled:true,reality:{enabled:'maybe'}}}]}));
});

test('red team: Clash Reality cannot bypass a disabled or absent TLS switch',()=>{
  const base={name:'Reality',type:'vless',server:'example.com',port:443,uuid,'reality-opts':{'public-key':'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG','short-id':'0123'}};
  assert.throws(()=>parse({proxies:[{...base,tls:false}]}));
  assert.throws(()=>parse({proxies:[base]}));
  assert.throws(()=>parse({proxies:[{...base,tls:'false'}]}));
  const valid=fields(parse({proxies:[{...base,tls:true}]}).trim());assert.equal(valid.obfs,'over-tls');assert.equal(valid['reality-hex-shortid'],'0123');
});

test('TLS-only schemes and plugin flags cannot be weakened by conflicting options',()=>{
  for(const input of [
    'https://example.com:443?security=none#HTTPS',
    'socks5s://example.com:443?security=none#SOCKS',
    {proxies:[{type:'https',name:'HTTPS',server:'example.com',port:443,tls:false}]},
    '[Proxy]\nHTTPS=https,example.com,443,over-tls=false',
    'ss://aes-128-gcm:test-password@example.com:443/?plugin='+encodeURIComponent('v2ray-plugin;mux=0;tls=false;host=example.com')+'#Plugin',
  ])assert.throws(()=>parse(input));
});
