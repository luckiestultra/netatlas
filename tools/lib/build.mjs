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
import { loadNativeRouting, nativeRoutingSettings, renderNativeRoutingFragment } from './native-routing.mjs';
import { loadRegexRouting, regexRoutingFor } from './regex-routing.mjs';
import { profileRoutingResources } from './routing-extensions.mjs';
import { loadRuleSupplement } from './rule-supplements.mjs';
import { loadQxCompatibility } from './qx-compat.mjs';

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
      if(!upstream||!['MIT','GPL-2.0-only'].includes(upstream.license)||!/^[a-f0-9]{40}$/.test(upstream.revision)||!/^[a-f0-9]{64}$/.test(upstream.licenseSha256))throw new Error(`Missing licensed pinned source: ${rule.id}`);
      if(!record.files?.length||record.files.some(file=>!/^[a-f0-9]{64}$/.test(file.sha256)))throw new Error(`Missing source file integrity: ${rule.id}`);
      if(record.source.localSupplement){
        const supplement=await loadRuleSupplement(root,record.source.localSupplement,rule.id);
        if(supplement.entries.some(entry=>!rule.entries.some(actual=>actual.type===entry.type&&actual.value===entry.value)))throw new Error(`Local supplement is absent from catalog: ${rule.id}`);
      }
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

