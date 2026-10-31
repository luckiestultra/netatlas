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
import { assertManagedPaths } from './managed-paths.mjs';
import { loadFeatureRegistry } from './feature-registry.mjs';
import { profileRulesetsFor } from './policies.mjs';

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
  await assertManagedPaths(root,['metadata/upstreams.json','src/rules']);
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
  await assertManagedPaths(root,[...paths,'src','metadata','tools']);
  for(const scope of ['src','metadata','tools'])for(const path of await filesUnder(resolve(root,scope)))paths.push(scope+'/'+path);
  const inputs=[];
  for(const path of paths.sort())inputs.push({path,sha256:sha256(await readFile(resolve(root,path)))});
  return {sha256:sha256(json(inputs)),files:inputs};
}

function clientReadme(client,rulesets,features){
  const embedded=profileRulesetsFor(rulesets),ids=new Set(embedded.map(rule=>rule.id));
  const entries=embedded.reduce((n,rule)=>n+rule.entries.length,0);
  const ruleRows=rulesets.map(rule=>`| [${rule.id}${ids.has(rule.id)?'':'（可选）'}](rules/${rule.id}.${client.ruleExtension}) | ${rule.category} | ${rule.entries.length} |`).join('\n');
  const featureList=features.length?features.map(file=>`- [${file.path}](${file.path})`).join('\n'):'该客户端没有对应可选成品。';
  return `# ${client.name}

[完整配置](profiles/default.${client.profileExtension}) · [私有接入输入示例](profiles/input.example.json) · [构建清单](manifest.json)

配置已包含节点/订阅接入、DNS、LAN/拦截/服务分流、CN 域名和 IPv4/IPv6 兜底及最终策略。公开文件不含你的私人节点，因此未配置时 Proxy 拒绝；填入真实节点后会自动接入，不需要再手改每个服务策略组。

## 填入自己的节点或订阅

~~~sh
mkdir -p private
cp clients/${client.id}/profiles/input.example.json private/${client.id}.json
# 编辑 private/${client.id}.json，填 nodes 或 subscriptions。
npm run profile -- --client ${client.id} --input private/${client.id}.json --output private/${client.id}.${client.profileExtension}
~~~

随后在 ${client.name} 导入生成的私有配置。文件权限为 0600；private/ 已忽略，不会提交。填本地节点时默认选第一个，selectedProxy 可指定其他节点。原生 URL 订阅在应用加载后还需手选实际节点；图形应用可能保留旧选择，导入后核对实际出站。

${['singBox','shadowrocket'].includes(client.id)?'该客户端不伪造远程节点 provider：本地命令拉取支持格式并展开真实节点；刷新时重新执行。Shadowrocket 的普通 URI 机场订阅也可直接从应用首页导入，Proxy 的原生匹配器会纳入应用节点。':'订阅使用该客户端自己的原生资源语法，刷新由客户端处理。公开示例没有活动假 URL。'}

支持的原生节点格式、订阅格式、DNS 行为及失败处理见[完整接入说明](../../docs/profile-setup.md)。无需为使用本仓库修改现有客户端配置；可导入为独立配置。

## 分流与 DNS

主配置内联 ${embedded.length} 组 / ${entries.toLocaleString('en-US')} 条规则，不依赖首次下载远程规则。具体服务先于 CN 兜底；LAN 直连，拦截拒绝，未命中走 Proxy。CN 数据是固定来源的网络分类，不是物理地理位置保证。anti-AD 的 100,682 条为可选资源，不默认内联。

DNS 按各客户端原生能力配置：独立的节点引导解析、LAN 系统解析、国内直连解析和代理目标远端解析；不会用一套外来字段硬套八个客户端。默认使用 AliDNS 国内 DoH；支持明确国外 DNS 角色的客户端使用 Cloudflare DoH 经代理。可在私有输入的 dnsUpstreams 覆盖对应角色，见接入说明。

| 应用/服务 | 标签 | 条目 |
| --- | --- | ---: |
${ruleRows}

## 可选功能

${featureList}

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX fragments/geoip.conf 合并到 [general]；不会自动启用 MITM、证书、重写或脚本。

HTTPS-upgrade 按 GPL-2.0-only 提供；anti-AD 和 CN 数据保留各自原始许可与 credits。详见[功能](../../docs/features.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。

验证：${client.nativeVerification==='available'?'固定内核原配置检查、真实订阅更新、四个 DNS 角色和 HTTP/SOCKS 路由；运行 npm run test:native':'高星完整配置与官方资料交叉核对、私有输入/原生字段/规则与引用检查；没有本机原生 GUI 运行证据'}。具体结果见[验证记录](../../docs/validation.md)，[来源登记](../../metadata/profile-references.json)。
`;
}

