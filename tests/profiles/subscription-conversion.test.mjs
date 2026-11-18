import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPrivateProfile, materializeSubscription } from '../../tools/lib/private-profile.mjs';

const uuid='7c9a3d20-44b0-493e-90d2-9b219674d04c';

test('subscription conversion never silently removes mandatory handshake features',()=>{
 for(const node of [
  {name:'SS',type:'ss',server:'127.0.0.1',port:8388,cipher:'aes-128-gcm',password:'fixture',plugin:'obfs','plugin-opts':{mode:'tls',host:'example.test'}},
  {name:'HY2',type:'hysteria2',server:'127.0.0.1',port:443,password:'fixture',obfs:'salamander','obfs-password':'fixture'},
  {name:'SOCKS-TLS',type:'socks5',server:'127.0.0.1',port:1080,tls:true},
 ])assert.throws(()=>materializeSubscription('singBox',JSON.stringify({proxies:[node]})),/native sing-box/);
 const uri='vmess://'+Buffer.from(JSON.stringify({ps:'HTTP-VMess',add:'127.0.0.1',port:443,id:uuid,net:'tcp',type:'http',host:'example.test',path:'/required'})).toString('base64');
 assert.throws(()=>materializeSubscription('singBox',uri),/native sing-box/);
 for(const hy2 of [
  'hy2://secret@127.0.0.1:443?sni=example.test&obfs=salamander&obfs-password=secret#HY2',
  'hysteria2://secret@127.0.0.1:443?sni=example.test&pinSHA256=00:11#HY2',
  'hy2://secret@127.0.0.1:443?sni=example.test&mport=20000-30000#HY2',
 ])assert.throws(()=>materializeSubscription('singBox',hy2),/native sing-box/);
});

test('WebSocket subscriptions preserve authentication headers and early-data handshake fields',()=>{
 const [node]=materializeSubscription('singBox',JSON.stringify({proxies:[{name:'WS',type:'vless',server:'127.0.0.1',port:18443,uuid,network:'ws','ws-opts':{path:'/secured',headers:{Host:'ws.example',Authorization:'Bearer fixture-required'},'max-early-data':2048,'early-data-header-name':'Sec-WebSocket-Protocol'}}]}));
 assert.deepEqual(node.transport,{type:'ws',path:'/secured',headers:{Host:'ws.example',Authorization:'Bearer fixture-required'},max_early_data:2048,early_data_header_name:'Sec-WebSocket-Protocol'});
});

test('sing-box URI importer converts standard Hysteria2 and AnyTLS links with mandatory TLS',()=>{
 const [hy2,anytls]=materializeSubscription('singBox',[
  'hy2://hy2-secret@198.51.100.10:8443?sni=hy2.example.test&alpn=h3&insecure=0#HY2%20Node',
  'anytls://any-secret@198.51.100.11:443?peer=any.example.test&fp=chrome#AnyTLS%20Node',
 ].join('\n'));
 assert.deepEqual(hy2,{type:'hysteria2',tag:'HY2 Node',server:'198.51.100.10',server_port:8443,password:'hy2-secret',tls:{enabled:true,server_name:'hy2.example.test',alpn:['h3']}});
 assert.deepEqual(anytls,{type:'anytls',tag:'AnyTLS Node',server:'198.51.100.11',server_port:443,password:'any-secret',tls:{enabled:true,server_name:'any.example.test',utls:{enabled:true,fingerprint:'chrome'}}});
});

test('disabled TLS verification and TLS stripping are rejected across VMess, VLESS, Trojan, Hysteria2 and AnyTLS URIs',()=>{
 const vmessInsecure=extra=>'vmess://'+Buffer.from(JSON.stringify({ps:'Insecure',add:'127.0.0.1',port:443,id:uuid,net:'tcp',tls:'tls',...extra})).toString('base64');
 for(const bad of [
  vmessInsecure({allowInsecure:true}),
  vmessInsecure({allowInsecure:1}),
  vmessInsecure({'skip-cert-verify':true}),
  `vless://${uuid}@127.0.0.1:443?security=tls&allowInsecure=true#Bad`,
  `vless://${uuid}@127.0.0.1:443?security=tls&insecure=true#Bad`,
  'trojan://secret@127.0.0.1:443?insecure=true#Bad',
  'trojan://secret@127.0.0.1:443?security=none#Bad',
  'hy2://secret@127.0.0.1:443?insecure=1#Bad',
  'anytls://secret@127.0.0.1:443?security=none#Bad',
 ])assert.throws(()=>materializeSubscription('singBox',bad),/TLS/i);
 assert.throws(()=>materializeSubscription('singBox','trojan://secret@127.0.0.1:443#%E0%A4%A'),error=>!error.message.includes('secret')&&/percent-encoded/i.test(error.message));
});

test('createPrivateProfile bounds retained .previous-* backup files across repeated refreshes',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'netatlas-priv-backups-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 for(const dir of ['metadata','src/rules','private'])await mkdir(path.join(root,dir),{recursive:true});
 await writeFile(path.join(root,'metadata/upstreams.json'),JSON.stringify({version:1,rulesets:[],repositories:[]}));
 const inputFile=path.join(root,'private/singBox.json'),outputFile=path.join(root,'private/singBox.out.json');
 await writeFile(inputFile,JSON.stringify({version:1,subscriptions:[{name:'Sub',url:'https://fixture.invalid/sub'}]}),{mode:0o600});
 for(let round=1;round<=5;round++){
  await createPrivateProfile({root,client:'singBox',inputFile,outputFile,fetchText:async()=>`trojan://secret@198.51.100.${round}:443?sni=example.test#Node-${round}`});
 }
 const files=await readdir(path.join(root,'private'));
 const backups=files.filter(name=>name.startsWith('singBox.out.json.previous-'));
 assert.equal(backups.length,2,'at most 2 previous private profile backups should remain');
});
