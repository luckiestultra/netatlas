import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';
import { normalizeEntry, normalizeRuleset, stableId } from './rules.mjs';
import { assertManagedPaths } from './managed-paths.mjs';
import { withSyncLock } from './sync-lock.mjs';
import { parseClassicalYaml } from './classical-source.mjs';
import { loadRuleSupplement } from './rule-supplements.mjs';

const limits = { maxDepth: 20, maxFiles: 512, maxVisits: 4096, maxEntries: 250_000, maxFileBytes: 1_000_000, maxTotalBytes: 24_000_000 };
// CN includes share source files with service lists but need more than 512
// downloads across the whole catalog. Each include closure remains capped at 512.
const maxDownloadFiles = 1024;
const licenses = new Set(['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC', 'CC0-1.0', 'GPL-2.0-only']);
const hardMaxFileBytes = 4_000_000;
const listName = /^[a-z0-9][a-z0-9.!_-]*$/;
const sha256 = content => createHash('sha256').update(content).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';

function validList(name) {
  return typeof name === 'string' && listName.test(name) && !name.includes('..');
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
}

function fileBudget(value = limits.maxFileBytes) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > hardMaxFileBytes) throw new Error('Invalid source file budget; absolute limit is 4 MB');
  return value;
}

function sourcePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 || value.split('/').some(part => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part) || part.includes('..'))) throw new Error('Invalid registered source path');
  return value;
}

export function parseCidrLines(text, file, matchType) {
  if (!['ip-cidr', 'ip-cidr6'].includes(matchType)) throw new Error('CIDR lines require an explicit address-family type');
  const entries=[];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const value=raw.trim();
    if (!value || value.startsWith('#')) continue;
    if (!value.includes('/') || /\s/.test(value) || isIP(value.split('/')[0]) !== (matchType==='ip-cidr'?4:6)) throw new Error(`${file}:${index+1}: Invalid CIDR address family`);
    const entry=normalizeEntry({type:matchType,value});
    if(entry.value!==value) throw new Error(`${file}:${index+1}: CIDR must be canonical`);
    entries.push(entry);
    if(entries.length>limits.maxEntries)throw new Error('CIDR entry limit exceeded');
  }
  if(!entries.length)throw new Error(`${file}: Empty CIDR source`);
  return {entries:normalizeRuleset({version:1,id:'cidr-lines',category:'network',entries}).entries,rawEntryCount:entries.length};
}

