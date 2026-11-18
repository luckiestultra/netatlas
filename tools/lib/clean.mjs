import { lstat, readdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertManagedPaths } from './managed-paths.mjs';

async function statOrNull(target) {
  try { return await lstat(target); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function pruneSubdirectories(root, relativeParent, { keep = 2, preserve = new Set() } = {}) {
  await assertManagedPaths(root, [relativeParent]);
  const parent = resolve(root, relativeParent);
  const parentStat = await statOrNull(parent);
  if (!parentStat) return 0;
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error(`Expected real cache directory: ${parent}`);
  const entries = await readdir(parent, { withFileTypes: true });
  const candidates = [];
  let removed = 0;
  for (const entry of entries) {
    const fullPath = resolve(parent, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in cache trees: ${fullPath}`);
    if (preserve.has(entry.name)) continue;
    if (!entry.isDirectory()) {
      await rm(fullPath, { force: true });
      removed += 1;
      continue;
    }
    const info = await lstat(fullPath);
    candidates.push({ name: entry.name, fullPath, mtimeMs: info.mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name, 'en'));
  for (const item of candidates.slice(Math.max(0, keep))) {
    await rm(item.fullPath, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

async function referencedReportEntries(nativeCheckRoot) {
  const nativePreserve = new Set(['latest.json']);
  const privatePreserve = new Set();
  const latestPath = resolve(nativeCheckRoot, 'latest.json');
  const info = await statOrNull(latestPath);
  if (!info || info.isSymbolicLink() || !info.isFile()) return { nativePreserve, privatePreserve };
  const raw = await readFile(latestPath, 'utf8');
  for (const match of raw.matchAll(/\.cache\/native-check\/([^/"\\\s]+)(?:\/|")/g)) {
    if (match[1] && match[1] !== '.' && match[1] !== '..') nativePreserve.add(match[1]);
  }
  for (const match of raw.matchAll(/"private\/(workflow-[A-Za-z0-9]{6})(?:\/|")/g)) {
    privatePreserve.add(match[1]);
  }
  return { nativePreserve, privatePreserve };
}

async function cleanStalePrivateWorkflows(root, preserve = new Set()) {
  const privateDir = resolve(root, 'private');
  const info = await statOrNull(privateDir);
  if (!info) return 0;
  await assertManagedPaths(root, ['private']);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Refusing non-directory or symlink private root: ${privateDir}`);
  let removed = 0;
  for (const entry of await readdir(privateDir, { withFileTypes: true })) {
    // Strictly touch only synthetic mkdtemp fixture directories; never touch user files.
    if (!/^(?:workflow|acceptance)-[A-Za-z0-9]{6}$/.test(entry.name) || preserve.has(entry.name)) continue;
    const fullPath = resolve(privateDir, entry.name);
    if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
    await rm(fullPath, { recursive: true, force: true });
    removed += 1;
  }
  if ((await readdir(privateDir)).length === 0) await rm(privateDir, { recursive: true, force: true });
  return removed;
}

export async function cleanCache(root, { all = false, keepBuildBackups = 1 } = {}) {
  await assertManagedPaths(root, ['.cache']);
  const cacheRoot = resolve(root, '.cache');
  const rootStat = await statOrNull(cacheRoot);
  let removed = 0;
  const nativeRoot = resolve(cacheRoot, 'native-check');
  const { nativePreserve, privatePreserve } = rootStat && !all && await statOrNull(nativeRoot)
    ? await referencedReportEntries(nativeRoot)
    : { nativePreserve: new Set(['latest.json']), privatePreserve: new Set() };

  removed += await cleanStalePrivateWorkflows(root, all ? new Set() : privatePreserve);
  if (!rootStat) return { removed };
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`Refusing non-directory or symlink cache root: ${cacheRoot}`);

  const topEntries = await readdir(cacheRoot, { withFileTypes: true });
  if (all) {
    for (const entry of topEntries) {
      const fullPath = resolve(cacheRoot, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in cache trees: ${fullPath}`);
      if (entry.name === 'sync.lock') continue;
      await rm(fullPath, { recursive: true, force: true });
      removed += 1;
    }
    return { removed };
  }

  const allowedTop = new Set(['bin', 'native-tools', 'native-check', 'build', 'sync', 'sync.lock']);
  for (const entry of topEntries) {
    const fullPath = resolve(cacheRoot, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in cache trees: ${fullPath}`);
    if (!allowedTop.has(entry.name)) {
      await rm(fullPath, { recursive: true, force: true });
      removed += 1;
    }
  }

  removed += await pruneSubdirectories(root, '.cache/build', { keep: keepBuildBackups });
  removed += await pruneSubdirectories(root, '.cache/sync', { keep: 1 });
  if (await statOrNull(nativeRoot)) {
    removed += await pruneSubdirectories(root, '.cache/native-check', { keep: 0, preserve: nativePreserve });
  }
  return { removed };
}
