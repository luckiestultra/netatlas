// SPDX-License-Identifier: MIT
// Original QX implementation; optional Loon upstream recipe stays separately licensed.
import { lstatSync, readFileSync } from 'node:fs';
import { publicArtifactUrl } from './public-url.mjs';
import { bundleResourceParser } from './resource-parser-bundle.mjs';

const clients = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const publicBase = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const qxArtifacts = ['scripts/resource-parser.js', 'fragments/resource-parser.conf'];
const helperProtocol = 'https://github.com/crossutility/Quantumult-X/blob/97fdae00a91f69e69d84898c686aa94a112dd4bd/parser-helper-protocol.md';
const loon = {
  repository: 'sub-store-org/Sub-Store', commit: 'd26e713e38901e02565a6505c1ae5cb8bb8a1a22',
  sourcePath: 'sub-store-parser.loon.min.js', license: 'AGPL-3.0-only',
  sha256: '54756d35c1777ef73aa384de4bea022d96ed58d8128f3610a14e202ee300d16c', bytes: 1276648,
  sourceCommit: 'c1018115a7eee4cdcb9042cce5e94afda41e48ba', release: '2.44.2',
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const invalid = message => { throw new Error('Invalid resource-parser registry: ' + message); };

export function validateResourceParsers(registry) {
  if (registry.version !== 2 || registry.defaultEnabled !== false || registry.recipeLicense !== 'MIT' || registry.sourceRegistry?.vendoredJavaScript !== true || registry.sourceRegistry?.independentQxImplementation !== true || !same(Object.keys(registry.clients ?? {}).sort(), ['loon', 'quantumultX'])) invalid('mixed implementation contract');
  if (!same([...(registry.unsupportedClients ?? [])].sort(), [...clients].filter(client => !['quantumultX', 'loon'].includes(client)).sort())) invalid('unsupported clients');
  const qx = registry.clients.quantumultX;
  if (qx.client !== 'quantumultX' || qx.author !== 'NetAtlas contributors' || qx.repository !== 'luckiestultra/netatlas' || qx.implementation !== 'netatlas' || qx.entrySource !== 'src/features/resource-parser/entry.mjs' || qx.sourcePath !== 'src/features/resource-parser' || qx.url !== publicArtifactUrl(publicBase, 'quantumultX', 'scripts/resource-parser.js') || qx.implementationLicense !== 'MIT' || qx.license !== 'MIT AND ISC' || qx.defaultEnabled !== true || qx.externalOnly !== false || qx.kind !== 'general-fragment' || qx.nativeApp !== 'not-run' || !same(qx.artifacts, qxArtifacts) || !same(qx.ownArtifacts, qxArtifacts)) invalid('QX implementation, license or artifacts');
  if (!same(qx.dependencies, [{ name: 'yaml', version: '2.9.1', license: 'ISC', licensePath: 'src/features/resource-parser/vendor/LICENSE-yaml' }])) invalid('QX dependency provenance');
  if (qx.permissions?.subscriptionContents !== true || qx.permissions?.userSuppliedScriptEval !== false || qx.permissions?.network !== false || qx.permissions?.storage !== false || qx.permissions?.automaticTasks !== false || qx.permissions?.mitm !== false || qx.permissions?.sourceScriptReferenceExecution !== false || qx.permissions?.noNetworkNoEval !== true) invalid('QX offline permissions');
  if (qx.permissions?.notifications !== 'Explicit info=1 only, after successful server conversion; numeric usage and expiry only, with no subscription URL, credentials or resource tag.') invalid('QX notification consent');
  if (!same(qx.sourceContract?.supportedResourceTypes, ['server', 'filter', 'rewrite']) || qx.sourceContract?.helperUiMinimumBuild !== 918 || qx.sourceContract?.helperProtocol !== helperProtocol || !['$resource', '$done', '$parser', 'hashSchema', 'hashToUI', 'uiToHash'].every(marker => qx.sourceMarkers?.includes(marker)) || !qx.officialDocumentation?.includes(helperProtocol) || !qx.officialDocumentation?.includes('https://github.com/crossutility/Quantumult-X/blob/master/resource-parser.js')) invalid('QX official host contract');
  const parser = registry.clients.loon;
  const url = 'https://raw.githubusercontent.com/' + loon.repository + '/' + loon.commit + '/' + loon.sourcePath;
  if (parser.client !== 'loon' || parser.repository !== loon.repository || parser.commit !== loon.commit || parser.sourcePath !== loon.sourcePath || parser.url !== url || parser.upstreamLicense !== loon.license || parser.defaultEnabled !== false || parser.externalOnly !== true || parser.nativeApp !== 'not-run' || parser.permissions?.automaticTasks !== false || parser.permissions?.mitm !== false || parser.permissions?.userSuppliedScriptEval !== false || !same(parser.artifacts, ['fragments/resource-parser.conf'])) invalid('Loon external provenance or defaults');
  if (parser.sha256 !== loon.sha256 || parser.bytes !== loon.bytes || parser.httpStatus !== 200 || parser.tlsVerified !== true || parser.syntaxCheck !== 'node --check (no execution)' || !parser.sourceMarkers?.includes('$resource') || !parser.sourceMarkers.includes('$done') || parser.sourceCommit !== loon.sourceCommit || parser.release !== loon.release || !same(parser.sourceContract?.supportedResourceTypes, { 1: 'nodes', 2: 'rules' }) || parser.completeSourceUrl !== 'https://github.com/' + loon.repository + '/tree/' + loon.sourceCommit || parser.licenseUrl !== 'https://raw.githubusercontent.com/' + loon.repository + '/' + loon.sourceCommit + '/LICENSE') invalid('Loon verification and complete source');
  return registry;
}

export function loadResourceParsers() {
  const url = new URL('../../metadata/resource-parsers.json', import.meta.url);
  if (lstatSync(new URL('../../metadata/', import.meta.url)).isSymbolicLink() || lstatSync(url).isSymbolicLink()) throw new Error('Refusing a resource-parser registry symlink');
  return validateResourceParsers(JSON.parse(readFileSync(url, 'utf8')));
}

function validateBaseUrl(baseUrl) {
  if (baseUrl === undefined) return;
  const text = String(baseUrl);
  const url = new URL(text);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[,\s]/.test(text)) throw new Error('Resource-parser baseUrl must be a plain HTTPS directory URL');
}

