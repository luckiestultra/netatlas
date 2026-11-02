// SPDX-License-Identifier: Apache-2.0
// Exact, reviewed aliases only. Source bytes and licenses are verified at build time.
const commit = '65075cdb388fc5e3094afd7e7314c67b243f3525';
const aliases = filename => ['master', 'refs/heads/master', commit].map(ref =>
  `https://raw.githubusercontent.com/Maasea/sgmodule/${ref}/Script/Youtube/${filename}`);

export const SCRIPT_RUNTIME_REGISTRY = Object.freeze(['request', 'response'].map(kind => Object.freeze({
  id: 'maasea-youtube-' + kind,
  kind,
  path: `scripts/compat-youtube-${kind}.js`,
  sourcePath: `upstream/youtube.${kind}.js`,
  sourceUrls: Object.freeze(aliases(`youtube.${kind}.js`)),
  worker: false,
  contract: 'surge',
  argumentMode: 'json-object',
})));

export function findScriptRuntime(sourceUrl, { worker = false } = {}) {
  return SCRIPT_RUNTIME_REGISTRY.find(entry => entry.worker === worker && entry.sourceUrls.includes(sourceUrl));
}
