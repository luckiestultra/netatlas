import { readFile, writeFile, readdir, mkdir, lstat, rename } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { clients } from './clients.mjs';
import { normalizeRuleset } from './rules.mjs';
import { orderedRulesets } from './policies.mjs';
import { renderRuleset, decodeRuleset } from './exporters.mjs';
import { renderProfile } from './profiles.mjs';
import { renderManagedProfile } from './managed-profiles.mjs';
import { validateManagedProfile } from './managed-validation.mjs';
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

function clientReadme(client,rulesets,features,baseUrl){
  const embedded=profileRulesetsFor(rulesets),ids=new Set(embedded.map(rule=>rule.id));
  const steps={
    quantumultX:'导入主配置后，在节点页添加自己的节点或原生 QX 订阅资源（也可编辑 [server_remote]）。节点选择默认使用 App 内置 proxy；选择实际节点即可，自动/地区组按节点名称筛选。定位显示已接入。',
    surge:'导入主配置，按 [Proxy Group] 的注释添加 policy-path 订阅组；将该组加入节点选择，并在自动/地区组的 include-other-group 引用它。也可在 [Proxy] 添加原生节点，由 include-all-proxies 纳入。',
    loon:'导入主配置，在 App 的远程代理（[Remote Proxy]）添加自己的订阅；全部节点和六地区 NameRegex 筛选器会发现节点。在节点选择中选择全部节点或实际节点。',
    shadowrocket:'在配置页导入主配置，在首页添加/更新订阅并选中实际节点，启用规则模式。节点选择中的 PROXY 指向首页选择；自动/地区组按首页节点名称筛选。',
    egern:'导入主配置，在 App 编辑策略组“节点订阅”的 urls，填写自己的 Egern 原生节点订阅。在“节点选择”选节点订阅，再选其实际节点；自动/地区组 flatten 后筛选该来源。',
    stash:'导入主配置，在 proxy-providers 添加自己的 Stash 原生订阅，将 provider 名称填入节点选择、自动选择和地区组的 use；也可直接添加 proxies。选择实际节点；当前公开文件没有活动假订阅。',
    mihomo:'在 GUI 前端导入主配置，在 proxy-providers 添加自己的 Mihomo 原生订阅，将 provider 名称加入节点选择、自动选择和地区组的 use（include-all 也会纳入节点）。也可填写 proxies；加载后选择实际节点。',
    singBox:'主配置面向 sing-box 1.14.4 核心。填入原生 outbounds，并将节点 tag 加入节点选择、自动选择和对应地区组的 outbounds，更新 selector.default。核心没有通用机场订阅 provider；支持订阅合并的前端需按其说明接入。需要本地转换时再使用下方高级工具，不向在线转换站上传秘密。',
  };
  const rows=rulesets.map(rule=>`| [${rule.id}${ids.has(rule.id)?'':'（可选）'}](rules/${rule.id}.${client.ruleExtension}) | ${rule.entries.length.toLocaleString('en-US')} |`).join('\n');
  const featureList=features.length?features.map(file=>`- [${file.path}](${file.path})`).join('\n'):'该客户端没有对应可选成品。';
  return `# ${client.name}

[主配置](profiles/default.${client.profileExtension}) · [Raw 导入地址](${baseUrl.replace(/\/+$/,'')}/clients/${client.id}/profiles/default.${client.profileExtension}) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

${steps[client.id]}

首次使用需由客户端下载远程规则。主配置引用本客户端的 ${embedded.length} 份规则资源，覆盖 ${embedded.reduce((n,rule)=>n+rule.entries.length,0).toLocaleString('en-US')} 条规则，更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 |
| --- | ---: |
${rows}

## 可选功能

${featureList}

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX 主配置已经接入 GeoIP；geoip.conf 片段供已有其他配置使用。重写、MITM 和证书均不自动启用。功能依各客户端语法导入，见[功能说明](../../docs/features.md)。

## 高级：离线配置或本地私有转换

[standalone.${client.profileExtension}](profiles/standalone.${client.profileExtension}) 内联全部默认规则，可作为不依赖远程规则资源的独立配置；业务选择沿用其服务 ID。它与主配置使用相同规范数据，规则更新需更新整个文件。

如需自动将私有节点/支持格式订阅展开到这份内联配置，可选用本地工具：

~~~sh
mkdir -p private
cp clients/${client.id}/profiles/input.example.json private/${client.id}.json
# 填入自己的 nodes 或 subscriptions。
npm run profile -- --client ${client.id} --input private/${client.id}.json --output private/${client.id}.${client.profileExtension}
~~~

这是高级可选流程，不是使用主配置的前提。私有输出权限 0600，private/ 已忽略。项目不改动你现用的 QX 或其他客户端配置。

来源、许可与验证边界见[构建清单](manifest.json)、[来源登记](../../metadata/profile-references.json)、[验证记录](../../docs/validation.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。六个闭源 GUI 未实际导入，结构/引用检查不能代替原生运行。
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
    const profile=renderManagedProfile(client.id,{rulesets,baseUrl});
    const validation=validateManagedProfile(client.id,profile.content,rulesets,{baseUrl});
    put(prefix+profile.path,profile.content);
    const standalone=renderProfile(client.id,{rulesets});
    validateProfile(client.id,standalone.content,rulesets,{requireRejectDefault:true});
    put(prefix+`profiles/standalone.${client.profileExtension}`,standalone.content);
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
    put(prefix+'README.md',clientReadme(client,rulesets,features,baseUrl));
    const artifacts=[...files].filter(([path])=>path.startsWith(prefix)).map(([path,content])=>({path:path.slice(prefix.length),sha256:sha256(content),bytes:Buffer.byteLength(content)})).sort((a,b)=>a.path.localeCompare(b.path,'en'));
    const embedded=profileRulesetsFor(rulesets);
    const embeddedIds=new Set(embedded.map(rule=>rule.id));
    const manifest={
      version:1,client:client.id,builder:'netatlas@0.1.0',inputSha256:input.sha256,baseUrl,targetVersion:client.targetVersion??null,
      counts:{defaultRuleSets:embedded.length,defaultEntries:embedded.reduce((sum,rule)=>sum+rule.entries.length,0),optionalRuleSets:rulesets.length-embedded.length,totalEntries:rulesets.reduce((sum,rule)=>sum+rule.entries.length,0)},
      validation:{profile:validation.level,rules:'canonical-semantic-round-trip',native:'not-run',nativeRequirement:client.nativeVerification,features:'host-contract-tests-run-separately'},
      features:clientFeatures.map(feature=>({id:feature.id,defaultEnabled:client.id==='quantumultX'&&feature.id==='geoip',license:feature.license??'MIT (original code)',adapter:feature.clients[client.id],upstream:feature.upstream??null,sourceRegistry:feature.sourceRegistry??null})),
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
