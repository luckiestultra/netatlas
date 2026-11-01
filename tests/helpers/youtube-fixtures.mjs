import vm from 'node:vm';

export function fixtureProgram(kind, scenario = 'empty', host = 'qx') {
  const response = kind === 'response';
  const url = response
    ? 'https://youtubei.googleapis.com/youtubei/v1/account/get_setting'
    : scenario === 'headers' ? 'https://youtubei.googleapis.com/youtubei/v1/log_event'
    : scenario === 'exit' ? 'https://fixture.example/unchanged'
    : 'https://fixture.googlevideo.com/initplayback?x=1&ack=1';
  const config = ['redirect', 'mismatch'].includes(scenario)
    ? { youtube: { clientKey: 'fixture-key', encryptKey: scenario === 'redirect' ? 'AQ==' : 'Ag==' } } : null;
  return `
var __calls=[],__network=0,__writes=[],__notifications=0,__logs=[];
var console={log:function(value){__logs.push(String(value))}};
var __store=${JSON.stringify(config ? { YouTubeConfig: JSON.stringify(config) } : {})};
var $request={url:${JSON.stringify(url)},headers:{'User-Agent':'fixture','content-encoding':'gzip','x-youtube-hot-hash-data':'fixture'}};
${!response && ['redirect','mismatch'].includes(scenario) ? '$request.bodyBytes=new Uint8Array([26,3,42,1,1]).buffer;' : ''}
var $response=${response ? "{statusCode:200,headers:{},bodyBytes:new Uint8Array("+(scenario === 'error' ? '[255]' : '[]')+").buffer}" : 'undefined'};
var $prefs={valueForKey:function(key){return __store[key]===undefined?null:__store[key]},setValueForKey:function(value,key){__writes.push({key:key,value:value});__store[key]=value;return true}};
var $persistentStore={read:function(key){return $prefs.valueForKey(key)},write:function(value,key){return $prefs.setValueForKey(value,key)}};
${host === 'qx' || host === 'loon' ? "var $task={fetch:function(){__network++;throw new Error('Fixture network capability is forbidden')}};" : ''}
${host === 'loon' ? 'var $loon={};' : ''}
var $notification={post:function(){__notifications++}};
var $notify=function(){__notifications++};
var $done=function(value){__calls.push(value)};
`;
}

export const summarizeProgram = `JSON.stringify({
 calls:__calls.map(function(value){return {
   keys:Object.keys(value||{}),status:value&&value.status,
   headers:value&&value.headers,url:value&&value.url,
   bodyType:Object.prototype.toString.call(value&&value.body),
   bodyBytesType:Object.prototype.toString.call(value&&value.bodyBytes),
   bodyBytes:value&&value.bodyBytes instanceof ArrayBuffer?Array.from(new Uint8Array(value.bodyBytes)):null,
   response:value&&value.response?{status:value.response.status,bodyType:Object.prototype.toString.call(value.response.body)}:null
 }}),network:__network,writes:__writes,notifications:__notifications,logs:__logs,
 capabilities:[typeof process,typeof require,typeof fetch,typeof XMLHttpRequest,typeof readFile]
})`;

export function runFixture(source, kind, scenario = 'empty', host = 'qx') {
  const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
  vm.runInContext(fixtureProgram(kind,scenario,host), context);
  vm.runInContext(source, context, {timeout:1000});
  return JSON.parse(vm.runInContext(summarizeProgram, context));
}
