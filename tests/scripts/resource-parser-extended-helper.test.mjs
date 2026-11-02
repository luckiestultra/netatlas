import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { installParserHelper } from '../../src/features/resource-parser/helper.mjs';
import { parseOptions } from '../../src/features/resource-parser/options.mjs';
import { parseResource, completeResource } from '../../src/features/resource-parser/core.mjs';

function helper(method, value) {
  const parser = installParserHelper({});
  const setup = Object.keys(parser).map(key => '$parser.' + key + ' = (' + parser[key].toString() + ');').join('\n');
  return JSON.parse(JSON.stringify(vm.runInNewContext(setup + '\n$parser[method](value)', { $parser: {}, method, value, URL: undefined, URLSearchParams: undefined, Buffer: undefined, process: undefined, require: undefined, fetch: undefined }, { timeout: 2000, contextCodeGeneration: { strings: false, wasm: false } })));
}
const hash = values => helper('uiToHash', values);
const parsed = values => parseOptions('https://example.test/public#' + hash(values));
const flat = ui => Object.fromEntries(ui.sections.flatMap(group => group.items.map(item => [item.key, item.value])));
const extended = {
  regex: 'tag=JP', regout: 'Trial', rrname: 'JP@Japan', replace: 'Japan@Tokyo', delreg: 'Trial', ptn: '3', npt: '1', cap: '1', sortx: '1', del: true,
  udp: '1', tfo: '0', uot: 'sp.v2', cert: 'verify.example', csha: 'a'.repeat(64), psha: 'b'.repeat(64), alpn: 'h2,http/1.1', aead: '0', host: 'front.example☠️', obfs: 'vhttp', tsession: '2', checkurl: 'https://example.test/check', tls13: '1',
  pset: '^example\\.test$@Other', fcr: '2', via: 'en0', relay: 'Relay', hide: false, dst: 'filter', cnt: true, dbg: true, ntf: '1', flow: '2030-01-01:100:20', b64: true, UA: true, profile: '111', arguments: '{"mode":"public","enabled":true}',
};
test('all implemented advanced options have standalone native helper controls', () => {
  const schema = helper('hashSchema');
  const items = schema.sections.flatMap(group => group.items), keys = items.map(item => item.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of Object.keys(extended)) assert.ok(keys.includes(key), key);
  assert.equal(items.find(item => item.key === 'sort').type, 'text');
  for (const item of items) assert.equal(Object.hasOwn(item, 'value'), false, item.key);
  assert.equal(hash({}), '');
});
test('every advanced UI edit serializes into a runtime-accepted hash and round trips', () => {
  for (const [key, value] of Object.entries(extended)) {
    const values = key === 'sortx' ? { sort: 'JP>HK', [key]: value } : { [key]: value };
    const serialized = hash(values);
    const options = parseOptions('https://example.test/public#' + serialized);
    assert.ok(options && typeof options === 'object', key);
    const edited = flat(helper('hashToUI', serialized));
    assert.deepEqual(Object.keys(edited).sort(), Object.keys(values).sort(), key);
    assert.deepEqual(parseOptions('https://example.test/#' + hash(edited)), options, key);
    assert.equal(hash(edited), serialized, key);
  }
  for (const sort of ['none', 'name', 'name-desc', 'random', '0', '1', '-1', 'x', 'JP>HK', 'JP<HK']) assert.doesNotThrow(() => parsed({ sort }));
});
test('encoded literal operators retain their data boundaries through helper editing', () => {
  for (const key of ['rename', 'rrname', 'replace', 'pset']) {
    const value = key === 'pset' ? 'A%2BB%40C@Other' : 'A%2BB%40C@New%2BName';
    const serialized = hash({ [key]: value });
    const options = parseOptions('https://example.test/#' + serialized);
    assert.deepEqual(options[key], [['A+B@C', key === 'pset' ? 'Other' : 'New+Name']]);
    assert.equal(flat(helper('hashToUI', serialized))[key], value);
    assert.equal(hash(flat(helper('hashToUI', serialized))), serialized);
  }
});
test('actual node flow uses edited helper name/filter/sort and connection fields', () => {
  const content = 'http=example.test:443, over-tls=true, tls-verification=true, tag=JP Trial 2\nhttp=example.test:443, over-tls=true, tls-verification=true, tag=HK 1';
  const result = parseResource({ type: 'server', content, link: 'https://example.test/#' + hash({ regex: 'tag=JP', rrname: 'JP@Japan', delreg: ' Trial', replace: 'Japan@Tokyo', rename: '@%20$type', suffix: '1', udp: '1', tfo: '0', cert: '1', tsession: '2' }) });
  assert.match(result.content, /tag=Tokyo 2 HTTP 「𝐡𝐭𝐭𝐩」/);
  assert.match(result.content, /udp-relay=true/); assert.match(result.content, /fast-open=false/);
  assert.match(result.content, /tls-no-session-reuse=true/); assert.doesNotMatch(result.content, /tag=HK/);
});
test('actual rules and rewrite flows use helper policy/network and disabled output controls', () => {
  const rule = parseResource({ type: 'filter', content: 'DOMAIN,example.test,DIRECT', link: 'https://example.test/#' + hash({ pset: '^example\\.test$@Other', fcr: '1', via: 'en0' }) });
  assert.match(rule.content, /host,example\.test,Other,force-cellular,via-interface=en0/);
  const rewrite = parseResource({ type: 'rewrite', content: '^https://example.test/ url reject', link: 'https://example.test/#' + hash({ out: ['example.test'], hide: false }) });
  assert.match(rewrite.content, /\^https:\/\/example\.test\/ - reject/);
});
test('module argument UI edits reach the real variable substitution path', () => {
  const result = parseResource({ type: 'rewrite', content: '#!arguments=mode:default\n[URL Rewrite]\n^https://example.test/ https://example.test/{{{mode}}} 302', link: 'https://example.test/#' + hash({ arguments: '{"mode":"public"}' }) });
  assert.match(result.content, /https:\/\/example\.test\/public/);
});
test('unknown options remain byte exact and malformed advanced values remain controlled', () => {
  const unknown = 'future=%2b+%252B&bad=%FF';
  const ui = helper('hashToUI', 'regex=JP&' + unknown);
  assert.equal(ui.unknown, unknown); assert.ok(hash({ ...flat(ui), __unknown: ui.unknown }).endsWith(unknown));
  for (const values of [{ udp: 'true' }, { tsession: '3' }, { cap: '3' }, { cert: 'PRIVATE' }, { csha: 'PRIVATE' }, { sort: 'JP>' }, { arguments: '{"nested":{}}' }, { regex: '(a*)+' }, { rename: 'A@@B' }, { profile: '1111' }]) assert.throws(() => hash(values), error => error.message === 'Parser helper: invalid parameters');
});

