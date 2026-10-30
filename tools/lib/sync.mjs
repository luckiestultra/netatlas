import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeRuleset, stableId } from './rules.mjs';

const limits = { maxDepth: 20, maxFiles: 512, maxVisits: 4096, maxEntries: 250_000, maxFileBytes: 1_000_000, maxTotalBytes: 24_000_000 };
const licenses = new Set(['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC', 'CC0-1.0']);
const listName = /^[a-z0-9][a-z0-9.!_-]*$/;
const sha256 = content => createHash('sha256').update(content).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';

function validList(name) {
  return typeof name === 'string' && listName.test(name) && !name.includes('..');
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
}

export function parseDomainList(text, file) {
  const tokens = [];
  for (const [index, original] of text.split(/\r?\n/).entries()) {
    const raw = original.split('#', 1)[0].trim();
    if (!raw) continue;
    const split = raw.search(/\s+[@&]/);
    const expression = split === -1 ? raw : raw.slice(0, split);
    const annotations = split === -1 ? [] : raw.slice(split).trim().split(/\s+/);
    const attributes = [];
    const affiliations = [];
    for (const annotation of annotations) {
      if (/^@[a-z0-9!_-]+$/i.test(annotation)) attributes.push(annotation.slice(1));
      else if (/^&[a-z0-9.!_-]+$/i.test(annotation)) affiliations.push(annotation.slice(1));
      else throw new Error(`${file}:${index + 1}: Unexpected annotation ${annotation}`);
    }
    const match = /^([a-z]+):(.*)$/.exec(expression);
    const kind = match ? match[1] : 'domain';
    const value = match ? match[2] : expression;
    if (!['domain', 'full', 'include', 'regexp', 'keyword'].includes(kind) || !value) {
      throw new Error(`${file}:${index + 1}: Unsupported expression ${expression}`);
    }
    if (kind === 'include' && !validList(value)) throw new Error(`${file}:${index + 1}: Invalid include ${value}`);
    if (!['regexp', 'keyword'].includes(kind) && /\s/.test(value)) throw new Error(`${file}:${index + 1}: Unexpected whitespace in ${expression}`);
    tokens.push({ kind, value, attributes, affiliations, line: index + 1, rule: expression, sourceLine: raw });
  }
  return tokens;
}

function selected(attributes, filters) {
  return filters.every(filter => filter.startsWith('-') ? !attributes.includes(filter.slice(1)) : attributes.includes(filter));
}

