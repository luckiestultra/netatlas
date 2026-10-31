import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRuleSupplement } from '../../tools/lib/rule-supplements.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');

test('the Unbreak supplement is an original two-exact-domain selection grounded in primary endpoint sources', async () => {
  const registry = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const source = registry.rulesets.find(item => item.id === 'unbreak');
  const supplement = await loadRuleSupplement(root, source.source.localSupplement, 'unbreak');
  assert.deepEqual(supplement.entries, [{ type: 'domain', value: 'ci.android.com' }, { type: 'domain', value: 'redirector.gvt1.com' }]);
  assert.equal(supplement.license, 'MIT');
  assert.ok(supplement.references.some(value => value.startsWith('https://source.android.com/')));
  assert.ok(supplement.references.some(value => value.startsWith('https://github.com/chromium/chromium/blob/')));
});

test('local supplements fail closed on integrity, path, schema, license and unnormalized entries', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'netatlas-supplement-'));
  await mkdir(path.join(directory, 'src/supplements'), { recursive: true });
  const object = { version: 1, id: 'fixture', license: 'MIT', author: 'NetAtlas contributors', updatedAt: '2026-10-31T00:00:00Z', references: ['https://source.example/endpoint'], entries: [{ type: 'domain', value: 'api.example' }] };
  const filename = 'src/supplements/fixture.json';
  async function setup(value = object) {
    const text = JSON.stringify(value, null, 2) + '\n';
    await writeFile(path.join(directory, filename), text);
    return { path: filename, license: 'MIT', sha256: digest(text) };
  }
  const descriptor = await setup();
  assert.deepEqual((await loadRuleSupplement(directory, descriptor, 'fixture')).entries, object.entries);
  for (const patch of [{ sha256: '0'.repeat(64) }, { path: '../fixture.json' }, { path: 'src/rules/fixture.json' }, { license: 'GPL-2.0-only' }]) await assert.rejects(loadRuleSupplement(directory, { ...descriptor, ...patch }, 'fixture'));
  for (const patch of [{ id: 'another' }, { references: ['http://insecure.example'] }, { license: 'unknown' }, { entries: [{ type: 'domain-suffix', value: 'too-broad.example' }] }, { entries: [{ type: 'domain', value: 'UPPER.example' }] }, { entries: [object.entries[0], object.entries[0]] }]) await assert.rejects(loadRuleSupplement(directory, await setup({ ...object, ...patch }), 'fixture'));
  await setup();
  await symlink(path.join(directory, filename), path.join(directory, 'src/supplements/link.json'));
  await assert.rejects(loadRuleSupplement(directory, { ...descriptor, path: 'src/supplements/link.json' }, 'fixture'));
});
