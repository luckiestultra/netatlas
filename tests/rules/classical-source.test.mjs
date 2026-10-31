import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClassicalYaml } from '../../tools/lib/classical-source.mjs';
test('registered classical source imports all five portable types with exact native meaning',()=>{
  const result=parseClassicalYaml('payload:\n - DOMAIN,api.example\n - DOMAIN-SUFFIX,example.com\n - DOMAIN-KEYWORD,stream\n - IP-CIDR,192.0.2.0/24\n - IP-CIDR6,2001:db8::/32,no-resolve\n','fixture.yaml');
  assert.equal(result.entries.length,5);
  assert.ok(result.entries.some(entry=>entry.type==='domain-keyword'&&entry.value==='stream'));
});
test('a classical service slice is an explicit raw token allowlist and cannot broaden on upstream change',()=>{
  const source='payload:\n - DOMAIN-SUFFIX,service.example\n - DOMAIN-SUFFIX,unrelated.example\n - PROCESS-NAME,NotPortable\n';
  assert.deepEqual(parseClassicalYaml(source,'f.yaml',['DOMAIN-SUFFIX,service.example']).entries,[{type:'domain-suffix',value:'service.example'}]);
  assert.throws(()=>parseClassicalYaml(source,'f.yaml'),/unsupported/i);
  assert.throws(()=>parseClassicalYaml(source,'f.yaml',['DOMAIN-SUFFIX,missing.example']),/missing/i);
  assert.throws(()=>parseClassicalYaml(source,'f.yaml',['DOMAIN-SUFFIX,service.example','DOMAIN-SUFFIX,service.example']),/selection/i);
});
test('classical source parser rejects format tricks and unsupported rule options',()=>{
  for(const text of ['payload:\n - RULE-SET,https://other.example/list\n','payload:\n - DOMAIN,service.example,Proxy\n','payload:\n - DOMAIN,service.example,no-resolve\n','payload: ["DOMAIN,ok.example"]\nscript: unsafe\n','payload:\n - IP-CIDR,192.0.2.1/24\n','payload: []\n'])assert.throws(()=>parseClassicalYaml(text,'bad.yaml'));
});
