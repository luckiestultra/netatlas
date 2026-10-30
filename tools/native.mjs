import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNativeVerification } from './lib/native.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  if (process.argv.length > 2) throw new Error('Usage: node tools/native.mjs');
  const report = await runNativeVerification({ root, onProgress: message => process.stderr.write(`${message}\n`) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
