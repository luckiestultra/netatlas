import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseOptions, applyNodeOptions, createKeywordMatcher, createTextMatcher } from '../../src/features/resource-parser/options.mjs';
import { installParserHelper } from '../../src/features/resource-parser/helper.mjs';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { parseRules } from '../../src/features/resource-parser/rules.mjs';
import { parseRewrites } from '../../src/features/resource-parser/rewrites.mjs';

const link = hash => 'https://example.test/private?token=DO_NOT_DISCLOSE#' + hash;
const node = name => 'http=proxy.example:80, username=user, password=DO_NOT_DISCLOSE, tag=' + name;
const content = (...names) => names.map(node).join('\n') + '\n';
const clean = value => JSON.parse(JSON.stringify(value));
function helperCall(method, argument) {
  const parser = installParserHelper({});
  // Simulate native extraction: the installation closure and every module
  // binding are absent. Only the three documented $parser methods survive.
  const setup = Object.keys(parser).map(key => '$parser.' + key + ' = (' + parser[key].toString() + ');').join('\n');
  return clean(vm.runInNewContext(setup + '\n$parser[method](argument);', {
    $parser: {}, method, argument,
    URL: undefined, URLSearchParams: undefined, Buffer: undefined,
    fetch: undefined, require: undefined, process: undefined, atob: undefined,
  }, { timeout: 1000 }));
}
const flat = ui => Object.fromEntries(ui.sections.flatMap(group => group.items.map(item => [item.key, item.value])));
const fixedError = call => assert.throws(call, error => error instanceof Error && error.message === 'Resource parser options: invalid parameters');

test('options retain defaults and do not override policy without an explicit parameter', () => {
  for (const address of ['', 'https://example.test/a?policy=Other', link('')]) {
    const options = parseOptions(address);
    assert.equal(options.type, 'auto');
    assert.equal(options.sourceFormat, 'auto');
    assert.equal(options.sort, 'none');
    assert.equal(options.allowResolve, false);
    assert.equal(Object.hasOwn(options, 'policy'), false);
    assert.equal(Object.hasOwn(options, 'domainSetMode'), false);
    assert.equal(Object.hasOwn(options, 'scriptCompatibility'), false);
  }
  const options = parseOptions(link('type=filter&format=clash&domain-mode=suffix&policy=My%20Group&allow-resolve=1&script-compat=qx&sort=name-desc'));
  assert.equal(options.type, 'filter');
  assert.equal(options.sourceFormat, 'clash');
  assert.equal(options.domainSetMode, 'suffix');
  assert.equal(options.policy, 'My Group');
  assert.equal(options.allowResolve, true);
  assert.equal(options.scriptCompatibility, 'qx');
  assert.equal(options.sort, 'name-desc');
});

test('in/out split raw plus signs once, preserving encoded plus and percent literals', () => {
  const options = parseOptions(link('in=HK+JP%2BVIP+%252B&out=trial%20node+%E6%B5%8B%E8%AF%95&prefix=%5B%2B%5D%20&suffix=%20VIP'));
  assert.deepEqual(options.in, ['HK', 'JP+VIP', '%2B']);
  assert.deepEqual(options.out, ['trial node', '测试']);
  assert.equal(options.prefix, '[+] ');
  assert.equal(options.suffix, ' VIP');
  assert.deepEqual(parseOptions(link('in=&out=')).in, []);
  assert.equal(parseOptions(link('policy=A+B')).policy, 'A+B');
});

test('all declared enum values parse and boolean resolve consent is explicit', () => {
  for (const type of ['auto', 'server', 'filter', 'rewrite']) assert.equal(parseOptions(link('type=' + type)).type, type);
  for (const format of ['auto', 'classical', 'qx', 'domain-set', 'clash', 'sing-box']) assert.equal(parseOptions(link('format=' + format)).sourceFormat, format);
  for (const mode of ['exact', 'suffix']) assert.equal(parseOptions(link('domain-mode=' + mode)).domainSetMode, mode);
  assert.equal(parseOptions(link('allow-resolve=0')).allowResolve, false);
});

test('unknown, repeated, decoded duplicate, malformed, executable and sensitive options fail with a fixed message', () => {
  for (const hash of [
    'secret=DO_NOT_DISCLOSE', 'type=server&type=filter', 'type=server&%74ype=filter',
    'in=HK&%69n=JP', '%=value', 'prefix=%FF', 'prefix=%', 'type=bad', 'format=surge',
    'domain-mode=auto', 'allow-resolve=true', 'script-compat=surge', 'sort=random',
    'regex=.*', 'regout=secret', 'replace=old@new', 'js=throw%20secret', '__proto__=x',
    'in=HK++JP', 'out=+trial', 'prefix=%0Asecret', 'prefix=%2Ctag%3Devil', 'suffix=%22evil',
    'policy=', 'policy=%20Other', 'policy=A%3DB', 'policy=A%2CB', 'policy=%E2%80%A8secret',
    'type', '&type=auto', 'type=auto&',
  ]) fixedError(() => parseOptions(link(hash)));
  for (const value of [null, undefined, {}, 'x'.repeat(65537)]) fixedError(() => parseOptions(value));
});

