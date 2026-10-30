import { resolve } from 'node:path';
import { createBuild, compareBuild, publishBuild, defaultBaseUrl } from './lib/build.mjs';
const root=resolve(import.meta.dirname,'..');
try{
  let check=false,baseUrl=defaultBaseUrl;
  const args=process.argv.slice(2);
  while(args.length){const arg=args.shift();if(arg==='--check')check=true;else if(arg==='--base-url'&&args.length)baseUrl=args.shift();else throw new Error(`Unknown or incomplete argument: ${arg}`);}
  const build=await createBuild(root,{baseUrl});
  if(check){const differences=await compareBuild(root,build);if(differences.length)throw new Error('Generated artifacts differ:\n'+differences.join('\n'));console.log(`Verified ${build.clients.length} clients / ${build.files.size} artifacts; no files changed.`);}
  else{const result=await publishBuild(root,build);console.log(`${result.changed?'Generated':'Unchanged'}: ${build.clients.length} clients / ${build.rulesets.length} rulesets / ${build.files.size} artifacts.${result.backup?' Previous tree retained at '+result.backup:''}`);}
}catch(error){console.error(error.message);process.exitCode=1;}
