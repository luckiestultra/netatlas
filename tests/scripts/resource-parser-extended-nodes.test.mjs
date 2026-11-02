import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const uuid='12345678-1234-1234-1234-123456789abc';
const encode=value=>Buffer.from(value).toString('base64url');
const parser=createNodeParser();
const fields=line=>Object.fromEntries(line.trim().split(',').slice(1).map(part=>{const p=part.indexOf('=');return [part.slice(0,p).trim(),part.slice(p+1).trim()];}));
function convert(content) {
  const expected=parseResource({content,type:'server'});
  let calls=0,captured;
  const denied=()=>assert.fail('conversion must not use network or storage');
  const result=vm.runInNewContext(bundleResourceParser(),{$resource:{content,type:'server'},$done:value=>{calls++;captured=value;return value;},fetch:denied,$task:{fetch:denied},$prefs:{valueForKey:denied},Buffer:undefined,URL:undefined,atob:undefined},{timeout:3000});
  assert.equal(calls,1);assert.equal(result,captured);assert.deepEqual(JSON.parse(JSON.stringify(result)),expected);
  return expected.content;
}
function rejects(content,pattern=/Node conversion failed:/) {
  assert.throws(()=>parseResource({content,type:'server'}),pattern);
  let calls=0;
  const result=vm.runInNewContext(bundleResourceParser(),{$resource:{content,type:'server'},$done:value=>{calls++;return value;}},{timeout:3000});
  assert.equal(calls,1);assert.deepEqual(Object.keys(result),['error']);assert.match(result.error,pattern);
  assert.doesNotMatch(result.error,/synthetic-secret|proxy\.example|private-token/);
}
const ssd=extra=>'ssd://'+encode(JSON.stringify({airport:'Synthetic',port:443,encryption:'aes-128-gcm',password:'default%40password',servers:[{server:'proxy.example',remarks:'Default'}],...extra}));

test('SSD expands independent defaults and per-server overrides, including IPv6, in the source and standalone bundle',()=>{
  const content=ssd({servers:[{server:'override.example',remarks:'Override',port:8443,password:'override',encryption:'aes-256-gcm'},{server:'2001:db8::1',remarks:'IPv6'},{server:'[2001:db8::2]',remarks:'Bracketed'}]});
  const rows=convert(content).trim().split('\n');
  assert.equal(rows.length,3);assert.match(rows[0],/^shadowsocks=override\.example:8443,/);assert.equal(fields(rows[0]).password,'override');assert.equal(fields(rows[0]).method,'aes-256-gcm');
  assert.match(rows[1],/^shadowsocks=\[2001:db8::1\]:443,/);assert.equal(fields(rows[1]).password,'default%40password');assert.equal(fields(rows[1]).method,'aes-128-gcm');
  assert.match(rows[2],/^shadowsocks=\[2001:db8::2\]:443,/);
  assert.equal(convert(encode(content)),rows.join('\n')+'\n');
  assert.equal(convert(JSON.stringify([content])),rows.join('\n')+'\n');
});

test('SSD plugin inheritance does not carry an override into the next server',()=>{
  const rows=convert(ssd({plugin:'simple-obfs',plugin_options:'obfs=http;obfs-host=default.example',servers:[{server:'one.example',remarks:'One',plugin_options:'obfs=tls;obfs-host=override.example'},{server:'two.example',remarks:'Two'}]})).trim().split('\n');
  assert.equal(fields(rows[0]).obfs,'tls');assert.equal(fields(rows[0])['obfs-host'],'override.example');
  assert.equal(fields(rows[1]).obfs,'http');assert.equal(fields(rows[1])['obfs-host'],'default.example');
  assert.equal(fields(convert(ssd({plugin_options:'obfs=tls;obfs-host=compat.example'}))).obfs,'tls');
});

