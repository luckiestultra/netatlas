import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, cp, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { createBuild, compareBuild, publishBuild, loadCatalog } from '../tools/lib/build.mjs';

const root=resolve(import.meta.dirname,'..');
test('all eight client trees are deterministic, App-first and service-first',async()=>{
  const a=await createBuild(root),b=await createBuild(root);
  assert.deepEqual(a.files,b.files);
  assert.equal(a.clients.length,8);
  for(const client of a.clients){
    const prefix=client.id+'/';
    const paths=[...a.files.keys()].filter(path=>path.startsWith(prefix)).map(path=>path.slice(prefix.length));
    const extraRuleResources={quantumultX:8,surge:8,loon:8,shadowrocket:6,egern:13,stash:13,mihomo:13,singBox:11};
    assert.equal(paths.filter(path=>path.startsWith('rules/')).length,a.rulesets.length+extraRuleResources[client.id]);
    assert.ok(paths.every(path=>!/^rules\/[^/]+\//.test(path)));
    const manifest=JSON.parse(a.files.get(prefix+'manifest.json'));
    assert.equal(manifest.validation.profile,'managed-resources-and-references');
    assert.ok(paths.includes('profiles/standalone.'+client.profileExtension));
    assert.equal(manifest.validation.native,'not-run');
    assert.equal(manifest.artifacts.length,paths.length-1);
  }
});
test('publishing preserves prior output, check detects edits, overwrite refuses manual changes',async()=>{
  const temp=await mkdtemp(resolve(tmpdir(),'atlas-build-'));
  const build=await createBuild(root);
  assert.equal((await compareBuild(temp,build)).length,build.files.size);
  await publishBuild(temp,build);
  assert.deepEqual(await compareBuild(temp,build),[]);
  const path=resolve(temp,'clients/quantumultX/rules/openai.list');
  await writeFile(path,'manual edit\n');
  assert.match((await compareBuild(temp,build)).join('\n'),/openai.list/);
  await assert.rejects(()=>publishBuild(temp,build),/modified|manual/i);
  assert.equal(await readFile(path,'utf8'),'manual edit\n');
});
test('source checksum mismatch blocks generation',async()=>{
  const temp=await mkdtemp(resolve(tmpdir(),'atlas-source-'));
  await cp(resolve(root,'src/rules'),resolve(temp,'src/rules'),{recursive:true});
  await cp(resolve(root,'src/supplements'),resolve(temp,'src/supplements'),{recursive:true});
  await mkdir(resolve(temp,'metadata'),{recursive:true});
  await cp(resolve(root,'metadata/upstreams.json'),resolve(temp,'metadata/upstreams.json'));
  const catalog=await loadCatalog(temp);
  await writeFile(resolve(temp,catalog.sources[0].path),'{}\n');
  await assert.rejects(()=>loadCatalog(temp),/checksum|ruleset|format|empty/i);
});

test('manual edits to the generated root catalog block replacement too',async()=>{
  const temp=await mkdtemp(resolve(tmpdir(),'atlas-catalog-'));
  const build=await createBuild(root);
  await publishBuild(temp,build);
  const path=resolve(temp,'clients/catalog.json');
  const catalog=JSON.parse(await readFile(path,'utf8'));
  catalog.personalNote='keep this manual annotation';
  await writeFile(path,JSON.stringify(catalog,null,2)+'\n');
  await assert.rejects(()=>publishBuild(temp,build),/modified.*catalog|catalog.*integrity/i);
  assert.match(await readFile(path,'utf8'),/keep this manual annotation/);
});

test('a build cannot be published after any of its inputs change',async()=>{
  const temp=await mkdtemp(resolve(tmpdir(),'atlas-stale-build-'));
  for(const path of ['src','metadata','tools','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md']){
    await cp(resolve(root,path),resolve(temp,path),{recursive:true});
  }
  const build=await createBuild(temp);
  await writeFile(resolve(temp,'LICENSE'),'changed after rendering\n');
  await assert.rejects(()=>publishBuild(temp,build),/inputs changed/i);
  assert.deepEqual((await readdir(temp)).sort(),['LICENSE','THIRD_PARTY_NOTICES.md','metadata','package-lock.json','package.json','src','tools']);
});

test('a symlinked build cache cannot write batches outside the repository',async()=>{
  const temp=await mkdtemp(resolve(tmpdir(),'netatlas-linked-cache-'));
  const outside=await mkdtemp(resolve(tmpdir(),'netatlas-outside-cache-'));
  await writeFile(resolve(outside,'sentinel.txt'),'must remain untouched\n');
  await symlink(outside,resolve(temp,'.cache'),'dir');
  const build=await createBuild(root);
  await assert.rejects(()=>publishBuild(temp,build),/symlink/i);
  assert.deepEqual(await readdir(outside),['sentinel.txt']);
  assert.equal(await readFile(resolve(outside,'sentinel.txt'),'utf8'),'must remain untouched\n');
  await assert.rejects(()=>readdir(resolve(temp,'clients')),/ENOENT/);
});