export async function collectDomainList(name, options) {
  const { readFile: read, exclusions = [], ...bounds } = options;
  const config = { ...limits, ...bounds };
  const files = new Map();
  const excluded = new Map();
  const entries = [];
  let totalBytes = 0;
  let attributeFiltered = 0;
  let affiliationDeclarations = 0;
  let visits = 0;
  async function visit(file, stack, filters) {
    if (!validList(file)) throw new Error(`Invalid include name: ${file}`);
    if (stack.includes(file)) throw new Error(`Include cycle: ${[...stack, file].join(' -> ')}`);
    if (stack.length > config.maxDepth) throw new Error(`Include depth exceeded at ${file}`);
    if (++visits > config.maxVisits) throw new Error('Include expansion count exceeded');
    if (!files.has(file)) {
      if (files.size >= config.maxFiles) throw new Error('Source file count exceeded');
      const text = await read(file);
      if (typeof text !== 'string') throw new Error(`Source file not found: ${file}`);
      const bytes = Buffer.byteLength(text);
      if (bytes > config.maxFileBytes) throw new Error(`Source file size exceeded: ${file}`);
      totalBytes += bytes;
      if (totalBytes > config.maxTotalBytes) throw new Error('Total source size exceeded');
      files.set(file, { text, sha256: sha256(text) });
    }
    for (const token of parseDomainList(files.get(file).text, file)) {
      if (token.kind === 'include') {
        await visit(token.value, [...stack, file], [...filters, ...token.attributes]);
        continue;
      }
      if (!selected(token.attributes, filters)) { attributeFiltered++; continue; }
      affiliationDeclarations += token.affiliations.length;
      if (token.kind === 'domain' || token.kind === 'full') {
        entries.push({ type: token.kind === 'full' ? 'domain' : 'domain-suffix', value: token.value });
        if (entries.length > config.maxEntries) throw new Error('Expanded entry count exceeded');
      } else {
        const approved = exclusions.find(item => item.file === file && item.rule === token.rule && typeof item.reason === 'string' && item.reason.trim());
        if (!approved) throw new Error(`${file}:${token.line}: Unsupported ${token.rule}; review an exact portable exclusion before updating`);
        excluded.set(`${file}:${token.line}`, { file, line: token.line, rule: token.rule, sourceLine: token.sourceLine, reason: approved.reason });
      }
    }
  }
  await visit(name, [], []);
  const normalized = normalizeRuleset({ version: 1, id: 'collected', category: 'portable', entries });
  return {
    entries: normalized.entries,
    files: [...files].map(([file, value]) => ({ file, sha256: value.sha256 })).sort((a, b) => a.file.localeCompare(b.file, 'en')),
    excluded: [...excluded.values()].sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`, 'en')),
    attributeFiltered,
    affiliationDeclarations
  };
}

export async function fetchBoundedText(url, { maxBytes = limits.maxFileBytes, timeoutMs = 15_000 } = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['raw.githubusercontent.com', 'api.github.com'].includes(parsed.hostname) || parsed.username || parsed.password) {
    throw new Error('Only registered HTTPS GitHub source endpoints are allowed');
  }
  const response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'netatlas-rule-sync', Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${url}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(`Source response size exceeded: ${url}`);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error(`Source response size exceeded: ${url}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function exists(file) {
  try { return await lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function rejectSymlinks(dir) {
  const stat = await exists(dir);
  if (!stat) return;
  if (stat.isSymbolicLink()) throw new Error(`Refusing a symlink in managed rule paths: ${dir}`);
  if (stat.isDirectory()) for (const item of await readdir(dir)) await rejectSymlinks(path.join(dir, item));
}

async function verifyInputs(root, expectedMetadataSha256, expectedSourceHashes) {
  const metadata = path.join(root, 'metadata', 'upstreams.json');
  if (expectedMetadataSha256 && sha256(await readFile(metadata)) !== expectedMetadataSha256) throw new Error('Source metadata changed during sync');
  for (const [relative, expected] of expectedSourceHashes || []) {
    const current = await readFile(path.join(root, 'src', 'rules', relative)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if ((current === null ? null : sha256(current)) !== expected) throw new Error(`Managed source changed during sync: ${relative}`);
  }
}

export async function recoverPublication(root, { dryRun = false } = {}) {
  if ((await exists(path.join(root, '.cache')))?.isSymbolicLink()) throw new Error('Refusing a symlink for the cache root');
  const cache = path.join(root, '.cache', 'sync');
  const stat = await exists(cache);
  if (!stat) return;
  if (stat.isSymbolicLink()) throw new Error('Refusing a symlink for the sync cache');
  const rules = path.join(root, 'src', 'rules');
  const metadata = path.join(root, 'metadata', 'upstreams.json');
  for (const name of (await readdir(cache)).filter(name => name.startsWith('batch-')).sort()) {
    const dir = path.join(cache, name);
    if ((await lstat(dir)).isSymbolicLink()) throw new Error('Refusing a symlink for a sync batch');
    const journalPath = path.join(dir, 'publication.json');
    if ((await exists(journalPath))?.isSymbolicLink()) throw new Error('Refusing a symlink for a sync journal');
    const journal = await readFile(journalPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!journal || journal.state !== 'pending') continue;
    const current = sha256(await readFile(metadata));
    if (current === journal.newMetadataSha256) {
      if (!dryRun) await writeFile(journalPath, json({ ...journal, state: 'complete' }));
      continue;
    }
    if (current !== journal.oldMetadataSha256) throw new Error(`Pending rule publication conflicts with local metadata; inspect ${dir}`);
    if (dryRun) throw new Error('Interrupted rule publication detected; run sync without --dry-run to restore the previous catalog');
    const backup = path.join(dir, 'previous-rules');
    const staged = path.join(dir, 'rules');
    if (await exists(backup)) {
      if (await exists(rules)) await rename(rules, path.join(dir, 'interrupted-rules'));
      await rename(backup, rules);
    } else if (!journal.hadPreviousRules && !(await exists(staged)) && await exists(rules)) {
      await rename(rules, path.join(dir, 'interrupted-rules'));
    }
    await writeFile(journalPath, json({ ...journal, state: 'recovered' }));
  }
}

export async function publishCatalog(root, outputs, metadataText, { expectedMetadataSha256, expectedSourceHashes } = {}) {
  const rules = path.join(root, 'src', 'rules');
  const metadata = path.join(root, 'metadata', 'upstreams.json');
  await rejectSymlinks(rules);
  const metadataStat = await exists(metadata);
  if (metadataStat?.isSymbolicLink()) throw new Error('Refusing a symlink for source metadata');
  for (const relative of outputs.keys()) if (!/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\.json$/.test(relative)) throw new Error(`Invalid managed rule path: ${relative}`);
  const cacheRootStat = await exists(path.join(root, '.cache'));
  if (cacheRootStat?.isSymbolicLink()) throw new Error('Refusing a symlink for the cache root');
  const cache = path.join(root, '.cache', 'sync');
  if ((await exists(cache))?.isSymbolicLink()) throw new Error('Refusing a symlink for the sync cache');
  await mkdir(cache, { recursive: true });
  const stage = await mkdtemp(path.join(cache, 'batch-'));
  const stagedRules = path.join(stage, 'rules');
  const previousRules = path.join(stage, 'previous-rules');
  const previousExists = Boolean(await exists(rules));
  if (previousExists) await cp(rules, stagedRules, { recursive: true });
  else await mkdir(stagedRules, { recursive: true });
  for (const [relative, content] of outputs) {
    const target = path.join(stagedRules, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  await writeFile(path.join(stage, 'upstreams.json'), metadataText);
  const journalPath = path.join(stage, 'publication.json');
  const journal = { state: 'pending', hadPreviousRules: previousExists, oldMetadataSha256: sha256(await readFile(metadata)), newMetadataSha256: sha256(metadataText) };
  await writeFile(journalPath, json(journal));
  await mkdir(path.dirname(rules), { recursive: true });
  let movedPrevious = false;
  let installed = false;
  let committed = false;
  try {
    await verifyInputs(root, expectedMetadataSha256, expectedSourceHashes);
    if (previousExists) { await rename(rules, previousRules); movedPrevious = true; }
    await rename(stagedRules, rules);
    installed = true;
    await rename(path.join(stage, 'upstreams.json'), metadata);
    committed = true;
    await writeFile(journalPath, json({ ...journal, state: 'complete' }));
  } catch (error) {
    if (!committed) {
      if (installed) await rename(rules, path.join(stage, 'failed-rules'));
      if (movedPrevious) await rename(previousRules, rules);
      await writeFile(journalPath, json({ ...journal, state: 'rolled-back' }));
    }
    throw error;
  }
  // Previous batches stay in the ignored cache as recoverable local backups.
}

export async function syncCatalog({ root, revision, latest = false, dryRun = false, fetchText = fetchBoundedText } = {}) {
  if (!root) throw new Error('A repository root is required');
  if (revision && latest) throw new Error('Use --revision or --latest, not both');
  await recoverPublication(root, { dryRun });
  await rejectSymlinks(path.join(root, 'src', 'rules'));
  const metadataPath = path.join(root, 'metadata', 'upstreams.json');
  if ((await exists(metadataPath))?.isSymbolicLink()) throw new Error('Refusing a symlink for source metadata');
  const originalMetadata = await readFile(metadataPath, 'utf8');
  const registry = JSON.parse(originalMetadata);
  if (registry.version !== 1 || !Array.isArray(registry.repositories) || registry.repositories.length > 8 || !Array.isArray(registry.rulesets) || registry.rulesets.length > 512) throw new Error('Invalid source registry');
  const originals = new Map();
  const expectedSourceHashes = new Map();
  const ids = new Set();
  for (const item of registry.rulesets) {
    if (!stableId.test(item.id) || !stableId.test(item.category) || ids.has(item.id)) throw new Error(`Invalid or duplicate ruleset id: ${item.id}`);
    ids.add(item.id);
    const relative = `${item.category}/${item.id}.json`;
    const current = await readFile(path.join(root, 'src', 'rules', relative), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    originals.set(relative, current);
    expectedSourceHashes.set(relative, current === null ? null : sha256(current));
  }
  const repositories = new Map();
  const cache = new Map();
  let downloadedBytes = 0;
  async function download(url) {
    if (!cache.has(url)) {
      if (cache.size >= limits.maxFiles) throw new Error('Total source file count exceeded');
      cache.set(url, (async () => {
        const text = await fetchText(url);
        if (typeof text !== 'string' || Buffer.byteLength(text) > limits.maxFileBytes) throw new Error('Source response size exceeded');
        downloadedBytes += Buffer.byteLength(text);
        if (downloadedBytes > limits.maxTotalBytes) throw new Error('Total source size exceeded');
        return text;
      })());
    }
    return cache.get(url);
  }
  for (const repo of registry.repositories) {
    if (!stableId.test(repo.id) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.repository) || !licenses.has(repo.license) || typeof repo.author !== 'string' || !repo.author.trim()) throw new Error('Unapproved repository, author, or license');
    if (repositories.has(repo.id)) throw new Error(`Duplicate repository id: ${repo.id}`);
    const previousRevision = repo.revision;
    if (latest) {
      if (!/^[A-Za-z0-9_.-]+$/.test(repo.branch || 'master')) throw new Error('Invalid upstream branch');
      const ref = JSON.parse(await download(`https://api.github.com/repos/${repo.repository}/git/ref/heads/${repo.branch || 'master'}`));
      repo.revision = ref.object?.sha;
    } else if (revision) repo.revision = revision;
    if (!/^[0-9a-f]{40}$/.test(repo.revision)) throw new Error('Sources must use a pinned full commit SHA');
    if (repo.revision !== previousRevision || !validDate(repo.revisionDate)) {
      const commit = JSON.parse(await download(`https://api.github.com/repos/${repo.repository}/commits/${repo.revision}`));
      if (commit.sha !== repo.revision || !validDate(commit.commit?.committer?.date)) throw new Error('Missing pinned commit date');
      repo.revisionDate = commit.commit.committer.date;
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(repo.licensePath)) throw new Error('Invalid license path');
    const licenseUrl = `https://raw.githubusercontent.com/${repo.repository}/${repo.revision}/${repo.licensePath}`;
    if (sha256(await download(licenseUrl)) !== repo.licenseSha256) throw new Error(`Source license checksum changed: ${repo.repository}`);
    repo.licenseUrl = licenseUrl;
    repositories.set(repo.id, repo);
  }
  const outputs = new Map();
  const report = [];
  for (const item of registry.rulesets) {
    const relative = `${item.category}/${item.id}.json`;
    const current = originals.get(relative);
    let ruleset;
    if (item.source?.type === 'local') {
      if (item.source.license !== 'MIT' || typeof item.source.author !== 'string' || !item.source.author.trim() || !validDate(item.source.updatedAt) || !Array.isArray(item.source.references) || !item.source.references.length) throw new Error(`Missing first-party provenance: ${item.id}`);
      if (current === null) throw new Error(`Missing first-party source: ${relative}`);
      ruleset = normalizeRuleset(JSON.parse(current));
      item.files = [];
      item.appliedExclusions = [];
      item.attributeFiltered = 0;
      item.updatedAt = item.source.updatedAt;
    } else {
      const repo = repositories.get(item.source?.repository);
      if (!repo) throw new Error(`Unregistered source repository: ${item.id}`);
      if (current !== null && !item.outputSha256) throw new Error(`No recorded checksum for existing managed ruleset: ${relative}`);
      if (current !== null && item.outputSha256 && sha256(current) !== item.outputSha256) throw new Error(`Local changes in managed ruleset: ${relative}`);
      const base = `https://raw.githubusercontent.com/${repo.repository}/${repo.revision}/data/`;
      const collected = await collectDomainList(item.source.list, { readFile: name => download(base + name), exclusions: item.exclusions || [] });
      ruleset = normalizeRuleset({ version: 1, id: item.id, category: item.category, entries: collected.entries });
      item.files = collected.files.map(file => ({ path: `data/${file.file}`, url: base + file.file, sha256: file.sha256 }));
      item.appliedExclusions = collected.excluded;
      item.attributeFiltered = collected.attributeFiltered;
      item.affiliationDeclarations = collected.affiliationDeclarations;
      item.selection = 'selected files and explicit includes; not global affiliation expansion';
      item.updatedAt = repo.revisionDate;
    }
    if (ruleset.id !== item.id || ruleset.category !== item.category) throw new Error(`First-party source identity mismatch: ${item.id}`);
    const content = json(ruleset);
    outputs.set(relative, content);
    item.outputSha256 = sha256(content);
    item.entryCount = ruleset.entries.length;
    report.push({ id: item.id, entries: item.entryCount, excluded: item.appliedExclusions.length, changed: current !== content });
  }
  const newMetadata = json(registry);
  const changed = report.some(item => item.changed) || newMetadata !== originalMetadata;
  const expectedMetadataSha256 = sha256(originalMetadata);
  await verifyInputs(root, expectedMetadataSha256, expectedSourceHashes);
  if (!dryRun && changed) await publishCatalog(root, outputs, newMetadata, { expectedMetadataSha256, expectedSourceHashes });
  return { dryRun, changed, repositories: [...repositories.values()].map(repo => ({ id: repo.id, revision: repo.revision })), downloadedFiles: cache.size, downloadedBytes, rulesets: report };
}