export async function createBuild(root,{baseUrl=defaultBaseUrl}={}){
  const input=await inputIdentity(root);
  const {rulesets,sources,registry}=await loadCatalog(root);
  const featureRegistry=await loadFeatureRegistry(root);
  for(const source of sources)if(input.files.find(file=>file.path===source.path)?.sha256!==source.sha256)throw new Error('Build inputs changed while reading the catalog');
  const files=new Map(),catalog=[];
  const put=(path,content)=>{if(files.has(path))throw new Error('Duplicate artifact: '+path);files.set(path,content);};
  for(const client of clients){
    const prefix=client.id+'/';
    const profile=renderProfile(client.id,{rulesets});
    const validation=validateProfile(client.id,profile.content,rulesets,{requireRejectDefault:true});
    put(prefix+profile.path,profile.content);
    put(prefix+'profiles/input.example.json',json({version:1,nodes:[],subscriptions:[]}));
    for(const ruleset of rulesets){
      const artifact=renderRuleset(client.id,ruleset);
      if(json(decodeRuleset(client.id,artifact.content))!==json(ruleset.entries))throw new Error(`Rule semantic round-trip failed: ${client.id}/${ruleset.id}`);
      put(prefix+artifact.path,artifact.content);
    }
    const features=renderFeatures(client.id,{baseUrl});
    const clientFeatures=featureRegistry.features.filter(feature=>feature.clients?.[client.id]);
    const emitted=new Set(features.map(artifact=>artifact.path));
    if(baseUrl)for(const feature of clientFeatures)for(const path of feature.clients[client.id].artifacts)if(!emitted.has(path))throw new Error(`Declared feature artifact was not emitted: ${client.id}/${path}`);
    for(const artifact of features)put(prefix+artifact.path,artifact.content);
    put(prefix+'README.md',clientReadme(client,rulesets,features));
    const artifacts=[...files].filter(([path])=>path.startsWith(prefix)).map(([path,content])=>({path:path.slice(prefix.length),sha256:sha256(content),bytes:Buffer.byteLength(content)})).sort((a,b)=>a.path.localeCompare(b.path,'en'));
    const embedded=profileRulesetsFor(rulesets);
    const embeddedIds=new Set(embedded.map(rule=>rule.id));
    const manifest={
      version:1,client:client.id,builder:'netatlas@0.1.0',inputSha256:input.sha256,baseUrl,targetVersion:client.targetVersion??null,
      counts:{defaultRuleSets:embedded.length,defaultEntries:embedded.reduce((sum,rule)=>sum+rule.entries.length,0),optionalRuleSets:rulesets.length-embedded.length,totalEntries:rulesets.reduce((sum,rule)=>sum+rule.entries.length,0)},
      validation:{profile:validation.level,rules:'canonical-semantic-round-trip',native:'not-run',nativeRequirement:client.nativeVerification,features:'host-contract-tests-run-separately'},
      features:clientFeatures.map(feature=>({id:feature.id,defaultEnabled:false,license:feature.license??'MIT (original code)',adapter:feature.clients[client.id],upstream:feature.upstream??null,sourceRegistry:feature.sourceRegistry??null})),
      sources:{repositories:registry.repositories,rules:registry.rulesets.map(record=>({id:record.id,tag:record.category,defaultProfile:embeddedIds.has(record.id),source:record.source,sha256:record.outputSha256,entries:record.entryCount,updatedAt:record.updatedAt,projection:record.selection??'first-party-selection',excludedExpressions:record.appliedExclusions??[]})),inputs:sources},
      artifacts
    };
    put(prefix+'manifest.json',json(manifest));
    catalog.push({id:client.id,name:client.name,manifest:prefix+'manifest.json',sha256:sha256(files.get(prefix+'manifest.json')),rulesets:rulesets.length,entries:rulesets.reduce((sum,set)=>sum+set.entries.length,0),defaultRuleSets:embedded.length,defaultEntries:embedded.reduce((sum,set)=>sum+set.entries.length,0)});
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
  await assertManagedPaths(root,['clients','.cache/build']);
  const directory=resolve(root,'clients');
  if((await inputIdentity(build.sourceRoot)).sha256!==build.inputSha256)throw new Error('Build inputs changed before publication; rebuild from current sources');
  await assertGeneratedUnmodified(directory);
  if(!(await compareBuild(root,build)).length)return {changed:false};
  const batch=resolve(root,'.cache/build',randomUUID()),stage=resolve(batch,'next'),backup=resolve(batch,'previous');
  await mkdir(stage,{recursive:true});
  for(const [path,content] of build.files){const target=resolve(stage,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,content,{flag:'wx'});}
  // Recheck after staging, so edits made while rendering are never overwritten.
  await assertManagedPaths(root,['clients','.cache/build']);
  await assertGeneratedUnmodified(directory);
  if((await inputIdentity(build.sourceRoot)).sha256!==build.inputSha256)throw new Error('Build inputs changed while staging; no output was published');
  const previous=await exists(directory);
  if(previous)await rename(directory,backup);
  try{await rename(stage,directory);}catch(error){if(previous)await rename(backup,directory);throw error;}
  return {changed:true,backup:previous?backup:null};
}
