import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute=promisify(execFile);
const root=resolve(import.meta.dirname,'..');
test('custom public URLs can be built, checked and validated through the actual CLIs',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'netatlas-cli-'));
  for(const path of ['src','metadata','tools','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md']){
    await cp(resolve(root,path),resolve(directory,path),{recursive:true});
  }
  await symlink(resolve(root,'node_modules'),resolve(directory,'node_modules'),'dir');
  const base='https://example.test/netatlas-fork';
  for(const args of [
    ['tools/build.mjs','--base-url',base],
    ['tools/build.mjs','--check','--base-url',base],
    ['tools/validate.mjs','--base-url',base],
    ['tools/validate.mjs','--client','quantumultX','--base-url',base],
  ]){
    // The full CN catalog and per-domain DNS policies make a cold eight-client
    // build take about 34 seconds under concurrent tests (the old catalog was 15s).
    const result=await execute(process.execPath,args,{cwd:directory,timeout:90000});
    assert.equal(result.stderr,'');
    assert.match(result.stdout,/Generated|Verified|Validated/);
  }
});
