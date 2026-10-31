// SPDX-License-Identifier: MIT
// The build resolves `yaml` to its browser entry. No host codecs or I/O are used.
import { parseDocument, isAlias, isMap, isScalar, isSeq } from 'yaml';

const MAX_INPUT=2*1024*1024;
const MAX_DEPTH=32;
const MAX_NODES=100000;
const MAX_ALIASES=20;
const forbiddenKeys=new Set(['__proto__','constructor','prototype']);
const coreTags=new Set(['map','seq','str','int','float','bool','null','merge'].map(tag=>'tag:yaml.org,2002:'+tag));
const fail=()=>{throw new Error('Invalid YAML resource');};

// Inspect the syntax tree before toJS: merges must not hide unsafe map keys,
// and conversion must not recurse into an unbounded document first.
function validateDocument(document) {
  const stack=[{node:document.contents,depth:0}];let count=0,aliases=0;
  while(stack.length){
    const {node,depth}=stack.pop();
    if(node===null)continue;
    if(++count>MAX_NODES||depth>MAX_DEPTH)fail();
    if(node.tag&&!coreTags.has(node.tag))fail();
    if(isAlias(node)){if(++aliases>MAX_ALIASES)fail();}
    else if(isMap(node)){
      for(const pair of node.items){
        if(!isScalar(pair.key)||typeof pair.key.value!=='string'||forbiddenKeys.has(pair.key.value))fail();
        stack.push({node:pair.key,depth:depth+1},{node:pair.value,depth:depth+1});
      }
    }else if(isSeq(node))for(const item of node.items)stack.push({node:item,depth:depth+1});
    else if(isScalar(node)){
      if(typeof node.value==='number'&&!Number.isFinite(node.value))fail();
      if(node.value!==null&&!['string','boolean','number'].includes(typeof node.value))fail();
    }else fail();
  }
}

function validateValue(value) {
  const active=new Set();let count=0;
  function visit(item,depth){
    if(++count>MAX_NODES||depth>MAX_DEPTH)fail();
    if(item===null||typeof item==='string'||typeof item==='boolean')return;
    if(typeof item==='number'){if(!Number.isFinite(item))fail();return;}
    if(typeof item!=='object'||active.has(item))fail();
    if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)fail();
    active.add(item);
    for(const key of Object.keys(item)){if(forbiddenKeys.has(key))fail();visit(item[key],depth+1);}
    active.delete(item);
  }
  visit(value,0);
}

export function parseYaml(text) {
  try {
    if(typeof text!=='string'||text.length>MAX_INPUT)fail();
    const document=parseDocument(text,{
      version:'1.2',schema:'core',strict:true,uniqueKeys:true,merge:true,
      resolveKnownTags:false,customTags:[],stringKeys:true,prettyErrors:false,
      // `silent` also suppresses MULTIPLE_DOCS errors in yaml 2.9.1.
      // `error` keeps those diagnostics without printing warnings or input.
      keepSourceTokens:false,logLevel:'error',
    });
    if(document.errors.length||document.warnings.length)fail();
    validateDocument(document);
    const result=document.toJS({maxAliasCount:MAX_ALIASES,mapAsMap:false});
    validateValue(result);
    return result;
  }catch{fail();}
}
