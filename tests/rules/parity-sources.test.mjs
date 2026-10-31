import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectDomainList, syncCatalog } from '../../tools/lib/sync.mjs';

const hotstarRule = 'regexp:^hses[1-7]?\\.akamaized\\.net$';
const expansion = { file: 'hotstar', rule: hotstarRule, conversion: 'hotstar-hosts-v1', reason: 'The anchored optional single digit enumerates exactly eight full hostnames.' };

test('explicit source unions retain both include closures and deduplicate portable entries', async () => {
  const files = { first: 'one.example\ninclude:shared\n', second: 'full:two.example\ninclude:shared\n', shared: 'shared.example\n' };
  const result = await collectDomainList(['first', 'second'], { readFile: async file => files[file] });
  assert.deepEqual(result.entries, [
    { type: 'domain-suffix', value: 'one.example' },
    { type: 'domain-suffix', value: 'shared.example' },
    { type: 'domain', value: 'two.example' }
  ]);
  assert.deepEqual(result.files.map(file => file.file), ['first', 'second', 'shared']);
  for (const roots of [[], ['first', 'first'], ['../outside'], ['first', 1]]) {
    await assert.rejects(collectDomainList(roots, { readFile: async () => 'one.example\n' }), /source lists|include name/i);
  }
});

test('exact token selection stays within named files and excludes unrelated parent services', async () => {
  const read = [];
  const result = await collectDomainList('parent', {
    readFile: async file => { read.push(file); return 'service.example\nother.example\ninclude:unrelated\nregexp:^unsupported.+$\n'; },
    select: [{ file: 'parent', rule: 'service.example' }]
  });
  assert.deepEqual(result.entries, [{ type: 'domain-suffix', value: 'service.example' }]);
  assert.deepEqual(read, ['parent']);
  assert.deepEqual(result.selectedTokens, [{ file: 'parent', line: 1, rule: 'service.example', sourceLine: 'service.example' }]);
  assert.equal(result.excluded.length, 0);
});

test('selectors reject drift, unknown fields, annotations, includes and unrelated files', async () => {
  for (const select of [
    [], [{ file: 'parent', rule: 'missing.example' }],
    [{ file: 'parent', rule: 'service.example', prefix: true }],
    [{ file: 'parent', rule: 'service.example @cn' }],
    [{ file: 'parent', rule: 'include:child' }],
    [{ file: 'child', rule: 'service.example' }],
    [{ file: 'parent', rule: 'service.example' }, { file: 'parent', rule: 'service.example' }]
  ]) {
    await assert.rejects(collectDomainList('parent', { readFile: async () => 'service.example\ninclude:child\n', select }), /select|token/i);
  }
});

test('regional selectors pin the original attribute set and preserve explicit regex omissions', async () => {
  const expression = 'regexp:^cdn[0-9]+\\.example$';
  const select = [{ file: 'parent', rule: 'regional.example', attributes: ['cn', 'telemetry'] }, { file: 'parent', rule: expression, attributes: ['cn'] }];
  const text = `regional.example @cn @telemetry\nforeign.example @!cn\n${expression} @cn\n`;
  const options = { select, exclusions: [{ file: 'parent', rule: expression, reason: 'Explicit unbounded regex omission in this portable regional projection.' }] };
  const result = await collectDomainList('parent', { readFile: async () => text, ...options });
  assert.deepEqual(result.entries, [{ type: 'domain-suffix', value: 'regional.example' }]);
  assert.deepEqual(result.selectedTokens[0].attributes, ['cn', 'telemetry']);
  assert.equal(result.excluded[0].sourceLine, expression + ' @cn');
  await assert.rejects(collectDomainList('parent', { readFile: async () => text.replace('@cn @telemetry', '@!cn @telemetry'), ...options }), /attribute/);
  for (const attributes of [null, [], ['cn', 'cn'], ['@cn'], ['cn', 1]]) {
    await assert.rejects(collectDomainList('parent', { readFile: async () => text, select: [{ file: 'parent', rule: 'regional.example', attributes }] }), /attribute|select/);
  }
});

