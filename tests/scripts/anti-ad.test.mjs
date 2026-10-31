import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { clientIds } from '../../tools/lib/clients.mjs';
import { renderAntiAd } from '../../tools/lib/anti-ad.mjs';
const baseUrl='https://example.test/netatlas';

test('optional advertising filters have genuine client-specific install or merge formats',()=>{
  const expected={quantumultX:'fragments/anti-ad.conf',surge:'modules/anti-ad.sgmodule',loon:'fragments/anti-ad.conf',shadowrocket:'fragments/anti-ad.conf',egern:'modules/anti-ad.yaml',stash:'modules/anti-ad.stoverride',mihomo:'fragments/anti-ad.yaml',singBox:'fragments/anti-ad.json'};
  for(const client of clientIds){
    const [artifact]=renderAntiAd(client,{baseUrl});
    assert.equal(artifact.path,expected[client]);
    assert.match(artifact.content,new RegExp(baseUrl+'/clients/'+client+'/rules/anti-ad\\.'));
    assert.doesNotMatch(artifact.content,/script-path|\[MITM\]|\$persistentStore|\$prefs/);
    if(client==='egern')assert.equal(parse(artifact.content).rules[0].rule_set.policy,'REJECT');
    if(client==='stash'||client==='mihomo'){
      const data=parse(artifact.content);
      assert.deepEqual(data.rules,['RULE-SET,netatlas-anti-ad,REJECT']);
      assert.equal(data['rule-providers']['netatlas-anti-ad'].behavior,'classical');
      assert.equal(data['rule-providers']['netatlas-anti-ad'].format,'yaml');
    }
    if(client==='singBox'){
      const data=JSON.parse(artifact.content);
      assert.deepEqual(data.route.rules,[{rule_set:['netatlas-anti-ad'],action:'reject'}]);
      assert.equal(data.route.rule_set[0].format,'source');
      assert.equal(data.route.rule_set[0].download_detour,undefined);
      assert.deepEqual(data.route.rule_set[0].http_client,{detour:'DIRECT'});
    }
  }
});

test('no unpublished local-path guess or injected configuration is emitted',()=>{
  for(const client of clientIds){
    assert.deepEqual(renderAntiAd(client),[]);
    for(const baseUrl of ['https://example.test/a,foo=bar','https://user:secret@example.test','https://example.test/a\n[Script]'])assert.throws(()=>renderAntiAd(client,{baseUrl}),/baseUrl/);
  }
});
