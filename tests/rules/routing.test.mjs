import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadCatalog } from '../../tools/lib/build.mjs';
import { clients } from '../../tools/lib/clients.mjs';
import { renderProfile } from '../../tools/lib/profiles.mjs';
import { inspectProfile } from '../../tools/lib/validation.mjs';
import { matchesEntry } from '../../tools/lib/rules.mjs';

const {rulesets}=await loadCatalog(resolve(import.meta.dirname,'../..'));
const cases=[
  [{host:'api.openai.com'},'openai'],
  [{host:'api.anthropic.com'},'claude'],
  [{host:'gemini.google.com'},'gemini'],
  [{host:'www.youtube.com'},'youtube'],
  [{host:'api.github.com'},'github'],
  [{host:'www.netflix.com'},'netflix'],
  [{host:'telegram.org'},'telegram'],
  [{host:'apple.com'},'apple'],
  [{host:'baidu.com'},'DIRECT'],
  [{host:'doubleclick.net'},'REJECT'],
  [{ip:'192.168.1.10'},'DIRECT'],
  [{ip:'fd00::1234'},'DIRECT'],
  [{host:'unlisted.example.invalid'},'Proxy'],
];
for(const client of clients)test(`${client.id}: full catalog routes concrete apps before broad parent-service lists`,()=>{
  const profile=inspectProfile(client.id,renderProfile(client.id,{rulesets}).content);
  for(const [request,expected] of cases){
    const actual=profile.rules.find(rule=>matchesEntry(rule,request))?.policy??profile.fallback;
    assert.equal(actual,expected,JSON.stringify(request));
  }
});
