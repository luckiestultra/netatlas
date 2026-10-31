import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { testSubscriptionIntegrityWorkflow } from '../../tools/lib/subscription-integrity-flow.mjs';

test('literal SIP002 passwords and complete native dependencies survive real private subscription workflows', {
  skip: process.env.NETATLAS_NATIVE_INTEGRITY !== '1', timeout: 60000,
}, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const report = await testSubscriptionIntegrityWorkflow({ root, binaries: { singBox: path.join(root, '.cache/bin/sing-box') } });
  assert.equal(report.status, 'passed');
  assert.equal(report.cases.length, 8);
  assert.ok(report.cases.some(item => item.id === 'ss-userinfo' && item.nativeAuthenticatedHttp === 'passed'));
  assert.ok(report.cases.some(item => item.id === 'discarded-carrier-import' && item.preservedLastGoodProfile));
  assert.ok(report.cases.some(item => item.id === 'preserved-good-profile' && item.actualHttpAfterRejectedRefresh === 'passed'));
});

for (const entry of ['.cache', '.cache/native-check']) {
  test(`integrity native workflow refuses a symlink at ${entry} before writing or execution`, async t => {
    const base = await mkdtemp(path.join(tmpdir(), 'netatlas-integrity-guard-'));
    t.after(() => rm(base, { recursive: true, force: true }));
    const root = path.join(base, 'root'), outside = path.join(base, 'outside');
    await mkdir(root); await mkdir(outside); await writeFile(path.join(outside, 'sentinel'), 'untouched');
    await mkdir(path.dirname(path.join(root, entry)), { recursive: true }); await symlink(outside, path.join(root, entry));
    await assert.rejects(() => testSubscriptionIntegrityWorkflow({ root, binaries: {} }), /symlink/i);
    assert.deepEqual(await readdir(outside), ['sentinel']); assert.equal(await readFile(path.join(outside, 'sentinel'), 'utf8'), 'untouched');
  });
}
