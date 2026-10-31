import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import * as native from '../../tools/lib/native.mjs';

const provider = (ruleCount) => ({ name: 'netatlas-anti-ad', behavior: 'Classical', format: 'YamlRule', type: 'Rule', vehicleType: 'File', ruleCount, updatedAt: ruleCount ? '2026-10-31T00:00:00Z' : '0001-01-01T00:00:00Z' });
async function fixture(handler) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, path: request.url, authorization: request.headers.authorization });
    handler(request, response, requests.length);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { requests, port: server.address().port, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

test('a listening proxy is not ready until its actual file provider count has loaded', async () => {
  assert.equal(typeof native.waitForMihomoRuleProvider, 'function');
  const api = await fixture((_request, response, count) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ providers: { 'netatlas-anti-ad': provider(count < 3 ? 0 : 100682) } }));
  });
  try {
    const result = await native.waitForMihomoRuleProvider({ controllerPort: api.port, secret: 'fixture-only-nonce', expectedCount: 100682 });
    assert.equal(result.status, 'passed');
    assert.equal(result.provider.ruleCount, 100682);
    assert.deepEqual(result.observations.map(item => item.ruleCount), [0, 0, 100682]);
    assert.equal(api.requests.length, 3);
    for (const request of api.requests) {
      assert.equal(request.method, 'GET');
      assert.equal(request.path, '/providers/rules');
      assert.equal(request.authorization, 'Bearer fixture-only-nonce');
    }
    assert.equal(JSON.stringify(result).includes('fixture-only-nonce'), false);
  } finally { await api.close(); }
});

test('provider readiness never reports success for zero rules, wrong counts or remote transport', async () => {
  assert.equal(typeof native.waitForMihomoRuleProvider, 'function');
  for (const state of [provider(0), provider(7), { ...provider(100682), vehicleType: 'HTTP' }]) {
    const api = await fixture((_request, response) => response.end(JSON.stringify({ providers: { 'netatlas-anti-ad': state } })));
    try {
      await assert.rejects(() => native.waitForMihomoRuleProvider({ controllerPort: api.port, secret: 'fixture-only', expectedCount: 100682, timeoutMs: 75 }), /provider.*(?:ready|count|File)/i);
    } finally { await api.close(); }
  }
});

test('provider readiness fails on API authentication/schema errors and exited kernels', async () => {
  assert.equal(typeof native.waitForMihomoRuleProvider, 'function');
  for (const body of ['{"providers":{}}', '{broken']) {
    const api = await fixture((_request, response) => response.end(body));
    try {
      await assert.rejects(() => native.waitForMihomoRuleProvider({ controllerPort: api.port, secret: 'fixture-only', expectedCount: 100682 }), /provider.*(?:missing|JSON|schema)/i);
      assert.equal(api.requests.length, 1);
    } finally { await api.close(); }
  }
  const api = await fixture((_request, response) => { response.statusCode = 401; response.end('{}'); });
  try {
    await assert.rejects(() => native.waitForMihomoRuleProvider({ controllerPort: api.port, secret: 'fixture-only', expectedCount: 100682 }), /provider.*401/i);
    await assert.rejects(() => native.waitForMihomoRuleProvider({ controllerPort: api.port, secret: 'fixture-only', expectedCount: 100682, child: { exitCode: 1, signalCode: null } }), /process.*exited/i);
    assert.equal(api.requests.length, 1);
  } finally { await api.close(); }
});
