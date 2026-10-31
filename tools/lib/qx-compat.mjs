// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import configuration from '../../metadata/qx-compat.json' with { type: 'json' };
import { regexRegistry, matchesRegexCondition } from './regex-routing.mjs';
import { publicArtifactUrl } from './public-url.mjs';
import { getClient } from './clients.mjs';
import { assertManagedPaths } from './managed-paths.mjs';

export const qxCompatibility = configuration;
const defaultBase='https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const routeDefinitions=[
  ['openai-compat','openai','openai','chatgpt-async-webps-prod-?*-?*.webpubsub.azure.com','AI服务'],
  ['viu-cdn-compat','viu-portable','viu','ewcdn?*.nowe.com','国外媒体'],
];

function sourceFor(record){
  const source=regexRegistry.expressions.find(item=>item.file===record.sourceFile&&item.rule===record.sourceRule);
  if(!source)throw new Error('QX compatibility source expression is not registered');
  return source;
}

function validate(config){
  assert.equal(config.version,1);assert.equal(config.license,'MIT');
  assert.equal(config.defaultEnabled,false);assert.equal(config.strictCoverageCredit,0);
  assert.equal(config.requiresMatchingOptimizationOff,true);assert.equal(config.requiresManualPlacement,true);
  assert.deepEqual(config.routes.map(route=>[route.id,route.sourceId,route.sourceFile,route.pattern,route.managedPolicy]),routeDefinitions,'Unexpected QX compatibility pattern or policy');
  for(const route of config.routes){
    const source=sourceFor(route),original=new RegExp(source.rule.slice(7));
    const matches=host=>matchesRegexCondition({type:'domain-wildcard',value:route.pattern},host);
    assert.deepEqual(route.positive,source.positive);
    assert.ok(route.extraMatches.length>=2&&route.nonMatches.length>=3);
    for(const host of route.positive)assert.ok(original.test(host)&&matches(host));
    for(const host of route.extraMatches)assert.ok(!original.test(host)&&matches(host),'Undisclosed compatibility widening');
    for(const host of route.nonMatches)assert.equal(matches(host),false);
  }
  const ads=sourceFor(config.httpAds);
  assert.equal(ads.file,'ookla-speedtest');
  assert.match(ads.rule,/^regexp:\^speed/);
  return config;
}

export async function loadQxCompatibility(root){
  await assertManagedPaths(root,['metadata/qx-compat.json']);
  const current=JSON.parse(await readFile(resolve(root,'metadata/qx-compat.json'),'utf8'));
  validate(current);
  assert.deepEqual(current,configuration,'QX compatibility metadata differs from the loaded registry');
  return current;
}

function urlPattern(scheme){
  const host=configuration.httpAds.sourceRule.slice('regexp:^'.length,-1);
  // Native absolute URLs: exact authority, an optional 0..65535 port (including
  // leading zeroes), and path/query. Raw fragments/whitespace are not requests.
  const port='(?::0*(?:[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?';
  return '^'+scheme+':\\/\\/'+host+port+'(?:[/?][^\\s#]*)?(?![\\s\\S])';
}

export function renderQxCompatibility(client,{baseUrl=defaultBase}={}){
  getClient(client);
  if(client!=='quantumultX')return [];
  if(typeof baseUrl!=='string'||!baseUrl)throw new Error('QX compatibility baseUrl must be a nonempty URL string');
  validate(configuration);
  const url=path=>publicArtifactUrl(baseUrl,client,path);
  const header='# NetAtlas QX compatibility — optional; NOT LOSSLESS source-regex restoration.\n'
    +'# MIT; original adapter for the pinned MIT domain-list-community source expressions.\n'
    +'# Not included in default or standalone profiles; strict coverage remains 14/24.\n';
  const artifacts=configuration.routes.map(route=>({
    path:`rules/${route.id}.list`,
    content:header+'# Widening: non-digits and nested labels can match the glob.\n'
      +'# Put this resource before broad service suffixes; keep App matching optimization OFF.\n'
      +'# Set force-policy='+route.managedPolicy+' for the managed profile; '+route.sourceId+' for standalone.\n'
      +`host-wildcard,${route.pattern},${route.sourceId}\n`,
  }));
  const mitm=['coe','open'].flatMap(mode=>[2,3,4,5,6].map(length=>`speed.${mode}.ad.${'?'.repeat(length)}.prod.hosts.ooklaserver.net`));
  for(const scheme of ['http','https'])artifacts.push({
    path:`rewrites/speedtest-ads-${scheme}.snippet`,
    content:header+'# Exact source hostname expression, limited to visible '+scheme.toUpperCase()+' URLs.\n'
      +'# No DNS, UDP, arbitrary TCP, HTTP/3 or certificate-pinning coverage is claimed.\n'
      +(scheme==='https'
        ? '# Explicit HTTPS opt-in: enable MITM yourself and trust your own CA. No certificate is supplied.\n# The MITM glob masks are broader than the reject expression; non-ad hosts can be decrypted.\n'
        : '# HTTP only; no MITM, certificate, script, storage or background request.\n')
      +urlPattern(scheme)+' url reject\n'
      +(scheme==='https'?'\nhostname = '+mitm.join(', ')+'\n':''),
  });
  artifacts.push({path:'fragments/regex-compat.conf',content:header
    +'# Manual merge fragment, NOT a complete profile. Read docs/qx-compatibility.md first.\n'
    +'# Copy only wanted lines to the TOP of [filter_remote], ahead of Microsoft/media suffix resources.\n'
    +'# Keep App matching optimization OFF; no undocumented profile key or automatic UI change is used.\n'
    +'# Native app priority has not been tested. Standalone: replace force-policy with each source ID.\n\n[filter_remote]\n'
    +configuration.routes.map(route=>`${url(`rules/${route.id}.list`)}, tag=${route.id}, force-policy=${route.managedPolicy}, update-interval=86400, opt-parser=false, enabled=true`).join('\n')
    +'\n\n[rewrite_remote]\n'
    +`${url('rewrites/speedtest-ads-http.snippet')}, tag=speedtest-ads-http, enabled=true\n`
    +'# HTTPS is separate and disabled here: enable only after checking its MITM masks and trusting your own CA.\n'
    +`${url('rewrites/speedtest-ads-https.snippet')}, tag=speedtest-ads-https, enabled=false\n`,
  });
  return artifacts;
}
