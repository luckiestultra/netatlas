import { resolve } from 'node:path';
import { createBuild, compareBuild, loadCatalog, defaultBaseUrl } from './lib/build.mjs';
import { getClient } from './lib/clients.mjs';
const root=resolve(import.meta.dirname,'..');
try{
  const args=process.argv.slice(2);let rulesOnly=false,client,baseUrl=defaultBaseUrl;
  while(args.length){const arg=args.shift();if(arg==='--rules')rulesOnly=true;else if(arg==='--client'&&args.length)client=getClient(args.shift()).id;else if(arg==='--base-url'&&args.length)baseUrl=args.shift();else throw new Error(`Unknown or incomplete argument: ${arg}`);}
  if(rulesOnly&&client)throw new Error('--rules and --client cannot be combined');
  if(rulesOnly){const catalog=await loadCatalog(root);console.log(`Validated provenance and canonical data: ${catalog.rulesets.length} rulesets / ${catalog.rulesets.reduce((n,set)=>n+set.entries.length,0)} entries.`);}
  else{const build=await createBuild(root,{baseUrl});const differences=(await compareBuild(root,build)).filter(path=>!client||path.slice(path.indexOf(':')+2).startsWith(client+'/'));if(differences.length)throw new Error(differences.join('\n'));console.log(`Validated ${client??build.clients.length+' clients'}: rule semantics, profile structure, policy references, provenance and artifact hashes. Native checks are separate.`);}
}catch(error){console.error(error.message);process.exitCode=1;}
