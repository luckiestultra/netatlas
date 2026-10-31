import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseResource, completeResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const native = 'shadowsocks=proxy.example:443, method=aes-128-gcm, password=example, tag=日本';
test('resource dispatcher detects native, URI, base64, structured nodes, rules and rewrites', () => {
  assert.equal(parseResource({content:native}).content, native+'\n');
  assert.match(parseResource({content:'trojan://example@proxy.example:443#Test'}).content,/^trojan=.*tag=Test/m);
  assert.match(parseResource({content:Buffer.from('trojan://example@proxy.example:443#日本').toString('base64')}).content,/tag=日本/);
  assert.match(parseResource({content:'proxies:\n  - name: 日本\n    type: ss\n    server: proxy.example\n    port: 443\n    cipher: aes-128-gcm\n    password: example\n'}).content,/^shadowsocks=.*tag=日本/m);
  assert.equal(parseResource({content:'DOMAIN,example.test,DIRECT'}).content,'host,example.test,direct\n');
  assert.equal(parseResource({content:'payload:\n  - DOMAIN-SUFFIX,example.test,Proxy'}).content,'host-suffix,example.test,Proxy\n');
  assert.equal(parseResource({content:'{"version":3,"rules":[{"domain":["example.test"]}]}'}).content,'host,example.test,proxy\n');
  assert.equal(parseResource({content:'^https://example.test/ad url reject'}).content,'^https://example.test/ad url reject\n');
});
test('fragment overrides are deliberate; filters preserve original rules unless policy is explicit', () => {
  assert.equal(parseResource({content:'example.test',link:'https://example.test/list#type=filter&format=domain-set&domain-mode=exact&policy=Media'}).content,'# NetAtlas: explicit policy override replaces every source policy.\nhost,example.test,Media\n');
  assert.match(parseResource({content:native,link:'https://example.test/sub?token=example#prefix=%E2%98%85&in=%E6%97%A5%E6%9C%AC'}).content,/tag=★日本/);
  assert.throws(()=>parseResource({content:native,link:'https://example.test/#policy=Media'}),/not valid for/);
  assert.throws(()=>parseResource({content:'DOMAIN,example.test,DIRECT',link:'https://example.test/#prefix=x'}),/not valid for/);
});
test('atomic failures contain no partial content, input, subscription URL or credentials', () => {
  for(const content of [native+'\nhysteria2://secret@proxy.example:443#Bad','DOMAIN,example.test,DIRECT\nPROCESS-NAME,private.exe,Proxy','payload: [one, two]\nproxies: []','<html>secret</html>','a'.repeat(2*1024*1024+1)]) {
    const calls=[];
    completeResource({content,link:'https://example.test/?token=very-private'}, value=>calls.push(value));
    assert.equal(calls.length,1);
    assert.deepEqual(Object.keys(calls[0]),['error']);
    assert.doesNotMatch(calls[0].error,/private|secret|password|https:\/\//);
  }
  let calls=0;
  assert.throws(()=>completeResource({content:native},()=>{calls++;throw new Error('host failure');}),/host failure/);
  assert.equal(calls,1,'host completion throwing must not cause a second completion');
});
test('standalone browser bundle executes without Node/browser/network APIs and completes once', () => {
  const code=bundleResourceParser();
  assert.equal(code,bundleResourceParser(),'bundle is deterministic');
  assert.equal(/KOP-XIAO|(?:from|require\()\s*["']node:|\/Users\/xingyun/.test(code),false,'bundle has no former parser reference, Node import or local path');
  for(const content of [native,'proxies:\n - {name: Test, type: ss, server: proxy.example, port: 443, cipher: aes-128-gcm, password: example}','DOMAIN,example.test,DIRECT','^https://example.test/ad url reject','TUIC://example']) {
    const results=[];
    const denied=()=>{throw new Error('network/storage forbidden');};
    const context={$resource:{content},$done:value=>results.push(value),$parser:{},fetch:denied,$task:{fetch:denied},$httpClient:{get:denied},$prefs:{valueForKey:denied},console:{log:denied},URL:undefined,URLSearchParams:undefined,Buffer:undefined,atob:undefined,TextDecoder:undefined,Intl:undefined};
    vm.runInNewContext(code,context,{timeout:3000});
    assert.equal(results.length,1);
    assert.equal(typeof context.$parser.hashSchema,'function');
    assert.equal(typeof context.$parser.hashToUI,'function');
    assert.equal(typeof context.$parser.uiToHash,'function');
    if(content.startsWith('TUIC'))assert.equal(typeof results[0].error,'string');else assert.equal(typeof results[0].content,'string');
  }
});
