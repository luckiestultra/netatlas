import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as native from '../../tools/lib/native.mjs';

const marker = 'netatlas-mihomo-running-56804c36-7b37-4a1d-b7e4-d603933527d4';
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'netatlas-running-signal-'));
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  return { child, markerPath: path.join(directory, marker) };
}

test('provider count and listener readiness cannot replace the post-up running signal', async () => {
  assert.equal(typeof native.waitForMihomoRunning, 'function');
  const { child, markerPath } = await fixture();
  let completed = false;
  const waiting = native.waitForMihomoRunning({ child, markerPath }).then(result => { completed = true; return result; });
  await writeFile(path.join(path.dirname(markerPath), 'provider-ready.json'), '{"ruleCount":100682}');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false, 'A loaded provider can still precede runtime.GC and tunnel.OnRunning');
  await writeFile(markerPath + '.pending', marker);
  await rename(markerPath + '.pending', markerPath);
  const result = await waiting;
  assert.equal(result.status, 'passed');
  assert.equal(result.signal, 'mihomo-cli-post-up');
  assert.equal(result.phase, 'after-hub-parse-and-tunnel-running');
  assert.equal(child.listenerCount('exit'), 0);
});

test('a post-up marker that arrives before the watcher is still observed', async () => {
  assert.equal(typeof native.waitForMihomoRunning, 'function');
  const { child, markerPath } = await fixture();
  await writeFile(markerPath, marker);
  const result = await native.waitForMihomoRunning({ child, markerPath });
  assert.equal(result.status, 'passed');
});

test('wrong or missing markers do not become running evidence', async () => {
  assert.equal(typeof native.waitForMihomoRunning, 'function');
  const missing = await fixture();
  await assert.rejects(() => native.waitForMihomoRunning({ ...missing, timeoutMs: 40 }), /post-up.*timed out/i);
  // A non-atomic producer can expose an empty final file before printf finishes.
  for (const value of ['', marker + '-wrong']) {
    const wrong = await fixture();
    await writeFile(wrong.markerPath, value);
    await assert.rejects(() => native.waitForMihomoRunning(wrong), /post-up.*invalid/i);
  }
});

test('an exited kernel fails instead of certifying early rejected traffic', async () => {
  assert.equal(typeof native.waitForMihomoRunning, 'function');
  for (const kind of ['exit', 'error', 'already-exited']) {
    const item = await fixture();
    if (kind === 'already-exited') item.child.exitCode = 1;
    const waiting = native.waitForMihomoRunning(item);
    if (kind === 'exit') item.child.emit('exit', 1, null);
    if (kind === 'error') item.child.emit('error', new Error('fixture startup failed'));
    await assert.rejects(waiting, /process.*(?:exited|startup failed)/i);
  }
});

test('the post-up marker is fixed-format generated data and cannot carry shell syntax', async () => {
  assert.equal(typeof native.waitForMihomoRunning, 'function');
  const { child, markerPath } = await fixture();
  for (const value of ['arbitrary', marker + ';bad', marker + '\n']) {
    await assert.rejects(() => native.waitForMihomoRunning({ child, markerPath: path.join(path.dirname(markerPath), value) }), /marker/i);
  }
});
