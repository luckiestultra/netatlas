import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { testPrivateProfileWorkflow } from '../../tools/lib/profile-workflow.mjs';

test('private profile subscription, node bootstrap, DNS split and full routing work in real native kernels', {
  skip: process.env.NETATLAS_NATIVE_WORKFLOW !== '1', timeout: 120000,
}, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const report = await testPrivateProfileWorkflow({ root, binaries: { mihomo: path.join(root, '.cache/bin/mihomo'), singBox: path.join(root, '.cache/bin/sing-box') } });
  assert.equal(report.status, 'passed');
  assert.equal(report.cases.length, 32);
  assert.equal(report.generatedProfiles.length, 2);
  assert.deepEqual([...new Set(report.dnsQuestions.map(question => question.role))].sort(), ['bootstrap', 'domestic', 'local', 'remote']);
  assert.ok(report.generatedProfiles.every(profile => profile.publishedRulesMatch));
  assert.ok(report.subscriptions.some(source => source.client === 'mihomo' && source.stage === 'refresh' && source.realRequest === 'passed'));
  assert.ok(report.subscriptions.some(source => source.client === 'singBox' && source.stage === 'refresh' && source.materializedFromActualHTTP && source.realRequest === 'passed'));
  assert.ok(report.subscriptions.some(source => source.client === 'singBox' && source.stage === 'empty-source' && source.preservedLastGoodProfile));
});
