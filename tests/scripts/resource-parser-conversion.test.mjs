import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'yaml';
import { parseRules } from '../../src/features/resource-parser/rules.mjs';
import { parseRewrites } from '../../src/features/resource-parser/rewrites.mjs';

const utils = { parseYaml: parse };

test('rules convert classical and native conditions without changing order or policies', () => {
  assert.equal(parseRules('DOMAIN,example.com,DIRECT\nDOMAIN-SUFFIX,example.net,My Group\nIP-CIDR6,2001:db8::/32,REJECT\nIP-ASN,AS13335,Proxy\nFINAL,Proxy'), 'host,example.com,direct\nhost-suffix,example.net,My Group\nip6-cidr,2001:db8::/32,reject\nip-asn,13335,Proxy\nfinal,Proxy\n');
  assert.equal(parseRules('host,example.com,proxy\nuser-agent,?abc*,direct\nfinal,proxy'), 'host,example.com,proxy\nuser-agent,?abc*,direct\nfinal,proxy\n');
});

test('rules handle Rule sections, explicit domain sets, and classical YAML payload', () => {
  assert.equal(parseRules('[Rule]\nDOMAIN,example.com,Proxy'), 'host,example.com,Proxy\n');
  assert.equal(parseRules('example.com\n.example.net', { sourceFormat: 'domain-set' }), 'host,example.com,proxy\nhost-suffix,example.net,proxy\n');
  assert.throws(() => parseRules('*.example.org', { sourceFormat: 'domain-set' }), /wildcard/i);
  assert.equal(parseRules('payload:\n - DOMAIN,example.com\n - IP-CIDR,192.0.2.1/32', {}, utils), 'host,example.com,proxy\nip-cidr,192.0.2.1/32,proxy\n');
  assert.throws(() => parseRules('example.com'), /domain|format/i);
  assert.throws(() => parseRules('[Rule]\nDOMAIN,example.com,Proxy\n[Script]\nsecret'), /section/i);
});