function clientReadme(client,rulesets,features,baseUrl,featureRegistry,sourceRegistry){
  const embedded=profileRulesetsFor(rulesets),ids=new Set(embedded.map(rule=>rule.id));
  const steps={
    quantumultX:'导入主配置后，在节点页添加自己的节点或支持格式的订阅资源（[server_remote] 使用 opt-parser=true）。节点选择默认使用 App 内置 proxy；选择实际节点即可，自动/地区组按节点名称筛选。定位显示已接入。',
    surge:'导入主配置，按 [Proxy Group] 的注释添加 policy-path 订阅组；将该组加入节点选择，并在自动/地区组的 include-other-group 引用它。也可在 [Proxy] 添加原生节点，由 include-all-proxies 纳入。',
    loon:'导入主配置，在 App 的远程代理（[Remote Proxy]）添加自己的订阅；全部节点和六地区 NameRegex 筛选器会发现节点。在节点选择中选择全部节点或实际节点。',
    shadowrocket:'在配置页导入主配置，在首页添加/更新订阅并选中实际节点，启用规则模式。节点选择中的 PROXY 指向首页选择；自动/地区组按首页节点名称筛选。',
    egern:'导入主配置，在 App 编辑策略组“节点订阅”的 urls，填写自己的 Egern 原生节点订阅。在“节点选择”选节点订阅，再选其实际节点；自动/地区组 flatten 后筛选该来源。',
    stash:'导入主配置，在 proxy-providers 添加自己的 Stash 原生订阅，将 provider 名称填入节点选择、自动选择和地区组的 use；也可直接添加 proxies。选择实际节点；当前公开文件没有活动假订阅。',
    mihomo:'在 GUI 前端导入主配置，在 proxy-providers 添加自己的 Mihomo 原生订阅，将 provider 名称加入节点选择、自动选择和地区组的 use（include-all 也会纳入节点）。也可填写 proxies；加载后选择实际节点。',
    singBox:'主配置面向 sing-box 1.14.4 核心。填入原生 outbounds，并将节点 tag 加入节点选择、自动选择和对应地区组的 outbounds，更新 selector.default。核心没有通用机场订阅 provider；支持订阅合并的前端需按其说明接入。需要本地转换时再使用下方高级工具，不向在线转换站上传秘密。',
  };
  const licenseFor=id=>{const record=sourceRegistry.rulesets.find(item=>item.id===id);return record.source.repository?sourceRegistry.repositories.find(repo=>repo.id===record.source.repository).license:record.source.license;};
  const rows=rulesets.map(rule=>`| [${rule.id}${ids.has(rule.id)?'':'（可选）'}](rules/${rule.id}.${client.ruleExtension}) | ${rule.entries.length.toLocaleString('en-US')} | ${licenseFor(rule.id)} |`).join('\n');
  const extensions=profileRoutingResources(client.id,rulesets),activeExtensions=profileRoutingResources(client.id,embedded);
  const regex=regexRoutingFor(client.id),native=nativeRoutingSettings(client.id);
  const extensionRows=extensions.map(rule=>`| [${rule.id}${ids.has(rule.sourceId)?'':'（可选）'}](${rule.path}) | ${rule.entries.length.toLocaleString('en-US')} | ${rule.license} |`).join('\n');
  const names={geoip:'出口定位','search-redirect':'Bing 搜索跳转','quick-search':'47 项快速搜索',redirects:'59 项网站重定向','biliintl-region':'BiliIntl 菲律宾参数','anti-ad':'可选反广告','https-upgrade':'六站 HTTPS 升级',boxjs:'BoxJS','script-hub':'ScriptHub','sub-store':'Sub-Store','body-replacement':'正文替换工具','resource-parser':'资源解析器','qx-regex-compat':'QX服务兼容补充（非无损）'};
  const available=featureRegistry.features.filter(feature=>feature.clients?.[client.id]);
  const featureList=available.length?'| 功能 | 实际入口/导入方式 |\n| --- | --- |\n'+available.map(feature=>`| ${names[feature.id]??feature.id} | ${feature.clients[client.id].artifacts.map(path=>`[${path}](${path})`).join(' · ')}；${feature.clients[client.id].kind} |`).join('\n'):'该核心不支持原生 HTTP 重写/JS 模块。';
  return `# ${client.name}

[主配置](profiles/default.${client.profileExtension}) · [Raw 导入地址](${baseUrl.replace(/\/+$/,'')}/clients/${client.id}/profiles/default.${client.profileExtension}) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

${steps[client.id]}

首次使用需由客户端下载远程规则。主配置引用本客户端的 ${embedded.length+activeExtensions.length} 份规则资源（${embedded.length} 份公共规则、${activeExtensions.length} 份原生条件补充），更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 | 许可 |
| --- | ---: | --- |
${rows}
${extensionRows}

## ASN、GeoIP、正则与白名单

${native.supported?'主配置和 standalone 已启用完整 5,231 个 ASN 编号匹配及 CN GeoIP 数据库条件，位于业务规则之后、静态 CN CIDR 之前。二者查询宿主真实数据库，不展开为国家 IP 集合。':'此版本核心不支持原生 ASN 和 GeoIP 数据库条件；没有生成冒充二者的 CIDR 集合。'} 数据库更新方式见 [原生条件片段](fragments/native-routing.${native.supported?(client.profileFormat==='ini'?'conf':'yaml'):'md'})。数据库归属信息不保证物理位置，ASN 归属也不等于 IP 国家。

固定源的 24 个正则引用中，本客户端可无损表达 ${regex.supportedExpressions} 个，无法原生表达 ${regex.unsupportedExpressions} 个；正则资源与原服务同策略同优先级，google-cn 仍为可选。只有零未支持项才称本客户端源正则完整，详见[逐项覆盖](../../docs/coverage.md)。

Unbreak 是完整 50 条条件，保留精确域名/后缀/关键词语义；默认在广告规则之前按“规则修正”直连（standalone 策略名 unbreak），包含若干 Google 下载及推送域。可将该策略切到节点选择；三个原有连接探测域仍独立固定直连。此白名单会明确豁免其中的统计/广告样式域，并非隐私拦截集合。

## 可选功能

${featureList}

modules 保存脚本功能安装资源，rewrites 保存纯重写，fragments 需要手工合并。QX 的 modules/*.snippet 仍在 App 中按“重写资源”导入；Surge/SR 用各自模块入口，Loon 用插件，Egern 用模块，Stash 用覆写，不能混用相同扩展名推断兼容。

BoxJS、ScriptHub、Sub-Store 为明确可选的上游工具，脚本入口固定版本，GUI 导入未实测；BoxJS 会读写宿主脚本存储，转换工具会读取订阅/用户指定 URL。没有自动同步任务，也不会自动启用 MITM 或安装 CA。第三方脚本与前端的完整依赖树不全部固定，见[工具许可与边界](../../src/vendor/integrations/)。QX 资源解析器为本仓库原创实现，打包 YAML 依赖；Loon 解析器片段仍链接固定上游脚本，许可与权限单独登记。

Mihomo/sing-box 提供原生规则、DNS、节点与可选反广告；BoxJS 等 GUI 模块和 HTTP 重写不是这两个核心的能力。需要订阅转换时可另用 [Sub-Store 官方服务](https://github.com/sub-store-org/Sub-Store)，不要把 GUI 脚本格式塞进核心配置。QX 主配置已经接入自有资源解析器和中文 GeoIP；片段供既有配置手工合并。支持范围及严格拒绝项见功能说明，转换不会加载或执行订阅中的脚本。完整边界见[逐项覆盖](../../docs/coverage.md)与[功能说明](../../docs/features.md)。${client.id==='quantumultX'?' 两份服务兼容分流与HTTP/HTTPS广告资源均为独立可选，扩大范围、顺序和MITM前提见[QX接入说明](../../docs/qx-compatibility.md)，不计入14/24严格覆盖。':''}

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
  await Promise.all([loadNativeRouting(root),loadRegexRouting(root),loadQxCompatibility(root)]);
  for(const source of sources)if(input.files.find(file=>file.path===source.path)?.sha256!==source.sha256)throw new Error('Build inputs changed while reading the catalog');
  const files=new Map(),catalog=[];
  const put=(path,content)=>{if(files.has(path))throw new Error('Duplicate artifact: '+path);files.set(path,content);};
  for(const client of clients){
    const prefix=client.id+'/';
    const profile=renderManagedProfile(client.id,{rulesets,baseUrl});
    const validation=validateManagedProfile(client.id,profile.content,rulesets,{baseUrl});
    put(prefix+profile.path,profile.content);
    const standalone=renderProfile(client.id,{rulesets,baseUrl});
    validateProfile(client.id,standalone.content,rulesets,{requireRejectDefault:true});
    put(prefix+`profiles/standalone.${client.profileExtension}`,standalone.content);
    put(prefix+'profiles/input.example.json',json({version:1,nodes:[],subscriptions:[]}));
    for(const ruleset of rulesets){
      const artifact=renderRuleset(client.id,ruleset);
      if(json(decodeRuleset(client.id,artifact.content))!==json(ruleset.entries))throw new Error(`Rule semantic round-trip failed: ${client.id}/${ruleset.id}`);
      put(prefix+artifact.path,artifact.content);
    }
    const routingResources=profileRoutingResources(client.id,rulesets);
    for(const resource of routingResources)put(prefix+resource.path,resource.content);
    const nativeFragment=renderNativeRoutingFragment(client.id,undefined,{baseUrl});
    put(prefix+nativeFragment.path,nativeFragment.content);
    const features=renderFeatures(client.id,{baseUrl});
    const clientFeatures=featureRegistry.features.filter(feature=>feature.clients?.[client.id]);
    const emitted=new Set(features.map(artifact=>artifact.path));
    if(baseUrl)for(const feature of clientFeatures)for(const path of feature.clients[client.id].artifacts)if(!emitted.has(path))throw new Error(`Declared feature artifact was not emitted: ${client.id}/${path}`);
    for(const artifact of features)put(prefix+artifact.path,artifact.content);
    put(prefix+'README.md',clientReadme(client,rulesets,features,baseUrl,featureRegistry,registry));
    const artifacts=[...files].filter(([path])=>path.startsWith(prefix)).map(([path,content])=>({path:path.slice(prefix.length),sha256:sha256(content),bytes:Buffer.byteLength(content)})).sort((a,b)=>a.path.localeCompare(b.path,'en'));
    const embedded=profileRulesetsFor(rulesets);
    const embeddedIds=new Set(embedded.map(rule=>rule.id));
    const manifest={
      version:1,client:client.id,builder:'netatlas@0.1.0',inputSha256:input.sha256,baseUrl,targetVersion:client.targetVersion??null,
      counts:{defaultRuleSets:embedded.length,defaultEntries:embedded.reduce((sum,rule)=>sum+rule.entries.length,0),optionalRuleSets:rulesets.length-embedded.length,totalEntries:rulesets.reduce((sum,rule)=>sum+rule.entries.length,0)},
      routingExtensions:{
        native:nativeRoutingSettings(client.id),
        regex:{supportedExpressions:regexRoutingFor(client.id).supportedExpressions,unsupportedExpressions:regexRoutingFor(client.id).unsupportedExpressions,expressions:regexRoutingFor(client.id).expressions},
        resources:routingResources.map(resource=>({id:resource.id,sourceId:resource.sourceId,path:resource.path,entries:resource.entries.length,license:resource.license,defaultProfile:embeddedIds.has(resource.sourceId)})),
      },
      validation:{profile:validation.level,rules:'canonical-semantic-round-trip',native:'not-run',nativeRequirement:client.nativeVerification,features:'host-contract-tests-run-separately'},
      features:clientFeatures.map(feature=>({id:feature.id,defaultEnabled:client.id==='quantumultX'&&['geoip','resource-parser'].includes(feature.id),license:feature.license??'MIT (original code)',adapter:feature.clients[client.id],upstream:feature.upstream??null,sourceRegistry:feature.sourceRegistry??null})),
      sources:{repositories:registry.repositories,rules:registry.rulesets.map(record=>({id:record.id,tag:record.category,defaultProfile:embeddedIds.has(record.id),source:record.source,license:record.source.repository?registry.repositories.find(repo=>repo.id===record.source.repository).license:record.source.license,sha256:record.outputSha256,entries:record.entryCount,updatedAt:record.updatedAt,projection:record.selection??'first-party-selection',excludedExpressions:record.appliedExclusions??[]})),inputs:sources},
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
