// SPDX-License-Identifier: MIT
// This renderer is independent of the separately licensed installer templates.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const clients = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const projectIds = ['boxjs', 'script-hub', 'sub-store'];
const extensions = { quantumultX: 'snippet', surge: 'sgmodule', loon: 'plugin', shadowrocket: 'module', egern: 'yaml', stash: 'stoverride' };
const root = new URL('../../', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fixedHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function readManaged(path) {
  if (!/^(?:metadata\/integrations\.json|src\/vendor\/integrations\/(?:boxjs|script-hub|sub-store)\/(?:LICENSE|(?:upstream|installers)\/(?:quantumultX|surge|loon|shadowrocket|egern|stash)\.txt))$/.test(path)) throw new Error('Invalid integration source path');
  let current = root;
  for (const part of path.split('/')) {
    current = new URL(part, current.href.endsWith('/') ? current : current.href + '/');
    if (lstatSync(fileURLToPath(current)).isSymbolicLink()) throw new Error('Symlink in integration source path');
  }
  return readFileSync(new URL(path, root));
}

function checkedFile(entry) {
  if (!entry || !fixedHash(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) throw new Error('Invalid integration source hash');
  const bytes = readManaged(entry.path);
  if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error('Integration source checksum mismatch: ' + entry.path);
  return bytes.toString('utf8');
}

function pinnedUrl(repository, commit, path) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(commit) || !/^[A-Za-z0-9_./-]+$/.test(path) || path.split('/').some(part => part === '.' || part === '..' || !part)) throw new Error('Invalid pinned integration URL');
  return 'https://raw.githubusercontent.com/' + repository + '/' + commit + '/' + path;
}

function parsedYaml(content) {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length) throw new Error('Invalid integration YAML');
  return document.toJS();
}