test('JSON rename percent literals and pattern validation agree with the runtime', () => {
  for (const key of ['rename', 'rrname']) {
    const value = JSON.stringify([['100%', '$1'], ['A+B@C', 'Value']]);
    const serialized = hash({ [key]: value });
    assert.equal(flat(helper('hashToUI', serialized))[key], value);
    assert.deepEqual(parseOptions('https://example.test/#' + hash(flat(helper('hashToUI', serialized))))[key], JSON.parse(value));
  }
  for (const regex of ['[a-\\d]', '(?=x)', '(a*)+', '(a)\\1', '[z-a]']) assert.throws(() => hash({ regex }), /invalid parameters/);
});

test('conflicting domain-set settings and invalid empty source fields remain visible as unknown', () => {
  for (const values of [{ type: 'domain-set', format: 'clash' }, { type: 'domain-set', 'domain-mode': 'suffix' }]) assert.throws(() => hash(values), /invalid parameters/);
  for (const raw of ['type=domain-set&format=clash', 'type=domain-set&domain-mode=suffix', 'regex=', 'policy=', 'arguments=', 'script-compat=']) {
    const ui = helper('hashToUI', raw); assert.deepEqual(ui.sections, []); assert.equal(ui.unknown, raw); assert.equal(hash({ __unknown: ui.unknown }), raw);
    assert.throws(() => parseOptions('https://example.test/#' + hash({ __unknown: ui.unknown })), /invalid parameters/);
  }
  assert.equal(parsed({ type: 'domain-set', format: 'domain-set', 'domain-mode': 'exact' }).sourceFormat, 'domain-set');
});
test('large structured fields retain runtime bounds through native editing', () => {
  const value = JSON.stringify(Object.fromEntries(Array.from({ length: 4 }, (_, index) => ['key' + index, 'a'.repeat(1990)])));
  const serialized = hash({ arguments: value });
  assert.equal(flat(helper('hashToUI', serialized)).arguments, value); assert.deepEqual(parsed({ arguments: value }).moduleArguments, JSON.parse(value));
  for (const value of [JSON.stringify(Object.fromEntries(Array.from({ length: 65 }, (_, index) => ['k' + index, true]))), JSON.stringify({ value: '\u0085' }), JSON.stringify({ value: 'a'.repeat(2049) })]) assert.throws(() => hash({ arguments: value }), /invalid parameters/);
  const raw = 'rename=' + Array(10).fill(encodeURIComponent('界'.repeat(200)) + '@x').join('+');
  const ui = helper('hashToUI', raw); assert.equal(ui.unknown, ''); assert.deepEqual(parseOptions('https://example.test/#' + hash(flat(ui))).rename, parseOptions('https://example.test/#' + raw).rename);
});

test('helper edits preserve supported grouped and zero-width runtime behavior', () => {
  const values = { regex: 'tag=(?:JP|HK)+$', replace: '$@%20$type', delreg: '^' };
  const serialized = hash(values); const options = parseOptions('https://example.test/#' + serialized);
  assert.equal(options.regex, values.regex); assert.deepEqual(options.replace, [['$', ' $type']]);
  const result = parseResource({ type: 'server', content: 'http=example.test:80, tag=JP', link: 'https://example.test/#' + serialized });
  assert.match(result.content, /tag=JP HTTP/);
  assert.deepEqual(parseOptions('https://example.test/#' + hash(flat(helper('hashToUI', serialized)))), options);
});