test('SSD validates every expanded server and rejects unrepresentable plugins, duplicate JSON keys and aggregate limits',()=>{
  for(const content of [ssd({plugin:'kcptun',plugin_options:'key=synthetic-secret'}),ssd({servers:[{server:'proxy.example',remarks:'Valid'},{server:'bad/host',remarks:'Bad'}]}),ssd({tls:true}),ssd({servers:Array.from({length:2001},(_,i)=>({server:'proxy.example',remarks:'Node'+i}))}),'ssd://'+encode('{"port":443,"port":80,"servers":[]}'),ssd({plugin:'v2ray-plugin',plugin_options:'tls;host=proxy.example'})])rejects(content);
});

test('Shadowrocket VLESS authority, naming, websocket and TLS aliases retain UUID, path, Host and secure defaults',()=>{
  const old='vless://'+encode('none:'+uuid+'@proxy.example:443')+'?remarks=SR%20VLESS&obfs=websocket&obfsParam='+encodeURIComponent('{"Host":"front.example"}')+'&path=%2Fsocket&tls=1';
  const f=fields(convert(old));assert.equal(f.password,uuid);assert.equal(f.tag,'SR VLESS');assert.equal(f.method,'none');assert.equal(f.obfs,'wss');assert.equal(f['obfs-host'],'front.example');assert.equal(f['obfs-uri'],'/socket');assert.equal(f['tls-verification'],'true');
  assert.equal(fields(convert('vless://'+encode(uuid+'@[2001:db8::3]:443')+'?remark=TLS&tls=1&peer=front.example'))['obfs-host'],'front.example');
  assert.equal(fields(convert('vless://'+uuid+'@proxy.example:80?remarks=Plain&obfs=websocket&obfsParam=front.example')).obfs,'ws');
});

test('old non-JSON VMess keeps method and legacy default AEAD, with explicit alterId=0 enabling AEAD',()=>{
  const uri='vmess://'+encode('chacha20-ietf-poly1305:'+uuid+'@proxy.example:443')+'?remarks=Old&obfs=websocket&obfsParam=front.example&path=%2Fws&tls=1';
  const f=fields(convert(uri));assert.equal(f.password,uuid);assert.equal(f.method,'chacha20-poly1305');assert.equal(f.aead,'false');assert.equal(f.obfs,'wss');assert.equal(f['tls-verification'],'true');
  assert.equal(fields(convert(uri+'&alterId=0')).aead,'true');
  assert.equal(fields(convert('vmess://aes-128-gcm:'+uuid+'@proxy.example:80?remark=Raw&obfs=none&alterId=0')).aead,'true');
  assert.equal(fields(convert('vmess://'+encode(uuid+'@proxy.example:80')+'?remarks=NoMethod')).method,'aes-128-gcm');
});

test('legacy VMess and VLESS reject transport, TLS-name, alias, multiplexing and alter-ID losses atomically',()=>{
  for(const scheme of ['vmess','vless']) {
    const uri=scheme+'://'+encode('none:'+uuid+'@proxy.example:443')+'?remarks=Bad';
    for(const query of ['&obfs=grpc','&tls=1&security=tls','&obfs=websocket&type=ws','&obfs=websocket&obfsParam=front.example&tls=1&sni=other.example','&mux=1','&obfsParam=%7B%22Host%22%3A%22front.example%22%2C%22Authorization%22%3A%22synthetic-secret%22%7D','&remark=Duplicate','&obfs=http&tls=1'])rejects(uri+query);
  }
  rejects('vmess://'+encode('none:'+uuid+'@proxy.example:443')+'?remarks=Bad&alterId=64');
  rejects('vmess://'+encode('none:'+uuid+'@proxy.example:443')+'?remarks=Bad&alterId=not-a-number');
});

test('legacy SOCKS and ssocks whole-Base64 authority preserve literal credentials and explicit TLS',()=>{
  const authority=encode('literal%40user:synthetic%25password@[2001:db8::4]:1080');
  const plain=fields(convert('socks://'+authority+'?remarks=SOCKS'));assert.equal(plain.username,'literal%40user');assert.equal(plain.password,'synthetic%25password');assert.equal(plain.tag,'SOCKS');assert.equal(plain['over-tls'],undefined);
  const encrypted=fields(convert('ssocks://'+authority+'?remarks=TLS&peer=cert.example&allowInsecure=0'));assert.equal(encrypted['over-tls'],'true');assert.equal(encrypted['tls-host'],'cert.example');assert.equal(encrypted['tls-verification'],'true');
  assert.equal(fields(convert('socks://'+authority+'#Fragment')).tag,'Fragment');
  assert.equal(fields(convert('socks://'+authority)).username,'literal%40user');
});

