import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { parseOptions, applyNodeOptions } from '../../src/features/resource-parser/options.mjs';
import { parseResource, completeResource } from '../../src/features/resource-parser/core.mjs';
import { installParserHelper } from '../../src/features/resource-parser/helper.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const address = hash => 'https://example.test/sub?token=PRIVATE_FIXTURE#' + hash;
const node = name => 'http=proxy.example:443, over-tls=true, tls-verification=true, username=test, password=PRIVATE_FIXTURE, tag=' + name;
const nodes = (...names) => names.map(node).join('\n') + '\n';
const exact = 'info=1&out=套餐+重置&emoji=2';
const header = 'upload=1073741824; download=2147483648; total=10737418240; expire=1893456000';
const resource = (hash = exact, extra = {}) => ({
  type: 'server', link: address(hash), content: nodes('套餐信息', '重置提示', '台湾01'), info: header, ...extra,
});
function run(fixture, notify) {
  const context = vm.createContext({ $resource: fixture, $parser: {}, ...(notify ? { $notify: notify } : {}),
    URL: undefined, URLSearchParams: undefined, Buffer: undefined, atob: undefined, Intl: undefined,
    fetch: () => assert.fail('no network'), $prefs: { valueForKey: () => assert.fail('no storage') },
  });
  vm.runInContext('var calls=0,captured;var $done=function(value){calls++;captured=value;return value;};', context);
  const result = vm.runInContext(bundleResourceParser(), context, { timeout: 3000 });
  context.result = result;
  assert.equal(context.calls, 1);
  assert.equal(vm.runInContext('result === captured', context), true);
  return result;
}

test('the reported legacy fragment filters names, applies device-compatible flags and notifies quota', () => {
  const notifications = [];
  const result = run(resource(), (...args) => notifications.push(args));
  assert.equal(result.content, nodes('🇨🇳 台湾01'));
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].join('\n'), /10\.00 GiB/);
  assert.match(notifications[0].join('\n'), /3\.00 GiB/);
  assert.match(notifications[0].join('\n'), /7\.00 GiB/);
  assert.match(notifications[0].join('\n'), /2030-01-01/);
  assert.doesNotMatch(JSON.stringify(notifications), /PRIVATE_FIXTURE|example\.test|proxy\.example/);
});

test('legacy flags are name decoration only, with explicit add, device, remove and off modes', () => {
  for (const [mode, expected] of [['1', '🇹🇼 台湾01'], ['2', '🇨🇳 台湾01'], ['-1', '台湾01'], ['0', '🇺🇸 台湾01']]) {
    assert.equal(parseResource(resource('emoji=' + mode, { content: nodes('🇺🇸 台湾01') })).content, nodes(expected));
  }
  assert.equal(parseResource(resource('emoji=1', { content: nodes('日本 JP01') })).content, nodes('🇯🇵 日本 JP01'));
  assert.equal(parseResource(resource('emoji=2', { content: nodes('Unknown Location') })).content, nodes('🏴‍☠️ Unknown Location'));
  assert.equal(parseResource(resource('emoji=1', { content: nodes('USAGE') })).content, nodes('🏴‍☠️ USAGE'));
});

test('flag filtering, literal rename, prefix, sorting and duplicate protection remain atomic', () => {
  const hash = 'emoji=1&out=套餐+重置&rename=' + encodeURIComponent(JSON.stringify([['日本', '台湾']])) + '&sort=name';
  assert.equal(parseResource(resource(hash, { content: nodes('日本02', '日本01', '套餐') })).content, nodes('🇹🇼 台湾01', '🇹🇼 台湾02'));
  assert.throws(() => applyNodeOptions(nodes('日本', '🇯🇵 日本'), parseOptions(address('emoji=1'))), /Node options failed/);
  assert.throws(() => parseResource(resource('out=台湾+套餐+重置&info=1&emoji=2')), /Node options failed/);
});

test('info is opt-in and unavailable or throwing notification APIs cannot break a valid conversion', () => {
  assert.equal(run(resource()).content, nodes('🇨🇳 台湾01'));
  assert.equal(run(resource(), () => { throw new Error('notification disabled'); }).content, nodes('🇨🇳 台湾01'));
  for (const hash of ['', 'info=0']) {
    const result = run(resource(hash), () => assert.fail('notifications must be opt-in'));
    assert.equal(result.content, nodes('套餐信息', '重置提示', '台湾01'));
  }
});

test('fake quota nodes are read before exclusion without leaking arbitrary node data', () => {
  const notices = [];
  const result = run(resource('info=1&out=剩余流量+到期时间&emoji=1', {
    info: undefined, content: nodes('剩余流量: 12.5 GB', '到期时间: 2030-02-28', '日本01'),
  }), (...args) => notices.push(args));
  assert.equal(result.content, nodes('🇯🇵 日本01'));
  assert.equal(notices.length, 1);
  assert.match(notices[0].join('\n'), /12\.5 GB/);
  assert.match(notices[0].join('\n'), /2030-02-28/);
  assert.doesNotMatch(JSON.stringify(notices), /PRIVATE_FIXTURE|proxy\.example/);
});

