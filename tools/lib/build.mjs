import { readFile, writeFile, readdir, mkdir, lstat, rename } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { clients } from './clients.mjs';
import { normalizeRuleset } from './rules.mjs';
import { orderedRulesets } from './policies.mjs';
import { renderRuleset, decodeRuleset } from './exporters.mjs';
import { renderProfile } from './profiles.mjs';
import { renderFeatures } from './features.mjs';
import { validateProfile } from './validation.mjs';

export const defaultBaseUrl='https://raw.githubusercontent.com/luckiestultra/netatlas/main';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
async function exists(path){try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
export async function filesUnder(root){
  const result=[];
  if(!await exists(root))return result;
  const stat=await lstat(root);
  if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error(`Expected a real directory, not a symlink: ${root}`);
  async function visit(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const path=resolve(directory,entry.name);
      if(entry.isSymbolicLink())throw new Error(`Symlinks are not allowed in generated/source trees: ${path}`);
      if(entry.isDirectory())await visit(path);
      else if(entry.isFile())result.push(relative(root,path).split('\\').join('/'));
      else throw new Error(`Unsupported filesystem entry: ${path}`);
    }
  }
  await visit(root);return result.sort();
}

export async function loadCatalog(root){
  const registry=JSON.parse(await readFile(resolve(root,'metadata/upstreams.json'),'utf8'));
  if(registry.version!==1||!Array.isArray(registry.rulesets))throw new Error('Unsupported upstream registry');
  const records=new Map(registry.rulesets.map(record=>[record.id,record]));
  if(records.size!==registry.rulesets.length)throw new Error('Duplicate upstream ruleset ID');
  const rulesets=[],sources=[],seen=new Set();
  for(const path of await filesUnder(resolve(root,'src/rules'))){
    if(!path.endsWith('.json'))throw new Error(`Unexpected source file: ${path}`);
    const bytes=await readFile(resolve(root,'src/rules',path));
    const rule=normalizeRuleset(JSON.parse(bytes));
    if(path!==`${rule.category}/${rule.id}.json`||seen.has(rule.id))throw new Error(`Invalid ruleset path or duplicate ID: ${path}`);
    const record=records.get(rule.id);
    if(!record||record.category!==rule.category)throw new Error(`Unregistered ruleset: ${rule.id}`);
    if(record.outputSha256!==sha256(bytes))throw new Error(`Source checksum mismatch: ${path}; review and update provenance before building`);
    if(bytes.toString()!==json(rule))throw new Error(`Ruleset is not canonical: ${path}`);
    if(record.entryCount!==rule.entries.length)throw new Error(`Source entry count mismatch: ${path}`);
    if(record.source.repository){
      const upstream=registry.repositories.find(repo=>repo.id===record.source.repository);
      if(!upstream||upstream.license!=='MIT'||!/^[a-f0-9]{40}$/.test(upstream.revision)||!/^[a-f0-9]{64}$/.test(upstream.licenseSha256))throw new Error(`Missing licensed pinned source: ${rule.id}`);
      if(!record.files?.length||record.files.some(file=>!/^[a-f0-9]{64}$/.test(file.sha256)))throw new Error(`Missing source file integrity: ${rule.id}`);
    }else if(record.source.type!=='local'||record.source.license!=='MIT'||!record.source.references?.length)throw new Error(`Missing local source references: ${rule.id}`);
    seen.add(rule.id);rulesets.push(rule);sources.push({path:'src/rules/'+path,sha256:sha256(bytes)});
  }
  if(records.size!==seen.size)throw new Error('Registered ruleset is missing from src/rules');
  return {rulesets:orderedRulesets(rulesets),sources,registry};
}

async function inputIdentity(root){
  const paths=['package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md'];
  for(const scope of ['src','metadata','tools'])for(const path of await filesUnder(resolve(root,scope)))paths.push(scope+'/'+path);
  const inputs=[];
  for(const path of paths.sort())inputs.push({path,sha256:sha256(await readFile(resolve(root,path)))});
  return {sha256:sha256(json(inputs)),files:inputs};
}