function parseDomainLines(text, file, matchType, linePrefix = '') {
  if (!['domain', 'domain-suffix'].includes(matchType)) throw new Error('Domain-line sources require an explicit supported match type');
  if (!['', '.'].includes(linePrefix) || (linePrefix === '.' && matchType !== 'domain-suffix')) throw new Error('Invalid domain-line prefix or match type');
  const entries = [];
  let declaredCount;
  for (const [index, original] of text.split(/\r?\n/).entries()) {
    let value = original.trim();
    if (!value) continue;
    if (value.startsWith('#')) {
      if (value.startsWith('#TOTAL_LINES')) {
        const count = /^#TOTAL_LINES=(0|[1-9][0-9]*)$/.exec(value);
        if (!count || declaredCount !== undefined || !Number.isSafeInteger(Number(count[1]))) throw new Error(`${file}:${index + 1}: Invalid domain-line count header`);
        declaredCount = Number(count[1]);
      }
      continue;
    }
    if (linePrefix) {
      if (!value.startsWith(linePrefix)) throw new Error(`${file}:${index + 1}: Missing registered domain-line prefix`);
      value = value.slice(linePrefix.length);
    }
    if (isIP(value) || /[\s*:@/#\\]/.test(value) || value.startsWith('.') || value.endsWith('.')) throw new Error(`${file}:${index + 1}: Invalid domain line`);
    entries.push({ type: matchType, value });
    if (entries.length > limits.maxEntries) throw new Error('Domain-line entry count limit exceeded');
  }
  if (declaredCount !== undefined && declaredCount !== entries.length) throw new Error(`${file}: Domain-line count header does not match the data`);
  const normalized = normalizeRuleset({ version: 1, id: 'domain-lines', category: 'portable', entries });
  return { entries: normalized.entries, rawEntryCount: entries.length };
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

function sourceLists(value) {
  const names = Array.isArray(value) ? value : [value];
  if (!names.length || names.length > 128 || names.some(name => !validList(name)) || new Set(names).size !== names.length) throw new Error('Invalid explicit source lists');
  return names;
}

const hotstarExpression = 'regexp:^hses[1-7]?\\.akamaized\\.net$';

function sourceSelection(select, roots) {
  if (select === undefined) return null;
  if (!Array.isArray(select) || !select.length || select.length > 2048) throw new Error('Invalid exact token selection');
  const wanted = new Map();
  for (const item of select) {
    if (!item || Object.keys(item).some(key => !['file', 'rule', 'attributes'].includes(key)) || !roots.includes(item.file) || typeof item.rule !== 'string') throw new Error('Invalid exact token selector');
    if (item.attributes !== undefined && (!Array.isArray(item.attributes) || !item.attributes.length || item.attributes.length > 16 || item.attributes.some(attribute => typeof attribute !== 'string' || !/^[a-z0-9!_-]+$/i.test(attribute)) || new Set(item.attributes).size !== item.attributes.length)) throw new Error('Invalid selected token attribute guard');
    const tokens = parseDomainList(item.rule, item.file);
    if (tokens.length !== 1 || tokens[0].kind === 'include' || tokens[0].sourceLine !== item.rule || tokens[0].rule !== item.rule) throw new Error('Selectors require one exact source token without annotations or includes');
    const key = `${item.file}:${item.rule}`;
    if (wanted.has(key)) throw new Error('Duplicate exact token selector');
    wanted.set(key, { found: false, attributes: item.attributes });
  }
  return wanted;
}

function sourceExpansions(expansions, exclusions) {
  if (!Array.isArray(expansions) || expansions.length > 32) throw new Error('Invalid portable expansion registration');
  const registered = new Map();
  for (const item of expansions) {
    if (!item || Object.keys(item).some(key => !['file', 'rule', 'conversion', 'reason'].includes(key)) || item.file !== 'hotstar' || item.rule !== hotstarExpression || item.conversion !== 'hotstar-hosts-v1' || typeof item.reason !== 'string' || !item.reason.trim()) throw new Error('Unproved portable expression expansion');
    const key = `${item.file}:${item.rule}`;
    if (registered.has(key) || exclusions.some(value => value.file === item.file && value.rule === item.rule)) throw new Error('Conflicting portable expansion registration');
    registered.set(key, item);
  }
  return registered;
}

export async function collectDomainList(name, options) {
  const { readFile: read, exclusions = [], select, expansions = [], ...bounds } = options;
  const roots = sourceLists(name);
  const wanted = sourceSelection(select, roots);
  const registeredExpansions = sourceExpansions(expansions, exclusions);
  const config = { ...limits, ...bounds };
  const files = new Map();
  const excluded = new Map();
  const expanded = new Map();
  const selectedTokens = new Map();
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
      const key = `${file}:${token.rule}`;
      // Exact selectors inspect only the explicitly named files. Includes do not
      // silently broaden a selected service to its entire corporate parent.
      if (wanted && !wanted.has(key)) continue;
      if (wanted) {
        const selection = wanted.get(key);
        if (selection.attributes && (selection.attributes.length !== token.attributes.length || selection.attributes.some(attribute => !token.attributes.includes(attribute)))) throw new Error(`${file}:${token.line}: Selected token attributes changed`);
        selection.found = true;
        selectedTokens.set(key, { file, line: token.line, rule: token.rule, sourceLine: token.sourceLine, ...(selection.attributes ? { attributes: token.attributes } : {}) });
      }
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
        const conversion = registeredExpansions.get(key);
        if (conversion) {
          // The fully anchored optional single digit has precisely this finite
          // language. Do not reuse this conversion for arbitrary regular expressions.
          const converted = ['', '1', '2', '3', '4', '5', '6', '7'].map(digit => ({ type: 'domain', value: `hses${digit}.akamaized.net` }));
          entries.push(...converted);
          if (entries.length > config.maxEntries) throw new Error('Expanded entry count exceeded');
          expanded.set(key, { ...conversion, line: token.line, sourceLine: token.sourceLine, entries: converted });
          continue;
        }
        const approved = exclusions.find(item => item.file === file && item.rule === token.rule && typeof item.reason === 'string' && item.reason.trim());
        if (approved) excluded.set(`${file}:${token.line}`, { file, line: token.line, rule: token.rule, sourceLine: token.sourceLine, reason: approved.reason });
        else if (token.kind === 'keyword') {
          entries.push(normalizeEntry({ type: 'domain-keyword', value: token.value }));
          if (entries.length > config.maxEntries) throw new Error('Expanded entry count exceeded');
        } else throw new Error(`${file}:${token.line}: Unsupported ${token.rule}; review an exact portable exclusion before updating`);
      }
    }
  }
  for (const root of roots) await visit(root, [], []);
  if (wanted && [...wanted.values()].some(item => !item.found)) throw new Error('A registered selected token is missing from its source file');
  if ([...registeredExpansions.keys()].some(key => !expanded.has(key))) throw new Error('A registered portable expansion is missing from the selected source');
  const normalized = normalizeRuleset({ version: 1, id: 'collected', category: 'portable', entries });
  return {
    entries: normalized.entries,
    files: [...files].map(([file, value]) => ({ file, sha256: value.sha256 })).sort((a, b) => a.file.localeCompare(b.file, 'en')),
    excluded: [...excluded.values()].sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`, 'en')),
    expanded: [...expanded.values()].sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`, 'en')),
    selectedTokens: [...selectedTokens.values()].sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`, 'en')),
    attributeFiltered,
    affiliationDeclarations
  };
}

export async function fetchBoundedText(url, { maxBytes = limits.maxFileBytes, timeoutMs = 15_000 } = {}) {
  fileBudget(maxBytes);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['raw.githubusercontent.com', 'api.github.com'].includes(parsed.hostname) || parsed.username || parsed.password) {
    throw new Error('Only registered HTTPS GitHub source endpoints are allowed');
  }
  const response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'netatlas-rule-sync', Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${url}`);
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error(`Source response size exceeded: ${url}`);
  }
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
  await assertManagedPaths(root, ['metadata/upstreams.json', 'src/rules', '.cache/sync']);
  const metadata = path.join(root, 'metadata', 'upstreams.json');
  if (expectedMetadataSha256 && sha256(await readFile(metadata)) !== expectedMetadataSha256) throw new Error('Source metadata changed during sync');
  for (const [relative, expected] of expectedSourceHashes || []) {
    const current = await readFile(path.join(root, 'src', 'rules', relative)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if ((current === null ? null : sha256(current)) !== expected) throw new Error(`Managed source changed during sync: ${relative}`);
  }
}

