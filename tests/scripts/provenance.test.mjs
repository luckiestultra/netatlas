import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadFeatureRegistry } from '../../tools/lib/feature-registry.mjs';
const root=resolve(import.meta.dirname,'../..');
async function fixture(){
  const dir=await mkdtemp(resolve(tmpdir(),'netatlas-feature-source-'));
  await mkdir(resolve(dir,'metadata'));
  for(const path of ['metadata/features.json','metadata/https-upgrade.json','src/features/https-upgrade','src/features/redirects'])await cp(resolve(root,path),resolve(dir,path),{recursive:true});
  return dir;
}
test('a fixed HTTPS projection cannot repeat or replace an admitted host',async()=>{
  for(const change of ['duplicate','cross-host']){
    const dir=await fixture(),path=resolve(dir,'src/features/https-upgrade/rules.json');
    const data=JSON.parse(await readFile(path,'utf8'));
    if(change==='duplicate')data.rules[5]={...data.rules[0]};
    else{
      const lines=(await readFile(resolve(dir,'src/features/https-upgrade/upstream/Redirect.conf.txt'),'utf8')).split(/\r?\n/);
      const index=lines.findIndex(line=>line.includes('aicoin')&&line.includes('url 302'));
      assert.ok(index>=0);
      data.rules[5]={...data.rules[5],host:'www.aicoin.com',upstreamLineNumber:index+1,upstreamLine:lines[index]};
    }
    await writeFile(path,JSON.stringify(data));
    await assert.rejects(()=>loadFeatureRegistry(dir),/host|projection|duplicate|source/i);
  }
});
test('source metadata cannot escape its registered feature directory',async()=>{
  const dir=await fixture(),path=resolve(dir,'metadata/https-upgrade.json');
  const data=JSON.parse(await readFile(path,'utf8'));
  await cp(resolve(dir,data.upstream.vendoredSource),resolve(dir,'src/features/other.txt'));
  data.upstream.vendoredSource='src/features/https-upgrade/../other.txt';
  await writeFile(path,JSON.stringify(data));
  await assert.rejects(()=>loadFeatureRegistry(dir),/escape|registered|source/i);
});

test('complete redirect source/license/count changes cannot bypass build provenance checks',async()=>{
  for(const change of ['source','license','count','line']){
    const dir=await fixture();
    const path=resolve(dir,'src/features/redirects/rules.json');
    const data=JSON.parse(await readFile(path,'utf8'));
    if(change==='source')await writeFile(resolve(dir,data.upstream.vendoredSource),'changed archive\n');
    if(change==='license')await writeFile(resolve(dir,data.upstream.vendoredLicense),'truncated license\n');
    if(change==='count')data.actions.pop();
    if(change==='line')data.actions[0].upstreamLines=data.actions[1].upstreamLines;
    await writeFile(path,JSON.stringify(data));
    await assert.rejects(()=>loadFeatureRegistry(dir),/redirect|license|source|count|line/i);
  }
});
