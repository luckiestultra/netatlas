// SPDX-License-Identifier: MIT
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

export function renderRewriteActions(client) {
  if (client !== 'quantumultX') return [];
  const result = buildSync({ absWorkingDir: fileURLToPath(new URL('../../', import.meta.url)), entryPoints: ['src/features/rewrite-actions/main.mjs'], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2020', minify: true, legalComments: 'inline', banner: { js: '/*! NetAtlas static rewrite actions; SPDX-License-Identifier: MIT */' }, logLevel: 'silent' });
  return [{ path: 'scripts/rewrite-actions.js', content: result.outputFiles[0].text }];
}
