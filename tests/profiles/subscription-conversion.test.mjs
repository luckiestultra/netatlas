import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeSubscription } from '../../tools/lib/private-profile.mjs';
test('subscription conversion never silently removes mandatory handshake features',()=>{
 for(const node of [
  {name:'SS',type:'ss',server:'127.0.0.1',port:8388,cipher:'aes-128-gcm',password:'fixture',plugin:'obfs','plugin-opts':{mode:'tls',host:'example.test'}},
  {name:'HY2',type:'hysteria2',server:'127.0.0.1',port:443,password:'fixture',obfs:'salamander','obfs-password':'fixture'},
  {name:'SOCKS-TLS',type:'socks5',server:'127.0.0.1',port:1080,tls:true},
 ])assert.throws(()=>materializeSubscription('singBox',JSON.stringify({proxies:[node]})),/native sing-box/);
 const uri='vmess://'+Buffer.from(JSON.stringify({ps:'HTTP-VMess',add:'127.0.0.1',port:443,id:'7c9a3d20-44b0-493e-90d2-9b219674d04c',net:'tcp',type:'http',host:'example.test',path:'/required'})).toString('base64');
 assert.throws(()=>materializeSubscription('singBox',uri),/native sing-box/);
});
test('WebSocket subscriptions preserve authentication headers and early-data handshake fields',()=>{
 const [node]=materializeSubscription('singBox',JSON.stringify({proxies:[{name:'WS',type:'vless',server:'127.0.0.1',port:18443,uuid:'7c9a3d20-44b0-493e-90d2-9b219674d04c',network:'ws','ws-opts':{path:'/secured',headers:{Host:'ws.example',Authorization:'Bearer fixture-required'},'max-early-data':2048,'early-data-header-name':'Sec-WebSocket-Protocol'}}]}));
 assert.deepEqual(node.transport,{type:'ws',path:'/secured',headers:{Host:'ws.example',Authorization:'Bearer fixture-required'},max_early_data:2048,early_data_header_name:'Sec-WebSocket-Protocol'});
});