test('HTTP(S) Base64 endpoints and authority preserve auth, fragments, TLS names and secure defaults',()=>{
  const plain=fields(convert('http://'+encode('user:synthetic%40password@proxy.example:8080')+'#HTTP'));assert.equal(plain.username,'user');assert.equal(plain.password,'synthetic%40password');assert.equal(plain.tag,'HTTP');
  const secure=fields(convert('https://'+encode('[2001:db8::5]:8443')+'?peer=cert.example#HTTPS'));assert.equal(secure['over-tls'],'true');assert.equal(secure['tls-verification'],'true');assert.equal(secure['tls-host'],'cert.example');
  const raw=fields(convert('http://literal%40user:synthetic%25password@proxy.example:80#Raw'));assert.equal(raw.username,'literal@user');assert.equal(raw.password,'synthetic%password');
});

test('domain certificate verification is preserved independently from TLS SNI and native booleans',()=>{
  // Official QX 1.7.0 build 938: https://t.me/QuanXNews/415
  const input='http=proxy.example:443, over-tls=true, tls-host=sni.example, tls-verification=certificate.example, tag=Domain';
  assert.equal(parser.parseNodes(input),input+'\n');const output=convert(input);assert.match(output,/tls-host=sni\.example, tls-verification=certificate\.example/);
  for(const domain of ['https://bad.example','bad..example','*.example','bad_domain.example','-bad.example','bad.example:443'])rejects('http=proxy.example:443, over-tls=true, tls-verification='+domain+', tag=Invalid');
});

test('duplicate-name opt-in exposes validated rows only for the later naming stage',()=>{
  const input='http=proxy.example:80, tag=Same\nhttp=proxy.example:81, tag=Same';
  assert.throws(()=>parser.parseNodes(input),/duplicate node name/);
  assert.equal(parser.parseNodes(input,{allowDuplicateNames:true}),input+'\n');
  assert.throws(()=>parser.parseNodes(input+'\nhttp=bad/host:80, tag=Bad',{allowDuplicateNames:true}),/Node conversion failed:/);
});

test('old Quantumult CSV-in-Base64 VMess retains cipher, TLS verification and Host while keeping its distinct AEAD default',()=>{
  // Producer and importer: tindy2013/subconverter subexport.cpp proxyToQuan and subparser.cpp explodeQuan.
  const body='CSV = vmess, proxy.example, 443, chacha20-ietf-poly1305, "'+uuid+'", group=Synthetic, over-tls=true, tls-host=front.example, certificate=1, obfs=ws, obfs-path="/socket", obfs-header="Host: front.example"';
  const f=fields(convert('vmess://'+encode(body)));assert.equal(f.tag,'CSV');assert.equal(f.method,'chacha20-poly1305');assert.equal(f.password,uuid);assert.equal(f.obfs,'wss');assert.equal(f['obfs-host'],'front.example');assert.equal(f['obfs-uri'],'/socket');assert.equal(f['tls-verification'],'true');assert.equal(f.aead,'true');
  const insecure=fields(convert('vmess://'+encode(body.replace('certificate=1','certificate=0'))));assert.equal(insecure['tls-verification'],'false');
  const tcp=fields(convert('vmess://'+encode('TCP = vmess, [2001:db8::6], 80, aes-128-gcm, "'+uuid+'"')+'?tfo=1'));assert.equal(tcp.aead,'true');assert.equal(tcp['fast-open'],'true');
  for(const changed of [body.replace('Host: front.example','Host: front.example[Rr][Nn]Edge: hidden'),body+', unknown=synthetic-secret',body.replace('tls-host=front.example','tls-host=other.example'),body+', certificate=0'])rejects('vmess://'+encode(changed));
});