test('JSON rename accepts only literal string pairs, including deletion', () => {
  const pairs = [['[HK].*', '香港'], ['Trial', ''], ['$&', '$1']];
  assert.deepEqual(parseOptions(link('rename=' + encodeURIComponent(JSON.stringify(pairs)))).rename, pairs);
  for (const value of ['old@new', '{}', 'null', '[["","new"]]', '[[1,"new"]]', '[["a",null]]', '[["a","b","c"]]', '[["a","bad,tag"]]', '[["a","bad\\nname"]]']) fixedError(() => parseOptions(link('rename=' + encodeURIComponent(value))));
});

test('node options preserve every byte when no transformations are selected', () => {
  const input = 'http=proxy.example:80, password="p=a ss", tag="Alpha"\r\n' + node('Beta') + '\r\n';
  assert.equal(applyNodeOptions(input), input);
  assert.equal(applyNodeOptions(input, parseOptions(link(''))), input);
});

test('literal filtering precedes sequential rename, prefixes, suffixes and deterministic sorting', () => {
  const options = parseOptions(link('in=HK+JP%2BVIP&out=Trial&rename=' + encodeURIComponent(JSON.stringify([['HK', '香港'], ['.*', '$1']])) + '&prefix=%5B&suffix=%5D&sort=name'));
  const result = applyNodeOptions(content('HK Z', 'US', 'JP+VIP A', 'HK Trial', 'HK .*'), options);
  assert.equal(result, content('[JP+VIP A]', '[香港 $1]', '[香港 Z]'));
  assert.ok(result.includes('password=DO_NOT_DISCLOSE'), 'unrelated native credentials are retained');
  assert.equal(applyNodeOptions(content('Beta', 'Alpha'), parseOptions(link('sort=name-desc'))), content('Beta', 'Alpha'));
  assert.equal(applyNodeOptions(content('Beta', 'Alpha'), parseOptions(link('sort=name'))), content('Alpha', 'Beta'));
});

test('literal terms and replacement metacharacters are never executed or treated as regex', () => {
  assert.equal(applyNodeOptions(content('A.*B', 'AxB'), { in: ['\\.*'] }), content('A.*B'));
  assert.equal(applyNodeOptions(content('A.*B.*'), { rename: [['.*', '$&']] }), content('A$&B$&'));
  assert.equal(applyNodeOptions(content('AAA'), { rename: [['A', 'B'], ['BB', 'C']] }), content('CB'));
  const source = content('globalThis.executed=true');
  assert.equal(applyNodeOptions(source, { rename: [['true', 'false']] }), content('globalThis.executed=false'));
  assert.equal(globalThis.executed, undefined);
  assert.throws(() => applyNodeOptions(content('A'), { rename: Array(100).fill(['A', 'AA']) }), /Node options failed/);
  assert.throws(() => applyNodeOptions(content('A'), { regex: '.*' }), /Node options failed/);
});

test('parsed options act on actual node, rule and rewrite converter results', () => {
  const parser = createNodeParser();
  const converted = parser.parseNodes('https://alice:secret@one.example:443#HK\nhttp://two.example:80#US');
  const selected = applyNodeOptions(converted, parseOptions(link('in=HK&prefix=VIP%20')));
  assert.match(selected, /username=alice/);
  assert.match(selected, /over-tls=true/);
  assert.match(selected, /tag=VIP HK/);
  assert.doesNotMatch(selected, /two\.example/);
  assert.equal(parser.parseNodes(selected), selected);
  assert.equal(parseRules('example.com', parseOptions(link('format=domain-set&domain-mode=suffix&policy=Other'))).split('\n').filter(line => !line.startsWith('#') && line).join('\n'), 'host-suffix,example.com,Other');
  assert.match(parseRules('IP-CIDR,192.0.2.1/32,DIRECT,no-resolve', parseOptions(link('allow-resolve=1'))), /ip-cidr,192\.0\.2\.1\/32,direct/);
  assert.match(parseRewrites('[Script]\nname = type=http-response, pattern=^https://example.com/, requires-body=true, script-path=https://example.com/a.js', parseOptions(link('script-compat=qx'))), /url script-response-body/);
});

test('empty, invalid and duplicate names or fully filtered subscriptions fail atomically without leaking credentials', () => {
  const invalid = [
    () => applyNodeOptions(''), () => applyNodeOptions('\n'),
    () => applyNodeOptions(content('')), () => applyNodeOptions(content('Same', 'Same')),
    () => applyNodeOptions(content('Good\u2028Bad')),
    () => applyNodeOptions(node('Good') + ',tag=Again'),
    () => applyNodeOptions('http=proxy.example:80,password=DO_NOT_DISCLOSE'),
    () => applyNodeOptions(content('Alpha'), { in: ['Missing'] }),
    () => applyNodeOptions(content('Alpha'), { rename: [['Alpha', '']] }),
    () => applyNodeOptions(content('A', 'B'), { rename: [['A', 'B']] }),
    () => applyNodeOptions(content('Alpha'), { prefix: ' ' }),
    () => applyNodeOptions(content('Alpha'), { suffix: ',tag=Injected' }),
    () => applyNodeOptions(content('Alpha'), { rename: [['', 'x']] }),
    () => applyNodeOptions(content('Alpha'), { in: 'Alpha' }),
  ];
  for (const call of invalid) assert.throws(call, error => error.message === 'Node options failed: invalid node names or parameters');
});