function clientReadme(client,rulesets,features){
  const ruleRows=rulesets.map(rule=>`| [${rule.id}](rules/${rule.id}.${client.ruleExtension}) | ${rule.category} | ${rule.entries.length} |`).join('\n');
  const featureList=features.length?features.map(file=>`- [${file.path}](${file.path})`).join('\n'):'该客户端本次没有脚本或重写成品；不创建空目录。';
  return `# ${client.name}\n\n[完整配置](profiles/default.${client.profileExtension}) · [构建清单](manifest.json)\n\n先导入完整配置，再在本地添加自己的节点并加入 Proxy 策略组。新建 Proxy 默认 REJECT；应用可能保留旧选择，导入后核对实际选项。DIRECT 可手动选择。配置不含订阅、账号或节点凭据。主配置已内联规则，不需要远程规则地址。\n\n规则按应用或服务平铺；分类只是索引标签。单独导入规则时自行指定策略，Quantumult X 文件含原生策略名，可在导入时设置 force-policy。不要把其他客户端的同名规则文件互换。\n\n| 应用/服务 | 标签 | 条目 |\n| --- | --- | ---: |\n${ruleRows}\n\n## 可选重写、脚本与模块\n\n${featureList}\n\n可选功能单独导入，默认不启用。Quantumult X 的 fragments/geoip.conf 是 [general] 合并片段，不是重写订阅。GeoIP 只显示查询源返回的出口归属；它不证明服务器物理位置。公共脚本 URL 需要对应文件已发布；本地构建不会自动发布。见 [功能说明](../../docs/features.md)。\n\n规则、配置结构和策略引用在构建时校验。原生状态：${client.nativeVerification==='available'?'可运行 npm run test:native，结果保存在忽略的 .cache/native-check/latest.json':'仍需在真实应用中导入验证'}。参见 [验证范围](../../docs/validation.md) 与 [官方参考](${client.reference})。\n`;
}

export async function createBuild(root,{baseUrl=defaultBaseUrl}={}){
  const input=await inputIdentity(root);
  const {rulesets,sources,registry}=await loadCatalog(root);
  for(const source of sources)if(input.files.find(file=>file.path===source.path)?.sha256!==source.sha256)throw new Error('Build inputs changed while reading the catalog');
  const files=new Map(),catalog=[];
  const put=(path,content)=>{if(files.has(path))throw new Error('Duplicate artifact: '+path);files.set(path,content);};
  for(const client of clients){
    const prefix=client.id+'/';
    const profile=renderProfile(client.id,{rulesets});
    const validation=validateProfile(client.id,profile.content,rulesets);
    put(prefix+profile.path,profile.content);
    for(const ruleset of rulesets){
      const artifact=renderRuleset(client.id,ruleset);
      if(json(decodeRuleset(client.id,artifact.content))!==json(ruleset.entries))throw new Error(`Rule semantic round-trip failed: ${client.id}/${ruleset.id}`);
      put(prefix+artifact.path,artifact.content);
    }
    const features=renderFeatures(client.id,{baseUrl});
    for(const artifact of features)put(prefix+artifact.path,artifact.content);
    put(prefix+'README.md',clientReadme(client,rulesets,features));
    const artifacts=[...files].filter(([path])=>path.startsWith(prefix)).map(([path,content])=>({path:path.slice(prefix.length),sha256:sha256(content),bytes:Buffer.byteLength(content)})).sort((a,b)=>a.path.localeCompare(b.path,'en'));
    const manifest={version:1,client:client.id,builder:'netatlas@0.1.0',inputSha256:input.sha256,baseUrl,targetVersion:client.targetVersion??null,validation:{profile:validation.level,rules:'canonical-semantic-round-trip',native:'not-run',nativeRequirement:client.nativeVerification,features:'host-contract-tests-run-separately'},sources:{repositories:registry.repositories,rules:registry.rulesets.map(record=>({id:record.id,tag:record.category,source:record.source,sha256:record.outputSha256,entries:record.entryCount,updatedAt:record.updatedAt,projection:record.selection??'first-party-selection',excludedExpressions:record.appliedExclusions??[]})),inputs:sources},artifacts};
    put(prefix+'manifest.json',json(manifest));
    catalog.push({id:client.id,name:client.name,manifest:prefix+'manifest.json',sha256:sha256(files.get(prefix+'manifest.json')),rulesets:rulesets.length,entries:rulesets.reduce((sum,set)=>sum+set.entries.length,0)});
  }
  const catalogBody={version:1,builder:'netatlas@0.1.0',input,clients:catalog};
  put('catalog.json',json({...catalogBody,contentSha256:sha256(json(catalogBody))}));
  if((await inputIdentity(root)).sha256!==input.sha256)throw new Error('Build inputs changed during rendering; no output was published');
  return {files,clients,rulesets,sourceRoot:resolve(root),inputSha256:input.sha256};
}

