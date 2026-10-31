import { lstat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// Check managed components below the chosen repository root, including parents.
// Host-level aliases such as macOS /tmp are outside this repository boundary.
export async function assertManagedPaths(root, paths) {
  const base = resolve(root);
  const baseStat = await lstat(base);
  if (baseStat.isSymbolicLink() || !baseStat.isDirectory()) throw new Error('Repository root must be a real directory, not a symlink');
  for (const path of paths) {
    const target = resolve(base, path);
    const local = relative(base, target);
    if (local === '..' || local.startsWith('..' + sep) || isAbsolute(local)) throw new Error('Managed path escapes the repository');
    let current = base;
    const parts = local.split(sep).filter(Boolean);
    for (const [index, part] of parts.entries()) {
      current = resolve(current, part);
      const stat = await lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!stat) break;
      if (stat.isSymbolicLink()) throw new Error(`Refusing a symlink in managed paths: ${current}`);
      if (index < parts.length - 1 && !stat.isDirectory()) throw new Error(`Managed path parent is not a directory: ${current}`);
    }
  }
}
