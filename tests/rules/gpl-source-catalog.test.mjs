import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseClassicalYaml } from '../../tools/lib/classical-source.mjs';
import { matchesEntry } from '../../tools/lib/rules.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vendor = path.join(root, 'src/vendor/rule-sources/blackmatrix7');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const revision = '0b6897dc17e0c513d25449c935a9694818e32f0c';
const licenseSha256 = '8177f97513213526df2cf6184d8ff986c675afb514d4e68a404010521b880643';

test('the GPL data archive preserves original bytes, full license and non-executable modes', async () => {
  const manifest = JSON.parse(await readFile(path.join(vendor, 'manifest.json'), 'utf8'));
  assert.equal(manifest.revision, revision);
  assert.equal(manifest.license, 'GPL-2.0-only');
  assert.equal(manifest.sourceArchiveExecutable, false);
  assert.equal(manifest.files.length, 8);
  for (const file of manifest.files) {
    const filename = path.join(vendor, file.path);
    const content = await readFile(filename);
    assert.equal(content.length, file.bytes, file.path);
    assert.equal(sha256(content), file.sha256, file.path);
    const blob = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    assert.equal(blob, file.gitBlobSha, file.path);
    assert.equal(file.originalBytes, true);
    assert.equal(file.executable, false);
    assert.equal((await stat(filename)).mode & 0o111, 0, file.path);
    assert.equal(file.license, 'GPL-2.0-only');
    assert.ok(file.upstreamUrl.includes('/' + revision + '/'));
  }
  const license = await readFile(path.join(vendor, 'LICENSE'));
  assert.equal(sha256(license), licenseSha256);
  assert.equal(license.length, 18092);
  const notice = await readFile(path.join(vendor, 'NOTICE.md'), 'utf8');
  assert.match(notice, /GPL-2\.0-only/);
  assert.match(notice, /blackmatrix7/);
  assert.match(notice, /not covered by this repository's MIT license/);
});

test('six canonical sources retain exact GPL provenance and the licensed service scope', async () => {
  const metadata = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const repository = metadata.repositories.find(item => item.id === 'ios-rule-script');
  assert.equal(repository.revision, revision);
  assert.equal(repository.license, 'GPL-2.0-only');
  assert.equal(repository.licenseSha256, licenseSha256);
  const expected = { all4: 2, 'netease-music': 28, global: 6985, 'hulu-jp': 5, 'hbo-asia': 19, 'five-itv': 2 };
  for (const [id, count] of Object.entries(expected)) {
    const item = metadata.rulesets.find(value => value.id === id);
    assert.equal(item.source.repository, repository.id, id);
    assert.equal(item.source.format, 'classical-yaml', id);
    assert.equal(item.entryCount, count, id);
    assert.equal(item.updatedAt, '2026-10-27T21:45:18Z');
    const original = await readFile(path.join(vendor, item.source.path));
    assert.equal(item.files[0].sha256, sha256(original), id);
    const canonical = await readFile(path.join(root, `src/rules/${item.category}/${id}.json`));
    assert.equal(item.outputSha256, sha256(canonical), id);
    assert.equal(JSON.parse(canonical).entries.length, count, id);
    assert.deepEqual(item.appliedExclusions, []);
  }
  const global = metadata.rulesets.find(item => item.id === 'global');
  assert.equal(global.source.path, 'rule/Clash/Proxy/Proxy_Classical.yaml');
  assert.match(global.source.description, /alternative/);
  assert.match(global.source.description, /not the upstream Global list/);
  const music = JSON.parse(await readFile(path.join(root, 'src/rules/media/netease-music.json'), 'utf8'));
  assert.equal(music.entries.some(entry => ['netease.com', '163.com', '126.net'].includes(entry.value)), false);
});

test('GPL keyword and selected streaming data keep their actual match semantics', async () => {
  const hbo = JSON.parse(await readFile(path.join(root, 'src/rules/media/hbo-asia.json'), 'utf8'));
  const keyword = hbo.entries.find(entry => entry.type === 'domain-keyword');
  assert.deepEqual(keyword, { type: 'domain-keyword', value: '.hbogoasia.' });
  assert.equal(matchesEntry(keyword, { host: 'play.hbogoasia.sg' }), true);
  assert.equal(matchesEntry(keyword, { host: 'hbogoasia.example' }), false);
  const text = await readFile(path.join(vendor, 'rule/Clash/GlobalMedia/GlobalMedia_Classical.yaml'), 'utf8');
  const selected = ['DOMAIN-SUFFIX,5itv.tv', 'DOMAIN-SUFFIX,ocnttv.com'];
  assert.deepEqual(parseClassicalYaml(text, 'GlobalMedia_Classical.yaml', selected).entries, [
    { type: 'domain-suffix', value: '5itv.tv' },
    { type: 'domain-suffix', value: 'ocnttv.com' }
  ]);
  assert.throws(() => parseClassicalYaml(text, 'GlobalMedia_Classical.yaml'), /Unsupported classical rule type: PROCESS-NAME/);
  assert.throws(() => parseClassicalYaml(text, 'GlobalMedia_Classical.yaml', [...selected, 'DOMAIN-SUFFIX,invented.example']), /selected token is missing/);
});
