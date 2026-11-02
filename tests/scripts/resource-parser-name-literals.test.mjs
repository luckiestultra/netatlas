import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { parseOptions, applyNodeOptions } from '../../src/features/resource-parser/options.mjs';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';
const node=name=>'http=proxy.example:80, username=synthetic-user, password=literal$type, tag='+name;
const options=hash=>parseOptions('https://example.test/sub#'+hash);
const tags=content=>content.trim().split('\n').map(row=>/tag=(.*)$/.exec(row)[1]);
const transform=(name,hash,tag='Public')=>applyNodeOptions(node(name)+'\n',options(hash),{tag});

test('source name dollar tokens stay literal when user prefix, suffix or rename requests a template',()=>{
  const literal='Literal $index $type $tag $emoji';
  assert.deepEqual(tags(transform(literal,'prefix=%24tag%20')),['Public '+literal]);
  assert.deepEqual(tags(transform(literal,'suffix=%20%24type')), [literal+' HTTP']);
  assert.deepEqual(tags(transform(literal,'rename=@%20%24index')), [literal+' 1']);
  assert.deepEqual(tags(transform(literal,'rrname=@%20%24type&prefix=%24tag%20')), ['Public '+literal+' HTTP']);
});

test('rename match operands accept dollar literals while only inserted values become templates',()=>{
  assert.deepEqual(tags(transform('Literal $custom $index','rename=%24custom@%24type')),['Literal HTTP $index']);
  assert.deepEqual(tags(transform('Literal $index','rename=%24index@Value&prefix=%24tag%20')),['Public Literal Value']);
  assert.deepEqual(tags(transform('JP','rename=JP@%24type+%24type@Replaced')),['Replaced']);
  assert.deepEqual(tags(transform('$type','rename='+encodeURIComponent(JSON.stringify([['$type','$tag']])),'$index')),['$index']);
  assert.throws(()=>options('rename=JP@%24unknown'),/invalid parameters/);
});

test('resource tag and matched captures never recursively activate named placeholders',()=>{
  const literal='$index $type $tag';
  for(const hash of ['prefix=%24tag%20','rename=@%20%24tag','rrname=@%20%24tag'])assert.deepEqual(tags(transform('Literal $index',hash,literal)),[hash.startsWith('prefix')?literal+' Literal $index':'Literal $index '+literal]);
  assert.deepEqual(tags(transform('Literal $type','replace=(Literal.*)@$1%20%24index')),['Literal $type 1']);
  assert.deepEqual(tags(transform('Literal $type','replace=Literal.*@$%26%20%24type')),['Literal $type HTTP']);
  assert.match(transform('Literal $index','replace=synthetic-user@new-user&suffix=%20%24type'),/password=literal\$type/);
});

test('name transformations keep their established order and indexes follow final sorting',()=>{
  const source=node('JP $index 2')+'\n'+node('JP $index 1')+'\n';
  const out=applyNodeOptions(source,options('rrname=JP@Japan&delreg=%20Trial&replace=Japan@Tokyo&rename=@%20%24index&prefix=%24tag%20&sort=1'),{tag:'$type'});
  assert.deepEqual(tags(out),['$type Tokyo $index 1 1','$type Tokyo $index 2 2']);
  assert.deepEqual(tags(transform('Original','rrname=Original@%24type&replace=tag%3DHTTP@tag%3DNotUsed&rename=%24type@Final')),['Final']);
});

