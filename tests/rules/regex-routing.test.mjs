import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { clientIds } from '../../tools/lib/clients.mjs';
import { regexRegistry, loadRegexRouting, regexRoutingFor, decodeRegexRuleset, matchesRegexCondition } from '../../tools/lib/regex-routing.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('all 24 selected omissions retain pinned raw source/line/license identity', async () => {
  const registry = await loadRegexRouting(root);
  assert.equal(registry.rulesets.reduce((n, item) => n + item.expressions.length, 0), 24);
  assert.equal(registry.expressions.length, 13);
  assert.deepEqual(registry, regexRegistry);
});

for (const client of clientIds) test(`${client}: native regex complements round-trip and never masquerade as a suffix`, () => {
  const result = regexRoutingFor(client);
  for (const resource of result.resources) {
    assert.equal(resource.domainOnly, true);
    assert.equal(resource.id, `${resource.sourceId}-regex`);
    assert.equal(resource.path, path.posix.join('rules', resource.id + resource.path.slice(resource.path.lastIndexOf('.'))));
    assert.deepEqual(decodeRegexRuleset(client, resource.content), resource.entries);
    for (const entry of resource.entries) assert.ok(['domain-regex', 'domain-wildcard'].includes(entry.type));
  }
  if (['egern', 'stash', 'mihomo', 'singBox'].includes(client)) {
    assert.equal(result.supportedExpressions, 24);
    assert.equal(result.unsupportedExpressions, 0);
    assert.equal(result.resources.length, 11);
  } else if (client === 'shadowrocket') {
    assert.equal(result.supportedExpressions, 14);
    assert.equal(result.unsupportedExpressions, 10);
    assert.equal(result.resources.length, 4);
    assert.equal(regexRegistry.clients.shadowrocket.minimumVersion, '2.2.65');
  } else {
    assert.ok(result.supportedExpressions > 0);
    assert.ok(result.unsupportedExpressions > 0);
  }
  assert.equal(result.supportedExpressions + result.unsupportedExpressions, 24);
});

test('proved wildcard languages preserve every positive and negative source fixture', () => {
  for (const client of clientIds) {
    const result = regexRoutingFor(client);
    for (const source of regexRegistry.expressions) {
      const records = result.expressions.filter(item => item.rule === source.rule);
      assert.ok(records.length);
      for (const record of records) {
        if (record.status === 'unsupported') continue;
        const original = new RegExp(source.rule.slice('regexp:'.length));
        for (const host of [...source.positive, ...source.negative]) {
          const expected = original.test(host);
          const actual = record.entries.some(entry => matchesRegexCondition(entry, host));
          assert.equal(actual, expected, `${client} ${source.rule} ${host}`);
        }
      }
    }
  }
});

test('native expressions are CSV-safe and keep ASCII RE2 shorthand semantics', () => {
  for (const client of ['egern', 'stash', 'mihomo', 'singBox']) {
    const result = regexRoutingFor(client);
    for (const resource of result.resources) for (const entry of resource.entries) {
      assert.doesNotMatch(entry.value, /[,\r\n]/);
      assert.doesNotMatch(entry.value, /\\[dws]/);
    }
    const source = result.expressions.find(item => item.rule.includes('speed\\.'));
    for (const length of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const host = `speed.coe.ad.${'a'.repeat(length)}.prod.hosts.ooklaserver.net`;
      assert.equal(source.entries.some(entry => matchesRegexCondition(entry, host)), length >= 2 && length <= 6);
    }
  }
});

test('unregistered source expressions, changed source lines and unknown clients fail closed', () => {
  const unknown = structuredClone(regexRegistry);
  unknown.rulesets[0].expressions[0].rule += 'new';
  assert.throws(() => regexRoutingFor('mihomo', unknown), /registered|expression|source/i);
  assert.throws(() => regexRoutingFor('QuantumultX'), /client/i);
  assert.throws(() => matchesRegexCondition({ type: 'domain-suffix', value: 'example.com' }, 'example.com'), /condition/i);
});

test('source byte or original line tampering is rejected before artifact generation', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'netatlas-regex-provenance-'));
  await cp(path.join(root, 'metadata'), path.join(temporary, 'metadata'), { recursive: true });
  const directory = 'src/vendor/rule-sources/domain-list-community/regex';
  await cp(path.join(root, directory), path.join(temporary, directory), { recursive: true });
  const original = path.join(temporary, directory, 'openai.txt');
  const bytes = await readFile(original);
  await writeFile(original, Buffer.concat([bytes, Buffer.from('\n# modified\n')]));
  await assert.rejects(loadRegexRouting(temporary), /source digest/);
  await writeFile(original, bytes);
  const metadata = path.join(temporary, 'metadata/upstreams.json');
  const sources = JSON.parse(await readFile(metadata, 'utf8'));
  sources.rulesets.find(item => item.id === 'openai').appliedExclusions[0].line++;
  await writeFile(metadata, JSON.stringify(sources));
  await assert.rejects(loadRegexRouting(temporary), /source line/);
});

test('a second root cannot claim new metadata while rendering a cached regex registry', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'netatlas-regex-registry-'));
  await cp(path.join(root, 'metadata'), path.join(temporary, 'metadata'), { recursive: true });
  const directory = 'src/vendor/rule-sources/domain-list-community/regex';
  await cp(path.join(root, directory), path.join(temporary, directory), { recursive: true });
  const filename = path.join(temporary, 'metadata/regex-routing.json');
  const value = JSON.parse(await readFile(filename, 'utf8'));
  value.clients.quantumultX.wildcard = null;
  await writeFile(filename, JSON.stringify(value));
  await assert.rejects(loadRegexRouting(temporary), /loaded registry/);
});