test('invalid or absent quota metadata never rejects nodes or echoes untrusted header data', () => {
  for (const info of [undefined, {}, '', 'upload=PRIVATE_FIXTURE;total=5', 'upload=1;download=2;total=4;total=5', 'upload=NaN;download=2;total=4', 'upload=1;download=2;total=9007199254740992']) {
    const notices = [];
    assert.equal(run(resource(exact, { info }), (...args) => notices.push(args)).content, nodes('🇨🇳 台湾01'));
    assert.equal(notices.length, 0);
  }
});

test('failed subscriptions emit neither a quota notification nor partially converted nodes', () => {
  const notices = [];
  const result = run(resource(exact, { content: nodes('台湾01') + 'hysteria2://PRIVATE_FIXTURE@proxy.example:443#Bad' }), (...args) => notices.push(args));
  assert.equal(typeof result.error, 'string');
  assert.equal(result.content, undefined);
  assert.deepEqual(notices, []);
  assert.doesNotMatch(result.error, /PRIVATE_FIXTURE|proxy\.example/);
});

test('invalid legacy modes, duplicate and unknown options remain errors across resource types', () => {
  for (const hash of ['info=2', 'info=true', 'emoji=3', 'emoji=true', 'info=1&info=0', 'emoji=1&%65moji=2', 'info=1&js=PRIVATE_FIXTURE', 'info=1&udp=1']) {
    assert.throws(() => parseResource(resource(hash)), /Resource parser options: invalid parameters/);
  }
  for (const hash of ['info=1', 'emoji=2']) {
    for (const [type, content] of [['filter', 'DOMAIN,example.test,DIRECT'], ['rewrite', '^https://example.test/ad url reject']]) {
      assert.throws(() => parseResource(resource(hash, { type, content })), /not valid for this resource/);
    }
  }
});

test('native helper exposes and round trips both implemented legacy options', () => {
  const parser = installParserHelper({});
  const definitions = Object.keys(parser).map(key => '$parser.' + key + ' = (' + parser[key].toString() + ');').join('\n');
  const context = vm.createContext({ $parser: {} });
  vm.runInContext(definitions, context);
  const ui = vm.runInContext('$parser.hashToUI("info=1&out=套餐+重置&emoji=2")', context);
  assert.equal(ui.unknown, '');
  const values = Object.fromEntries(ui.sections.flatMap(group => group.items.map(item => [item.key, item.value])));
  assert.equal(values.info, true);
  assert.equal(values.emoji, '2');
  context.values = values;
  const hash = vm.runInContext('$parser.uiToHash(values)', context);
  assert.equal(parseResource(resource(hash)).content, nodes('🇨🇳 台湾01'));
});

test('notification preparation preserves the once-only host exception contract', () => {
  let calls = 0, notices = 0;
  assert.throws(() => completeResource(resource(), () => { calls++; throw new Error('host stopped'); }, () => { notices++; }), /host stopped/);
  assert.equal(calls, 1);
  assert.equal(notices, 1);
});

test('the exact fragment works for URI, Base64 and structured subscriptions without changing Reality or TLS', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const uri = 'vless://' + id + '@proxy.example:443?encryption=none&security=reality&pbk=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&sid=0123&flow=xtls-rprx-vision&sni=front.example#日本01';
  const clash = { proxies: [{ name: '日本01', type: 'trojan', server: 'proxy.example', port: 443, password: 'PRIVATE_FIXTURE', sni: 'front.example', 'skip-cert-verify': false }] };
  for (const content of [uri, Buffer.from(uri).toString('base64'), JSON.stringify(clash)]) {
    const baseline = parseResource(resource('', { content })).content;
    const notices = [];
    const result = run(resource(exact, { content }), (...args) => notices.push(args));
    assert.equal(result.content, baseline.replace('tag=日本01', 'tag=🇯🇵 日本01'));
    assert.equal(notices.length, 1);
  }
});

test('flag renaming preserves quoted credential commas and equals signs', () => {
  const content = 'http=proxy.example:443, over-tls=true, tls-verification=true, username="test,user", password="a=b,c", tag="日本01"';
  // The standalone name transformer accepts already-native quoted fields.
  // Whole-subscription conversion still rejects unrepresentable credentials.
  const result = applyNodeOptions(content, parseOptions(address(exact)));
  assert.equal(result, content.replace('tag="日本01"', 'tag=🇯🇵 日本01') + '\n');
  assert.ok(result.includes('username="test,user"'));
  assert.ok(result.includes('password="a=b,c"'));
});

test('quota parsing accepts missing upload, zero quota and extra fields without echoing untrusted data', () => {
  for (const info of ['download=0;total=0', 'download=2,total=10,unused=PRIVATE_FIXTURE,expire=0']) {
    const notices = [];
    assert.equal(run(resource(exact, { info }), (...args) => notices.push(args)).content, nodes('🇨🇳 台湾01'));
    assert.equal(notices.length, 1);
    assert.doesNotMatch(notices[0].join('\n'), /NaN|Infinity|PRIVATE_FIXTURE|1970/);
  }
});
