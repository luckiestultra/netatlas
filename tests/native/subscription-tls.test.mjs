import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { testSubscriptionTlsWorkflow } from '../../tools/lib/subscription-tls-flow.mjs';

test('subscription TLS constraints survive publication or reject before replacing a usable profile', {
  skip: process.env.NETATLAS_NATIVE_TLS !== '1', timeout: 60000,
}, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const report = await testSubscriptionTlsWorkflow({ root, binaries: { mihomo: path.join(root, '.cache/bin/mihomo'), singBox: path.join(root, '.cache/bin/sing-box') } });
  assert.equal(report.status, 'passed');
  assert.equal(report.cases.length, 7);
  assert.ok(report.cases.some(item => item.id === 'pin-import' && item.preservedLastGoodProfile && item.rejectedBeforePublication));
  assert.ok(report.cases.some(item => item.id === 'imported-trojan-alpn' && item.actualTlsHttp === 'passed'));
  assert.ok(report.cases.some(item => item.id === 'negative-control-missing-alpn' && item.rejectedWithoutRequiredAlpn));
});

for (const entry of ['.cache', '.cache/native-check']) {
  test(`TLS native workflow refuses a symlink at ${entry} before writing or execution`, async t => {
    const base = await mkdtemp(path.join(tmpdir(), 'netatlas-tls-guard-'));
    t.after(() => rm(base, { recursive: true, force: true }));
    const root = path.join(base, 'root'), outside = path.join(base, 'outside');
    await mkdir(root); await mkdir(outside);
    await writeFile(path.join(outside, 'sentinel'), 'untouched');
    await mkdir(path.dirname(path.join(root, entry)), { recursive: true });
    await symlink(outside, path.join(root, entry));
    await assert.rejects(() => testSubscriptionTlsWorkflow({ root, binaries: {} }), /symlink/i);
    assert.deepEqual(await readdir(outside), ['sentinel']);
    assert.equal(await readFile(path.join(outside, 'sentinel'), 'utf8'), 'untouched');
  });
}
