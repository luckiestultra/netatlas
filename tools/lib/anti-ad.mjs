import { stringify } from 'yaml';
import { getClient } from './clients.mjs';
import { publicArtifactUrl } from './public-url.mjs';

// Native contracts: Surge RULE-SET, QX filter_remote, Egern rule_set,
// Stash rule-providers, and sing-box 1.14 source-format remote rule sets.
// See metadata/features.json and docs/features.md for official references.
export function renderAntiAd(clientId,{baseUrl}={}) {
  const client=getClient(clientId);
  const url=publicArtifactUrl(baseUrl,clientId,'rules/anti-ad.'+client.ruleExtension);
  if(!url)return [];
  const merge='# Optional Anti-AD. Merge the provider declaration and PREPEND its rule before general or final rules.\n';
  if(clientId==='quantumultX')return [{path:'fragments/anti-ad.conf',content:merge+'[filter_remote]\n'+url+', tag=NetAtlas Anti-AD, force-policy=reject, enabled=true\n'}];
  if(clientId==='surge')return [{path:'modules/anti-ad.sgmodule',content:'#!name=NetAtlas Anti-AD\n#!desc=Optional domain blocking; no MITM or scripts.\n\n[Rule]\nRULE-SET,'+url+',REJECT\n'}];
  if(clientId==='loon')return [{path:'fragments/anti-ad.conf',content:merge+'[Remote Rule]\n'+url+', policy=REJECT, tag=NetAtlas Anti-AD, enabled=true\n'}];
  if(clientId==='shadowrocket')return [{path:'fragments/anti-ad.conf',content:merge+'[Rule]\nRULE-SET,'+url+',REJECT\n'}];
  if(clientId==='egern')return [{path:'modules/anti-ad.yaml',content:stringify({name:'NetAtlas Anti-AD',description:'Optional domain blocking; no MITM or scripts.',rules:[{rule_set:{match:url,policy:'REJECT',update_interval:86400}}]},{lineWidth:0})}];
  if(clientId==='singBox')return [{path:'fragments/anti-ad.json',content:JSON.stringify({route:{rule_set:[{type:'remote',tag:'netatlas-anti-ad',format:'source',url,http_client:{detour:'DIRECT'},update_interval:'1d'}],rules:[{rule_set:['netatlas-anti-ad'],action:'reject'}]}},null,2)+'\n'}];
  const provider={type:'http',behavior:'classical',format:'yaml',url,path:'./ruleset/netatlas-anti-ad.yaml',interval:86400,...(clientId==='mihomo'?{proxy:'DIRECT'}:{})};
  const data={...(clientId==='stash'?{name:'NetAtlas Anti-AD',desc:'Optional domain blocking; no MITM or scripts.'}:{}),'rule-providers':{'netatlas-anti-ad':provider},rules:['RULE-SET,netatlas-anti-ad,REJECT']};
  return [{path:clientId==='stash'?'modules/anti-ad.stoverride':'fragments/anti-ad.yaml',content:(clientId==='mihomo'?merge:'')+stringify(data,{lineWidth:0})}];
}
