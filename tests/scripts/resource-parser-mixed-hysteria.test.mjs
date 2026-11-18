import test from 'node:test';
import assert from 'node:assert/strict';
import { completeResource, parseResource } from '../../src/features/resource-parser/core.mjs';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';

const id='12345678-1234-1234-1234-123456789abc';
const good=`vless://${id}@example.com:443?encryption=none&type=ws&security=tls&sni=example.com&host=example.com&path=%2Fws&fp=chrome&pcs=&quicSecurity=none&serviceName=&headerType=none#valid`;
const unsupported='hysteria2://secret@example.net:443?sni=example.net#unsupported';
const encoded=s=>Buffer.from(s).toString('base64');

test('mixed encoded subscription keeps valid nodes and reports unsupported Hysteria2',()=>{
  const results=[], notices=[];
  completeResource({type:'server',content:encoded(good+'\n'+unsupported)},x=>results.push(x),(...x)=>notices.push(x));
  assert.equal(results.length,1); assert.match(results[0].content,/^vless=example\.com:443,/m);
  assert.match(results[0].content,/skipped 1 unsupported Hysteria2/);
  assert.equal(notices.length,1); assert.match(notices[0].join(' '),/1 条/);
  assert.doesNotMatch(notices[0].join(' '),/secret|example\.net/);
});

test('mixed Clash, sing-box and Surge/Loon subscriptions skip Hysteria2 consistently without leaking secrets',()=>{
  const clash={proxies:[
    {name:'Valid Clash',type:'vless',server:'example.com',port:443,uuid:id,tls:true,servername:'example.com'},
    {name:'HY2 Clash',type:'hysteria2',server:'hy.example.net',port:443,password:'hy2-secret'},
  ]};
  const singbox={outbounds:[
    {tag:'Valid SingBox',type:'vless',server:'example.com',server_port:443,uuid:id,tls:{enabled:true,server_name:'example.com'}},
    {tag:'HY2 SingBox',type:'hysteria2',server:'hy.example.net',server_port:443,password:'hy2-secret'},
  ]};
  const surge='[Proxy]\nValid Surge = http, example.com, 80\nHY2 Surge = hysteria2, hy.example.net, 443, password=hy2-secret';
  for(const content of [JSON.stringify(clash),JSON.stringify(singbox),surge]){
    const results=[], notices=[];
    completeResource({type:'server',content},x=>results.push(x),(...x)=>notices.push(x));
    assert.equal(results.length,1);
    assert.match(results[0].content,/skipped 1 unsupported Hysteria2/);
    assert.doesNotMatch(results[0].content,/hy2-secret|hy\.example\.net/);
    assert.equal(notices.length,1);
    assert.match(notices[0].join(' '),/1 条/);
    assert.doesNotMatch(notices[0].join(' '),/hy2-secret|hy\.example\.net/);
  }
  assert.throws(()=>createNodeParser().parseNodes(clash),/unsupported/i);
});

test('unsupported-only and malformed supported nodes fail without partial output',()=>{
  const clashOnly={proxies:[{name:'HY2',type:'hysteria2',server:'hy.example.net',port:443,password:'secret'}]};
  const singOnly={outbounds:[{tag:'HY2',type:'hysteria2',server:'hy.example.net',server_port:443,password:'secret'}]};
  const surgeOnly='[Proxy]\nHY2 = hysteria2, hy.example.net, 443, password=secret';
  for(const content of [unsupported, good+'\n'+unsupported+'\n'+good.replace('pcs=', 'pcs=malicious'), JSON.stringify(clashOnly), JSON.stringify(singOnly), surgeOnly]){
    const calls=[];completeResource({type:'server',content:content.startsWith('[')||content.startsWith('{')?content:encoded(content)},v=>calls.push(v));
    assert.equal(calls.length,1);assert.equal(typeof calls[0].error,'string');assert.equal(calls[0].content,undefined);
  }
  for(const altered of [good.replace('serviceName=','serviceName=grpc'),good.replace('quicSecurity=none','quicSecurity=aes-128-gcm'),good.replace('pcs=','pcs=secret')])assert.throws(()=>parseResource({type:'server',content:altered}));
});

test('QX native subscription accepts comma-separated text in a final tag without treating it as options',()=>{
  const node='shadowsocks=quota.example:443, method=aes-128-gcm, password=example, fast-open=false, udp-relay=false, tag=流量信息,剩余100GB,到期2027';
  const resource={type:'server',content:encoded(node+'\n'+good),link:'https://example.test/sub'};
  const output=parseResource(resource).content;
  assert.match(output,/tag=流量信息，剩余100GB，到期2027/);
  assert.equal(output.split('\n').filter(l=>/^(vless|shadowsocks)=/.test(l)).length,2);
  for(const attack of [node+', tls-verification=false',node+', password=changed',node+',tag=other']){
    assert.throws(()=>parseResource({type:'server',content:encoded(attack)}));
  }
});

test('URI, VMess JSON, Clash, SIP008, sing-box and Surge/Loon node names normalize commas while keeping credential commas rejected',()=>{
  const vmess=Buffer.from(JSON.stringify({v:'2',ps:'Tokyo, JP, 01',add:'example.com',port:'443',id,aid:'0',scy:'auto',net:'tcp',tls:'tls',sni:'example.com'})).toString('base64');
  const sources=[
    [`vless://${id}@example.com:443?encryption=none&security=tls&sni=example.com#Los%20Angeles%2C%20US%2001`,'tag=Los Angeles， US 01'],
    [`vmess://${vmess}`,'tag=Tokyo， JP， 01'],
    [JSON.stringify({proxies:[{name:'HK, BGP, IPLC',type:'http',server:'example.com',port:80}]}),'tag=HK， BGP， IPLC'],
    [JSON.stringify({version:1,servers:[{server:'example.com',server_port:8388,method:'aes-128-gcm',password:'example',remarks:'SG, IEPL'}]}),'tag=SG， IEPL'],
    [JSON.stringify({outbounds:[{tag:'TW, Hinet',type:'http',server:'example.com',server_port:80}]}),'tag=TW， Hinet'],
    ['[Proxy]\nUS, GIA = http, example.com, 80','tag=US， GIA'],
  ];
  for(const [content,expected] of sources){
    const output=parseResource({type:'server',content}).content;
    assert.ok(output.includes(expected),`expected ${expected} in ${output}`);
  }
  assert.throws(()=>parseResource({type:'server',content:JSON.stringify({proxies:[{name:'HK, BGP',type:'http',server:'example.com',port:80,password:'bad,password'}]})}),/unrepresentable field/);
});
