import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, symlinkSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { parseYaml } from '../../src/features/resource-parser/yaml.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const root=new URL('../../',import.meta.url);
const safeFailure=input=>assert.throws(()=>parseYaml(input),error=>error.message==='Invalid YAML resource');

test('YAML preserves ordinary values, literal scripts, anchors and merge overrides',()=>{
  const actual=parseYaml('base: &base {type: http, server: example.com, port: 80}\nproxies:\n  - <<: *base\n    name: 日本\n    port: 8080\nscript: |\n  line one\n  line two\n');
  assert.deepEqual(actual.proxies,[{type:'http',server:'example.com',port:8080,name:'日本'}]);
  assert.equal(actual.script,'line one\nline two\n');
  assert.deepEqual(parseYaml('a: true\nb: null\nc: 1.5\n'),{a:true,b:null,c:1.5});
});

test('invalid YAML, duplicate keys, warnings and custom/unsafe tags fail without source data',()=>{
  for(const input of ['x: [LEAK-ME','x: 1\nx: 2\n','x: !LEAK-ME secret','%YAML 1.3\n---\nx: secret','x: !!js/function function secret() {}','x: !!binary c2VjcmV0','x: !!timestamp 2026-10-31','---\nx: 1\n---\ny: secret'])safeFailure(input);
});

test('prototype keys are rejected before or after merges',()=>{
  for(const key of ['__proto__','constructor','prototype']){
    safeFailure(`${key}: secret`);
    safeFailure(`base: &base {${key}: secret}\nnode: {<<: *base}`);
    safeFailure(`nested:\n  - {${key}: secret}`);
  }
  assert.equal({}.secret,undefined);
});

test('cycles, excessive alias expansion, deep graphs and non-finite numbers fail closed',()=>{
  for(const input of ['a: &a {self: *a}','a: &a {<<: *a}','a: &a [*a]','a: .inf','a: -.Inf','a: .NaN','a: 1e999','x: '+('['.repeat(34))+'0'+(']'.repeat(34))])safeFailure(input);
  safeFailure('base: &base [a, b]\nrefs: ['+Array.from({length:21},()=>'*base').join(', ')+']');
  assert.deepEqual(parseYaml('base: &base {value: ok}\na: *base\nb: *base').a,{value:'ok'});
});

test('input and parsed-node resource limits are enforced',()=>{
  safeFailure('s'.repeat(2*1024*1024+1));
  safeFailure('- 0\n'.repeat(100001));
  safeFailure(null);
  safeFailure({body:'secret'});
});

test('browser-target YAML bundle parses without Node, browser codecs, console or networking',()=>{
  const source=buildSync({stdin:{contents:'import {parseYaml} from "./src/features/resource-parser/yaml.mjs";globalThis.parseYaml=parseYaml;',resolveDir:root.pathname,sourcefile:'yaml-host-check.mjs'},absWorkingDir:root.pathname,bundle:true,platform:'browser',format:'iife',target:'es2020',write:false,logLevel:'silent'}).outputFiles[0].text;
  const context={console:undefined,Buffer:undefined,process:undefined,URL:undefined,atob:undefined,btoa:undefined,TextDecoder:undefined,fetch:undefined};vm.createContext(context);vm.runInContext(source,context);
  assert.equal(context.parseYaml('base: &base {a: 1}\ncopy: {<<: *base}').copy.a,1);
  assert.throws(()=>context.parseYaml('secret: !secret secret'),error=>error.message==='Invalid YAML resource');
  assert.equal(source.includes('/Users/'),false);
});

test('vendored YAML notice retains the exact installed ISC license',()=>{
  const actual=readFileSync(new URL('../../src/features/resource-parser/vendor/LICENSE-yaml',import.meta.url),'utf8');
  assert.equal(actual,readFileSync(new URL('../../node_modules/yaml/LICENSE',import.meta.url),'utf8'));
});

test('real host bundle is deterministic, retains licenses and executes YAML conversion',()=>{
  const script=bundleResourceParser();assert.equal(bundleResourceParser(),script);
  const isc=readFileSync(new URL('../../src/features/resource-parser/vendor/LICENSE-yaml',import.meta.url),'utf8').trimEnd();
  assert.ok(script.includes(isc));assert.ok(script.includes('Copyright (c) 2026 luckiestultra'));assert.ok(script.includes('yaml 2.9.1 (ISC)'));
  assert.equal(script.includes('/Users/'),false);assert.equal(script.includes('sourceMappingURL='),false);
  const done=[];const context={$resource:{type:'server',link:'https://example.com/subscription',content:'base: &base {type: http, server: example.com, port: 80}\nproxies:\n  - <<: *base\n    name: YAML node'},$done:value=>done.push(value),console:undefined,Buffer:undefined,process:undefined,URL:undefined,atob:undefined,btoa:undefined,fetch:undefined,TextDecoder:undefined};
  vm.createContext(context);vm.runInContext(script,context);assert.equal(done.length,1);assert.equal(done[0].error,undefined);assert.match(done[0].content,/^http=example\.com:80, tag=YAML node\n$/);
});

test('bundle cache invalidates content changes and tracks newly imported inputs',async()=>{
  const temp=mkdtempSync(join(tmpdir(),'netatlas-bundle-test-'));
  try {
    mkdirSync(join(temp,'tools/lib'),{recursive:true});mkdirSync(join(temp,'src/features/resource-parser/vendor'),{recursive:true});mkdirSync(join(temp,'src/features/youtube-enhance'),{recursive:true});
    for(const file of ['LICENSE','package.json','package-lock.json','tools/lib/resource-parser-bundle.mjs','src/features/resource-parser/vendor/LICENSE-yaml','src/features/youtube-enhance/LICENSE'])copyFileSync(new URL('../../'+file,import.meta.url),join(temp,file));
    symlinkSync(new URL('../../node_modules',import.meta.url).pathname,join(temp,'node_modules'),'dir');
    const entry=join(temp,'src/features/resource-parser/entry.mjs'),input=join(temp,'src/features/resource-parser/input.mjs');
    writeFileSync(entry,"import {value} from './input.mjs';globalThis.marker=value;");writeFileSync(input,"export const value='first';");
    const build=(await import(pathToFileURL(join(temp,'tools/lib/resource-parser-bundle.mjs')).href)).bundleResourceParser;
    const first=build();assert.equal(build(),first);const one={};vm.runInNewContext(first,one);assert.equal(one.marker,'first');
    writeFileSync(input,"export const value='second';");const second=build();assert.notEqual(second,first);const two={};vm.runInNewContext(second,two);assert.equal(two.marker,'second');
    writeFileSync(entry,"import {value} from './new-input.mjs';globalThis.marker=value;");writeFileSync(join(temp,'src/features/resource-parser/new-input.mjs'),"export const value='third';");unlinkSync(input);
    const third=build();const three={};vm.runInNewContext(third,three);assert.equal(three.marker,'third');
    writeFileSync(join(temp,'src/features/resource-parser/new-input.mjs'),"export const value='fourth';");const four={};vm.runInNewContext(build(),four);assert.equal(four.marker,'fourth');
  }finally{rmSync(temp,{recursive:true,force:true});}
});