test('legacy HTTP-header aliases stay distinct from HTTP/2 and retain TCP TLS names without a websocket',()=>{
  for(const scheme of ['vmess','vless']) {
    const prefix=scheme+'://'+encode('none:'+uuid+'@proxy.example:80')+'?remarks=Header';
    const http=fields(convert(prefix+'&obfs=http&obfsParam=front.example&path=%2Fheader&tls=0'));
    assert.equal(http.obfs,'http');assert.equal(http['obfs-host'],'front.example');assert.equal(http['obfs-uri'],'/header');
    const tls=fields(convert(prefix+'&obfs=none&obfsParam=front.example&tls=1&peer=front.example'));
    assert.equal(tls.obfs,'over-tls');assert.equal(tls['obfs-host'],'front.example');
    rejects(prefix+'&obfs=none&obfsParam=front.example&tls=1&peer=other.example');
  }
  const many=ssd({servers:Array.from({length:1001},(_,i)=>({server:'proxy.example',remarks:'Node'+i}))});
  rejects(many+'\n'+many,/node limit exceeded/);
  for(const value of [null,{},true,7]) {
    rejects(ssd({plugin:value}));rejects(ssd({plugin_options:value}));
  }
});

test('final native semantic validation preserves decoded directive-like values while source directives remain rejected',()=>{
  const source='http://synthetic-user:literal%23%21include@proxy.example:80#Name%20%23%21SYSTEM%3Dmac';
  const native=parser.parseNodes(source);
  assert.equal(parser.parseNodes(native),native,'native field tails are literal data even before final validation');
  assert.equal(parser.validateNative(native),native,'canonical semantic validation must preserve tag and credentials verbatim');
  assert.match(native,/tag=Name #!SYSTEM=mac/);assert.match(native,/password=literal#!include/);
  const adaptations=new Set();
  const domain='http=proxy.example:443, over-tls=true, tls-verification=certificate.example, tag=Domain\n';
  assert.equal(parser.validateNative(domain,{adaptations}),domain);assert.deepEqual([...adaptations],['tls-verification-domain']);
  for(const input of ['http=bad/host:80, tag=Bad','http=proxy.example:0, tag=Bad','http=proxy.example:80, over-tls=1, tag=Bad','http=proxy.example:80, command=synthetic-secret, tag=Bad','http=proxy.example:443, over-tls=true, tls-alpn=02, tag=Bad','http=proxy.example:443, tls-verification=bad..example, tag=Bad','http=proxy.example:80, tag=Same\nhttp=proxy.example:81, tag=Same','http=proxy.example:80, tag=Bad\u0000','[server_local]\nhttp=proxy.example:80, tag=Bad'])assert.throws(()=>parser.validateNative(input),/Node conversion failed:/);
  const atomic=new Set();assert.throws(()=>parser.validateNative(domain+'http=bad/host:80, tag=Bad',{adaptations:atomic}),/Node conversion failed:/);assert.equal(atomic.size,0);
  assert.throws(()=>parser.parseNodes('http=proxy.example:80, tag=Safe\n#!include https://example.test/synthetic'),/unsupported executable directive/);
});

test('initial native and URI data retain directive-like literals while standalone and foreign executable directives fail',()=>{
  for(const marker of ['#!SYSTEM=mac','//!SYSTEM=mac','#!include synthetic','#!IOS-ONLY']){
    for(const field of ['tag','password','username']){
      const input='http=proxy.example:80, '+(field==='tag'?'tag=Name '+marker:field+'=literal '+marker+', tag=Name');
      assert.equal(parser.parseNodes(input),input+'\n');assert.equal(convert(input),input+'\n');
    }
    const source='http://synthetic-user:literal%20'+encodeURIComponent(marker)+'@proxy.example:80#Name%20'+encodeURIComponent(marker);
    const result=convert(source);assert.equal(fields(result).tag,'Name '+marker);assert.equal(fields(result).password,'literal '+marker);
    rejects('http=proxy.example:80, tag=Safe\n'+marker,/unsupported executable directive/);
    rejects('[Proxy]\nSafe=http, proxy.example, 80 '+marker,/unsupported executable directive/);
  }
});
