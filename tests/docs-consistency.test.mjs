import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { filesUnder, loadCatalog } from '../tools/lib/build.mjs';
import { profileRulesetsFor } from '../tools/lib/policies.mjs';

const root = resolve(import.meta.dirname, '..');

async function exists(target) {
  try { await lstat(target); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

test('active documentation rule and entry counts match the live canonical catalog', async () => {
  const { rulesets } = await loadCatalog(root);
  const defaults = profileRulesetsFor(rulesets);
  const totalSets = String(rulesets.length);
  const totalEntries = rulesets.reduce((sum, set) => sum + set.entries.length, 0).toLocaleString('en-US');
  const defaultSets = String(defaults.length);
  const defaultEntries = defaults.reduce((sum, set) => sum + set.entries.length, 0).toLocaleString('en-US');
  const antiAdEntries = rulesets.find(set => set.id === 'anti-ad').entries.length.toLocaleString('en-US');
  const globalEntries = rulesets.find(set => set.id === 'global').entries.length.toLocaleString('en-US');

  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  assert.ok(readme.includes(`${defaultSets} 份公共规则资源（${defaultEntries} 条）`), `README default counts mismatch: expected ${defaultSets} / ${defaultEntries}`);
  assert.ok(readme.includes(`anti-AD **${antiAdEntries} 条**`), 'README anti-AD count mismatch');
  assert.ok(readme.includes(`global **${globalEntries} 条**`), 'README global count mismatch');
  assert.ok(readme.includes(`${totalSets} 套、${totalEntries} 条`), `README total counts mismatch: expected ${totalSets} / ${totalEntries}`);

  const checks = [
    ['docs/capabilities.md', [`${defaultSets} 组公共数据、${defaultEntries} 条`]],
    ['docs/coverage.md', [`${totalSets} 套、${totalEntries} 条`]],
    ['docs/architecture.md', [`默认 ${defaultSets} 组主配置`]],
    ['docs/profile-setup.md', [`${defaultSets} 个公共规则资源`, `${defaultEntries} 条`]],
    ['docs/specs/rules.md', [`${totalSets} 个规则集、${totalEntries} 条`, `默认 ${defaultSets} 组、${defaultEntries} 条`]],
    ['docs/specs/profiles.md', [`${defaultSets} 个默认公共资源包含 ${defaultEntries} 条`]],
  ];
  for (const [file, snippets] of checks) {
    const text = await readFile(resolve(root, file), 'utf8');
    assert.doesNotMatch(text, /40\s*[个组]/, `${file} still contains legacy 40-ruleset wording`);
    for (const snippet of snippets) {
      assert.ok(text.includes(snippet), `${file} missing live count snippet: ${snippet}`);
    }
  }
});

test('all relative file links in README and docs resolve to existing paths', async () => {
  const docFiles = ['README.md', ...(await filesUnder(resolve(root, 'docs'))).filter(file => file.endsWith('.md')).map(file => `docs/${file}`)];
  for (const relativeFile of docFiles) {
    const fullFile = resolve(root, relativeFile);
    const raw = await readFile(fullFile, 'utf8');
    // Strip fenced code blocks before scanning inline links.
    const prose = raw.replace(/~~~[\s\S]*?~~~|```[\s\S]*?```/g, '');
    for (const match of prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const href = match[1].trim();
      if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const cleanPath = href.split('#')[0].split('?')[0];
      if (!cleanPath) continue;
      const target = resolve(dirname(fullFile), cleanPath);
      assert.equal(await exists(target), true, `Broken link in ${relativeFile}: ${href}`);
    }
  }
});
