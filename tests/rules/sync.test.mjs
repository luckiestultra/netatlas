import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, chmod, rename, symlink, cp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDomainList, fetchBoundedText, parseDomainList, publishCatalog, recoverPublication, syncCatalog } from '../../tools/lib/sync.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const revision = 'a'.repeat(40);
const license = 'MIT License\nCopyright test fixture\n';
const execute = promisify(execFile);

test('conditional includes filter attributes without changing match types', async () => {
  const files = {
    main: 'include:child @cn @-ads\nfull:Exact.Example.ORG\n',
    child: 'example.cn @cn\nad.example.cn @cn @ads\nother.example.org\n'
  };
  const result = await collectDomainList('main', { readFile: async name => files[name] });
  assert.deepEqual(result.entries, [
    { type: 'domain-suffix', value: 'example.cn' },
    { type: 'domain', value: 'exact.example.org' }
  ]);
  assert.equal(result.excluded.length, 0);
});

test('an unsupported upstream expression fails unless exactly reviewed', async () => {
  const text = 'example.org\nregexp:^api[0-9]+\\.example\\.org$\n';
  await assert.rejects(collectDomainList('main', { readFile: async () => text }), /main:2.*regexp/);
  const result = await collectDomainList('main', {
    readFile: async () => text,
    exclusions: [{ file: 'main', rule: 'regexp:^api[0-9]+\\.example\\.org$', reason: 'No equivalent portable matcher.' }]
  });
  assert.deepEqual(result.entries, [{ type: 'domain-suffix', value: 'example.org' }]);
  assert.equal(result.excluded[0].line, 2);
  assert.equal(result.excluded[0].rule, 'regexp:^api[0-9]+\\.example\\.org$');
});

test('a newly introduced unsupported expression cannot use a broad exclusion', async () => {
  await assert.rejects(collectDomainList('main', {
    readFile: async () => 'regexp:^new\\.example$\n',
    exclusions: [{ file: 'main', rule: 'regexp:^old\\.example$', reason: 'Previously reviewed.' }]
  }), /Unsupported/);
});

test('include cycles and traversal are rejected with a source location', async () => {
  await assert.rejects(collectDomainList('main', { readFile: async () => 'include:main' }), /cycle/);
  assert.throws(() => parseDomainList('include:../private', 'main'), /Invalid include/);
  assert.throws(() => parseDomainList('full:example.org trailing-data', 'main'), /Unexpected/);
});

test('include depth and file bytes are bounded', async () => {
  await assert.rejects(collectDomainList('a', {
    readFile: async name => name === 'a' ? 'include:b' : 'example.org', maxDepth: 0
  }), /depth/);
  await assert.rejects(collectDomainList('a', {
    readFile: async () => 'example.org\n'.repeat(100), maxFileBytes: 20
  }), /size/);
  await assert.rejects(collectDomainList('a', {
    readFile: async name => name === 'a' ? 'include:b\ninclude:b' : 'example.org', maxVisits: 2
  }), /expansion count/);
});

async function sandbox() {
  await mkdir(path.join(root, '.cache', 'sync-tests'), { recursive: true });
  const dir = await mkdtemp(path.join(root, '.cache', 'sync-tests', 'case-'));
  await mkdir(path.join(dir, 'metadata'), { recursive: true });
  const metadata = {
    version: 1,
    repositories: [{ id: 'dlc', repository: 'v2fly/domain-list-community', author: 'Fixture contributors', revision, revisionDate: '2026-10-01T00:00:00Z', license: 'MIT', licensePath: 'LICENSE', licenseSha256: sha256(license) }],
    rulesets: [
      { id: 'alpha', category: 'development', source: { repository: 'dlc', list: 'alpha' }, exclusions: [] },
      { id: 'beta', category: 'media', source: { repository: 'dlc', list: 'beta' }, exclusions: [] }
    ]
  };
  await writeFile(path.join(dir, 'metadata', 'upstreams.json'), JSON.stringify(metadata, null, 2) + '\n');
  const fetchText = async url => {
    if (url.endsWith('/LICENSE')) return license;
    if (url.endsWith('/data/alpha')) return 'alpha.example\n';
    if (url.endsWith('/data/beta')) return 'full:beta.example\n';
    throw new Error('Unexpected fixture URL: ' + url);
  };
  return { dir, metadata, fetchText };
}

