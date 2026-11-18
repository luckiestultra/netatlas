import { resolve } from 'node:path';
import { cleanCache } from './lib/clean.mjs';

const root = resolve(import.meta.dirname, '..');
try {
  const args = process.argv.slice(2);
  let all = false, keepBuildBackups = 1;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--all') all = true;
    else if (arg === '--keep-backups' && args.length) {
      keepBuildBackups = Number(args.shift());
      if (!Number.isInteger(keepBuildBackups) || keepBuildBackups < 0) throw new Error('--keep-backups requires a non-negative integer');
    } else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  const result = await cleanCache(root, { all, keepBuildBackups });
  console.log(`Cleaned .cache (${all ? 'all removable entries' : 'stale backups and scratch entries'}): ${result.removed} item(s) removed.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
