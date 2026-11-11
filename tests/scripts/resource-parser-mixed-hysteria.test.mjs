import test from 'node:test';
import assert from 'node:assert/strict';
import { completeResource, parseResource } from '../../src/features/resource-parser/core.mjs';

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

test('unsupported-only and malformed supported nodes fail without partial output',()=>{
  for(const content of [unsupported, good+'\n'+unsupported+'\n'+good.replace('pcs=', 'pcs=malicious')]){
    const calls=[];completeResource({type:'server',content:encoded(content)},v=>calls.push(v));
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
