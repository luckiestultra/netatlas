import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseOptions, applyNodeOptions, createKeywordMatcher } from '../../src/features/resource-parser/options.mjs';
import { installParserHelper } from '../../src/features/resource-parser/helper.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';
const link = hash => 'https://example.test/synthetic?token=SYNTHETIC_SECRET#' + hash;
const node = name => 'http=proxy.example:80, password=SYNTHETIC_SECRET, tag=' + name;
const nodes = (...names) => names.map(node).join('\n') + '\n';
function run(hash, content, info) {
  const notifications = [];
  const context = vm.createContext({ $parser: {}, $resource: { link: link(hash), content, info }, $notify: (...args) => notifications.push(args), fetch: () => assert.fail('network'), $prefs: { valueForKey: () => assert.fail('storage') }, URL: undefined, URLSearchParams: undefined, Buffer: undefined });
  vm.runInContext('var calls=0,captured;var $done=function(value){calls++;captured=value;return value;}', context);
  const result = vm.runInContext(bundleResourceParser(), context, { timeout: 3000 }); context.result = result;
  assert.equal(context.calls, 1); assert.equal(vm.runInContext('result===captured', context), true);
  return { result, notifications };
}
function helper(method, argument) {
  const parser = installParserHelper({});
  const setup = Object.keys(parser).map(key => '$parser.' + key + '=(' + parser[key].toString() + ');').join('\n');
  return JSON.parse(JSON.stringify(vm.runInNewContext(setup + '$parser[method](argument)', { $parser: {}, method, argument }, { timeout: 1000 })));
}
const flat = ui => Object.fromEntries(ui.sections.flatMap(group => group.items.map(item => [item.key, item.value])));

test('node keyword filtering has bounded OR/AND grammar with escaped literal dots', () => {
  assert.equal(applyNodeOptions(nodes('香港 IEPL 01', '香港 BGP 02', '日本03'), parseOptions(link('in=香港.iepl+日本'))), nodes('香港 IEPL 01', '日本03'));
  assert.equal(applyNodeOptions(nodes('香港 IEPL 01', '香港 BGP 02', '日本03'), parseOptions(link('out=香港.iepl'))), nodes('香港 BGP 02', '日本03'));
  assert.equal(applyNodeOptions(nodes('HK 0.2倍率', 'HK 1倍率'), parseOptions(link('out=0%5C.2'))), nodes('HK 1倍率'));
  assert.equal(applyNodeOptions(nodes('Trial HK', 'TRIAL JP', 'Normal SG'), parseOptions(link('out=trial'))), nodes('Normal SG'));
  assert.equal(applyNodeOptions(nodes('JP+VIP', 'JP VIP', '%2B'), parseOptions(link('in=JP%2BVIP+%252B'))), nodes('JP+VIP', '%2B'));
});

test('keyword grammar rejects empty AND operands and bounds aggregate work', () => {
  for (const hash of ['in=A..B', 'out=.A', 'in=A.', 'in=' + Array(129).fill('A').join('.')]) assert.throws(() => applyNodeOptions(nodes('A'), parseOptions(link(hash))), /Node options failed/);
  assert.throws(() => applyNodeOptions(nodes('A'), { in: ['A..B'] }), /Node options failed/);
});

test('sort aliases use the same canonical ascending and descending ordering', () => {
  assert.equal(parseOptions(link('sort=1')).sort, 'name');
  assert.equal(parseOptions(link('sort=-1')).sort, 'name-desc');
  assert.equal(run('sort=1', nodes('Beta', 'Alpha')).result.content, nodes('Alpha', 'Beta'));
});

test('common type aliases are explicit and domain sets retain exact matching', () => {
  for (const [alias, type] of [['nodes','server'],['list','server'],['rule','filter'],['module','rewrite']]) assert.equal(parseOptions(link('type=' + alias)).type, type);
  for (const hash of ['type=domain-set', 'domain-mode=exact&type=domain-set&format=domain-set', 'type=domain-set&format=auto']) {
    const options = parseOptions(link(hash)); assert.equal(options.type, 'filter'); assert.equal(options.sourceFormat, 'domain-set'); assert.equal(options.domainSetMode, 'exact');
  }
  for (const hash of ['type=domain-set&format=qx', 'format=clash&type=domain-set', 'type=domain-set&domain-mode=suffix']) assert.throws(() => parseOptions(link(hash)), /invalid parameters/);
});

test('rename accepts sequential simple expressions and keeps encoded delimiters literal', () => {
  assert.equal(run('rename=香港@HK+HK@Hong%20Kong', nodes('香港01')).result.content, nodes('Hong Kong01'));
  assert.equal(run('rename=VIP%20@+@%20END+Trial☠️', nodes('Trial HK')).result.content, nodes('VIP  HK END'));
  assert.equal(run('rename=A%40B@C%2BD+@%40', nodes('A@B')).result.content, nodes('C+D@'));
  assert.equal(run('rename=0%5C.2.Trial☠️', nodes('HK 0.2 Trial')).result.content, nodes('HK'));
  assert.equal(run('rename=@', nodes('A@B')).result.content, nodes('AB'));
  assert.equal(run('rename=' + encodeURIComponent(JSON.stringify([['A@B', 'C+D'], ['C', '$&']])), nodes('A@B')).result.content, nodes('$&+D'));
});