test('no-resolve cannot silently lose DNS semantics and policy replacement is explicit', () => {
  assert.throws(() => parseRules('IP-CIDR,192.0.2.0/24,Proxy,no-resolve'), /no-resolve/i);
  const result = parseRules('IP-CIDR,192.0.2.0/24,Proxy,no-resolve', { allowResolve: true, policy: 'Other' });
  assert.match(result, /^# .*DNS/m);
  assert.match(result, /^# .*policy/m);
  assert.match(result, /ip-cidr,192\.0\.2\.0\/24,Other/);
});

test('sing-box address fields are OR, but conjunctions and inversion must not flatten', () => {
  const source = { version: 3, rules: [{ domain: ['example.com'], domain_suffix: ['example.net'], ip_cidr: ['192.0.2.0/24'] }, { type: 'logical', mode: 'or', rules: [{ domain_keyword: 'test' }] }] };
  assert.equal(parseRules(JSON.stringify(source)), 'host,example.com,proxy\nhost-suffix,example.net,proxy\nip-cidr,192.0.2.0/24,proxy\nhost-keyword,test,proxy\n');
  for (const extra of [{ port: [443] }, { invert: true }, { network: 'tcp' }, { process_name: ['secret'] }]) {
    assert.throws(() => parseRules(JSON.stringify({ version: 3, rules: [{ domain: ['example.com'], ...extra }] })), /unsupported|condition|invert/i);
  }
  assert.throws(() => parseRules(JSON.stringify({ version: 3, rules: [{ type: 'logical', mode: 'or', invert: 'false', rules: [{ domain: 'example.com' }] }] })), /logical/i);
});

test('registered regex conversions preserve nonempty prefixes and unknown regex aborts whole resource', () => {
  assert.equal(parseRules(String.raw`DOMAIN-REGEX,^.+-mihayo\.akamaized\.net$,Proxy`), 'host-wildcard,?*-mihayo.akamaized.net,Proxy\n');
  const expanded = parseRules(String.raw`DOMAIN-REGEX,.+\.awsdns-[0-9][0-9]\.(co\.uk|com|net|org)$,Proxy`);
  assert.equal(expanded.trim().split('\n').length, 400);
  assert.match(expanded, /host-wildcard,\?\*\.awsdns-99\.org,Proxy/);
  for (const bad of ['DOMAIN-REGEX,^.*example.com$,Proxy', 'AND,((DOMAIN,example.com),(DST-PORT,443)),Proxy', 'DST-PORT,443,Proxy', 'PROCESS-NAME,secret,Proxy', 'DOMAIN,example.com,Proxy,unsupported']) assert.throws(() => parseRules(bad));
  for (const option of ['extended-matching', 'pre-matching']) assert.throws(() => parseRules('DOMAIN,example.com,' + option), /option/i);
});

test('rule validation rejects resource injections and invalid IP addresses without leaking source', () => {
  for (const bad of ['IP-CIDR,999.1.1.1/24,proxy', 'IP-CIDR6,2001::db8::/64,proxy', 'IP-CIDR6,:1:2:3:4:5:6:7:8/64,proxy', 'IP-CIDR6,1:2:3:4:5:6:7:8:/64,proxy', 'GEOIP,ZZZ,proxy', 'IP-ASN,AS-1,proxy', 'FINAL,proxy\nDOMAIN,example.com,proxy', 'DOMAIN,example.com,proxy,force-cellular=evil', 'DOMAIN,secret@example.com,proxy']) {
    assert.throws(() => parseRules(bad), error => !error.message.includes('secret@'));
  }
});

test('domain-set modes and sing-box leading dots preserve the source root boundary', () => {
  assert.equal(parseRules('example.com', { sourceFormat: 'domain-set', domainSetMode: 'suffix' }), 'host-suffix,example.com,proxy\n');
  assert.equal(parseRules('payload:\n - +.example.com\n - example.org', { sourceFormat: 'clash', domainSetMode: 'exact' }, utils), 'host-suffix,example.com,proxy\nhost,example.org,proxy\n');
  assert.equal(parseRules('payload:\n - .example.com', { sourceFormat: 'clash', domainSetMode: 'exact' }, utils), 'host-wildcard,*.example.com,proxy\n');
  assert.throws(() => parseRules('payload:\n - "*.example.com"', { sourceFormat: 'clash', domainSetMode: 'exact' }, utils), /single-label/i);
  assert.throws(() => parseRules('payload:\n - .foo.*.example.com', { sourceFormat: 'clash', domainSetMode: 'exact' }, utils), /single-label/i);
  assert.throws(() => parseRules('payload:\n - example.com', { sourceFormat: 'clash', domainSetMode: 'suffix' }, utils), /exact mode/i);
  assert.equal(parseRules(JSON.stringify({ version: 3, rules: [{ domain_suffix: ['.example.com', 'example.org'] }] })), 'host-wildcard,*.example.com,proxy\nhost-suffix,example.org,proxy\n');
  assert.throws(() => parseRules(JSON.stringify({ version: 4, rules: [{ domain: ['example.com'] }] })));
});

test('conversion bounds apply to complete emitted resources', () => {
  const lines = Array(20000).fill('DOMAIN,example.com,proxy').join('\n');
  assert.equal(parseRules(lines).trim().split('\n').length, 20000);
  assert.throws(() => parseRules(lines + '\nDOMAIN,example.net,proxy'), /limit/i);
  assert.throws(() => parseRules(lines, { policy: 'Other' }), /limit/i);
  assert.throws(() => parseRewrites(Array(20001).fill('^https://example.com/ url reject').join('\n')), /limit/i);
});

test('rewrites convert redirects and compatible reject bodies with MITM hostnames', () => {
  assert.equal(parseRewrites('[URL Rewrite]\n^https://a\\.example/ https://b.example/ 302\n[MITM]\nhostname = %APPEND% a.example, *.example.net'), '^https://a\\.example/ url 302 https://b.example/\nhostname = a.example, *.example.net\n');
  assert.equal(parseRewrites('[Rewrite]\n^https://a.example/ reject-200\n^https://b.example/ 307 https://c.example/'), '^https://a.example/ url reject-200\n^https://b.example/ url 307 https://c.example/\n');
  assert.throws(() => parseRewrites('[Rewrite]\n^https://a.example/ reject'), /reject|semantic/i);
  assert.equal(parseRewrites('[URL Rewrite]\n^http://a.example/ https://b.example/ 302 // comment'), '^http://a.example/ url 302 https://b.example/\n');
  assert.throws(() => parseRewrites('[URL Rewrite]\n^http://a.example/ http://{{{GATEWAY_ADDRESS}}}/ 302'), /placeholder/i);
});

test('native QX rewrites and HTTPS script references pass without executing or fetching', () => {
  const source = '^https://a.example/ url reject\n^https://b.example/ url script-response-body https://example.com/script.js\nhostname = a.example, b.example';
  assert.equal(parseRewrites(source), source + '\n');
  const advanced = String.raw`^https://a.example/ url request-body abc request-body x # content
^https://b.example/ url jsonjq-response-body '.[0]'
^https://c.example/ \r\nUser-Agent: example-agent url-and-header reject`;
  assert.equal(parseRewrites(advanced), advanced + '\n');
  for (const url of ['script.js', 'file:///private/secret.js', 'http://example.com/script.js', 'https://user:secret@example.com/a.js']) assert.throws(() => parseRewrites('^https://a.example/ url script-response-body ' + url));
});

test('cross-host scripts require explicit API compatibility and reject unmappable fields', () => {
  const source = '[Script]\nname = type=http-response, pattern=^https://example.com/, requires-body=true, script-path=https://example.com/a.js';
  assert.throws(() => parseRewrites(source), /compatib/i);
  assert.match(parseRewrites(source, { scriptCompatibility: 'qx' }), /^# .*QX/m);
  assert.match(parseRewrites(source, { scriptCompatibility: 'qx' }), /url script-response-body https:\/\/example.com\/a.js/);
  assert.match(parseRewrites('[Script]\nhttp-request ^https://example.com/ script-path=https://example.com/a.js, requires-body=false, tag=Name', { scriptCompatibility: 'qx' }), /url script-request-header/);
  for (const field of ['timeout=20', 'argument=secret', 'max-size=100', 'binary-body-mode=true', 'enable=false']) assert.throws(() => parseRewrites(source + ', ' + field, { scriptCompatibility: 'qx' }));
  assert.throws(() => parseRewrites('[Script]\nhttp-request ^https://example.com/ script-path=https://example.com/a.js, type=http-response', { scriptCompatibility: 'qx' }));
});

test('rewrites refuse certificates, unknown executable sections and local references atomically', () => {
  for (const bad of ['[MITM]\nhostname=example.com\nca-p12=SUPERSECRET', '[Script]\ncron = type=cron, script-path=https://example.com/a.js', '[General]\nskip-proxy=example.com', '[URL Rewrite]\n^https://a.example/ - reject', '^https://a.example/ url script-unknown https://example.com/a.js', '[MITM]\nhostname=example.com\nskip-server-cert-verify=true']) {
    assert.throws(() => parseRewrites(bad, { scriptCompatibility: 'qx' }), error => !error.message.includes('SUPERSECRET'));
  }
});
