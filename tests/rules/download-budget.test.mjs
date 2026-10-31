import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncCatalog } from '../../tools/lib/sync.mjs';
async function fixture(groups,children) {
 const root=await mkdtemp(path.join(tmpdir(),'netatlas-file-budget-'));
 await mkdir(path.join(root,'metadata'));
 const license='MIT fixture\n';
 const registry={version:1,repositories:[{id:'cn-source',repository:'example/cn-source',author:'Fixture',revision:'a'.repeat(40),revisionDate:'2026-10-01T00:00:00Z',license:'MIT',licensePath:'LICENSE',licenseSha256:createHash('sha256').update(license).digest('hex')}],rulesets:Array.from({length:groups},(_,i)=>({id:`part-${i}`,category:'network',source:{repository:'cn-source',list:`group-${i}`},exclusions:[]}))};
 await writeFile(path.join(root,'metadata/upstreams.json'),JSON.stringify(registry));
 return {root,dryRun:true,fetchText:async url=>{if(url.endsWith('/LICENSE'))return license;const match=/\/data\/group-(\d+)$/.exec(url);return match?Array.from({length:children},(_,i)=>`include:leaf-${match[1]}-${i}`).join('\n'):'example.test\n';}};
}
test('catalog download budget supports CN closure plus service lists above 512 files',async()=>{
 const result=await syncCatalog(await fixture(2,264));
 assert.equal(result.downloadedFiles,531);
 assert.equal(result.rulesets.length,2);
});
test('combined source download budget still rejects more than 1024 files',async()=>{
 await assert.rejects(()=>syncCatalogFixture(),/Total source file count exceeded/);
 async function syncCatalogFixture(){return syncCatalog(await fixture(3,341));}
});