// Inspect the emitted native configuration, resolving Stash providers by name.
export function inspectIntegrationInstaller(client, content) {
  let scriptUrls, hosts;
  if (client === 'egern') {
    const value = parsedYaml(content);
    if (value.scriptings?.some(entry => !entry.http_request)) throw new Error('Unexpected integration trigger');
    scriptUrls = (value.scriptings ?? []).map(entry => entry.http_request.script_url);
    hosts = Array.isArray(value.mitm?.hostnames) ? value.mitm.hostnames : value.mitm?.hostnames?.includes;
  } else if (client === 'stash') {
    const value = parsedYaml(content);
    if (value.cron || value.http?.script?.some(entry => entry.type !== 'request')) throw new Error('Unexpected integration trigger');
    const names = value.http?.script?.map(entry => entry.name) ?? [];
    if (new Set(names).size !== names.length || Object.keys(value['script-providers'] ?? {}).some(name => !names.includes(name))) throw new Error('Unused or duplicate integration provider');
    scriptUrls = names.map(name => value['script-providers']?.[name]?.url);
    hosts = value.http?.mitm;
  } else {
    scriptUrls = [...content.matchAll(/script-path=([^,\s]+)/g)].map(match => match[1]);
    scriptUrls.push(...[...content.matchAll(/script\("([^"\n]+)"(?:,\s*"")?\)/g)].map(match => match[1]));
    if (client === 'quantumultX') scriptUrls.push(...[...content.matchAll(/^\S+ url script-[a-z-]+ (\S+)$/gm)].map(match => match[1]));
    hosts = /^hostname\s*=\s*(.+)$/m.exec(content)?.[1].replace(/%(?:APPEND|INSERT)%\s*/g, '').split(',').map(host => host.trim());
  }
  if (!scriptUrls?.length || scriptUrls.some(url => typeof url !== 'string') || !hosts?.length) throw new Error('Incomplete integration installer');
  return { scriptUrls, hosts };
}

export function validateIntegrations(catalog) {
  if (catalog.version !== 1 || catalog.defaultEnabled !== false || !Array.isArray(catalog.integrations) || JSON.stringify(catalog.integrations.map(item => item.id)) !== JSON.stringify(projectIds)) throw new Error('Invalid integration registry');
  const dependencies = new Map();
  for (const dependency of catalog.remoteDependencies ?? []) {
    if (dependencies.has(dependency.id) || !projectIds.includes(dependency.project) || dependency.url !== pinnedUrl(dependency.repository, dependency.commit, dependency.path) || !fixedHash(dependency.sha256) || !Number.isSafeInteger(dependency.bytes) || dependency.bytes <= 0 || dependency.httpStatus !== 200 || dependency.tlsVerified !== true || dependency.syntaxCheck !== 'node --check (no execution)' || !dependency.sourceMarkers?.includes('$done')) throw new Error('Invalid integration dependency provenance');
    dependencies.set(dependency.id, dependency);
  }
  for (const item of catalog.integrations) {
    const expectedLicense = item.id === 'sub-store' ? 'AGPL-3.0-only' : 'GPL-3.0-only';
    if (item.defaultEnabled !== false || item.license !== expectedLicense || item.remoteScriptLicense !== expectedLicense || item.permissions?.automaticTasks !== false || item.sourceUrl !== 'https://github.com/' + item.repository + '/tree/' + item.sourceCommit) throw new Error('Invalid integration license or defaults');
    pinnedUrl(item.repository, item.sourceCommit, 'LICENSE');
    if (item.licenseFile.path !== 'src/vendor/integrations/' + item.id + '/LICENSE') throw new Error('Invalid integration license path');
    const license = checkedFile(item.licenseFile);
    if (!license.includes(item.id === 'sub-store' ? 'GNU AFFERO GENERAL PUBLIC LICENSE' : 'GNU GENERAL PUBLIC LICENSE')) throw new Error('Incomplete integration license');
    if (JSON.stringify(Object.keys(item.clients).sort()) !== JSON.stringify(Object.keys(extensions).sort())) throw new Error('Missing integration client');
    for (const [client, adapter] of Object.entries(item.clients)) {
      const path = 'modules/' + item.id + '.' + extensions[client];
      if (JSON.stringify(adapter.artifacts) !== JSON.stringify([path]) || adapter.nativeApp !== 'not-run' || adapter.installer.path !== 'src/vendor/integrations/' + item.id + '/installers/' + client + '.txt') throw new Error('Invalid integration artifact path or native claim');
      const content = checkedFile(adapter.installer);
      if (adapter.upstreamInstaller) {
        const prefix = pinnedUrl(item.repository, item.sourceCommit, 'LICENSE').replace(/LICENSE$/, '');
        if (adapter.upstreamInstaller.path !== 'src/vendor/integrations/' + item.id + '/upstream/' + client + '.txt' || !adapter.upstreamInstaller.url.startsWith(prefix) || adapter.upstreamInstaller.url !== pinnedUrl(item.repository, item.sourceCommit, adapter.upstreamInstaller.url.slice(prefix.length))) throw new Error('Invalid upstream installer provenance');
        checkedFile(adapter.upstreamInstaller);
      } else if (!(item.id === 'boxjs' && client === 'egern' && adapter.schemaSources?.length)) throw new Error('Missing official installer provenance');
      if (/type=cron|^\s*cron\s|^cron:|^\s*-\s*schedule:|ca[-_]p12|ca[-_]passphrase|skip[-_]cert|insecure[-_]?tls/im.test(content)) throw new Error('Unexpected task, CA payload or TLS override in integration');
      const parsed = inspectIntegrationInstaller(client, content);
      if (JSON.stringify([...parsed.hosts].sort()) !== JSON.stringify([...item.mitmHosts].sort())) throw new Error('Integration MITM hostname mismatch');
      const expectedUrls = adapter.dependencyIds.map(id => {
        const dependency = dependencies.get(id);
        if (!dependency || dependency.project !== item.id || dependency.license !== item.remoteScriptLicense) throw new Error('Missing integration dependency');
        return dependency.url;
      });
      if (new Set(parsed.scriptUrls).size !== parsed.scriptUrls.length || JSON.stringify([...parsed.scriptUrls].sort()) !== JSON.stringify(expectedUrls.sort())) throw new Error('Unregistered integration script reference');
    }
  }
  return catalog;
}

export function loadIntegrations() {
  return validateIntegrations(JSON.parse(readManaged('metadata/integrations.json').toString('utf8')));
}

function sourceBase(baseUrl = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main') {
  const value = String(baseUrl).replace(/\/+$/, '');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[,\s]/.test(value)) throw new Error('Integration baseUrl must be an HTTPS directory without credentials, query, fragment or configuration delimiters');
  return value;
}

export function renderIntegrations(client, { baseUrl } = {}) {
  if (!clients.has(client)) throw new Error('Unknown client: ' + client);
  const base = sourceBase(baseUrl);
  const catalog = loadIntegrations();
  if (client === 'mihomo' || client === 'singBox') return [];
  return catalog.integrations.map(item => {
    const adapter = item.clients[client];
    const source = base + '/src/vendor/integrations/' + item.id + '/';
    let content = checkedFile(adapter.installer);
    // Loon Script v2 injects null when the second argument is omitted, but these
    // pinned upstream entries call $argument.split() whenever it is defined.
    // Adapt only the emitted wrapper; retain the archived source bytes/hashes.
    // https://nsloon.app/docs/Script/script_v2/#argument-参数
    if (client === 'loon' && item.id === 'script-hub') {
      for (const id of ['script-hub-rewrite-parser', 'script-hub-rule-parser', 'script-hub-script-converter']) {
        const dependency = catalog.remoteDependencies.find(entry => entry.id === id);
        const invocation = 'script("' + dependency.url + '")';
        if (content.split(invocation).length !== 2) throw new Error('Unexpected Loon ScriptHub entry invocation');
        content = content.replace(invocation, 'script("' + dependency.url + '", "")');
      }
      content = '# Changed by NetAtlas on 2026-11-02: pass an explicit empty string to the three Script v2 conversion entries.\n' + content;
    }
    const notice = [
      '# SPDX-License-Identifier: ' + item.license,
      '# Adapted from ' + item.repository + '; authors: ' + item.authors + '.',
      '# Changed by NetAtlas on 2026-10-31: pin entry scripts, remove scheduled tasks and cosmetic/routing additions; see NOTICE.',
      '# Upstream complete source: ' + item.sourceUrl,
      '# Modified installer sources and changes: ' + source,
      '# Renderer source: ' + base + '/tools/lib/integrations.mjs',
      '# License: ' + source + 'LICENSE',
      '# Provided WITHOUT ANY WARRANTY. This installer and the remote scripts are not covered by NetAtlas MIT.',
      '# Optional: importing/enabling this resource activates remote JavaScript and tool-host MITM.',
      '# Requires an existing trusted user CA for HTTPS; no CA or automatic task is supplied.',
      '# Remote scripts can access host storage and user-selected URLs/scripts. Pin scope and permissions: ' + source + 'README.md',
    ].join('\n') + '\n\n';
    return { path: adapter.artifacts[0], content: notice + content.trimEnd() + '\n' };
  });
}