async function domainLinesSandbox(body, { maxFileBytes = 3_000_000, matchType = 'domain-suffix', format = 'domain-lines', linePrefix = '' } = {}) {
  const fixture=await sandbox();
  fixture.metadata.rulesets=[{id:'anti-ad',category:'privacy',source:{repository:'dlc',format,path:'domains.txt',matchType,linePrefix,...(maxFileBytes===null?{}:{maxFileBytes})},exclusions:[]}];
  await writeFile(path.join(fixture.dir,'metadata/upstreams.json'),JSON.stringify(fixture.metadata,null,2)+'\n');
  return {...fixture,fetchText:async(url,options)=>url.endsWith('/domains.txt')?body:fixture.fetchText(url,options)};
}

async function twoRepositoriesSandbox(){
  const fixture=await sandbox();
  fixture.metadata.repositories.push({...fixture.metadata.repositories[0],id:'other',repository:'example/other-rules'});
  fixture.metadata.rulesets[1].source.repository='other';
  await writeFile(path.join(fixture.dir,'metadata/upstreams.json'),JSON.stringify(fixture.metadata,null,2)+'\n');
  return fixture;
}

test('an ambiguous multi-repository revision is rejected before downloads or recovery writes',async()=>{
  const fixture=await twoRepositoriesSandbox();
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  const metadata=await readFile(path.join(fixture.dir,'metadata/upstreams.json'));
  const batch=path.join(fixture.dir,'.cache/sync/batch-ambiguous');await mkdir(batch,{recursive:true});
  const journal=path.join(batch,'publication.json');
  await writeFile(journal,JSON.stringify({state:'pending',hadPreviousRules:true,oldMetadataSha256:sha256(metadata),newMetadataSha256:'f'.repeat(64)}));
  const before=await readFile(journal);let downloads=0;
  await assert.rejects(()=>syncCatalog({root:fixture.dir,revision,fetchText:async url=>{downloads++;return fixture.fetchText(url);}}),/multiple.*--repository|--repository.*multiple/i);
  assert.equal(downloads,0);
  assert.deepEqual(await readFile(journal),before);
  assert.deepEqual(await readFile(path.join(fixture.dir,'metadata/upstreams.json')),metadata);
});

test('a repository selector moves only the selected version, date and source outputs',async()=>{
  const fixture=await twoRepositoriesSandbox();
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  const before=JSON.parse(await readFile(path.join(fixture.dir,'metadata/upstreams.json'),'utf8'));
  const beta=await readFile(path.join(fixture.dir,'src/rules/media/beta.json'));
  const updated='b'.repeat(40);
  await syncCatalog({root:fixture.dir,latest:true,repository:'dlc',fetchText:async url=>{
    if(url.includes('/git/ref/heads/')){assert.ok(url.includes('/v2fly/domain-list-community/'));return JSON.stringify({object:{sha:updated}});}
    if(url.endsWith('/commits/'+updated))return JSON.stringify({sha:updated,commit:{committer:{date:'2026-10-30T13:25:16Z'}}});
    if(url.includes('/'+updated+'/data/alpha'))return 'changed.alpha.example\n';
    return fixture.fetchText(url);
  }});
  const after=JSON.parse(await readFile(path.join(fixture.dir,'metadata/upstreams.json'),'utf8'));
  assert.equal(after.repositories[0].revision,updated);
  assert.equal(after.repositories[0].revisionDate,'2026-10-30T13:25:16Z');
  assert.deepEqual(after.repositories[1],before.repositories[1]);
  assert.deepEqual(after.rulesets[1],before.rulesets[1]);
  assert.deepEqual(await readFile(path.join(fixture.dir,'src/rules/media/beta.json')),beta);
  assert.notEqual(after.rulesets[0].outputSha256,before.rulesets[0].outputSha256);
});

test('unknown repository selectors and selectors without a version operation are rejected',async()=>{
  const fixture=await twoRepositoriesSandbox();let downloads=0;
  const fetchText=async url=>{downloads++;return fixture.fetchText(url);};
  await assert.rejects(()=>syncCatalog({root:fixture.dir,latest:true,repository:'missing',fetchText}),/repository selector/i);
  await assert.rejects(()=>syncCatalog({root:fixture.dir,repository:'dlc',fetchText}),/selector.*latest|selector.*revision/i);
  assert.equal(downloads,0);
});

