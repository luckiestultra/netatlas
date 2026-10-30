import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { testLocalRouting } from '../../tools/lib/native.mjs';

// Explicit opt-in: the normal unit suite must not download or run native tools.
// tools/native.mjs verifies pinned binaries and runs these routing assertions too.
test('both real kernels enforce exact/suffix rules through HTTP and SOCKS5', {
  skip: process.env.PROXY_ATLAS_NATIVE_INTEGRATION !== '1',
  timeout: 60_000,
}, async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const binaries = { mihomo: path.join(root, '.cache/bin/mihomo'), singBox: path.join(root, '.cache/bin/sing-box') };
  const result = await testLocalRouting({ root, binaries });
  assert.equal(result.status, 'passed');
  assert.ok(result.upstreamRequests > 0, 'fallback must traverse the real loopback SOCKS fixture');
  for (const client of ['mihomo', 'singBox']) {
    for (const protocol of ['http', 'socks5']) {
      for (const behavior of ['explicit-direct', 'explicit-reject', 'fallback-reject', 'fallback-direct', 'suffix-root-reject', 'suffix-child-reject', 'suffix-similar-fallback', 'suffix-tail-fallback', 'fallback-proxy']) {
        assert.ok(result.cases.some(item => item.client === client && item.protocol === protocol && item.behavior === behavior && item.status === 'passed'), `${client} ${protocol} ${behavior}`);
      }
    }
  }
});
