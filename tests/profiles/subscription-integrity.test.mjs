import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPrivateProfile, materializeSubscription } from '../../tools/lib/private-profile.mjs';

const method = 'aes-128-gcm';
for (const password of ['literal%2Fvalue', 'literal%value', 'literal%20value', '中文%2F:@']) {
  for (const format of ['base64-userinfo', 'legacy-base64', 'raw-userinfo']) {
    test(`Shadowsocks ${format} preserves the literal password ${password}`, () => {
      const endpoint = '127.0.0.1:18388';
      const uri = format === 'base64-userinfo' ? `ss://${Buffer.from(`${method}:${password}`).toString('base64url')}@${endpoint}#SS`
        : format === 'legacy-base64' ? `ss://${Buffer.from(`${method}:${password}@${endpoint}`).toString('base64')}#SS`
          : `ss://${encodeURIComponent(method)}:${encodeURIComponent(password)}@${endpoint}#SS`;
      assert.equal(materializeSubscription('singBox', uri)[0].password, password);
    });
  }
}

test('outer Base64 subscription encoding does not add another password decoding pass', () => {
  const password = 'literal%2Fvalue';
  const uri = `ss://${Buffer.from(`${method}:${password}`).toString('base64url')}@127.0.0.1:18388#SS`;
  assert.equal(materializeSubscription('singBox', Buffer.from(uri).toString('base64'))[0].password, password);
});

const node = (tag, detour) => ({ type: 'http', tag, server: '127.0.0.1', server_port: 18080, ...(detour === undefined ? {} : { detour }) });
async function fixture(t, options) {
  const root = await mkdtemp(path.join(tmpdir(), 'netatlas-subscription-integrity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['metadata', 'src/rules', 'private']) await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, 'metadata/upstreams.json'), JSON.stringify({ version: 1, rulesets: [], repositories: [] }));
  const inputFile = path.join(root, 'private/input.json'), outputFile = path.join(root, 'private/output.json');
  const input = JSON.stringify({ version: 1, ...options });
  await writeFile(inputFile, input, { mode: 0o600 });
  await writeFile(outputFile, 'last-known-good-profile\n', { mode: 0o600 });
  return { root, inputFile, outputFile, input };
}
const subscription = name => ({ name, url: `https://fixture.invalid/${name}?token=synthetic-private-token` });

for (const [name, nodes] of [
  ['a discarded selector', [node('Outer'), { type: 'selector', tag: 'Carrier', outbounds: ['Outer'] }, node('Inner', 'Carrier')]],
  ['an unknown outbound', [node('Inner', 'Missing')]],
  ['a malformed detour', [node('Inner', false)]],
  ['an outbound cycle', [node('Outer', 'Inner'), node('Inner', 'Outer')]],
  ['a cycle through a generated selector', [node('Inner', 'Proxy')]],
]) {
  test(`a native subscription depending on ${name} cannot replace the last good private profile`, async t => {
    const f = await fixture(t, { subscriptions: [subscription('Native')] });
    let failure;
    try { await createPrivateProfile({ ...f, client: 'singBox', fetchText: async () => JSON.stringify({ outbounds: nodes }) }); } catch (error) { failure = error; }
    assert.ok(failure, 'unusable native dependencies must fail before publication');
    assert.doesNotMatch(failure.message, /synthetic-private-token|Missing|Carrier/);
    assert.equal(await readFile(f.outputFile, 'utf8'), 'last-known-good-profile\n');
    assert.equal(await readFile(f.inputFile, 'utf8'), f.input);
    assert.deepEqual((await readdir(path.dirname(f.outputFile))).sort(), ['input.json', 'output.json']);
  });
}

for (const local of [true, false]) {
  test(`valid detours can reference ${local ? 'local nodes' : 'another subscription'} after all sources are combined`, async t => {
    const f = await fixture(t, { nodes: local ? [node('Outer')] : [], subscriptions: local ? [subscription('Inner')] : [subscription('Outer'), subscription('Inner')], selectedProxy: 'Inner' });
    await createPrivateProfile({ ...f, client: 'singBox', fetchText: async url => JSON.stringify({ outbounds: [url.includes('/Outer?') ? node('Outer') : node('Inner', 'Outer')] }) });
    const config = JSON.parse(await readFile(f.outputFile, 'utf8'));
    assert.equal(config.outbounds.find(item => item.tag === 'Inner').detour, 'Outer');
    assert.equal(config.outbounds.find(item => item.tag === 'Proxy').default, 'Inner');
  });
}

test('an unused subscription selector can be omitted without rejecting its independent real node', async t => {
  const f = await fixture(t, { subscriptions: [subscription('Native')] });
  await createPrivateProfile({ ...f, client: 'singBox', fetchText: async () => JSON.stringify({ outbounds: [node('Outer'), { type: 'selector', tag: 'Unused', outbounds: ['Outer'] }] }) });
  const config = JSON.parse(await readFile(f.outputFile, 'utf8'));
  assert.ok(config.outbounds.some(item => item.tag === 'Outer'));
  assert.ok(!config.outbounds.some(item => item.tag === 'Unused'));
});