test('an explicit revision can select the second repository without moving the first',async()=>{
  const fixture=await twoRepositoriesSandbox();
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  const before=JSON.parse(await readFile(path.join(fixture.dir,'metadata/upstreams.json'),'utf8'));
  const updated='c'.repeat(40);
  await syncCatalog({root:fixture.dir,repository:'other',revision:updated,fetchText:async url=>{
    if(url.endsWith('/commits/'+updated))return JSON.stringify({sha:updated,commit:{committer:{date:'2026-10-29T00:00:00Z'}}});
    if(url.includes('/'+updated+'/data/beta'))return 'full:changed.beta.example\n';
    return fixture.fetchText(url);
  }});
  const after=JSON.parse(await readFile(path.join(fixture.dir,'metadata/upstreams.json'),'utf8'));
  assert.deepEqual(after.repositories[0],before.repositories[0]);
  assert.deepEqual(after.rulesets[0],before.rulesets[0]);
  assert.equal(after.repositories[1].revision,updated);
  assert.equal(after.repositories[1].revisionDate,'2026-10-29T00:00:00Z');
  assert.notEqual(after.rulesets[1].outputSha256,before.rulesets[1].outputSha256);
});

test('unexpected unselected source drift blocks the complete selected update',async()=>{
  const fixture=await twoRepositoriesSandbox();
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  const metadataPath=path.join(fixture.dir,'metadata/upstreams.json'),alpha=path.join(fixture.dir,'src/rules/development/alpha.json');
  const before=[await readFile(metadataPath),await readFile(alpha)];
  await assert.rejects(()=>syncCatalog({root:fixture.dir,repository:'dlc',revision,fetchText:async url=>url.endsWith('/data/beta')?'full:drifted.beta.example\n':fixture.fetchText(url)}),/Unselected source changed/);
  assert.deepEqual([await readFile(metadataPath),await readFile(alpha)],before);
});

test('the actual sync CLI recognizes repository selection before its preflight gate',async()=>{
  const fixture=await twoRepositoriesSandbox();
  await cp(path.join(root,'tools'),path.join(fixture.dir,'tools'),{recursive:true});
  await assert.rejects(()=>execute(process.execPath,['tools/sync.mjs','--repository','missing','--latest','--dry-run'],{cwd:fixture.dir,timeout:5000}),error=>{assert.match(error.stderr,/repository selector/i);return true;});
  const help=await execute(process.execPath,['tools/sync.mjs','--repository','dlc','--help'],{cwd:fixture.dir,timeout:5000});
  assert.match(help.stdout,/--repository/);
});

test('registered domain lines preserve explicit suffix semantics, header counts and deduplication',async()=>{
  const fixture=await domainLinesSandbox('#TITLE=fixture\n#TOTAL_LINES=3\nad.example\nad.example\nfull.example\n');
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  const source=JSON.parse(await readFile(path.join(fixture.dir,'src/rules/privacy/anti-ad.json'),'utf8'));
  assert.deepEqual(source.entries,[{type:'domain-suffix',value:'ad.example'},{type:'domain-suffix',value:'full.example'}]);
  const metadata=JSON.parse(await readFile(path.join(fixture.dir,'metadata/upstreams.json'),'utf8'));
  assert.equal(metadata.rulesets[0].source.matchType,'domain-suffix');
  assert.equal(metadata.rulesets[0].files[0].path,'domains.txt');
  assert.equal(metadata.rulesets[0].rawEntryCount,3);
});

test('domain lines never infer suffix matching when exact matching was registered',async()=>{
  const fixture=await domainLinesSandbox('#TOTAL_LINES=1\nonly.example\n',{matchType:'domain'});
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  assert.deepEqual(JSON.parse(await readFile(path.join(fixture.dir,'src/rules/privacy/anti-ad.json'),'utf8')).entries,[{type:'domain',value:'only.example'}]);
});

test('a registered Surge domain-set prefix is required on every suffix line',async()=>{
  const fixture=await domainLinesSandbox('#TOTAL_LINES=2\n.ad.example\n.child.ad.example\n',{linePrefix:'.'});
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  const source=path.join(fixture.dir,'src/rules/privacy/anti-ad.json');
  assert.deepEqual(JSON.parse(await readFile(source,'utf8')).entries,[{type:'domain-suffix',value:'ad.example'},{type:'domain-suffix',value:'child.ad.example'}]);
  const before=await readFile(source);
  await assert.rejects(()=>syncCatalog({root:fixture.dir,fetchText:async url=>url.endsWith('/domains.txt')?'ad.example\n':fixture.fetchText(url)}),/prefix/i);
  assert.deepEqual(await readFile(source),before);
});

