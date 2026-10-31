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
  [{host:'tv.apple.com'},'apple-tvplus'],
  [{host:'hls.itunes.apple.com'},'apple-tvplus'],
  [{host:'sub.hls.itunes.apple.com'},'apple'],
  [{host:'copilot-proxy.githubusercontent.com'},'github-copilot'],
  [{host:'sub.copilot-proxy.githubusercontent.com'},'github'],
  [{host:'registry.npmjs.org'},'npmjs'],
  [{host:'registry-1.docker.io'},'docker'],
  [{host:'gitlab.com'},'gitlab'],
  [{host:'plugins.jetbrains.com'},'jetbrains'],
  [{host:'vercel.com'},'vercel'],
  [{host:'api.groq.com'},'groq'],
  [{host:'api.perplexity.ai'},'perplexity'],
  [{host:'poe.com'},'poe'],
  [{host:'huggingface.co'},'huggingface'],
  [{host:'cursor.sh'},'cursor'],
  [{host:'grok.com'},'xai'],
  [{host:'discord.com'},'discord'],
  [{host:'signal.org'},'signal'],
  [{host:'whatsapp.com'},'whatsapp'],
  [{host:'line.me'},'line'],
  [{host:'slack.com'},'slack'],
  [{host:'zoom.us'},'zoom'],
  [{host:'www.hbo.com'},'hbo'],
  [{host:'www.twitch.tv'},'twitch'],
  [{host:'www.tiktok.com'},'tiktok'],
  [{host:'store.steampowered.com'},'steam'],
  [{host:'notdiscord.com'},'Proxy'],
  [{host:'nothuggingface.co'},'Proxy'],
  [{host:'tv.apple.com.invalid'},'Proxy'],
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
