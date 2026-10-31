import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { renderQxCompatibility, loadQxCompatibility, qxCompatibility } from '../../tools/lib/qx-compat.mjs';
import { renderFeatures } from '../../tools/lib/features.mjs';
import { regexRoutingFor, matchesRegexCondition } from '../../tools/lib/regex-routing.mjs';
import { renderManagedProfile } from '../../tools/lib/managed-profiles.mjs';
import { renderProfile } from '../../tools/lib/profiles.mjs';

const root=resolve(import.meta.dirname,'../..');
const files=()=>new Map(renderQxCompatibility('quantumultX').map(item=>[item.path,item.content]));
const rules=content=>content.split('\n').filter(line=>line&&!line.startsWith('#'));

test('QX compatibility files are opt-in and never credited as lossless regex restoration',async()=>{
  await loadQxCompatibility(root);
  const out=files();
  assert.deepEqual([...out.keys()],['rules/openai-compat.list','rules/viu-cdn-compat.list','rewrites/speedtest-ads-http.snippet','rewrites/speedtest-ads-https.snippet','fragments/regex-compat.conf']);
  assert.equal(qxCompatibility.defaultEnabled,false);
  assert.equal(qxCompatibility.strictCoverageCredit,0);
  assert.equal(regexRoutingFor('quantumultX').supportedExpressions,14);
  for(const mode of [renderManagedProfile,renderProfile])assert.doesNotMatch(mode('quantumultX').content,/openai-compat|viu-cdn-compat|speedtest-ads/);
  const featurePaths=renderFeatures('quantumultX').map(item=>item.path);
  for(const path of out.keys())assert.ok(featurePaths.includes(path));
});

test('source positives and deliberately wider host matches are explicit for both routing resources',()=>{
  const out=files();
  for(const route of qxCompatibility.routes){
    const line=rules(out.get(`rules/${route.id}.list`))[0];
    const [type,value,policy]=line.split(',');
    assert.equal(type,'host-wildcard');assert.equal(value,route.pattern);assert.equal(policy,route.sourceId);
    for(const host of route.positive)assert.equal(matchesRegexCondition({type:'domain-wildcard',value},host),true);
    for(const host of route.extraMatches){
      assert.equal(new RegExp(route.sourceRule.slice(7)).test(host),false);
      assert.equal(matchesRegexCondition({type:'domain-wildcard',value},host),true);
    }
    for(const host of route.nonMatches)assert.equal(matchesRegexCondition({type:'domain-wildcard',value},host),false);
    assert.match(out.get(`rules/${route.id}.list`),/NOT LOSSLESS/);
  }
});

test('Speedtest generated URL conditions preserve hostname, alphabet, length, port and scheme boundaries',()=>{
  const out=files();
  for(const scheme of ['http','https']){
    const content=out.get(`rewrites/speedtest-ads-${scheme}.snippet`);
    const line=rules(content).find(line=>line.includes(' url reject'));
    assert.ok(line.endsWith(' url reject'));
    const re=new RegExp(line.slice(0,-' url reject'.length));
    for(const mode of ['coe','open'])for(const region of ['cn','abcdef'])for(const port of ['','0','80','443','19800','65535','00443']){
      const origin=`${scheme}://speed.${mode}.ad.${region}.prod.hosts.ooklaserver.net${port?':'+port:''}`;
      for(const tail of ['','/','/ads?q=1','?q=1'])assert.ok(re.test(origin+tail),origin+tail);
    }
    const host='speed.coe.ad.cn.prod.hosts.ooklaserver.net';
    for(const url of [
      `${scheme==='http'?'https':'http'}://${host}/`, `ftp://${host}/`,
      `${scheme}://${host}.evil/`,`${scheme}://evil.${host}/`,`${scheme}://${host}@evil/`,`${scheme}://evil@${host}/`,
      `${scheme}://${host}:65536/`,`${scheme}://${host}:80evil/`,`${scheme}://${host}:abc/`,
      `${scheme}://speed.coe.ad.c2.prod.hosts.ooklaserver.net/`,`${scheme}://speed.coe.ad.a.prod.hosts.ooklaserver.net/`,
      `${scheme}://speed.coe.ad.abcdefg.prod.hosts.ooklaserver.net/`,`${scheme}://${host}/\n`,`${scheme}://${host}#fragment`,
    ])assert.equal(re.test(url),false,url);
    if(scheme==='http')assert.doesNotMatch(content,/^hostname\s*=/m);
    else {
      const hosts=content.match(/^hostname = (.+)$/m)[1].split(', ');
      assert.equal(hosts.length,10);assert.equal(hosts.includes('*.ooklaserver.net'),false);
      assert.ok(hosts.every(host=>host.startsWith('speed.coe.ad.')||host.startsWith('speed.open.ad.')));
      assert.match(content,/MITM|trust/);assert.match(content,/broader/);
    }
  }
});

test('manual fragment preserves mirror URLs, managed policies, placement and disabled HTTPS prerequisites',()=>{
  const out=new Map(renderQxCompatibility('quantumultX',{baseUrl:'https://mirror.example/netatlas/'}).map(item=>[item.path,item.content]));
  const text=out.get('fragments/regex-compat.conf');
  assert.match(text,/TOP.*filter_remote/);assert.match(text,/matching optimization.*OFF/i);
  assert.match(text,/openai-compat\.list, tag=.+force-policy=AI服务/);
  assert.match(text,/viu-cdn-compat\.list, tag=.+force-policy=国外媒体/);
  assert.match(text,/speedtest-ads-https\.snippet,.*enabled=false/);
  assert.doesNotMatch(text,/raw\.githubusercontent\.com\/luckiestultra/);
  assert.ok(text.includes('https://mirror.example/netatlas/clients/quantumultX/rules/openai-compat.list'));
});

test('the seven other clients gain no QX artifact or pretend regex capability',()=>{
  for(const client of ['surge','loon','shadowrocket','egern','stash','mihomo','singBox'])assert.deepEqual(renderQxCompatibility(client),[]);
  assert.throws(()=>renderQxCompatibility('qx'),/client/);
  assert.throws(()=>renderQxCompatibility('quantumultX',{baseUrl:'https://user:pass@example.test/x'}),/baseUrl/);
  for(const baseUrl of [null,'',false,0])assert.throws(()=>renderQxCompatibility('quantumultX',{baseUrl}),/baseUrl/);
});

test('changed metadata cannot be validated while rendering the loaded compatibility registry',async()=>{
  const temporary=await mkdtemp(resolve(tmpdir(),'netatlas-qx-compat-'));
  await cp(resolve(root,'metadata'),resolve(temporary,'metadata'),{recursive:true});
  const path=resolve(temporary,'metadata/qx-compat.json');
  const data=JSON.parse(await readFile(path,'utf8'));data.routes[0].pattern='*.azure.com';
  await writeFile(path,JSON.stringify(data));
  await assert.rejects(loadQxCompatibility(temporary),/registry|pattern|compatibility/);
});
