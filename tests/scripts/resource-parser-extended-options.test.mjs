import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { safePattern } from '../../src/features/resource-parser/safe-pattern.mjs';
import { parseOptions, applyNodeOptions } from '../../src/features/resource-parser/options.mjs';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { createNodeParser } from '../../src/features/resource-parser/nodes.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';
const address = value => 'https://example.test/sub#' + value;
const opt = value => parseOptions(address(value));
const node = (tag, extra = '') => 'http=example.test:443, over-tls=true, tls-verification=true, password=SYNTHETIC' + extra + ', tag=' + tag;
const names = content => content.trim().split('\n').map(line => /tag=([^,]+)/.exec(line)[1]);
const transform = (content, hash, context) => applyNodeOptions(content + '\n', opt(hash), context);
test('regex/regout select native declaration fields with bounded regular expressions', () => {
  const input = node('HK 1') + '\n' + node('JP 2', ', username=selected');
  assert.deepEqual(names(transform(input, 'regex=username%3Dselected&regout=tag%3DHK')), ['JP 2']);
  assert.throws(() => opt('regex=(a*)%2B%24'), /invalid parameters/);
  assert.throws(() => opt('regex=(%3F%3Dx)'), /invalid parameters/);
});
test('numeric suffix labels, rename placeholders and resource tag act on node names', () => {
  assert.deepEqual(names(transform(node('JP'), 'suffix=1')), ['JP 「𝐡𝐭𝐭𝐩」']);
  assert.deepEqual(names(transform(node('JP'), 'suffix=-1')), ['「𝐡𝐭𝐭𝐩」 JP']);
  assert.deepEqual(names(transform(node('JP'), 'suffix=0')), ['JP']);
  assert.deepEqual(names(transform(node('JP'), 'rename=@%20%24type%20%24index%20%24emoji1%20%24tag', { tag: 'Public' })), ['JP HTTP 1 🇯🇵 Public']);
});
test('rrname deletion replace and final rename have a fixed order and preserve credentials', () => {
  const result = transform(node('JP Trial 02'), 'rrname=JP@Japan&delreg=%20Trial&replace=Japan@Tokyo&rename=02@01');
  assert.deepEqual(names(result), ['Tokyo 01']);
  assert.match(result, /password=SYNTHETIC/);
  assert.match(transform(node('JP'), 'replace=password%3DSYNTHETIC@password%3Dchanged'), /password=changed/);
  assert.throws(() => transform(node('JP'), 'replace=password%3DSYNTHETIC@unknown%3Dchanged'), /Node options failed/);
});
test('case and Unicode style transformations use explicit modes', () => {
  assert.deepEqual(names(transform(node('jP abc 12'), 'cap=1')), ['JP ABC 12']);
  assert.deepEqual(names(transform(node('jP ABC 12'), 'cap=-1')), ['jp abc 12']);
  assert.deepEqual(names(transform(node('jP ABC 12'), 'cap=0')), ['Jp Abc 12']);
  assert.deepEqual(names(transform(node('JP 12'), 'ptn=3&npt=1')), ['𝐉𝐏 ①②']);
});
test('keyword sort, subgroup sort and random preserve the actual node multiset', () => {
  const input = ['US z', 'JP z', 'HK z', 'JP a'].map(name => node(name)).join('\n');
  assert.deepEqual(names(transform(input, 'sort=0')), ['US z', 'JP z', 'HK z', 'JP a']);
  assert.deepEqual(names(transform(input, 'sort=JP%3EHK&sortx=1')), ['JP a', 'JP z', 'HK z', 'US z']);
  assert.deepEqual(names(transform(input, 'sort=x')).sort(), ['HK z', 'JP a', 'JP z', 'US z']);
});
test('duplicate final names are numbered without collisions and del removes later duplicates only', () => {
  const input = ['JP', 'JP', 'JP ¹', 'JP'].map(name => node(name)).join('\n');
  const result = names(transform(input, ''));
  assert.equal(result.length, 4); assert.equal(new Set(result).size, 4); assert.equal(result[0], 'JP');
  assert.deepEqual(names(transform(input, 'del=1')), ['JP', 'JP ¹']);
});
test('connection overrides are explicit native fields and do not weaken absent TLS settings', () => {
  const hash = 'udp=1&tfo=0&cert=verify.example&csha=' + 'a'.repeat(64) + '&alpn=h2&tsession=2&checkurl=https%3A%2F%2Fexample.test%2Fcheck&tls13=1';
  const result = transform(node('JP'), hash);
  for (const field of ['udp-relay=true', 'fast-open=false', 'tls-verification=verify.example', 'tls-cert-sha256=' + 'a'.repeat(64), 'tls-alpn=026832', 'tls-no-session-ticket=true', 'tls-no-session-reuse=true', 'server_check_url=https://example.test/check', 'tls13=true']) assert.ok(result.includes(field), field);
  assert.equal(transform(node('JP'), ''), node('JP') + '\n');
  assert.throws(() => transform(node('JP'), 'uot=1'), /Node options failed/);
  assert.throws(() => transform(node('JP'), 'aead=1'), /Node options failed/);
});
test('invalid options are atomic and do not expose supplied values', () => {
  for (const hash of ['cert=maybe', 'udp=maybe', 'csha=PRIVATE', 'alpn=%0A', 'tsession=3', 'sort=JP%3E', 'ptn=9', 'npt=9', 'checkurl=javascript%3APRIVATE', 'rename=%40%24unknown']) {
    assert.throws(() => opt(hash), error => error.message === 'Resource parser options: invalid parameters');
  }
});
test('actual parser and bundled host flow preserve exactly-once completion', () => {
  const resource = { type: 'server', tag: 'Public', link: address('regex=tag%3DJP&suffix=1&udp=1'), content: 'https://example.test:443#JP' };
  assert.match(parseResource(resource).content, /tag=JP 「𝐡𝐭𝐭𝐩」/);
  let calls = 0, captured;
  const value = vm.runInNewContext(bundleResourceParser(), { $resource: resource, $done: result => { calls++; captured = result; return result; }, fetch: () => assert.fail('network forbidden'), $prefs: { valueForKey: () => assert.fail('storage forbidden') } }, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(calls, 1); assert.equal(value, captured); assert.ok(value.content); assert.equal(value.error, undefined);
  assert.doesNotThrow(() => createNodeParser().parseNodes(value.content));
});

// ReDoS and capture parity checks execute the actual matcher used by bundled QX.
test('bounded pattern engine matches a supported reference corpus without backtracking', () => {
  const inputs = ['', 'a', 'ab', 'aab', 'aaaabc', 'xxx aab c', 'JP JP01 a', 'tag=JP 22', 'HK 123', 'abaaba'];
  const patterns = ['a', 'a*', 'a+', 'a?', 'a*?', 'a+?', 'ab|a', 'a|ab', 'a*b', 'a+b', 'a?b', 'a{1,3}b', 'a{2,}b', '(a)(.*)', '(a.*)(b)', '^tag=(.*)$', '[A-Z]+', '[^0-9]+', '\\bJP\\b', '(?:ab|a)b', '(ab|a)b', '(ab|a).*', 'a.*?b', 'a.*b', 'a*X|a'];
  for (const pattern of patterns) for (const input of inputs) {
    assert.equal(safePattern(pattern).test(input), new RegExp(pattern, 'i').test(input), pattern);
    assert.equal(safePattern(pattern).replace(input, '[$1:$&]'), input.replace(new RegExp(pattern, 'gi'), '[$1:$&]'), pattern);
  }
  const run = code => vm.runInNewContext('(' + safePattern.toString() + ')' + code, {}, { timeout: 2000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(run("('a*a*a*a*a*a*a*a*Z').test('a'.repeat(16000))"), false);
  assert.throws(() => run("('a*Z|a').replace('a'.repeat(20000),'b')"), /invalid parameters/);
  for (const pattern of ['(a*)+$', '(a|)+$', '(?=x)', '(a)\\1', '[' ]) assert.throws(() => safePattern(pattern), /invalid parameters/);
});
test('native override negative paths reject incompatible or ineffective security fields', () => {
  for (const hash of ['cert=0&csha=' + 'a'.repeat(64), 'csha=' + 'a'.repeat(64) + '&psha=' + 'b'.repeat(64), 'host=front.example', 'obfs=vhttp', 'alpn=00', 'checkurl=https%3A%2F%2Fexample.test%3A99999%2F']) {
    assert.throws(() => transform(node('JP'), hash), /invalid|unsupported/);
  }
  const reality = node('JP', ', reality-base64-pubkey=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  for (const hash of ['alpn=h2', 'tsession=2', 'tfo=1']) assert.throws(() => transform(reality, hash), /unsupported/);
  const ss = 'shadowsocks=example.test:443, method=aes-128-gcm, password=SYNTHETIC, obfs=over-tls, tls-verification=true, tag=JP';
  for (const [mode, native] of [['1','true'], ['0','false'], ['sp.v1','sp.v1'], ['sp.v2','sp.v2']]) assert.ok(transform(ss, 'uot=' + mode).includes('udp-over-tcp=' + native));
  assert.ok(transform(node('JP'), 'host=front.example☠️').includes('tls-host=front.example'));
  assert.ok(transform(node('JP'), 'udp=-1&tfo=-1').includes('udp-relay=false'));
  assert.match(transform(node('JP'), 'rrname=JP@Japan&replace=Japan@JP&rename=JP@Japan+Japan@JP'), /tag=JP/);
});
test('literal operator boundaries and sorted indexes stay distinct from encoded content', () => {
  const input = node('JP 2') + '\n' + node('JP 1');
  assert.deepEqual(names(transform(input, 'rename=@%20%24index&sort=1')), ['JP 1 1', 'JP 2 2']);
  assert.deepEqual(names(transform(node('A+B@C'), 'rename=A%2BB%40C@Value')), ['Value']);
  assert.deepEqual(names(transform(node('JP'), 'rename=JP@台湾+@%20%24emoji1')), ['台湾 🇹🇼']);
  assert.deepEqual(opt('pset=^example\\.test%24@Direct+Proxy@Other').pset, [['^example\\.test$', 'Direct'], ['Proxy', 'Other']]);
  assert.equal(opt('via=0&fcr=3&hide=0&dst=filter').via, '%TUN%');
  for (const hash of ['UA=2', 'profile=1111', 'flow=2030-02-30%3A100%3A1', 'flow=2030-01-01%3A1%3A2', 'replace=%28a*%29%2B@x']) assert.throws(() => opt(hash), /invalid parameters/);
});

test('accepted character ranges and replacement dollar tokens match native legacy regex semantics', () => {
  for (const [pattern, input] of [['[A-z]', '_'], ['[a-z]', 'ß'], ['[a-z]', 'ſ'], ['[a-z]', 'ı'], ['[µ]', 'Μ'], ['[Σ]', 'ς'], ['[Z-a]', 'z'], ['[Z-a]', 'A'], ['ß', 'ẞ']]) assert.equal(safePattern(pattern).test(input), new RegExp(pattern, 'i').test(input), pattern + input);
  for (const replacement of ['$10', '$01', '$09', '$100', '$0', '$$', '$&', "$`-$1-$'"]) assert.equal(safePattern('(JP)').replace('xJPz', replacement), 'xJPz'.replace(/(JP)/gi, replacement), replacement);
  assert.deepEqual(names(transform(node('JP'), 'replace=(JP)@$10')), ['JP0']);
  assert.deepEqual(names(transform(node('_'), 'regex=tag%3D%5BA-z%5D')), ['_']);
});

test('quoted native booleans have the same security meaning as unquoted fields', () => {
  const quotedTls = 'http=example.test:443, over-tls="true", tls-verification=true, tag=JP';
  assert.ok(transform(quotedTls, 'cert=1').includes('tls-verification=true'));
  const noVerification = 'http=example.test:443, over-tls=true, tls-verification="false", tag=JP';
  assert.throws(() => transform(noVerification, 'csha=' + 'a'.repeat(64)), /unsupported/);
  assert.ok(transform(noVerification, 'cert=1&csha=' + 'a'.repeat(64)).includes('tls-cert-sha256='));
  const ss2022 = 'shadowsocks=example.test:443, method=2022-blake3-aes-128-gcm, password=SYNTHETIC, tag=JP';
  assert.throws(() => transform(ss2022, 'uot=1'), /unsupported/);
  assert.ok(transform(ss2022, 'uot=sp.v2').includes('udp-over-tcp=sp.v2'));
});

test('full-declaration replacement cannot bypass requested security field validation', () => {
  const source = 'http=example.test:443, over-tls=true, tls-verification=false, tag=JP';
  const pin = 'a'.repeat(64);
  assert.throws(() => transform(source, 'replace=tag%3DJP@tls-cert-sha256%3D' + pin + '%2C%20tag%3DJP'), /Node options failed/);
  assert.ok(transform(source, 'cert=1&replace=tag%3DJP@tls-cert-sha256%3D' + pin + '%2C%20tag%3DJP').includes('tls-cert-sha256='));
  assert.ok(transform(source, 'replace=tls-verification%3Dfalse@tls-verification%3Dtrue+tag%3DJP@tls-cert-sha256%3D' + pin + '%2C%20tag%3DJP').includes('tls-cert-sha256='));
  const reality = node('JP', ', reality-base64-pubkey=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  for (const field of ['tls-alpn=026832', 'tls-no-session-ticket=true', 'fast-open=true']) assert.throws(() => transform(reality, 'replace=tag%3DJP@' + encodeURIComponent(field + ', tag=JP')), /Node options failed/);
});

test('resource tag values inserted into templates remain literal data', () => {
  for (const tag of ['$index', '$type', 'literal $tag']) assert.deepEqual(names(transform(node('Node'), 'prefix=%24tag%20', { tag })), [tag + ' Node']);
  assert.deepEqual(names(transform(node('Node'), 'prefix=%24tag%20&rename=@%20%24index', { tag: '$index' })), ['$index Node 1']);
});

test('module argument JSON is a bounded scalar-only plain object', () => {
  const expected = { mode: 'public', count: 2, enabled: true, optional: null };
  assert.deepEqual(opt('arguments=' + encodeURIComponent(JSON.stringify(expected))).moduleArguments, expected);
  for (const value of ['null', '[]', '{"nested":{}}', '{"items":[]}', '{"__proto__":"value"}', '{"constructor":"value"}', '{"value":1e400}', JSON.stringify({ value: 'a'.repeat(2049) }), JSON.stringify({ value: '\u0085' }), JSON.stringify({ ['\u0085']: 'value' })]) assert.throws(() => opt('arguments=' + encodeURIComponent(value)), /invalid parameters/);
});
test('aggregate matcher work is bounded across a legal complete subscription', () => {
  const input = Array.from({ length: 200 }, (_, index) => 'http=example.test:80, password=' + 'z'.repeat(1000) + ', tag=Node' + (index === 199 ? 'Q' : index)).join('\n');
  assert.throws(() => transform(input, 'regex=' + encodeURIComponent('a?'.repeat(250) + 'Q')), error => error.message === 'Resource parser options: invalid parameters');
});

test('non-nullable grouped patterns and zero-width replacements are supported declaration options', () => {
  assert.deepEqual(names(transform(node('JPJP'), 'regex=' + encodeURIComponent('tag=(?:JP|HK)+$'))), ['JPJP']);
  assert.equal(safePattern('(a+)+$').test('aaaa'), true);
  assert.deepEqual(names(transform(node('JP'), 'replace=%24@%20%24type')), ['JP HTTP']);
  assert.equal(transform(node('JP'), 'delreg=%5E'), node('JP') + '\n');
  assert.equal(safePattern('^|$').replace('😀', 'X'), 'X😀X');
});
