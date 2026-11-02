import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import vm from 'node:vm';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';
import { parseRules } from '../../src/features/resource-parser/rules.mjs';
import { parseResource, completeResource } from '../../src/features/resource-parser/core.mjs';

const active = text => text.split('\n').filter(row => row && !row.startsWith('#'));
const glob = (pattern, value) => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.') + '$').test(value);

test('plain mixed domain and IP lists are detected without turning addresses into domain suffixes', () => {
  const content = 'example.test\n192.0.2.1\n2001:db8::1\n198.51.100.0/24\n.example.net';
  const expected = ['host-suffix,example.test,proxy', 'ip-cidr,192.0.2.1/32,proxy', 'ip6-cidr,2001:db8::1/128,proxy', 'ip-cidr,198.51.100.0/24,proxy', 'host-suffix,example.net,proxy'];
  assert.deepEqual(active(parseRules(content)), expected);
  assert.deepEqual(active(parseResource({ content }).content), expected);
  assert.equal(parseRules('example.test', { sourceFormat: 'domain-set' }), 'host,example.test,proxy\n', 'explicit DOMAIN-SET still means an exact bare domain');
  assert.equal(parseRules('payload:\n - example.test\n - +.example.net\n - .sub.test', {}, { parseYaml: parse }), 'host,example.test,proxy\nhost-suffix,example.net,proxy\nhost-wildcard,*.sub.test,proxy\n');
});

test('finite and glob-compatible DOMAIN-REGEX forms preserve the complete matching language', () => {
  const expressions = [String.raw`^(api|cdn)[0-2]\.example\.com$`, String.raw`^foo.*\.example\.com$`, String.raw`^foo.+\.example\.com$`, String.raw`^a(b|cd)?\.test$`, String.raw`ad[01]{1,2}\.test$`, '^foo|bar$', '^foo|bar', 'foo|bar$'];
  const hosts = ['api0.example.com', 'cdn2.example.com', 'api3.example.com', 'xapi1.example.com', 'foo.example.com', 'foobar.example.com', 'foo.a.example.com', 'a.test', 'ab.test', 'acd.test', 'ad0.test', 'xad01.test', 'ad111.test', 'other.test', 'xbar', 'xbar.test'];
  for (const expression of expressions) {
    const patterns = active(parseRules('DOMAIN-REGEX,' + expression + ',Proxy')).map(row => row.split(',')[1]);
    for (const host of hosts) assert.equal(patterns.some(pattern => glob(pattern, host)), new RegExp(expression, 'i').test(host), expression + ' / ' + host);
  }
  for (const bad of [String.raw`^(a+)\1\.test$`, String.raw`^(?!ads).*\.test$`, String.raw`^[A-z]\.test$`, '^a{1000}\\.test$', '^a[0-9]{10}\\.test$']) assert.throws(() => parseRules('DOMAIN-REGEX,' + bad + ',Proxy'));
});

test('rule notes and existing disabled rules remain metadata and never become active conditions', () => {
  const text = '{# note contains skip.test #} DOMAIN,keep.test,DIRECT\n-DOMAIN,disabled.test,REJECT\nDOMAIN,skip.test,Proxy';
  const output = parseRules(text, { out: ['skip.test'], hide: false });
  assert.match(output, /^host,keep\.test,direct$/m);
  assert.match(output, /^-host,disabled\.test,reject$/m);
  assert.match(output, /^-host,skip\.test,Proxy$/m);
  assert.match(output, /^# note: note contains skip\.test$/m);
  assert.match(parseRules('{# UI note #} DOMAIN,keep.test,DIRECT', {}, { build: 950 }), /^\{# UI note #\} host,keep\.test,direct$/m);
  assert.throws(() => parseRules('{# malformed DOMAIN,keep.test,DIRECT'));
});

test('rule regular expressions, conditional policy and interface options execute in order', () => {
  const options = { regex: 'keep|other', regout: 'other', pset: [['keep\\.test', 'Media']], fcr: '3', via: '%TUN%' };
  const output = parseRules('DOMAIN,keep.test,Proxy\nDOMAIN,other.test,Proxy\nDOMAIN,drop.test,Proxy', options);
  assert.equal(output, 'host,keep.test,Media,multi-interface-balance,via-interface=%TUN%\n');
  assert.equal(parseRules('DOMAIN,example.test,Proxy', { pset: [['^Proxy$', 'Media']] }), 'host,example.test,Media\n');
  assert.equal(parseRules('DOMAIN,example.test,Proxy', { pset: [['^example\\.test$', 'Media']] }), 'host,example.test,Media\n');
  assert.equal(parseRules('DOMAIN,example.test,Proxy', { pset: [['example\\.test,Proxy', 'Media']] }), 'host,example.test,Proxy\n');
  const replaced = parseRules('DOMAIN,old.test,Proxy', { replace: [['old\\.test', 'new.test']] });
  assert.equal(replaced, 'host,new.test,Proxy\n');
  assert.throws(() => parseRules('DOMAIN,old.test,Proxy', { replace: [['old\\.test', 'new.test,Proxy\nFINAL,DIRECT']] }));
});

test('disabled FINAL does not terminate later rules, while an active FINAL still does', () => {
  assert.equal(parseRules('-FINAL,DIRECT\nDOMAIN,keep.test,Proxy'), '-final,direct\nhost,keep.test,Proxy\n');
  let calls = 0;
  const result = completeResource({ content: 'FINAL,DIRECT\nDOMAIN,keep.test,Proxy', type: 'filter' }, () => { calls++; });
  assert.equal(calls, 1); assert.deepEqual(Object.keys(result), ['error']);
  assert.throws(() => parseRules('FINAL,DIRECT', { fcr: '1' }), /final/i);
  assert.throws(() => parseRules('FINAL,DIRECT', { via: 'en0' }), /final/i);
});

test('physical output limits include expanded notes and policy warning rows', () => {
  const row = String.raw`{# n #} DOMAIN-REGEX,^a[0-9]{3}\.test$,Proxy`;
  assert.throws(() => parseRules(Array(125).fill(row).join('\n'), { policy: 'Media' }), /output limit/);
});

test('replacement amplification stops before assembling an oversized output copy', () => {
  const input = Array(5000).fill('USER-AGENT,XXXX,DIRECT').join('\n');
  const context = vm.createContext({ $resource: { type: 'filter', content: input, link: 'https://fixture.test/rules#replace=X@' + 'X'.repeat(512) } });
  vm.runInContext(`var calls=0,oversizedAssemblies=0;var $done=function(value){calls++;return value};
    var originalJoin=Array.prototype.join;Array.prototype.join=function(separator){
      if(this.length>1000){var length=0;for(var i=0;i<this.length;i++)if(typeof this[i]==='string')length+=this[i].length;
        if(length>8388608){oversizedAssemblies++;throw Error('oversized assembly');}}
      return originalJoin.call(this,separator);
    };`, context);
  const result = vm.runInContext(bundleResourceParser(), context, { timeout: 3000 });
  assert.match(result.error, /^Rule conversion: output limit exceeded$/);
  assert.equal(context.oversizedAssemblies, 0);
  assert.equal(context.calls, 1);
});
