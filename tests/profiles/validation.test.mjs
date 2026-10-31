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

test('Surge and Loon recognize local proxy names referenced by selectors',()=>{
  for(const client of ['surge','loon']){
    const rendered=renderProfile(client,{rulesets}).content;
    const withLocal=rendered.replace('[Proxy]','[Proxy]\nFixture-Local = http, 127.0.0.1, 1080');
    const selected=withLocal.replace('Proxy = select, REJECT, DIRECT','Proxy = select, REJECT, DIRECT, Fixture-Local');
    assert.equal(validateProfile(client,selected,rulesets).rules,2);
    assert.throws(()=>validateProfile(client,rendered.replace('Proxy = select, REJECT, DIRECT','Proxy = select, REJECT, DIRECT, Missing-Node'),rulesets),/unknown.*member/i);
  }
});

test('Egern recognizes the name nested in a native protocol proxy object',()=>{
  const config=parse(renderProfile('egern',{rulesets}).content);
  config.proxies=[{http:{name:'Fixture-Local',server:'127.0.0.1',port:1080}}];
  config.policy_groups.find(group=>group.select?.name==='Proxy').select.policies.push('Fixture-Local');
  assert.equal(validateProfile('egern',stringify(config),rulesets).rules,2);
  config.proxies=[];
  assert.throws(()=>validateProfile('egern',stringify(config),rulesets),/unknown.*member/i);
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

// A public template has no credentials, but its validator must accept a user node.
test('quantumultX recognizes local node tags and dynamic node selectors as policy inputs',()=>{
  const rendered=renderProfile('quantumultX',{rulesets}).content;
  const withLocal=rendered.replace('[server_local]', '[server_local]\nsocks5=127.0.0.1:1080, tag=Fixture-Local');
  const selected=withLocal.replace(/^static=Proxy,.*$/m,'static=Proxy,reject,direct,Fixture-Local');
  assert.equal(validateProfile('quantumultX',selected,rulesets).rules,2);
  const dynamic=withLocal.replace(/^static=Proxy,.*$/m,'static=Proxy,reject,direct,server-tag-regex=.+');
  assert.equal(validateProfile('quantumultX',dynamic,rulesets).rules,2);
  assert.throws(()=>validateProfile('quantumultX',withLocal.replace(/^static=Proxy,.*$/m,'static=Proxy,reject,direct,Missing-Node'),rulesets),/unknown.*member/i);
  assert.throws(()=>validateProfile('quantumultX',dynamic.replace('server-tag-regex=.+','server-tag-regex=['),rulesets),/regex/i);
  const extraDynamic=dynamic.replace('[policy]','[policy]\nstatic=Independent-Dynamic,server-tag-regex=^Fixture-');
  assert.equal(validateProfile('quantumultX',extraDynamic,rulesets).rules,2);
});
