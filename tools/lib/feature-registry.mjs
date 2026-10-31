import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { getClient } from './clients.mjs';
import { normalizeEntry, stableId } from './rules.mjs';
import { assertManagedPaths } from './managed-paths.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function loadFeatureRegistry(root) {
  await assertManagedPaths(root,['metadata/features.json','metadata/https-upgrade.json','src/features/https-upgrade/rules.json']);
  const registry=JSON.parse(await readFile(resolve(root,'metadata/features.json'),'utf8'));
  if(registry.version!==1||!Array.isArray(registry.features))throw new Error('Invalid feature registry');
  const ids=new Set();
  for(const feature of registry.features){
    if(!stableId.test(feature.id)||ids.has(feature.id)||feature.defaultEnabled!==false)throw new Error('Invalid, duplicate or automatically enabled optional feature');
    if(!Array.isArray(feature.sources)||feature.sources.some(source=>{try{const url=new URL(source);return typeof source!=='string'||url.protocol!=='https:'||url.username||url.password;}catch{return true;}}))throw new Error('Invalid feature source URL');
    ids.add(feature.id);
    for(const [client,adapter] of Object.entries(feature.clients??{})){
      getClient(client);
      if(!Array.isArray(adapter.artifacts)||adapter.artifacts.some(path=>! /^(?:modules|scripts|rewrites|fragments|rules)\/[a-z0-9.-]+$/.test(path)))throw new Error(`Invalid feature artifact: ${feature.id}/${client}`);
    }
  }
  const feature=registry.features.find(item=>item.id==='https-upgrade');
  if(feature){
    const detail=JSON.parse(await readFile(resolve(root,'metadata/https-upgrade.json'),'utf8'));
    if(detail.license!=='GPL-2.0-only'||feature.license!==detail.license||feature.upstream.sourceSha256!==detail.upstream.sourceSha256)throw new Error('HTTPS-upgrade provenance or license mismatch');
    if(!/^[a-f0-9]{40}$/.test(detail.upstream.commit))throw new Error('HTTPS-upgrade source is not pinned');
    for(const [path,hash] of [[detail.upstream.vendoredSource,detail.upstream.sourceSha256],[detail.upstream.vendoredLicense,detail.upstream.licenseSha256]]){
      if(!resolve(root,path).startsWith(resolve(root,'src/features/https-upgrade')+sep))throw new Error('Feature source escapes its registered directory');
      await assertManagedPaths(root,[path]);
      if(sha256(await readFile(resolve(root,path)))!==hash)throw new Error('HTTPS-upgrade source or license checksum mismatch');
    }
    const lines=(await readFile(resolve(root,detail.upstream.vendoredSource),'utf8')).split(/\r?\n/);
    const projection=JSON.parse(await readFile(resolve(root,'src/features/https-upgrade/rules.json'),'utf8'));
    if(projection.license!==detail.license||projection.rules.length!==detail.selectedRuleCount)throw new Error('HTTPS-upgrade projection metadata mismatch');
    const expectedHosts=new Set(detail.hosts),seenHosts=new Set();
    if(expectedHosts.size!==detail.selectedRuleCount)throw new Error('Invalid registered HTTPS hosts');
    for(const rule of projection.rules){
      if(!expectedHosts.has(rule.host)||seenHosts.has(rule.host))throw new Error('Unexpected or duplicate host in HTTPS-upgrade projection');
      seenHosts.add(rule.host);
      if(normalizeEntry({type:'domain',value:rule.host}).value!==rule.host||lines[rule.upstreamLineNumber-1]!==rule.upstreamLine)throw new Error('HTTPS-upgrade projection differs from its recorded source');
      const destination=/\surl\s+302\s+(https:\/\/[^\s]+)$/.exec(rule.upstreamLine)?.[1];
      const url=destination&&new URL(destination);
      if(!url||url.hostname!==rule.host||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('HTTPS-upgrade destination differs from its registered host');
      const originPattern=rule.upstreamLine.split(/\s+/)[0];
      if(!new RegExp(originPattern).test('http://'+rule.host+'/'))throw new Error('HTTPS-upgrade source does not match the registered origin host');
    }
  }
  const redirects=registry.features.find(item=>item.id==='redirects');
  if(redirects){
    const path='src/features/redirects/rules.json';
    await assertManagedPaths(root,[path]);
    const detail=JSON.parse(await readFile(resolve(root,path),'utf8'));
    const region=registry.features.find(item=>item.id==='biliintl-region');
    if(detail.license!=='GPL-2.0-only'||redirects.license!==detail.license||region?.license!==detail.license||redirects.ruleCount!==detail.actions?.length||region.ruleCount!==detail.regionActions?.length*2)throw new Error('Redirect license or action count mismatch');
    if(!/^[a-f0-9]{40}$/.test(detail.upstream.commit))throw new Error('Redirect source must be pinned');
    for(const [path,hash] of [[detail.upstream.vendoredSource,detail.upstream.sourceSha256],[detail.upstream.vendoredLicense,detail.upstream.licenseSha256]]){
      if(!resolve(root,path).startsWith(resolve(root,'src/features/redirects')+sep))throw new Error('Redirect source escapes registered directory');
      await assertManagedPaths(root,[path]);
      if(sha256(await readFile(resolve(root,path)))!==hash)throw new Error('Redirect source or license checksum mismatch');
    }
    const lines=(await readFile(resolve(root,detail.upstream.vendoredSource),'utf8')).split(/\r?\n/);
    const sourceLines=lines.flatMap((line,index)=>/\surl\s+302\s/.test(line)?[index+1]:[]);
    const covered=[...detail.actions,...detail.regionActions].flatMap(action=>action.upstreamLines??[]);
    const inventory=[...covered,...detail.deduplicatedUpstreamLines];
    if(new Set(inventory).size!==inventory.length||JSON.stringify(inventory.sort((a,b)=>a-b))!==JSON.stringify(sourceLines))throw new Error('Redirect source line accounting mismatch');
    for(const action of detail.actions){
      if(!['root','upgrade','google','homepage','firefox'].includes(action.mode)||action.upstreamLines.some(index=>lines[index-1].trim().split(/\s+/).at(-1)!==action.upstreamTarget))throw new Error('Redirect action does not identify its original source');
      if(action.mode!=='upgrade'){
        const url=new URL(action.target);
        if(url.protocol!=='https:'||url.username||url.password)throw new Error('Redirect target must use HTTPS');
      }
    }
  }
  return registry;
}
