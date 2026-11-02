import test from 'node:test';
import assert from 'node:assert/strict';
import { completeResource, parseResource } from '../../src/features/resource-parser/core.mjs';

const native = 'http=proxy.example:8080, username=example, password=example, tag=Node';
test('native UA retry is explicit, carries a fallback and stops after one host download', () => {
  const calls = [];
  const resource = { content: native, link: 'https://example.test/sub#UA=1', user_agent: '' };
  const first = completeResource(resource, value => calls.push(value));
  assert.equal(calls.length, 1); assert.match(first.content, /^http=/);
  assert.equal(typeof first.retry.user_agent, 'string');
  const second = completeResource({ ...resource, user_agent: first.retry.user_agent }, () => {});
  assert.equal(second.retry, undefined); assert.match(second.content, /^http=/);
  const failed = completeResource({ ...resource, content: '<html>SECRET</html>' }, () => {});
  assert.equal(typeof failed.error, 'string'); assert.equal(typeof failed.retry.user_agent, 'string'); assert.doesNotMatch(failed.error, /SECRET/);
});

test('count/debug notices reveal aggregate numbers only and obey ntf=0', () => {
  const notices = [];
  completeResource({ content: native, link: 'https://example.test/sub?token=SECRET#cnt=1&dbg=1' }, () => {}, (...args) => notices.push(args));
  assert.equal(notices.length, 1); assert.match(notices[0].join(' '), /1/); assert.doesNotMatch(notices[0].join(' '), /SECRET|proxy\.example|password|username|Node/);
  completeResource({ content: native, link: 'https://example.test/sub#cnt=1&ntf=0' }, () => {}, (...args) => notices.push(args));
  assert.equal(notices.length, 1);
});

test('explicit base64 and real quota fields do not fabricate usage', () => {
  const output = parseResource({ content: native, link: 'https://example.test/sub#b64=1' }).content;
  assert.equal(Buffer.from(output, 'base64').toString(), native + '\n');
  const result = completeResource({ content: native, info: 'upload=100; download=200; total=1000; expire=1893456000', link: 'https://example.test/sub#flow=1' }, () => {});
  assert.deepEqual(result.info, { bytes_used: 300, bytes_remaining: 700, expire_date: 1893456000 });
  const manual = completeResource({ content: native, link: 'https://example.test/sub#flow=2030-01-01:10:2' }, () => {});
  assert.deepEqual(manual.info, { bytes_used: 2147483648, bytes_remaining: 8589934592, expire_date: 1893456000 });
  for (const info of ['upload=INVALID;download=100;total=1000', 'upload=100;download=INVALID;total=1000', 'upload=100;upload=INVALID;download=200;total=1000', 'total=1000']) {
    const invalid = completeResource({ content: native, info, link: 'https://example.test/sub#flow=1' }, () => {});
    assert.match(invalid.content, /^http=/);
    assert.equal(invalid.info, undefined, 'malformed or absent usage must not fabricate zero counters');
  }
});

test('relay uses actual proxy endpoint, including bracketed IPv6, instead of the TLS camouflage host', () => {
  const content = 'vless=proxy.example:443, method=none, password=11111111-1111-4111-8111-111111111111, obfs=over-tls, obfs-host=camouflage.example, tag=One\nhttp=[2001:db8::1]:8080, username=user, password=pass, tag=Two';
  const output = parseResource({ content, link: 'https://example.test/sub#relay=Chain' }).content;
  assert.equal(output, 'host,proxy.example,Chain\nip6-cidr,2001:db8::1/128,Chain\n');
});

test('module-only options cannot silently succeed on nodes or rules', () => {
  const suffix = '#arguments=' + encodeURIComponent(JSON.stringify({ Block: true }));
  for (const content of [native, 'DOMAIN,example.test,Proxy']) assert.throws(() => parseResource({ content, link: 'https://example.test/source' + suffix }), /not valid|not supported/);
});

test('QR and explicit profile resource import produce local confirmation actions, never download or expose content', () => {
  const notifications = [];
  const qr = completeResource({ content: 'https://example.test/sub?token=PRIVATE', type: 'server' }, () => {}, (...args) => notifications.push(args));
  assert.equal(typeof qr.error, 'string'); assert.equal(notifications.length, 1);
  assert.doesNotMatch(notifications[0].slice(0, 3).join(' '), /PRIVATE|https:\/\//);
  const action = notifications[0][3]['open-url'];
  assert.match(action, /^quantumult-x:\/\/\/add-resource\?remote-resource=/);
  const parsed = JSON.parse(decodeURIComponent(action.split('remote-resource=')[1]));
  assert.match(parsed.server_remote[0], /token=PRIVATE/);
  notifications.length = 0;
  completeResource({ content: '[server_remote]\nhttps://example.test/sub, tag=One\n[filter_remote]\nhttps://example.test/rules, force-policy=Proxy\n[rewrite_remote]\nhttps://example.test/rewrites\n[server_local]\n' + native, link: 'https://example.test/profile#profile=010' }, () => {}, (...args) => notifications.push(args));
  assert.equal(notifications.length, 1);
  const selected = JSON.parse(decodeURIComponent(notifications[0][3]['open-url'].split('remote-resource=')[1]));
  assert.deepEqual(Object.keys(selected), ['filter_remote']);
});
