import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { matchesEntry } from '../../tools/lib/rules.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('the first-party connectivity repair selection matches only its three official exact probes', async () => {
  const filename = path.join(root, 'src/rules/network/unbreak.json');
  const text = await readFile(filename, 'utf8');
  const rules = JSON.parse(text);
  const hosts = ['captive.apple.com', 'dns.msftncsi.com', 'www.msftconnecttest.com'];
  assert.deepEqual(rules.entries, hosts.map(value => ({ type: 'domain', value })));
  for (const host of hosts) {
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host })), true, host);
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host: 'ads.' + host })), false, host);
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host: host + '.unrelated.example' })), false, host);
  }
  for (const host of ['apple.com', 'ads.apple.com', 'microsoft.com', 'msftconnecttest.com', 'msftncsi.com']) {
    assert.equal(rules.entries.some(entry => matchesEntry(entry, { host })), false, host);
  }
  const metadata = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const record = metadata.rulesets.find(item => item.id === 'unbreak');
  assert.equal(record.source.type, 'local');
  assert.equal(record.source.license, 'MIT');
  assert.equal(record.entryCount, 3);
  assert.equal(record.outputSha256, createHash('sha256').update(text).digest('hex'));
  assert.deepEqual(record.source.references, [
    'https://support.apple.com/en-ie/101555',
    'https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/troubleshoot-ncsi-guidance'
  ]);
});
