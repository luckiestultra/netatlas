// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { loadYouTubeEnhance } from './youtube-enhance.mjs';
import { createScriptRuntime } from '../../src/features/script-runtime/runtime.mjs';
import { SCRIPT_RUNTIME_REGISTRY } from '../../src/features/script-runtime/registry.mjs';

// Compilation concatenates reviewed source text; it never evaluates source during the build.
export function compileScriptRuntime(source, fixed) {
  if (typeof source !== 'string' || !['request', 'response'].includes(fixed.kind) || fixed.worker !== false || typeof fixed.name !== 'string' || ![undefined, 'json-object'].includes(fixed.argumentMode)) throw new Error('Invalid static script wrapper');
  return `// NetAtlas statically compiled Surge HTTP adapter. Runtime source loading is not supported.\n` +
    `// Limits are checked after QX buffering; timers cannot preempt synchronous code. Empty-body invocation remains native QX behavior.\n` +
    `(function(__qx){\nconst __runtime=(${createScriptRuntime.toString()})(__qx,${JSON.stringify(fixed)});\nif(!__runtime.active)return;\n` +
    `(function($request,$response,$argument,$script,$httpClient,$persistentStore,$notification,$done,setTimeout,$task,$prefs,$loon){\ntry{\n${source}\n}catch(__error){__runtime.fail('script execution failed');}\n` +
    `})(__runtime.request,__runtime.response,__runtime.argument,__runtime.script,__runtime.httpClient,__runtime.persistentStore,__runtime.notification,__runtime.done,__runtime.timer,undefined,undefined,undefined);\n` +
    `})({request:typeof $request==='undefined'?undefined:$request,response:typeof $response==='undefined'?undefined:$response,environment:typeof $environment==='undefined'?{}:$environment,prefs:$prefs,notify:$notify,done:$done,timer:setTimeout,fetch:function(options){return $task.fetch(options)},log:function(message){console.log(message)}});\n`;
}

export function renderScriptRuntime(client) {
  if (client !== 'quantumultX') return [];
  const { registry, contents } = loadYouTubeEnhance();
  const notice = readFileSync(new URL('../../src/features/youtube-enhance/NOTICE.md', import.meta.url), 'utf8');
  const banner = '/*!\nSPDX-License-Identifier: Apache-2.0 AND BSD-3-Clause AND CC0-1.0\n' + notice +
    '\nStatic Surge-contract wrapper added by NetAtlas; upstream source body is unchanged.\n' + registry.licenses.map(file => contents.get(file.path)).join('\n\n') + '\n*/\n';
  return SCRIPT_RUNTIME_REGISTRY.map(entry => ({ path: entry.path, content: banner + compileScriptRuntime(contents.get(entry.sourcePath), { kind: entry.kind, worker: false, name: entry.id, argumentMode: entry.argumentMode, sourceUrls: entry.sourceUrls }) }));
}
