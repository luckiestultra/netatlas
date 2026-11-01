import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadCatalog } from '../../tools/lib/build.mjs';
import { managedModel } from '../../tools/lib/managed-profiles.mjs';
import { matchesEntry } from '../../tools/lib/rules.mjs';
import { profileRoutingResources } from '../../tools/lib/routing-extensions.mjs';
import { matchesRegexCondition } from '../../tools/lib/regex-routing.mjs';
import { clientIds } from '../../tools/lib/clients.mjs';
const root=resolve(import.meta.dirname,'../..');
test('expanded service policies retain domestic/media routes and child-before-corporate/media parents',async()=>{
  const {rulesets}=await loadCatalog(root);
  const model=managedModel('quantumultX',{rulesets});
  const byId=new Map([...rulesets,...profileRoutingResources('quantumultX',rulesets)].map(rule=>[rule.id,rule]));
  const match=host=>model.rules.find(rule=>byId.get(rule.id).entries.some(entry=>['domain-regex','domain-wildcard'].includes(entry.type)?matchesRegexCondition(entry,host):['ip-asn','geoip'].includes(entry.type)?false:matchesEntry(entry,{host})));
  for(const [host,policy] of [['www.bilibili.com','国内媒体'],['www.douyin.com','国内媒体'],['www.tiktok.com','国外媒体'],['www.alipay.com','国内服务'],['api.github.com','开发服务'],['www.youtube.com','国外媒体'],['www.apple.com','苹果服务'],['y.qq.com','国内媒体'],['music.qq.com','国内媒体'],['kugou.com','国内媒体'],['litvfreepc.akamaized.net','国外媒体'],['tra-ww000-cp.akamaized.net','国外媒体']])assert.equal(match(host)?.policy,policy,host);
  for(const host of ['captive.apple.com','dns.msftncsi.com','www.msftconnecttest.com'])assert.equal(match(host)?.policy,'DIRECT',host);
  assert.equal(match('app.adjust.com')?.policy,'规则修正');
  assert.equal(match('ads.app.adjust.com')?.policy,'REJECT');
  assert.equal(model.groups.find(group=>group.name==='规则修正').choices[0],'DIRECT');
  assert.equal(match('www.google.cn')?.policy,'谷歌服务','regional direct subset must not change the default Google proxy route');
  assert.equal(model.rules.some(rule=>rule.id==='google-cn'),false,'regional direct subset remains independently available, opt-in only');
  const order=id=>model.rules.findIndex(rule=>rule.id===id);
  for(const [child,parent] of [['hulu-jp','hulu'],['hbo-asia','hbo'],['steam-cn','steam'],['alipay','alibaba'],['quark','alibaba'],['tiktok','bytedance'],['icloud','apple'],['onedrive','microsoft'],['hulu','disney'],['mytvsuper','tvb'],['disney','global-media'],['hmt-media','global-media'],['global-media','china']])if(order(child)>=0)assert.ok(order(child)<order(parent),child+' before '+parent);
  assert.equal(model.groups.find(group=>group.name==='国内媒体').choices[0],'DIRECT');
});

for (const client of clientIds) test(`${client}: Grok retains the AI policy before the Twitter parent domain`, async () => {
  const { rulesets } = await loadCatalog(root);
  const model = managedModel(client, { rulesets });
  const byId = new Map([...rulesets, ...profileRoutingResources(client, rulesets)].map(rule => [rule.id, rule]));
  const policyForHost = host => model.rules.find(rule => byId.get(rule.id).entries.some(entry =>
    entry.type.startsWith('domain') && (['domain-regex', 'domain-wildcard'].includes(entry.type)
      ? matchesRegexCondition(entry, host) : matchesEntry(entry, { host }))
  ))?.policy;
  for (const host of ['grok.com', 'grok.x.com', 'cdn.grok.x.com']) assert.equal(policyForHost(host), 'AI服务', host);
  for (const host of ['x.com', 'www.x.com', 'notgrok.x.com']) assert.equal(policyForHost(host), '即时通讯', host);
  assert.equal(policyForHost('grok.x.com.invalid'), undefined);
});
