import { parse } from 'yaml';
import { getClient } from './clients.mjs';
import { normalizeEntry } from './rules.mjs';
import { policyForRuleset, profileRulesetsFor } from './policies.mjs';

const classicTypes = { DOMAIN:'domain', 'DOMAIN-SUFFIX':'domain-suffix', 'IP-CIDR':'ip-cidr', 'IP-CIDR6':'ip-cidr6' };
const qxTypes = { host:'domain', 'host-suffix':'domain-suffix', 'ip-cidr':'ip-cidr', 'ip6-cidr':'ip-cidr6' };
const egernTypes = { domain:'domain', domain_suffix:'domain-suffix', ip_cidr:'ip-cidr', ip_cidr6:'ip-cidr6' };
function ini(text) {
  const sections = {}; let section;
  for (const raw of text.split(/\r?\n/)) {
    const line=raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('//')) continue;
    const heading=/^\[([^\]]+)\]$/.exec(line);
    if(heading){section=heading[1].toLowerCase();if(sections[section])throw new Error(`Duplicate INI section: ${section}`);sections[section]=[];}
    else {if(!section)throw new Error('Content before INI section');sections[section].push(line);}
  }
  return sections;
}
function normalizedPolicy(policy) { return /^(direct|reject)$/i.test(policy)?policy.toUpperCase():policy; }
function checkReferences(groups, rules, fallback, extra=[]) {
  const known=new Set(['DIRECT','REJECT',...extra]);
  for(const group of groups){if(known.has(group.name))throw new Error(`Duplicate policy group: ${group.name}`);known.add(group.name);}
  for(const group of groups){if(!group.choices.length&&!Object.keys(group.matchers??{}).length)throw new Error(`Empty policy group: ${group.name}`);for(const choice of group.choices)if(!known.has(normalizedPolicy(choice)))throw new Error(`Unknown policy member: ${choice}`);}
  for(const policy of [...rules.map(rule=>rule.policy),fallback])if(!known.has(normalizedPolicy(policy)))throw new Error(`Unknown policy or outbound: ${policy}`);
  const byName=new Map(groups.map(group=>[group.name,group]));
  function visit(name,path){if(path.includes(name))throw new Error(`Policy cycle: ${[...path,name].join(' -> ')}`);for(const choice of byName.get(name)?.choices??[])if(byName.has(choice))visit(choice,[...path,name]);}
  for(const group of groups)visit(group.name,[]);
  const proxy=groups.find(group=>group.name==='Proxy');
  if(!proxy)throw new Error('Missing Proxy selector');
}