export async function compareBuild(root,build){
  const directory=resolve(root,'clients');
  const actual=new Set(await filesUnder(directory)),differences=[];
  for(const [path,expected] of build.files){
    if(!actual.delete(path)){differences.push('missing: '+path);continue;}
    if((await readFile(resolve(directory,path),'utf8'))!==expected)differences.push('changed: '+path);
  }
  for(const path of actual)differences.push('extra: '+path);
  return differences;
}

async function assertGeneratedUnmodified(directory){
  const paths=await filesUnder(directory);
  if(!paths.length)return;
  if(!paths.includes('catalog.json'))throw new Error('Refusing to overwrite an existing clients tree without a generated catalog');
  const catalog=JSON.parse(await readFile(resolve(directory,'catalog.json'),'utf8'));
  const {contentSha256,...catalogBody}=catalog;
  if(contentSha256!==sha256(json(catalogBody)))throw new Error('Modified catalog: integrity checksum does not match; preserve manual changes');
  const allowed=new Set(['catalog.json']);
  for(const client of catalog.clients??[]){
    if(!clients.some(known=>known.id===client.id)||client.manifest!==client.id+'/manifest.json')throw new Error('Invalid existing generated catalog');
    const content=await readFile(resolve(directory,client.manifest));
    if(sha256(content)!==client.sha256)throw new Error(`Modified generated manifest: ${client.id}`);
    allowed.add(client.manifest);
    const manifest=JSON.parse(content);
    for(const artifact of manifest.artifacts??[]){
      if(!/^(?:profiles|rules|rewrites|scripts|modules|fragments)\/[^/]+$/.test(artifact.path)&&artifact.path!=='README.md')throw new Error('Invalid generated artifact path');
      const path=client.id+'/'+artifact.path;allowed.add(path);
      if(!paths.includes(path)||sha256(await readFile(resolve(directory,path)))!==artifact.sha256)throw new Error('Modified or missing generated artifact; preserve manual changes: '+path);
    }
  }
  for(const path of paths)if(!allowed.has(path))throw new Error('Manual file in generated tree; preserve before building: '+path);
}

export async function publishBuild(root,build){
  const directory=resolve(root,'clients');
  if((await inputIdentity(build.sourceRoot)).sha256!==build.inputSha256)throw new Error('Build inputs changed before publication; rebuild from current sources');
  await assertGeneratedUnmodified(directory);
  if(!(await compareBuild(root,build)).length)return {changed:false};
  const batch=resolve(root,'.cache/build',randomUUID()),stage=resolve(batch,'next'),backup=resolve(batch,'previous');
  await mkdir(stage,{recursive:true});
  for(const [path,content] of build.files){const target=resolve(stage,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,content,{flag:'wx'});}
  // Recheck after staging, so edits made while rendering are never overwritten.
  await assertGeneratedUnmodified(directory);
  if((await inputIdentity(build.sourceRoot)).sha256!==build.inputSha256)throw new Error('Build inputs changed while staging; no output was published');
  const previous=await exists(directory);
  if(previous)await rename(directory,backup);
  try{await rename(stage,directory);}catch(error){if(previous)await rename(backup,directory);throw error;}
  return {changed:true,backup:previous?backup:null};
}