test('keyword tokens retain native substring semantics unless exactly excluded', async () => {
  const text = 'service.example\nkeyword:Media-CDN.Example\n';
  const result = await collectDomainList('service', { readFile: async () => text });
  assert.ok(result.entries.some(entry => entry.type === 'domain-keyword' && entry.value === 'media-cdn.example'));
  const selected = await collectDomainList('service', { readFile: async () => text, select: [{ file: 'service', rule: 'keyword:Media-CDN.Example' }] });
  assert.deepEqual(selected.entries, [{ type: 'domain-keyword', value: 'media-cdn.example' }]);
  const omitted = await collectDomainList('service', { readFile: async () => text, exclusions: [{ file: 'service', rule: 'keyword:Media-CDN.Example', reason: 'An explicitly reviewed projection remains stable.' }] });
  assert.equal(omitted.entries.some(entry => entry.type === 'domain-keyword'), false);
  assert.equal(omitted.excluded.length, 1);
  await assert.rejects(collectDomainList('service', { readFile: async () => 'keyword:bad/value\n' }), /keyword|invalid/i);
});

test('registered finite hotstar conversion has exactly the anchored regex language', async () => {
  const result = await collectDomainList('hotstar', { readFile: async () => hotstarRule + '\n', expansions: [expansion] });
  const values = result.entries.map(entry => { assert.equal(entry.type, 'domain'); return entry.value; }).sort();
  const expected = ['hses.akamaized.net', ...Array.from({ length: 7 }, (_, i) => `hses${i + 1}.akamaized.net`)].sort();
  assert.deepEqual(values, expected);
  const regex = new RegExp(hotstarRule.slice('regexp:'.length));
  for (const prefix of ['hses', ...Array.from({ length: 100 }, (_, i) => `hses${i}`), 'hses11', 'hses-1', 'xhses1', 'sub.hses1']) {
    const host = `${prefix}.akamaized.net`;
    assert.equal(values.includes(host), regex.test(host), host);
  }
  for (const host of ['hses1.akamaized.net.extra', 'sub.hses1.akamaized.net', 'hses1xakamaized.net', 'hses1.akamaizedxnet']) {
    assert.equal(regex.test(host), false);
    assert.equal(values.includes(host), false);
  }
  assert.equal(result.excluded.length, 0);
  assert.equal(result.expanded[0].conversion, expansion.conversion);
  assert.deepEqual(result.expanded[0].entries.map(entry => entry.value).sort(), expected);
});

test('finite conversion registration cannot approve different or unbounded expressions', async () => {
  for (const registration of [
    { ...expansion, rule: 'regexp:^hses[0-9]+\\.akamaized\\.net$' },
    { ...expansion, conversion: 'unknown' },
    { ...expansion, entries: [{ type: 'domain-suffix', value: 'akamaized.net' }] },
    { ...expansion, reason: '' }
  ]) {
    await assert.rejects(collectDomainList('hotstar', { readFile: async () => hotstarRule, expansions: [registration] }), /expansion|conversion/i);
  }
  await assert.rejects(collectDomainList('hotstar', { readFile: async () => 'regexp:^hses[0-9]+\\.akamaized\\.net$\n', expansions: [expansion] }), /Unsupported/);
});