test('rename expressions stay bounded and malformed actions are atomic fixed errors', () => {
  for (const hash of ['rename=A@B@C', 'rename=+A@B', 'rename=A@B+', 'rename=☠️', 'rename=A..B☠️', 'rename=A@bad%2Ctag', 'rename=' + Array(101).fill('A@B').join('+')]) {
    const { result, notifications } = run(hash, nodes('A'), 'download=0;total=100'); assert.equal(result.content, undefined); assert.equal(result.error, 'Resource parser options: invalid parameters'); assert.deepEqual(notifications, []); assert.doesNotMatch(result.error, /SYNTHETIC_SECRET/);
  }
});

test('helper round trips common aliases, operators and delimiter-safe rename expressions', () => {
  for (const hash of ['type=nodes&sort=1&in=香港.iepl+JP%2BVIP', 'inhn=example%5C.com.api+CDN&outhn=ad', 'rename=A%40B@C%2BD+@%40', 'rename=[VIP]@+@%20END', 'type=domain-set']) {
    const ui = helper('hashToUI', hash); assert.equal(ui.unknown, ''); const saved = helper('uiToHash', flat(ui)); assert.deepEqual(parseOptions(link(saved)), parseOptions(link(hash)));
  }
});

test('helper does not turn invalid option values into valid success values', () => {
  for (const hash of ['type=nodes&type=rule', 'sort=x', 'in=A++B', 'rename=A@B@C', 'prefix=%0ASYNTHETIC_SECRET']) {
    const ui = helper('hashToUI', hash); const saved = helper('uiToHash', { ...flat(ui), __unknown: ui.unknown }); assert.throws(() => parseOptions(link(saved)), /invalid parameters/);
  }
});

test('country label matching prefers full Indonesia aliases and English word boundaries', () => {
  assert.equal(run('emoji=2', nodes('印度尼西亚01', '印度尼西亞02', 'Indonesia03', '🇺🇸 Indiana 04', 'India05', 'USAGE06')).result.content, nodes('🇮🇩 印度尼西亚01', '🇮🇩 印度尼西亞02', '🇮🇩 Indonesia03', '🇺🇸 Indiana 04', '🇮🇳 India05', '🏴‍☠️ USAGE06'));
});

test('quota notices read accepted uppercase TAG before node filtering', () => {
  const { result, notifications } = run('info=1&out=剩余流量&emoji=2', node('剩余流量: 12.5 GB').replace('tag=', 'TAG=') + '\n' + node('台湾01'));
  assert.equal(result.content, nodes('🇨🇳 台湾01')); assert.equal(notifications.length, 1); assert.match(notifications[0][2], /12\.5 GB/); assert.doesNotMatch(JSON.stringify(notifications), /SYNTHETIC_SECRET|example\.test|proxy\.example/);
});

// Consumers share this self-contained predicate instead of reimplementing hash rules.
test('the shared matcher runs independently and treats patterns as literal text', () => {
  const factory = vm.runInNewContext('(' + createKeywordMatcher.toString() + ')');
  assert.equal(factory(['HK.IEPL', 'JP+VIP'])('hk iepl 01'), true);
  assert.equal(factory(['HK.IEPL'])('HK BGP'), false);
  assert.equal(factory(['\\.*'])('A.*B'), true);
  assert.equal(factory([])('any'), false);
});

test('helper saves long encoded rename text without decoding literal operators twice', () => {
  const hash = 'rename=' + Array(10).fill(encodeURIComponent('界'.repeat(200)) + '@x').join('+');
  assert.ok(hash.length > 16384);
  const ui = helper('hashToUI', hash); assert.equal(ui.unknown, '');
  const saved = helper('uiToHash', flat(ui));
  assert.deepEqual(parseOptions(link(saved)).rename, parseOptions(link(hash)).rename);
  assert.equal(run(saved, nodes('Japan')).result.content, nodes('Japan'));
  const once = helper('hashToUI', 'rename=%252B@%2540');
  const onceSaved = helper('uiToHash', flat(once));
  assert.equal(run(onceSaved, nodes('%2B')).result.content, nodes('%40'));
});

test('helper accepts familiar aliases while showing one choice for each behavior', () => {
  const ui = helper('hashToUI', 'type=nodes&sort=1');
  assert.equal(flat(ui).type, 'server'); assert.equal(flat(ui).sort, 'name');
  const items = helper('hashSchema').sections.flatMap(group => group.items);
  assert.deepEqual(items.find(item => item.key === 'sort').options.map(option => option.value), ['none', 'name', 'name-desc']);
  assert.deepEqual(parseOptions(link(helper('uiToHash', { type: 'nodes', sort: '-1' }))), parseOptions(link('type=server&sort=name-desc')));
});
