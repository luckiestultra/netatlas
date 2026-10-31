import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPrivateProfile, materializeSubscription } from '../../tools/lib/private-profile.mjs';

const password = 'synthetic-tls-password';
const uuid = '7c9a3d20-44b0-493e-90d2-9b219674d04c';
const alpn = ['h2', 'http/1.1'];
const clashNode = extra => ({ name: 'TLS-Node', type: 'trojan', server: '127.0.0.1', port: 18443, password, ...extra });
const clashSource = extra => JSON.stringify({ proxies: [clashNode(extra)] });
const vmessSource = extra => 'vmess://' + Buffer.from(JSON.stringify({ ps: 'TLS-Node', add: '127.0.0.1', port: '18443', id: uuid, net: 'tcp', tls: 'tls', ...extra })).toString('base64');
const uriSource = (type, value) => `${type}://${type === 'vless' ? uuid : password}@127.0.0.1:18443?security=tls&alpn=${encodeURIComponent(value)}#TLS-Node`;
const convert = source => materializeSubscription('singBox', source)[0];

for (const fingerprint of ['00'.repeat(32), 'AA:'.repeat(31) + 'AA', 'chrome', null, false]) {
  test(`Clash certificate fingerprint ${String(fingerprint).slice(0, 12)} cannot be silently converted to a different pin type`, () => {
    assert.throws(() => convert(clashSource({ fingerprint })), /certificate.*pin|fingerprint|native sing-box/i);
  });
}

test('an absent certificate pin does not change the browser client-fingerprint option', () => {
  const node = convert(clashSource({ fingerprint: '', 'client-fingerprint': 'chrome' }));
  assert.deepEqual(node.tls.utls, { enabled: true, fingerprint: 'chrome' });
});

for (const [name, source] of [
  ['Clash', clashSource({ alpn })],
  ['VMess comma-separated', vmessSource({ alpn: alpn.join(',') })],
  ['VMess list', vmessSource({ alpn })],
  ['VLESS URI', uriSource('vless', alpn.join(','))],
  ['Trojan URI', uriSource('trojan', alpn.join(','))],
]) {
  test(`${name} preserves the explicit ALPN preference order`, () => {
    assert.deepEqual(convert(source).tls.alpn, alpn);
  });
}

for (const [name, source] of [
  ['Clash', clashSource({ alpn: [] })],
  ['VMess', vmessSource({ alpn: '' })],
  ['Trojan URI', uriSource('trojan', '')],
]) {
  test(`${name} preserves an explicitly empty ALPN list`, () => {
    assert.deepEqual(convert(source).tls.alpn, []);
  });
}

for (const value of [null, false, 42, {}, [null], [''], ['x'.repeat(256)]]) {
  test(`Clash and VMess reject invalid ALPN ${JSON.stringify(value).slice(0, 18)}`, () => {
    assert.throws(() => convert(clashSource({ alpn: value })), /ALPN/i);
    assert.throws(() => convert(vmessSource({ alpn: value })), /ALPN/i);
  });
}

test('Clash requires its documented ALPN list instead of coercing a scalar', () => {
  assert.throws(() => convert(clashSource({ alpn: 'h2,http/1.1' })), /ALPN/i);
});

test('URI ALPN rejects empty members, oversized IDs and repeated query parameters', () => {
  for (const value of ['h2,,http/1.1', 'x'.repeat(256)]) assert.throws(() => convert(uriSource('trojan', value)), /ALPN/i);
  assert.throws(() => convert(uriSource('trojan', 'h2').replace('#TLS-Node', '&alpn=http%2F1.1#TLS-Node')), /ALPN/i);
});

test('nonempty ALPN cannot disappear when the source disables TLS', () => {
  assert.throws(() => convert(clashSource({ type: 'vmess', uuid, tls: false, alpn })), /ALPN|TLS/i);
  assert.throws(() => convert(vmessSource({ tls: '', alpn: 'h2' })), /ALPN|TLS/i);
  assert.throws(() => convert(uriSource('vless', 'h2').replace('security=tls', 'security=none')), /ALPN|TLS/i);
});

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'netatlas-subscription-tls-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['metadata', 'src/rules', 'private']) await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, 'metadata/upstreams.json'), JSON.stringify({ version: 1, rulesets: [], repositories: [] }));
  const inputFile = path.join(root, 'private/input.json'), outputFile = path.join(root, 'private/output.json');
  const input = JSON.stringify({ version: 1, subscriptions: [{ name: 'TLS', url: 'https://fixture.invalid/subscription?token=synthetic-private-token' }] });
  await writeFile(inputFile, input, { mode: 0o600 });
  await writeFile(outputFile, 'last-known-good-profile\n', { mode: 0o600 });
  return { root, inputFile, outputFile, input };
}

for (const [name, source] of [
  ['certificate pin', clashSource({ fingerprint: '00'.repeat(32) })],
  ['malformed ALPN', clashSource({ alpn: [false] })],
]) {
  test(`a subscription with ${name} fails before replacing the last good private output`, async t => {
    const f = await fixture(t);
    let failure;
    try { await createPrivateProfile({ ...f, client: 'singBox', fetchText: async () => source }); } catch (error) { failure = error; }
    assert.ok(failure, 'unsafe TLS conversion must reject before publication');
    assert.doesNotMatch(failure.message, /synthetic-tls-password|synthetic-private-token|00{20}/);
    assert.equal(await readFile(f.outputFile, 'utf8'), 'last-known-good-profile\n');
    assert.equal(await readFile(f.inputFile, 'utf8'), f.input);
    assert.deepEqual((await readdir(path.dirname(f.outputFile))).sort(), ['input.json', 'output.json']);
  });
}

test('a valid ALPN reaches the published private native node', async t => {
  const f = await fixture(t);
  await createPrivateProfile({ ...f, client: 'singBox', fetchText: async () => clashSource({ alpn }) });
  const config = JSON.parse(await readFile(f.outputFile, 'utf8'));
  assert.deepEqual(config.outbounds.find(node => node.tag === 'TLS-Node').tls.alpn, alpn);
});