test('invalid domain-line syntax or a mismatched header preserves previous published data',async()=>{
  for(const body of ['#TOTAL_LINES=2\nad.example\n','0.0.0.0 ad.example\n','0.0.0.0\n','*.example\n','include:child\n','ad.example/path\n','ad.example#comment\n']){
    const fixture=await domainLinesSandbox('#TOTAL_LINES=1\nad.example\n');
    await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
    const source=path.join(fixture.dir,'src/rules/privacy/anti-ad.json'),metadata=path.join(fixture.dir,'metadata/upstreams.json');
    const before=[await readFile(source),await readFile(metadata)];
    await assert.rejects(()=>syncCatalog({root:fixture.dir,fetchText:async url=>url.endsWith('/domains.txt')?body:fixture.fetchText(url)}),/domain|header|line count/i);
    assert.deepEqual([await readFile(source),await readFile(metadata)],before);
  }
});

test('domain-line formats, match semantics, paths and file budgets must be explicitly valid',async()=>{
  for(const options of [{format:'guessed-format'},{matchType:'guessed-match'},{maxFileBytes:0},{maxFileBytes:4_000_001},{linePrefix:'*.'},{linePrefix:'.',matchType:'domain'}]){
    const fixture=await domainLinesSandbox('ad.example\n',options);
    await assert.rejects(()=>syncCatalog({root:fixture.dir,fetchText:fixture.fetchText}),/format|match|budget|limit|prefix/i);
  }
  const fixture=await domainLinesSandbox('ad.example\n');
  fixture.metadata.rulesets[0].source.path='../private.txt';
  await writeFile(path.join(fixture.dir,'metadata/upstreams.json'),JSON.stringify(fixture.metadata));
  await assert.rejects(()=>syncCatalog({root:fixture.dir,fetchText:fixture.fetchText}),/path/i);
});

test('only a registered larger domain-line budget accepts more than the normal 1 MB limit',async()=>{
  const body='#'+ 'x'.repeat(1_050_000)+'\nad.example\n';
  const allowed=await domainLinesSandbox(body);
  await syncCatalog({root:allowed.dir,fetchText:allowed.fetchText});
  const limited=await domainLinesSandbox(body,{maxFileBytes:null});
  await assert.rejects(()=>syncCatalog({root:limited.dir,fetchText:limited.fetchText}),/size/i);
  const legacy=await sandbox();
  await assert.rejects(()=>syncCatalog({root:legacy.dir,fetchText:async url=>url.endsWith('/data/alpha')?body:legacy.fetchText(url)}),/size/i);
});

test('domain-line sources retain the same license checksum gate',async()=>{
  const fixture=await domainLinesSandbox('ad.example\n');
  await assert.rejects(()=>syncCatalog({root:fixture.dir,fetchText:async url=>url.endsWith('/LICENSE')?'changed license':fixture.fetchText(url)}),/license checksum/i);
});

test('a shared download cache cannot bypass a second source narrower file budget',async()=>{
  const body='#'+'x'.repeat(1_050_000)+'\nad.example\n';
  const fixture=await domainLinesSandbox(body);
  const narrow={...fixture.metadata.rulesets[0],id:'narrow',source:{...fixture.metadata.rulesets[0].source}};
  delete narrow.source.maxFileBytes;
  fixture.metadata.rulesets.push(narrow);
  const registry=path.join(fixture.dir,'metadata/upstreams.json');
  await writeFile(registry,JSON.stringify(fixture.metadata));
  const before=await readFile(registry);
  await assert.rejects(()=>syncCatalog({root:fixture.dir,fetchText:fixture.fetchText}),/Cached.*size/i);
  assert.deepEqual(await readFile(registry),before);
});

