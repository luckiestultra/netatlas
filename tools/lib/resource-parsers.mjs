// SPDX-License-Identifier: MIT
// Original opt-in installation recipes. External parsers are not redistributed.
import { lstatSync, readFileSync } from 'node:fs';

const clients = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const expected = {
  quantumultX: { repository: 'KOP-XIAO/QuantumultX', commit: 'f0177f5ea2f62681ab2592a4ed54677dfbbc4b78', sourcePath: 'Scripts/resource-parser.js', license: 'unspecified', section: 'general', key: 'resource_parser_url' },
  loon: { repository: 'sub-store-org/Sub-Store', commit: 'd26e713e38901e02565a6505c1ae5cb8bb8a1a22', sourcePath: 'sub-store-parser.loon.min.js', license: 'AGPL-3.0-only', section: 'General', key: 'resource-parser' },
};

export function validateResourceParsers(registry) {
  if (registry.version !== 1 || registry.defaultEnabled !== false || registry.recipeLicense !== 'MIT' || registry.sourceRegistry?.vendoredJavaScript !== false || JSON.stringify(Object.keys(registry.clients ?? {}).sort()) !== JSON.stringify(Object.keys(expected).sort())) throw new Error('Invalid external resource-parser registry');
  for (const [client, parser] of Object.entries(registry.clients)) {
    const contract = expected[client];
    const url = 'https://raw.githubusercontent.com/' + contract.repository + '/' + contract.commit + '/' + contract.sourcePath;
    if (parser.repository !== contract.repository || parser.commit !== contract.commit || parser.sourcePath !== contract.sourcePath || parser.url !== url || parser.upstreamLicense !== contract.license || parser.defaultEnabled !== false || parser.externalOnly !== true || parser.nativeApp !== 'not-run' || parser.permissions?.automaticTasks !== false || parser.permissions?.mitm !== false || JSON.stringify(parser.artifacts) !== JSON.stringify(['fragments/resource-parser.conf'])) throw new Error('Invalid external resource-parser provenance or defaults');
    if (!/^[a-f0-9]{64}$/.test(parser.sha256) || !Number.isSafeInteger(parser.bytes) || parser.bytes <= 0 || parser.httpStatus !== 200 || parser.tlsVerified !== true || parser.syntaxCheck !== 'node --check (no execution)' || !parser.sourceMarkers?.includes('$resource') || !parser.sourceMarkers.includes('$done')) throw new Error('Missing resource-parser source verification');
    if (client === 'quantumultX' && !parser.sourceMarkers.includes('hashSchema')) throw new Error('Missing QX parser host contract');
    if (client === 'loon' && (parser.sourceCommit !== 'c1018115a7eee4cdcb9042cce5e94afda41e48ba' || parser.release !== '2.44.2')) throw new Error('Missing Loon release source provenance');
  }
  return registry;
}

export function loadResourceParsers() {
  const url = new URL('../../metadata/resource-parsers.json', import.meta.url);
  if (lstatSync(new URL('../../metadata/', import.meta.url)).isSymbolicLink() || lstatSync(url).isSymbolicLink()) throw new Error('Refusing a resource-parser registry symlink');
  return validateResourceParsers(JSON.parse(readFileSync(url, 'utf8')));
}

function validateBaseUrl(baseUrl) {
  // Entry scripts remain upstream; this option never changes their URLs.
  if (baseUrl === undefined) return;
  const text = String(baseUrl);
  const url = new URL(text);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[,\s]/.test(text)) throw new Error('Resource-parser baseUrl must be a plain HTTPS directory URL');
}

export function renderResourceParsers(client, { baseUrl } = {}) {
  if (!clients.has(client)) throw new Error('Unknown client: ' + client);
  validateBaseUrl(baseUrl);
  const registry = loadResourceParsers();
  const parser = registry.clients[client];
  if (!parser) return [];
  const contract = expected[client];
  const lines = [
    '# NetAtlas optional external resource-parser recipe (MIT recipe only).',
    '# Author: ' + parser.author + '; external parser license: ' + parser.upstreamLicense + '.',
    '# Merge this setting into the existing [' + contract.section + '] section; replace an existing parser assignment.',
    '# This is neither a complete profile nor a module/rewrite subscription. Default profiles do not enable it.',
    '# Script stays at its original upstream URL; NetAtlas does not redistribute or implement this parser.',
    '# Verified upstream GET SHA-256: ' + parser.sha256,
    '# Reviewed host contract and syntax only; native import and conversion execution: not run.',
    '# The parser receives subscription contents and runs with its host-app privileges; no isolated sandbox is claimed.',
    '# No MITM, certificate, scheduled task or automatic Gist synchronization is supplied.',
    '# Official documentation: ' + parser.officialDocumentation[0],
    ...(client === 'quantumultX' ? [
      '# Upstream license is unspecified. This is only an original-author external installation recipe.',
      '# Custom filter/rename scripts can execute in the parser context; the helper UI requires build 918+.',
    ] : [
      '# Complete AGPL release source: ' + parser.completeSourceUrl,
      '# Upstream license: ' + parser.licenseUrl,
      '# Applies to node/rule resources; set parser-enabled=true on the chosen existing [Remote Proxy] subscription.',
      '# The external parser may re-fetch its resource URL when supplied content cannot be converted.',
    ]),
    '', '[' + contract.section + ']', contract.key + ' = ' + parser.url, '',
  ];
  return [{ path: parser.artifacts[0], content: lines.join('\n') }];
}
