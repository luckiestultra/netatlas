import { parseDocument } from 'yaml';
import { normalizeEntry, normalizeRuleset } from './rules.mjs';

const types={DOMAIN:'domain','DOMAIN-SUFFIX':'domain-suffix','DOMAIN-KEYWORD':'domain-keyword','IP-CIDR':'ip-cidr','IP-CIDR6':'ip-cidr6'};
// Source format: https://wiki.metacubex.one/en/config/rule-providers/classical/
// Unknown native conditions are rejected; they are never silently dropped.
export function parseClassicalYaml(text,file,selectPayload) {
  const doc=parseDocument(text,{uniqueKeys:true});
  if(doc.errors.length)throw new Error(`${file}: Invalid source YAML`);
  const object=doc.toJS({maxAliasCount:0});
  if(!object||Object.keys(object).length!==1||!Array.isArray(object.payload)||!object.payload.length||object.payload.length>250000)throw new Error(`${file}: Expected classical payload`);
  if(selectPayload!==undefined&&(!Array.isArray(selectPayload)||!selectPayload.length||selectPayload.length>4096||selectPayload.some(value=>typeof value!=='string'||value.trim()!==value)||new Set(selectPayload).size!==selectPayload.length))throw new Error('Invalid classical payload selection');
  const wanted=selectPayload&&new Set(selectPayload),found=new Set(),entries=[];
  for(const line of object.payload){
    if(typeof line!=='string'||/[\r\n]/.test(line))throw new Error(`${file}: Invalid classical payload line`);
    if(wanted&&!wanted.has(line))continue;
    const [type,value,...options]=line.split(',').map(value=>value.trim());
    if(!Object.hasOwn(types,type))throw new Error(`${file}: Unsupported classical rule type: ${type}`);
    if(!value||options.length>1||options.length&&(!type.startsWith('IP-CIDR')||options[0]!=='no-resolve'))throw new Error(`${file}: Unsupported classical rule options`);
    const entry=normalizeEntry({type:types[type],value});
    if(entry.type.startsWith('ip-')&&entry.value!==value)throw new Error(`${file}: Noncanonical CIDR`);
    entries.push(entry);found.add(line);
  }
  if(wanted&&[...wanted].some(line=>!found.has(line)))throw new Error(`${file}: Registered selected token is missing`);
  return {entries:normalizeRuleset({version:1,id:'classical-source',category:'portable',entries}).entries,rawEntryCount:object.payload.length,selectedTokens:[...found].sort()};
}