test('registered large sources still share the 24 MB total transfer budget',async()=>{
  const fixture=await domainLinesSandbox('ad.example\n');
  await syncCatalog({root:fixture.dir,fetchText:fixture.fetchText});
  const source=path.join(fixture.dir,'src/rules/privacy/anti-ad.json');
  const beforeSource=await readFile(source);
  const current=JSON.parse(await readFile(path.join(fixture.dir,'metadata/upstreams.json'),'utf8'));
  const template=current.rulesets[0];
  current.rulesets=Array.from({length:9},(_,index)=>index===0?template:{...template,id:'anti-ad-'+index,source:{...template.source,path:'domains-'+index+'.txt'}});
  const registry=path.join(fixture.dir,'metadata/upstreams.json');
  await writeFile(registry,JSON.stringify(current));
  const beforeRegistry=await readFile(registry);
  const body='#'+'x'.repeat(2_900_000)+'\nad.example\n';
  await assert.rejects(()=>syncCatalog({root:fixture.dir,fetchText:async url=>url.endsWith('/LICENSE')?license:body}),/Total source size/i);
  assert.deepEqual(await readFile(source),beforeSource);
  assert.deepEqual(await readFile(registry),beforeRegistry);
});

test('HTTP declared and streamed sizes enforce the configured budget and absolute 4 MB cap',async()=>{
  const previous=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response('small body',{headers:{'content-length':'1001'}});
    await assert.rejects(()=>fetchBoundedText('https://raw.githubusercontent.com/example/rules/main/domains.txt',{maxBytes:1000}),/size/i);
    globalThis.fetch=async()=>new Response('x'.repeat(1001));
    await assert.rejects(()=>fetchBoundedText('https://raw.githubusercontent.com/example/rules/main/domains.txt',{maxBytes:1000}),/size/i);
    let fetched=false;
    globalThis.fetch=async()=>{fetched=true;throw new Error('unexpected request');};
    await assert.rejects(()=>fetchBoundedText('https://raw.githubusercontent.com/example/rules/main/domains.txt',{maxBytes:4_000_001}),/budget|limit/i);
    assert.equal(fetched,false);
  }finally{globalThis.fetch=previous;}
});

