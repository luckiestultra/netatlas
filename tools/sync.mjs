#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { syncCatalog } from './lib/sync.mjs';

const args = process.argv.slice(2);
const options = { root: fileURLToPath(new URL('../', import.meta.url)) };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry-run') options.dryRun = true;
  else if (args[i] === '--latest') options.latest = true;
  else if (args[i] === '--revision' && args[i + 1]) options.revision = args[++i];
  else if (args[i] === '--repository' && args[i + 1]) options.repository = args[++i];
  else if (args[i] === '--help') {
    console.log('Usage: node tools/sync.mjs [--dry-run] [--latest | --revision <full-commit-sha>] [--repository <registered-id>]');
    process.exit(0);
  } else {
    console.error('Unknown or incomplete option: ' + args[i]);
    process.exit(1);
  }
}
try {
  console.log(JSON.stringify(await syncCatalog(options), null, 2));
} catch (error) {
  console.error('Rule sync failed: ' + error.message);
  process.exitCode = 1;
}
