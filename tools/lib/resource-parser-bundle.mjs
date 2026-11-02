// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildSync, version as esbuildVersion } from 'esbuild';

const root=fileURLToPath(new URL('../../',import.meta.url));
const entry='src/features/resource-parser/entry.mjs';
const yamlLicense='src/features/resource-parser/vendor/LICENSE-yaml';
const registryLicense='src/features/youtube-enhance/LICENSE';
const versions={yaml:'2.9.1',esbuild:'0.28.2'};
const controlFiles=['LICENSE',yamlLicense,registryLicense,'package.json','package-lock.json','node_modules/yaml/package.json','tools/lib/resource-parser-bundle.mjs'];
let cache;

function inputHash(inputs){
  const hash=createHash('sha256');
  for(const file of [...new Set([...controlFiles,...inputs])].sort()){
    hash.update(file);hash.update('\0');hash.update(readFileSync(resolve(root,file)));hash.update('\0');
  }
  return hash.digest('hex');
}

function banner(){
  const mit=readFileSync(resolve(root,'LICENSE'),'utf8').trimEnd();
  const isc=readFileSync(resolve(root,yamlLicense),'utf8').trimEnd();
  const apache=readFileSync(resolve(root,registryLicense),'utf8').trimEnd();
  return '/*! NetAtlas Quantumult X resource parser\n'+mit+'\n\nThird-party dependency: yaml '+versions.yaml+' (ISC)\n'+isc+'\n\nStatic script registry component: Apache-2.0\n'+apache+'\n*/';
}

// Cache only while every esbuild input has exactly the same contents. A source
// edit (including a newly added import) changes the key and triggers a rebuild.
export function bundleResourceParser(){
  const yamlPackage=JSON.parse(readFileSync(resolve(root,'node_modules/yaml/package.json'),'utf8'));
  if(yamlPackage.version!==versions.yaml||esbuildVersion!==versions.esbuild)throw new Error('Resource-parser dependency versions differ from the build contract');
  if(cache){
    try {if(cache.hash===inputHash(cache.inputs))return cache.output;}
    catch { /* A removed import must invalidate the graph, not prevent rebuild. */ }
  }
  const result=buildSync({
    absWorkingDir:root,entryPoints:[entry],bundle:true,write:false,
    platform:'browser',format:'iife',globalName:'NetAtlasResourceParser',target:'es2020',charset:'utf8',
    legalComments:'inline',sourcemap:false,metafile:true,minify:true,
    banner:{js:banner()},
    // QX consumes the program's final value; an IIFE alone loses completion.
    footer:{js:'typeof $resource !== "undefined" && typeof $done === "function" ? NetAtlasResourceParser.runResource($resource,$done,typeof $notify === "function" ? $notify : undefined,typeof $environment === "object" ? $environment : undefined) : undefined;'},
    logLevel:'silent',
  });
  if(result.outputFiles.length!==1)throw new Error('Unexpected resource-parser build output');
  const output=result.outputFiles[0].text;
  if(output.includes(root)||output.includes('sourceMappingURL='))throw new Error('Resource-parser build contains private paths or a source map');
  const inputs=Object.keys(result.metafile.inputs);
  cache={inputs,hash:inputHash(inputs),output};
  return output;
}