test('dry run performs validation but does not publish files or update registry', async () => {
  const { dir, fetchText } = await sandbox();
  const before = await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8');
  const result = await syncCatalog({ root: dir, dryRun: true, fetchText });
  assert.equal(result.rulesets.length, 2);
  assert.equal(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'), before);
  await assert.rejects(readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json')), /ENOENT/);
});

test('pinned sync produces repeatable bytes and hashes the exact written files', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const file = path.join(dir, 'src', 'rules', 'development', 'alpha.json');
  const first = await readFile(file, 'utf8');
  const firstMetadata = await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8');
  await syncCatalog({ root: dir, fetchText });
  assert.equal(await readFile(file, 'utf8'), first);
  assert.equal(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'), firstMetadata);
  const registry = JSON.parse(firstMetadata);
  assert.equal(registry.rulesets[0].outputSha256, sha256(first));
  assert.equal(registry.rulesets[0].files[0].sha256, sha256('alpha.example\n'));
});

test('network failure leaves the entire previous catalog and registry intact', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const before = await readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json'), 'utf8');
  const metadata = await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8');
  await assert.rejects(syncCatalog({ root: dir, fetchText: async url => {
    if (url.endsWith('/data/beta')) throw new Error('Network unavailable');
    if (url.endsWith('/data/alpha')) return 'changed.example\n';
    return fetchText(url);
  } }), /Network unavailable/);
  assert.equal(await readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json'), 'utf8'), before);
  assert.equal(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'), metadata);
});

test('bad domain URL components abort sync and preserve the previous source and registry', async () => {
  for (const invalid of ['full:alpha.example/path', 'alpha.example?query']) {
    const { dir, fetchText } = await sandbox();
    await syncCatalog({ root: dir, fetchText });
    const source = path.join(dir, 'src/rules/development/alpha.json');
    const registry = path.join(dir, 'metadata/upstreams.json');
    const before = [await readFile(source), await readFile(registry)];
    await assert.rejects(syncCatalog({ root: dir, fetchText: url => url.endsWith('/data/alpha') ? invalid+'\n' : fetchText(url) }), /domain/i);
    assert.deepEqual([await readFile(source), await readFile(registry)], before);
  }
});

test('a symlinked metadata parent is rejected before any external source metadata is modified', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const outside = dir + '-metadata';
  await rename(path.join(dir, 'metadata'), outside);
  await symlink(outside, path.join(dir, 'metadata'), 'dir');
  const before = await readFile(path.join(outside, 'upstreams.json'));
  const source = await readFile(path.join(dir, 'src/rules/development/alpha.json'));
  await assert.rejects(syncCatalog({ root: dir, fetchText: url => url.endsWith('/data/alpha') ? 'changed.example\n' : fetchText(url) }), /symlink/i);
  assert.deepEqual(await readFile(path.join(outside, 'upstreams.json')), before);
  assert.deepEqual(await readFile(path.join(dir, 'src/rules/development/alpha.json')), source);
});

test('source update dates come from the pinned commit instead of the local clock', async () => {
  const { dir, fetchText } = await sandbox();
  const updatedRevision = 'b'.repeat(40);
  await syncCatalog({ root: dir, latest: true, fetchText: async url => {
    if (url.includes('/git/ref/heads/')) return JSON.stringify({ object: { sha: updatedRevision } });
    if (url.endsWith('/commits/' + updatedRevision)) return JSON.stringify({ sha: updatedRevision, commit: { committer: { date: '2026-10-30T13:25:16Z' } } });
    return fetchText(url);
  } });
  const metadata = JSON.parse(await readFile(path.join(dir, 'metadata', 'upstreams.json'), 'utf8'));
  assert.equal(metadata.repositories[0].revisionDate, '2026-10-30T13:25:16Z');
  assert.equal(metadata.rulesets[0].updatedAt, '2026-10-30T13:25:16Z');
  assert.equal(metadata.rulesets[0].source.repository, 'dlc');
});

test('source license changes or local manual edits prevent an overwrite', async () => {
  const { dir, fetchText } = await sandbox();
  await assert.rejects(syncCatalog({ root: dir, fetchText: async url => url.endsWith('/LICENSE') ? 'Different license' : fetchText(url) }), /license checksum/i);
  await syncCatalog({ root: dir, fetchText });
  const file = path.join(dir, 'src', 'rules', 'development', 'alpha.json');
  await writeFile(file, 'personal local edit');
  await assert.rejects(syncCatalog({ root: dir, fetchText }), /Local changes/);
  assert.equal(await readFile(file, 'utf8'), 'personal local edit');
});

test('a manual edit made while a download is pending is not overwritten', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const file = path.join(dir, 'src', 'rules', 'development', 'alpha.json');
  await assert.rejects(syncCatalog({ root: dir, fetchText: async url => {
    if (url.endsWith('/data/alpha')) return 'new-source.example\n';
    if (url.endsWith('/data/beta')) await writeFile(file, 'local edit during download');
    return fetchText(url);
  } }), /changed during sync/);
  assert.equal(await readFile(file, 'utf8'), 'local edit during download');
});

test('metadata publication failure rolls back the catalog directory', async () => {
  const { dir } = await sandbox();
  const rules = path.join(dir, 'src', 'rules');
  await mkdir(rules, { recursive: true });
  await writeFile(path.join(rules, 'marker.json'), 'previous');
  const metadataDir = path.join(dir, 'metadata');
  await chmod(metadataDir, 0o555);
  try {
    await assert.rejects(publishCatalog(dir, new Map([['development/alpha.json', '{}\n']]), '{}\n'));
  } finally {
    await chmod(metadataDir, 0o755);
  }
  assert.equal(await readFile(path.join(rules, 'marker.json'), 'utf8'), 'previous');
  await assert.rejects(readFile(path.join(rules, 'development', 'alpha.json')), /ENOENT/);
});

test('an interrupted directory swap is recovered without deleting either version', async () => {
  const { dir, fetchText } = await sandbox();
  await syncCatalog({ root: dir, fetchText });
  const metadata = await readFile(path.join(dir, 'metadata', 'upstreams.json'));
  const batch = path.join(dir, '.cache', 'sync', 'batch-interrupted');
  await mkdir(batch, { recursive: true });
  await rename(path.join(dir, 'src', 'rules'), path.join(batch, 'previous-rules'));
  await mkdir(path.join(dir, 'src', 'rules'), { recursive: true });
  await writeFile(path.join(dir, 'src', 'rules', 'new-version.json'), 'interrupted candidate');
  await writeFile(path.join(batch, 'publication.json'), JSON.stringify({ state:'pending', hadPreviousRules:true, oldMetadataSha256:sha256(metadata), newMetadataSha256:'f'.repeat(64) }));
  await assert.rejects(recoverPublication(dir, { dryRun:true }), /Interrupted/);
  await recoverPublication(dir);
  assert.match(await readFile(path.join(dir, 'src', 'rules', 'development', 'alpha.json'), 'utf8'), /alpha.example/);
  assert.equal(await readFile(path.join(batch, 'interrupted-rules', 'new-version.json'), 'utf8'), 'interrupted candidate');
});
