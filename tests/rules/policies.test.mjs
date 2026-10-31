import test from 'node:test';
import assert from 'node:assert/strict';
import {policyGroupsFor,orderedRulesets,policyForRuleset} from '../../tools/lib/policies.mjs';
const rule=(id,category='system')=>({id,category,entries:[]});
test('application routing is independent of browsing categories',()=>{
  const groups=policyGroupsFor([rule('google'),rule('apple'),rule('new-service')]);
  assert.equal(groups.find(group=>group.name==='google').choices[0],'Proxy');
  assert.equal(groups.find(group=>group.name==='apple').choices[0],'DIRECT');
  assert.equal(groups.find(group=>group.name==='new-service').choices[0],'Proxy');
  assert.equal(policyForRuleset(rule('lan','network')),'DIRECT');
  assert.equal(policyForRuleset(rule('adblock','privacy')),'REJECT');
});
test('specialized services precede broad Google/Microsoft includes regardless of category tags',()=>{
  const sorted=orderedRulesets([rule('google'),rule('microsoft'),rule('youtube','system'),rule('github','system'),rule('gemini','system'),rule('adblock','privacy'),rule('lan','network')]).map(set=>set.id);
  assert.deepEqual(sorted.slice(0,2),['lan','adblock']);
  assert.ok(sorted.indexOf('youtube')<sorted.indexOf('google'));
  assert.ok(sorted.indexOf('github')<sorted.indexOf('microsoft'));
});

test('Apple TV+, Copilot and npm retain their own policies ahead of their parent services',()=>{
  const sets=[
    {id:'apple',category:'system',entries:[{type:'domain-suffix',value:'apple.com'},{type:'domain-suffix',value:'itunes.apple.com'}]},
    {id:'apple-tvplus',category:'media',entries:[{type:'domain-suffix',value:'tv.apple.com'},{type:'domain',value:'hls.itunes.apple.com'}]},
    {id:'github',category:'development',entries:[{type:'domain-suffix',value:'githubusercontent.com'},{type:'domain-suffix',value:'npmjs.org'}]},
    {id:'github-copilot',category:'ai',entries:[{type:'domain',value:'copilot-proxy.githubusercontent.com'}]},
    {id:'npmjs',category:'development',entries:[{type:'domain-suffix',value:'npmjs.org'}]},
  ];
  const ordered=orderedRulesets(sets);
  // This independent first-match check does not use a renderer, native decoder or production matcher.
  function route(host){
    for(const set of ordered)for(const entry of set.entries){
      if(host===entry.value||(entry.type==='domain-suffix'&&host.endsWith('.'+entry.value)))return set.id;
    }
    return 'Proxy';
  }
  assert.equal(route('tv.apple.com'),'apple-tvplus');
  assert.equal(route('cdn.tv.apple.com'),'apple-tvplus');
  assert.equal(route('hls.itunes.apple.com'),'apple-tvplus');
  assert.equal(route('sub.hls.itunes.apple.com'),'apple');
  assert.equal(route('copilot-proxy.githubusercontent.com'),'github-copilot');
  assert.equal(route('sub.copilot-proxy.githubusercontent.com'),'github');
  assert.equal(route('registry.npmjs.org'),'npmjs');
  assert.equal(route('notnpmjs.org'),'Proxy');
  assert.equal(route('tv.apple.com.invalid'),'Proxy');
  const groups=policyGroupsFor(sets);
  assert.equal(groups.find(group=>group.name==='apple').choices[0],'DIRECT');
  assert.equal(groups.find(group=>group.name==='apple-tvplus').choices[0],'Proxy');
});
