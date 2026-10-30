import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';
import { createGeoIP } from '../src/features/geoip/core.mjs';
import { renderFeatures } from './lib/features.mjs';

const geo=createGeoIP();
const script=renderFeatures('quantumultX').find(file=>file.path==='scripts/geoip.js').content;
const providers=[['ipinfo','https://ipinfo.io/json'],['ipwho.de','http://ipwho.de/json']];
const results=await Promise.allSettled(providers.map(async([provider,url])=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{accept:'application/json'}});
  const chunks=[];let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>65536)throw new Error('Response exceeds 64 KiB');chunks.push(chunk);}
  const body=Buffer.concat(chunks).toString('utf8');
  const nativeResponse={statusCode:response.status,body};
  const normalized=geo.parseGeoResponse(nativeResponse);
  assert.equal(normalized.state,'ok',`${provider}: ${normalized.state} (HTTP ${response.status})`);
  assert.ok(normalized.ip,`${provider}: no exit IP returned`);
  let calls=0,output;
  const context=createContext({$response:nativeResponse,$done:value=>{calls++;output=value;}});
  new Script(script).runInContext(context,{timeout:1000});
  assert.equal(calls,1);
  assert.deepEqual(JSON.parse(JSON.stringify(output)),geo.formatQuantumultX(normalized));
  // The actual IP and response body stay in memory; do not persist personal IPs.
  return {provider,http:response.status,state:normalized.state,countryCode:normalized.countryCode,asn:normalized.asn||null,nativeAdapter:'vm-contract-pass',nativeApp:'not-run'};
}));
for(let i=0;i<results.length;i++){
  const result=results[i];
  if(result.status==='fulfilled')console.log(JSON.stringify(result.value));
  else{console.error(`${providers[i][0]}: live lookup failed (${result.reason.code??result.reason.name??'error'})`);process.exitCode=1;}
}