test('the catalog sync reproduces union and narrow selectors with pinned provenance', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const scratch = path.join(root, '.cache/sync-tests');
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(path.join(scratch, 'parity-'));
  await mkdir(path.join(dir, 'metadata'));
  const license = 'MIT fixture\n';
  const digest = text => createHash('sha256').update(text).digest('hex');
  const metadata = {
    version: 1,
    repositories: [{ id: 'dlc', repository: 'example/fixture', revision: 'a'.repeat(40), revisionDate: '2026-10-01T00:00:00Z', author: 'Fixture authors', license: 'MIT', licensePath: 'LICENSE', licenseSha256: digest(license) }],
    rulesets: [
      { id: 'union', category: 'media', source: { repository: 'dlc', lists: ['first', 'second'] }, exclusions: [] },
      { id: 'narrow', category: 'system', source: { repository: 'dlc', list: 'parent', select: [{ file: 'parent', rule: 'narrow.example' }] }, exclusions: [] }
    ]
  };
  const metadataPath = path.join(dir, 'metadata/upstreams.json');
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  const files = { first: 'first.example\ninclude:shared\n', second: 'second.example\n', shared: 'shared.example\n', parent: 'narrow.example\nunrelated.example\ninclude:never-fetched\n' };
  const fetched = [];
  const fetchText = async url => {
    fetched.push(url);
    if (url.endsWith('/LICENSE')) return license;
    const value = files[url.split('/').at(-1)];
    assert.equal(typeof value, 'string', url);
    return value;
  };
  await syncCatalog({ root: dir, fetchText });
  const before = await readFile(metadataPath, 'utf8');
  const recorded = JSON.parse(before);
  assert.equal(recorded.rulesets[0].entryCount, 3);
  assert.equal(recorded.rulesets[1].entryCount, 1);
  assert.equal(recorded.rulesets[1].selectedTokens[0].rule, 'narrow.example');
  assert.equal(fetched.some(url => url.endsWith('/never-fetched')), false);
  for (const item of recorded.rulesets) {
    const text = await readFile(path.join(dir, `src/rules/${item.category}/${item.id}.json`), 'utf8');
    assert.equal(digest(text), item.outputSha256);
    assert.ok(item.files.every(file => file.url.includes('/' + 'a'.repeat(40) + '/data/')));
  }
  const replay = await syncCatalog({ root: dir, fetchText, dryRun: true });
  assert.equal(replay.changed, false);
  assert.equal(await readFile(metadataPath, 'utf8'), before);
  recorded.rulesets[0].source.list = 'first';
  await writeFile(metadataPath, JSON.stringify(recorded, null, 2) + '\n');
  await assert.rejects(syncCatalog({ root: dir, fetchText, dryRun: true }), /exactly one/);
});

test('registered regional subsets keep tagged tokens and avoid corporate parent widening', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const metadata = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  for (const id of ['google-cn', 'steam-cn']) {
    const item = metadata.rulesets.find(value => value.id === id);
    assert.ok(item.source.select.every(token => token.attributes.includes('cn')), id);
    assert.ok(item.selectedTokens.every(token => token.attributes.includes('cn') && token.sourceLine.includes('@cn')), id);
    const rules = JSON.parse(await readFile(path.join(root, `src/rules/${item.category}/${id}.json`), 'utf8'));
    const values = rules.entries.map(entry => entry.value);
    assert.equal(values.includes(id === 'google-cn' ? 'google.com' : 'steampowered.com'), false);
    assert.equal(values.includes(id === 'google-cn' ? 'google.cn' : 'steamchina.com'), true);
  }
  const google = metadata.rulesets.find(value => value.id === 'google-cn');
  assert.equal(google.appliedExclusions.length, 2);
  assert.ok(google.appliedExclusions.every(token => token.sourceLine.endsWith('@cn')));
  const hulu = JSON.parse(await readFile(path.join(root, 'src/rules/media/hulu-jp.json'), 'utf8'));
  assert.equal(hulu.entries.length, 5);
  assert.ok(hulu.entries.some(entry => entry.type === 'domain-suffix' && entry.value === 'hulu.jp'));
  assert.equal(hulu.entries.some(entry => entry.value === 'hulu.com'), false);
  const hbo = JSON.parse(await readFile(path.join(root, 'src/rules/media/hbo-asia.json'), 'utf8'));
  assert.ok(hbo.entries.some(entry => entry.type === 'domain-keyword' && entry.value === '.hbogoasia.'));
  assert.equal(hbo.entries.some(entry => entry.value === 'hbo.com' || entry.value === 'max.com'), false);
});