export function inspectProfile(clientId,text) {
  const client=getClient(clientId);let groups=[],rules=[],fallback,object,iniNodes=[];
  if(client.profileFormat==='ini'){
    const sections=ini(text);const isQx=clientId==='quantumultX';
    const groupLines=sections[isQx?'policy':'proxy group'];
    const lines=sections[isQx?'filter_local':'rule'];
    if(!groupLines||!lines)throw new Error('Missing native policy or rule section');
    iniNodes=(sections[isQx?'server_local':'proxy']??[]).map(line=>{
      const name=isQx?/(?:^|,)\s*tag\s*=\s*([^,]+)/.exec(line)?.[1]:/^([^=]+)\s*=/.exec(line)?.[1];
      if(!name?.trim())throw new Error('Missing local proxy name or node tag');
      return name.trim();
    });
    if(!isQx)for(const line of sections['remote proxy']??[]){const name=/^([^=]+)\s*=/.exec(line)?.[1]?.trim();if(!name)throw new Error('Invalid native proxy subscription');iniNodes.push(name);}
    groups=groupLines.map(line=>{
      const match=isQx?/^static\s*=\s*([^,]+),(.*)$/.exec(line):/^([^=]+)=\s*(?:select|fallback)\s*,(.*)$/i.exec(line);
      if(!match)throw new Error('Invalid native policy group');
      const members=match[2].split(',').map(x=>x.trim()),choices=[],matchers={};
      for(const member of members){
        const option=/^(server-tag-regex|resource-tag-regex|policy-regex-filter|include-all-proxies|policy-path|update-interval|evaluate-before-use|url|interval|timeout|last-resort)=(.*)$/.exec(member);
        if(!option){choices.push(member);continue;}
        if(Object.hasOwn(matchers,option[1]))throw new Error('Duplicate node regex option');
        if(option[1].includes('regex')){try {new RegExp(option[2]);} catch {throw new Error('Invalid node regex');}if(!option[2])throw new Error('Empty node regex');}
        matchers[option[1]]=option[2];
      }
      return {name:match[1].trim(),choices,...(Object.keys(matchers).length?{matchers}:{})};
    });
    for(const line of lines){const [type,value,policy]=line.split(',').map(x=>x.trim());if(/^(final|match)$/i.test(type)){if(fallback)throw new Error('Multiple final rules');fallback=value;continue;}if(fallback)throw new Error('Rules after final fallback');rules.push({...normalizeEntry({type:(isQx?qxTypes:classicTypes)[type],value}),policy});}
  }else if(clientId==='singBox'){
    object=JSON.parse(text);
    if(!Array.isArray(object.inbounds)||object.inbounds.some(inbound=>inbound.listen!=='127.0.0.1'||inbound.set_system_proxy!==false))throw new Error('Nonlocal or system proxy listener');
    if(!Array.isArray(object.outbounds)||!object.route)throw new Error('Missing native outbounds or route');
    groups=object.outbounds.filter(out=>out.type==='selector').map(out=>({name:out.tag,choices:out.outbounds}));
    for(const rule of object.route.rules??[]){if(rule.action==='resolve'&&Object.keys(rule).length===1)continue;const fields=Object.keys(rule).filter(key=>!['action','outbound'].includes(key));if(!['route','reject'].includes(rule.action)||fields.length!==1||(rule.action==='reject'&&rule.outbound))throw new Error('Unexpected route shape');const field=fields[0];if(!Array.isArray(rule[field]))throw new Error('Invalid route values');for(const value of rule[field])rules.push({...normalizeEntry({type:field==='domain'?'domain':field==='domain_suffix'?'domain-suffix':field==='ip_cidr'?(value.includes(':')?'ip-cidr6':'ip-cidr'):null,value}),policy:rule.action==='reject'?'REJECT':rule.outbound});}
    fallback=object.route.final;
  }else if(clientId==='egern'){
    object=parse(text);
    if(object.allow_external_connections!==false)throw new Error('External listener must be disabled');
    groups=(object.policy_groups??[]).map(item=>({name:item.select?.name,choices:item.select?.policies??[]}));
    for(const rule of object.rules??[]){const keys=Object.keys(rule);if(keys.length!==1)throw new Error('Invalid native rule shape');const key=keys[0];if(key==='default'){if(fallback)throw new Error('Multiple default rules');fallback=rule.default.policy;continue;}if(fallback)throw new Error('Rule after default');rules.push({...normalizeEntry({type:egernTypes[key],value:rule[key].match}),policy:rule[key].policy});}
  }else{
    object=parse(text);
    if(object['allow-lan']!==false||object['bind-address']!=='127.0.0.1')throw new Error('LAN listener must stay local');
    groups=(object['proxy-groups']??[]).map(group=>({name:group.name,choices:group.proxies??[]}));
    for(const line of object.rules??[]){const [type,value,policy]=line.split(',');if(type==='MATCH'){if(fallback)throw new Error('Multiple MATCH rules');fallback=value;continue;}if(fallback)throw new Error('Rule after MATCH');rules.push({...normalizeEntry({type:classicTypes[type],value}),policy});}
  }
  if(!fallback)throw new Error('Missing explicit final policy');
  const extra=client.profileFormat==='ini'?iniNodes:clientId==='singBox'?(object.outbounds??[]).filter(out=>out.type!=='selector'&&!['DIRECT','REJECT'].includes(out.tag)).map(out=>out.tag):clientId==='egern'?(object.proxies??[]).flatMap(proxy=>Object.values(proxy).map(settings=>settings?.name).filter(name=>typeof name==='string')):(object?.proxies??[]).map(proxy=>proxy.name);
  for(const rule of rules) rule.policy=normalizedPolicy(rule.policy);
  fallback=normalizedPolicy(fallback);
  checkReferences(groups,rules,fallback,extra);
  return {groups,rules,fallback,nodes:extra};
}

export function validateProfile(clientId,text,rulesets,{requireRejectDefault=false}={}) {
  const inspected=inspectProfile(clientId,text);
  const expected=profileRulesetsFor(rulesets).flatMap(ruleset=>ruleset.entries.map(entry=>({...normalizeEntry(entry),policy:policyForRuleset(ruleset)})));
  if(JSON.stringify(inspected.rules)!==JSON.stringify(expected))throw new Error(`${clientId}: profile rules differ from the ordered canonical rules or policies`);
  if(inspected.fallback!=='Proxy')throw new Error('Final policy must explicitly use Proxy');
  if(requireRejectDefault&&normalizedPolicy(inspected.groups.find(group=>group.name==='Proxy')?.choices[0])!=='REJECT')throw new Error('Public Proxy must start with REJECT until private nodes are configured');
  return {rules:inspected.rules.length,groups:inspected.groups.length,level:'structural-and-references',native:'not-run'};
}
