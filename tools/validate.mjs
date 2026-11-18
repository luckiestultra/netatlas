import { resolve } from 'node:path';
import { createBuild, compareBuild, loadCatalog, defaultBaseUrl } from './lib/build.mjs';
import { getClient } from './lib/clients.mjs';
const root=resolve(import.meta.dirname,'..');
try{
  const args=process.argv.slice(2);let rulesOnly=false,checkSummary=false,client,baseUrl=defaultBaseUrl;
  while(args.length){const arg=args.shift();if(arg==='--rules')rulesOnly=true;else if(arg==='--check')checkSummary=true;else if(arg==='--client'&&args.length)client=getClient(args.shift()).id;else if(arg==='--base-url'&&args.length)baseUrl=args.shift();else throw new Error(`Unknown or incomplete argument: ${arg}`);}
  if(rulesOnly&&(client||checkSummary))throw new Error('--rules cannot be combined with --client or --check');
  if(rulesOnly){const catalog=await loadCatalog(root);console.log(`Validated provenance and canonical data: ${catalog.rulesets.length} rulesets / ${catalog.rulesets.reduce((n,set)=>n+set.entries.length,0)} entries.`);}
  else{
    const build=await createBuild(root,{baseUrl,...(client?{client}:{})});
    const differences=await compareBuild(root,build,{...(client?{client}:{})});
    if(differences.length)throw new Error(differences.join('\n'));
    if(checkSummary)console.log(`Verified ${build.clients.length} clients / ${build.files.size} artifacts; no files changed.`);
    console.log(`Validated ${client??build.clients.length+' clients'}: rule semantics, profile structure, policy references, provenance and artifact hashes. Native checks are separate.`);
  }
}catch(error){console.error(error.message);process.exitCode=1;}
