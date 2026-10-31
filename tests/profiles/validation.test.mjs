import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'yaml';
import { renderProfile } from '../../tools/lib/profiles.mjs';
import { clientIds } from '../../tools/lib/clients.mjs';
import { validateProfile } from '../../tools/lib/validation.mjs';
const rulesets=[{version:1,id:'lan',category:'network',entries:[{type:'ip-cidr',value:'192.168.0.0/16'}]},{version:1,id:'openai',category:'ai',entries:[{type:'domain-suffix',value:'openai.com'}]}];
for(const client of clientIds) test(`${client}: validates actual standalone rules and all policy references`,()=>{
  assert.equal(validateProfile(client,renderProfile(client,{rulesets}).content,rulesets).rules,2);
});

test('large optional rule catalogs do not silently enter any default profile',()=>{
  const expanded=[...rulesets,{version:1,id:'anti-ad',category:'privacy',entries:[{type:'domain-suffix',value:'optional-only.example'}]}];
  for(const client of clientIds){
    const profile=renderProfile(client,{rulesets:expanded}).content;
    assert.doesNotMatch(profile,/optional-only\.example/);
    assert.equal(validateProfile(client,profile,expanded).rules,2);
  }
});
test('broken policy references are rejected across YAML, JSON and INI profiles',()=>{
  const mihomo=parse(renderProfile('mihomo',{rulesets}).content);
  mihomo['proxy-groups']=mihomo['proxy-groups'].filter(group=>group.name!=='openai');
  assert.throws(()=>validateProfile('mihomo',stringify(mihomo),rulesets),/policy|group/i);
  const sing=JSON.parse(renderProfile('singBox',{rulesets}).content);sing.route.final='missing';
  assert.throws(()=>validateProfile('singBox',JSON.stringify(sing),rulesets),/policy|outbound/i);
  const qx=renderProfile('quantumultX',{rulesets}).content.replace(/^static=Proxy,.*\n/m,'');
  assert.throws(()=>validateProfile('quantumultX',qx,rulesets),/policy|group/i);
});
test('profiles cannot drop a source rule or silently broaden the listener',()=>{
  const mihomo=parse(renderProfile('mihomo',{rulesets}).content);
  mihomo.rules=mihomo.rules.filter(line=>!line.startsWith('DOMAIN-SUFFIX'));
  assert.throws(()=>validateProfile('mihomo',stringify(mihomo),rulesets),/rule/i);
  mihomo['allow-lan']=true;
  assert.throws(()=>validateProfile('mihomo',stringify(mihomo),[]),/listen|LAN/i);
});
