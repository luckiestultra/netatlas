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