test('URI source through user templates and declaration replacement survives final semantic validation and standalone host execution',()=>{
  const resource={type:'server',tag:'Public $index',link:'https://example.test/sub#prefix=%24tag%20&replace=synthetic-user@new-user&suffix=%20%24type',content:'http://synthetic-user:literal%23%21include@proxy.example:80#Name%20%24index%20%23%21SYSTEM%3Dmac'};
  const expected=parseResource(resource);assert.deepEqual(tags(expected.content),['Public $index Name $index #!SYSTEM=mac HTTP']);
  assert.match(expected.content,/username=new-user/);assert.match(expected.content,/password=literal#!include/);assert.doesNotThrow(()=>createNodeParser().validateNative(expected.content));
  let calls=0,captured;const denied=()=>assert.fail('no network or storage');
  const actual=vm.runInNewContext(bundleResourceParser(),{$resource:resource,$done:value=>{calls++;captured=value;return value;},fetch:denied,$task:{fetch:denied},$prefs:{valueForKey:denied}},{timeout:3000,contextCodeGeneration:{strings:false,wasm:false}});
  assert.equal(calls,1);assert.equal(actual,captured);assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
  assert.throws(()=>parseResource({...resource,content:node('Safe')+'\n#!include https://example.test/synthetic'}),/unsupported executable directive/);
});

test('template provenance survives captures and escaped dollar tokens without activating assembled source text',()=>{
  assert.deepEqual(tags(transform('Literal $type','replace=(tag%3D)(.*)@$1$2%20%24type')),['Literal $type HTTP']);
  assert.deepEqual(tags(transform('Literal','replace=tag%3DLiteral@tag%3D$$type%20%24index')),['$type 1']);
  assert.deepEqual(tags(transform('$ty','prefix=%24tag%20&suffix=pe%20%24index')),['Public $type 1']);
  assert.deepEqual(tags(transform('Original','rrname=Original@%24type&replace=(tag%3D)(.*)@$1$2%20%24index')),['HTTP 1']);
  assert.deepEqual(tags(transform('JP $index','prefix=%24tag%20&emoji=1')),['🇯🇵 Public JP $index']);
});

test('literal rename and rrname use standard replacement dollar tokens and preserve copied source tokens',()=>{
  for(const option of ['rename','rrname']) {
    assert.deepEqual(tags(transform('JP',option+'=JP@$%26X')),['JPX']);
    assert.deepEqual(tags(transform('JP',option+'=JP@%24%24')),['$']);
    assert.deepEqual(tags(transform('JP',option+'=JP@%241')),['$1']);
    assert.deepEqual(tags(transform('$type',option+'=%24type@$%26%20%24index')),['$type 1']);
    assert.deepEqual(tags(transform('JP',option+'=JP@%24%24unknown')),['$unknown']);
    assert.deepEqual(tags(transform('JP',option+'='+encodeURIComponent(JSON.stringify([['JP','$&X']])))),['JPX']);
  }
});

test('literal rename replacement agrees with standard String.replace across a deterministic dollar-token corpus',()=>{
  const inputs=['JP','JPJP','xJPyJPz','A.*B.*','Literal $type $index','aba','😀 JP 😀','A+B@C'];
  const operands=['JP','.*','$type','a','😀','A+B@C'];
  const replacements=['X','$&X','$$','$`',"$'",'$1','$01','$10','$100','$0','$&-$$-$1',"$`-$&-$'",'$$type','$$unknown'];
  let cases=0;
  for(const input of inputs)for(const from of operands)for(const replacement of replacements){
    const reference=input.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),replacement);
    if(!reference||reference!==reference.trim())continue;
    const hash='rename='+encodeURIComponent(from)+'@'+encodeURIComponent(replacement);
    assert.deepEqual(tags(transform(input,hash)),[reference],JSON.stringify({input,from,replacement}));cases++;
  }
  assert.ok(cases>=500,'exercise at least 500 standard substitution cases');
});

test('literal name transformation work has a shared resource budget while ordinary large subscriptions remain valid',()=>{
  const hash='rename='+Array.from({length:100},(_,i)=>i%2?'Y@X':'X@Y').join('+');
  const content=Array.from({length:20},(_,i)=>node('X'.repeat(490)+i)).join('\n');
  assert.throws(()=>parseResource({type:'server',content,link:'https://example.test/sub#'+hash}),/invalid (?:node names or parameters|parameters)/);
  const normal=Array.from({length:2000},(_,i)=>node('JP '+i)).join('\n');
  assert.equal(tags(parseResource({type:'server',content:normal}).content).length,2000);
  assert.equal(tags(parseResource({type:'server',content:normal,link:'https://example.test/sub#rename=JP@Japan'}).content).length,2000);
});


test('native JavaScriptCore bounds actual bundled name work and preserves literal native tails', {skip:process.platform!=='darwin'},()=>{
  const changing='rename='+Array.from({length:100},(_,i)=>i%2?'Y@X':'X@Y').join('+');
  const identity='rename='+Array(100).fill('X@X').join('+');
  const rows=count=>Array.from({length:count},(_,i)=>node('X'.repeat(490)+i)).join('\n');
  const cases=[
    {name:'budget',resource:{type:'server',content:rows(20),link:'https://example.test/sub#'+changing},error:true},
    {name:'identity2000',resource:{type:'server',content:rows(2000),link:'https://example.test/sub#'+identity},count:2000},
    {name:'native-literal',resource:{type:'server',content:node('Name #!SYSTEM=mac')},count:1},
  ];
  const program=bundleResourceParser()+'\n'+`var denied=function(){throw new Error('network or storage forbidden')};var fetch=denied,$task={fetch:denied},$prefs={valueForKey:denied};var cases=${JSON.stringify(cases)};JSON.stringify(cases.map(function(test){var calls=0,value,start=Date.now();NetAtlasResourceParser.runResource(test.resource,function(result){calls++;value=result;return result;});return {name:test.name,calls:calls,ms:Date.now()-start,error:value.error||null,count:value.content?value.content.trim().split('\\n').length:0};}));`;
  // Three native-engine cases share a process; parallel full-suite load also
  // includes interpreter startup. The deterministic work-budget assertions
  // below remain the guard, rather than an idle-machine wall-clock promise.
  const result=spawnSync('python3',['tests/helpers/youtube-jsc.py'],{input:program,encoding:'utf8',timeout:15000,maxBuffer:65536});
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);const actual=JSON.parse(result.stdout);
  for(let i=0;i<cases.length;i++){assert.equal(actual[i].calls,1);if(cases[i].error)assert.match(actual[i].error,/invalid (?:node names or parameters|parameters)/);else{assert.equal(actual[i].error,null);assert.equal(actual[i].count,cases[i].count);}}
});

test('identity optimizations preserve only explicitly inserted complete template tokens',()=>{
  assert.deepEqual(tags(transform('$type','rename=%24@%24+t@t+y@y+p@p+e@e&prefix=%24tag%20')),['Public $type']);
  assert.deepEqual(tags(transform('$type','rename=%24type@%24type')),['HTTP']);
});
