import test from 'node:test';
import assert from 'node:assert/strict';
import * as sync from '../../tools/lib/sync.mjs';
test('registered CIDR lines retain explicit address families and reject widening input',()=>{
 assert.equal(typeof sync.parseCidrLines,'function');
 assert.deepEqual(sync.parseCidrLines('# pinned source\n1.0.1.0/24\n1.0.1.0/24\n','cn4.txt','ip-cidr').entries,[{type:'ip-cidr',value:'1.0.1.0/24'}]);
 assert.deepEqual(sync.parseCidrLines('2400:3200::/32\n','cn6.txt','ip-cidr6').entries,[{type:'ip-cidr6',value:'2400:3200::/32'}]);
 for(const value of ['1.0.1.1/24','1.0.1.0','example.com/24','2400:3200::/32','1.0.1.0/24 extra'])assert.throws(()=>sync.parseCidrLines(value,'bad.txt','ip-cidr'),/CIDR|family|canonical/i);
 assert.throws(()=>sync.parseCidrLines('1.0.1.0/24','bad.txt','domain-suffix'),/CIDR|type/i);
});
