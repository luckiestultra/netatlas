import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runManagedProfileVerification } from '../../tools/lib/managed-workflow.mjs';

test('App-first managed profiles fetch their actual remote rules and enforce native DNS, nodes, routing and updates', {
  skip: process.env.PROXY_ATLAS_NATIVE_INTEGRATION !== '1', timeout: 60_000,
}, async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const result = await runManagedProfileVerification({ root, binaries: { mihomo: path.join(root, '.cache/bin/mihomo'), singBox: path.join(root, '.cache/bin/sing-box') } });
  assert.equal(result.status, 'passed');
  assert.equal(result.publicTunChecks.length, 2);
  assert.ok(result.publicTunChecks.every(item => item.status === 'passed' && item.mode.includes('never started')));
  for (const client of ['mihomo', 'singBox']) {
    assert.ok(result.profiles.some(profile => profile.client === client && profile.remoteProviders > 30 && profile.defaultUpdateSeconds === 86400 && profile.captureTraffic === false));
    for (const protocol of ['http', 'socks5']) assert.ok(result.cases.some(item => item.client === client && item.protocol === protocol && item.behavior === 'specific-before-cn'));
    assert.ok(result.updates.some(item => item.client === client && item.kind === 'rule' && item.actualHttpFetch && item.realHttpAndSocks));
  }
  assert.ok(result.updates.some(item => item.kind === 'subscription' && item.before === 'JP-A' && item.after === 'JP-B' && item.realRequest));
});