test('runtime functions and the shared matcher execute without module or host globals', () => {
  const matcher = '(' + createKeywordMatcher.toString() + ')';
  const options = clean(vm.runInNewContext('(' + parseOptions.toString() + ')(link)', { link: link('in=HK&prefix=%5B&suffix=%5D'), createTextMatcher: vm.runInNewContext('(' + createTextMatcher.toString() + ')'), URL: undefined, URLSearchParams: undefined }));
  assert.equal(vm.runInNewContext('(' + applyNodeOptions.toString() + ')(content,options)', { content: content('HK', 'US'), options, createKeywordMatcher: vm.runInNewContext(matcher) }), content('[HK]'));
  const schema = clean(vm.runInNewContext('(' + installParserHelper.toString() + ')($parser).hashSchema()', { $parser: {} }));
  assert.equal(schema.version, 1);
});

test('helper schema follows native v1 shapes without values and includes exactly supported parameters', () => {
  const schema = helperCall('hashSchema');
  assert.equal(schema.version, 1);
  const items = schema.sections.flatMap(group => { assert.equal(group.type, 'group'); return group.items; });
  assert.deepEqual(items.map(item => item.key).sort(), ['allow-resolve', 'domain-mode', 'emoji', 'format', 'in', 'info', 'inhn', 'out', 'outhn', 'policy', 'prefix', 'rename', 'script-compat', 'sort', 'suffix', 'type']);
  for (const item of items) {
    assert.equal(Object.hasOwn(item, 'value'), false);
    assert.ok(['select', 'text', 'tags', 'switch'].includes(item.type));
    if (item.type === 'select') assert.ok(item.options.length >= 2);
  }
  assert.deepEqual(helperCall('hashToUI', ''), { version: 1, sections: [], unknown: '' });
});

test('helper displays only present values, decodes once, and serializes off switches', () => {
  const ui = helperCall('hashToUI', '%74ype=server&in=HK+JP%2BVIP+%252B&policy=My%20Group&allow-resolve=0&prefix=%2B');
  assert.deepEqual(flat(ui), { type: 'server', policy: 'My Group', in: ['HK', 'JP+VIP', '%2B'], prefix: '+', 'allow-resolve': false });
  const hash = helperCall('uiToHash', flat(ui));
  assert.equal(parseOptions(link(hash)).allowResolve, false);
  assert.deepEqual(parseOptions(link(hash)).in, ['HK', 'JP+VIP', '%2B']);
  assert.ok(hash.includes('allow-resolve=0'));
});

test('unknown raw parameters survive helper UI round trips but are rejected at runtime', () => {
  const unknown = 'future=%2b+%252B&x=DO_NOT_DISCLOSE&bad=%FF';
  const ui = helperCall('hashToUI', 'type=server&' + unknown + '&in=HK');
  assert.equal(ui.unknown, unknown);
  const hash = helperCall('uiToHash', { ...flat(ui), __unknown: ui.unknown });
  assert.ok(hash.endsWith(unknown));
  fixedError(() => parseOptions(link(hash)));
});

test('helper does not collapse decoded duplicate or invalid enum parameters into an accepted hash', () => {
  for (const raw of ['type=server&%74ype=filter', 'format=foreign', 'allow-resolve=maybe', 'in=A++B', 'prefix=%FF', '%=bad', 'type']) {
    const ui = helperCall('hashToUI', raw);
    assert.deepEqual(ui.sections, []);
    assert.equal(ui.unknown, raw);
    assert.equal(helperCall('uiToHash', { __unknown: ui.unknown }), raw);
    fixedError(() => parseOptions(link(raw)));
  }
});

test('helper empty optional policy and advanced texts preserve runtime defaults', () => {
  const hash = helperCall('uiToHash', { policy: '', rename: '', 'script-compat': '', in: [], out: [], prefix: '', suffix: '', sort: 'none' });
  assert.equal(Object.hasOwn(parseOptions(link(hash)), 'policy'), false);
  assert.equal(Object.hasOwn(parseOptions(link(hash)), 'scriptCompatibility'), false);
});

test('helper rejects non-UI types and malformed structures with non-sensitive fixed errors', () => {
  for (const values of [null, [], { type: 'unknown' }, { in: 'HK' }, { in: [''] }, { policy: {} }, { prefix: '\nDO_NOT_DISCLOSE' }, { 'allow-resolve': '1' }, { __unknown: {} }, { regex: 'DO_NOT_DISCLOSE' }]) {
    assert.throws(() => helperCall('uiToHash', values), error => error.message === 'Parser helper: invalid parameters');
  }
});