export function renderResourceParsers(client, { baseUrl } = {}) {
  if (!clients.has(client)) throw new Error('Unknown client: ' + client);
  validateBaseUrl(baseUrl);
  const parser = loadResourceParsers().clients[client];
  if (!parser) return [];
  if (client === 'quantumultX') return [
    { path: 'scripts/resource-parser.js', content: bundleResourceParser() },
    { path: 'fragments/resource-parser.conf', content: [
      '# NetAtlas original QX resource parser (MIT; bundled yaml 2.9.1: ISC).',
      '# The repository profiles enable this setting. For an existing profile, merge into [general].',
      '# This is a general-section fragment, not a rewrite subscription or module.',
      '# Offline, atomic node/rule/rewrite conversion; unsupported conditions/options still fail the complete resource.',
      '# Leading JS installation comments are read statically; source scripts are never executed.',
      '# Surge/Loon HTTP declarations convert by default; requires-body accepts true/false/1/0.',
      '# Source argument/max-size/timeout settings are not applied; binary scripts must use QX bodyBytes.',
      '# Script APIs are not translated; script-compat=qx only records a user compatibility declaration.',
      '# Mixed rewrite/filter snippets require QX 1.5.2 build 844+: https://t.me/QuanXNews/294',
      '# No downloads, storage, eval, certificate import or source-script execution.',
      '# Source script state/credential changes and original broad hostname masks are not endorsed; business effects are unverified.',
      '# Explicit allow-resolve=1 changes DNS behavior.',
      '# Official parser-helper UI: QX 1.5.6 build 918+. Native application import: not run.',
      '# Documentation: ' + parser.officialDocumentation[0],
      '', '[general]',
      'resource_parser_url = ' + publicArtifactUrl(baseUrl ?? publicBase, client, 'scripts/resource-parser.js'), '',
    ].join('\n') },
  ];
  return [{ path: 'fragments/resource-parser.conf', content: [
    '# NetAtlas optional external resource-parser recipe (MIT recipe only).',
    '# Author: ' + parser.author + '; external parser license: ' + parser.upstreamLicense + '.',
    '# Merge into the existing [General] section; replace an existing parser assignment.',
    '# This is neither a complete profile nor a module/rewrite subscription. Loon profiles do not enable it.',
    '# Script stays at its original upstream URL; NetAtlas does not redistribute or implement this parser.',
    '# Verified upstream GET SHA-256: ' + parser.sha256,
    '# Reviewed host contract and syntax only; native import and conversion execution: not run.',
    '# The external parser receives subscription contents and runs with Loon host privileges.',
    '# No MITM, certificate, scheduled task or automatic Gist synchronization is supplied.',
    '# Official documentation: ' + parser.officialDocumentation[0],
    '# Complete AGPL release source: ' + parser.completeSourceUrl,
    '# Upstream license: ' + parser.licenseUrl,
    '# Applies to node/rule resources; set parser-enabled=true on the chosen existing [Remote Proxy] subscription.',
    '# The external parser may re-fetch its resource URL when supplied content cannot be converted.',
    '', '[General]', 'resource-parser = ' + parser.url, '',
  ].join('\n') }];
}