export async function recoverPublication(root, options = {}) {
  return withSyncLock(root, assertOwned => recoverPublicationLocked(root, options, assertOwned));
}

async function recoverPublicationLocked(root, { dryRun = false } = {}, assertOwned) {
  await assertOwned();
  await assertManagedPaths(root, ['metadata/upstreams.json', 'src/rules', '.cache/sync']);
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

export async function publishCatalog(root, outputs, metadataText, options = {}) {
  return withSyncLock(root, assertOwned => publishCatalogLocked(root, outputs, metadataText, options, assertOwned));
}

async function publishCatalogLocked(root, outputs, metadataText, { expectedMetadataSha256, expectedSourceHashes } = {}, assertOwned) {
  await assertManagedPaths(root, ['metadata/upstreams.json', 'src/rules', '.cache/sync']);
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
    await assertOwned();
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

export async function syncCatalog(options = {}) {
  if (!options.root) throw new Error('A repository root is required');
  return withSyncLock(options.root, assertOwned => syncCatalogLocked(options, assertOwned));
}

async function syncCatalogLocked({ root, revision, repository, latest = false, dryRun = false, fetchText = fetchBoundedText }, assertOwned) {
  await assertManagedPaths(root, ['metadata/upstreams.json', 'src/rules', '.cache/sync']);
  if (revision && latest) throw new Error('Use --revision or --latest, not both');
  const metadataPath = path.join(root, 'metadata', 'upstreams.json');
  if ((await exists(metadataPath))?.isSymbolicLink()) throw new Error('Refusing a symlink for source metadata');
  const originalMetadata = await readFile(metadataPath, 'utf8');
  const registry = JSON.parse(originalMetadata);
  if (registry.version !== 1 || !Array.isArray(registry.repositories) || registry.repositories.length > 8 || !Array.isArray(registry.rulesets) || registry.rulesets.length > 512) throw new Error('Invalid source registry');
  if (repository !== undefined && (!stableId.test(repository) || !registry.repositories.some(repo => repo.id === repository))) throw new Error(`Unknown repository selector: ${repository}`);
  if (repository && !revision && !latest) throw new Error('A repository selector requires --latest or --revision');
  if (revision && registry.repositories.length > 1 && !repository) throw new Error('Multiple repositories require --repository with --revision');
  // Reject ambiguous version operations before recovery can write any journal or directory.
  await recoverPublicationLocked(root, { dryRun }, assertOwned);
  await rejectSymlinks(path.join(root, 'src', 'rules'));
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
  async function download(url, { maxBytes = limits.maxFileBytes } = {}) {
    fileBudget(maxBytes);
    if (!cache.has(url)) {
      if (cache.size >= maxDownloadFiles) throw new Error('Total source file count exceeded');
      cache.set(url, (async () => {
        const text = await fetchText(url, { maxBytes });
        if (typeof text !== 'string' || Buffer.byteLength(text) > maxBytes) throw new Error('Source response size exceeded');
        downloadedBytes += Buffer.byteLength(text);
        if (downloadedBytes > limits.maxTotalBytes) throw new Error('Total source size exceeded');
        return text;
      })());
    }
    const text = await cache.get(url);
    if (Buffer.byteLength(text) > maxBytes) throw new Error('Cached source response size exceeded');
    return text;
  }
  for (const repo of registry.repositories) {
    if (!stableId.test(repo.id) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.repository) || !licenses.has(repo.license) || typeof repo.author !== 'string' || !repo.author.trim()) throw new Error('Unapproved repository, author, or license');
    if (repositories.has(repo.id)) throw new Error(`Duplicate repository id: ${repo.id}`);
    const previousRevision = repo.revision;
    const selectedRepository = repository === undefined || repo.id === repository;
    if (latest && selectedRepository) {
      if (!/^[A-Za-z0-9_.-]+$/.test(repo.branch || 'master')) throw new Error('Invalid upstream branch');
      const ref = JSON.parse(await download(`https://api.github.com/repos/${repo.repository}/git/ref/heads/${repo.branch || 'master'}`));
      repo.revision = ref.object?.sha;
    } else if (revision && selectedRepository) repo.revision = revision;
    if (!/^[0-9a-f]{40}$/.test(repo.revision)) throw new Error('Sources must use a pinned full commit SHA');
    if (repo.revision !== previousRevision || !validDate(repo.revisionDate)) {
      if (!selectedRepository) throw new Error(`Unselected repository needs a valid pinned date: ${repo.id}`);
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
    const unselectedMetadata = repository && item.source?.repository !== repository ? json(item) : null;
    let ruleset;
    if (item.source?.type === 'local') {
      if (['lists', 'select', 'expansions', 'localSupplement'].some(key => item.source[key] !== undefined)) throw new Error('Upstream selection fields are not valid for a local source');
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
      const format = item.source.format ?? 'domain-list-community';
      if(format!=='classical-yaml'&&item.source.selectPayload!==undefined)throw new Error('Classical payload selection requires classical-yaml format');
      if(format!=='classical-yaml'&&item.source.localSupplement!==undefined)throw new Error('Local rule supplements require classical-yaml format');
      if (format !== 'domain-list-community' && ['lists', 'select', 'expansions'].some(key => item.source[key] !== undefined)) throw new Error('DLC union, selection and expansion fields require domain-list-community format');
      if (format === 'classical-yaml') {
        if(item.exclusions?.length||item.source.linePrefix!==undefined||item.source.matchType!==undefined)throw new Error('Classical sources require exact supported payload conditions');
        const file=sourcePath(item.source.path),url=`https://raw.githubusercontent.com/${repo.repository}/${repo.revision}/${file}`;
        const text=await download(url,{maxBytes:fileBudget(item.source.maxFileBytes)});
        const collected=parseClassicalYaml(text,file,item.source.selectPayload);
        const supplement=item.source.localSupplement===undefined?null:await loadRuleSupplement(root,item.source.localSupplement,item.id);
        ruleset=normalizeRuleset({version:1,id:item.id,category:item.category,entries:[...collected.entries,...(supplement?.entries??[])]});
        item.files=[{path:file,url,sha256:sha256(text)}];
        item.appliedExclusions=[];item.attributeFiltered=0;item.affiliationDeclarations=0;
        item.rawEntryCount=collected.rawEntryCount;
        if(item.source.selectPayload!==undefined)item.selectedTokens=collected.selectedTokens;
        else delete item.selectedTokens;
        item.selection=item.source.selectPayload!==undefined?'exact registered payload tokens; unrelated conditions are not included':'complete five-type classical YAML payload; unsupported conditions fail closed';
        if(supplement){
          item.localSupplement={path:supplement.path,sha256:supplement.sha256,license:supplement.license,entryCount:supplement.entries.length,updatedAt:supplement.updatedAt};
          item.selection+='; separately attributed original exact-host supplement';
        }else delete item.localSupplement;
      } else if (format === 'domain-lines' || format === 'cidr-lines') {
        const file = sourcePath(item.source.path);
        const maxBytes = fileBudget(item.source.maxFileBytes);
        if (item.exclusions?.length) throw new Error('Domain-line sources do not allow silent expression exclusions');
        const url = `https://raw.githubusercontent.com/${repo.repository}/${repo.revision}/${file}`;
        const text = await download(url, { maxBytes });
        if(format==='cidr-lines'&&item.source.linePrefix!==undefined)throw new Error('CIDR-line sources do not support prefixes');
        const collected = format==='cidr-lines'?parseCidrLines(text,file,item.source.matchType):parseDomainLines(text, file, item.source.matchType, item.source.linePrefix);
        ruleset = normalizeRuleset({ version: 1, id: item.id, category: item.category, entries: collected.entries });
        item.files = [{ path: file, url, sha256: sha256(text) }];
        item.appliedExclusions = [];
        item.attributeFiltered = 0;
        item.affiliationDeclarations = 0;
        item.rawEntryCount = collected.rawEntryCount;
        item.selection = `complete registered ${format==='cidr-lines'?'CIDR':'domain'}-line file; explicit ${item.source.matchType} semantics`;
      } else if (format === 'domain-list-community') {
        if (item.source.maxFileBytes !== undefined) throw new Error('File budget overrides require registered domain-lines format');
        if (item.source.linePrefix !== undefined) throw new Error('Line prefixes require registered domain-lines format');
        const base = `https://raw.githubusercontent.com/${repo.repository}/${repo.revision}/data/`;
        if ((item.source.list === undefined) === (item.source.lists === undefined)) throw new Error('A DLC source requires exactly one of list or lists');
        if (item.source.list !== undefined && typeof item.source.list !== 'string') throw new Error('DLC list must be a single registered name');
        if (item.source.lists !== undefined && !Array.isArray(item.source.lists)) throw new Error('DLC lists must be an explicit array');
        const collected = await collectDomainList(item.source.list ?? item.source.lists, { readFile: name => download(base + name), exclusions: item.exclusions || [], select: item.source.select, expansions: item.source.expansions });
        ruleset = normalizeRuleset({ version: 1, id: item.id, category: item.category, entries: collected.entries });
        item.files = collected.files.map(file => ({ path: `data/${file.file}`, url: base + file.file, sha256: file.sha256 }));
        item.appliedExclusions = collected.excluded;
        item.attributeFiltered = collected.attributeFiltered;
        item.affiliationDeclarations = collected.affiliationDeclarations;
        if (item.source.expansions !== undefined) item.appliedExpansions = collected.expanded;
        else delete item.appliedExpansions;
        if (item.source.select !== undefined) item.selectedTokens = collected.selectedTokens;
        else delete item.selectedTokens;
        item.selection = item.source.select !== undefined ? 'exact registered portable tokens in named files; includes are not expanded' : item.source.lists !== undefined ? 'explicit named source union and include closures; not global affiliation expansion' : 'selected files and explicit includes; not global affiliation expansion';
      } else {
        throw new Error(`Unregistered rule source format: ${format}`);
      }
      item.updatedAt = repo.revisionDate;
    }
    if (ruleset.id !== item.id || ruleset.category !== item.category) throw new Error(`First-party source identity mismatch: ${item.id}`);
    const content = json(ruleset);
    outputs.set(relative, content);
    item.outputSha256 = sha256(content);
    item.entryCount = ruleset.entries.length;
    if (unselectedMetadata !== null && (current !== content || json(item) !== unselectedMetadata)) throw new Error(`Unselected source changed during validation: ${item.id}; initialize or review the full catalog separately`);
    report.push({ id: item.id, entries: item.entryCount, excluded: item.appliedExclusions.length, changed: current !== content });
  }
  const newMetadata = json(registry);
  const changed = report.some(item => item.changed) || newMetadata !== originalMetadata;
  const expectedMetadataSha256 = sha256(originalMetadata);
  await verifyInputs(root, expectedMetadataSha256, expectedSourceHashes);
  if (!dryRun && changed) await publishCatalogLocked(root, outputs, newMetadata, { expectedMetadataSha256, expectedSourceHashes }, assertOwned);
  return { dryRun, changed, repositories: [...repositories.values()].map(repo => ({ id: repo.id, revision: repo.revision })), downloadedFiles: cache.size, downloadedBytes, rulesets: report };
}
