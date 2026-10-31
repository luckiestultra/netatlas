import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import metadata from '../../metadata/native-routing.json' with { type: 'json' };
import canonical from '../../src/native-rules/china-asn.json' with { type: 'json' };
import { assertManagedPaths } from './managed-paths.mjs';
import { publicArtifactUrl } from './public-url.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const defaultBaseUrl = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const extensions = { quantumultX: 'list', surge: 'list', loon: 'list', shadowrocket: 'list', egern: 'yaml', stash: 'yaml', mihomo: 'yaml' };

export const nativeRoutingRegistry = Object.freeze({ ...metadata, asns: Object.freeze([...canonical.asns]) });

export function parseAsnSource(content) {
  const asns = new Set();
  for (const [index, raw] of content.split('\n').entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const match = /^IP-ASN,([1-9][0-9]*)(?:\s+\/\/.*)?$/.exec(line);
    if (!match) throw new Error(`Unsupported ASN source condition at line ${index + 1}`);
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number) || number > 4294967295 || asns.has(number)) throw new Error(`Invalid or duplicate ASN at line ${index + 1}`);
    asns.add(number);
  }
  if (!asns.size) throw new Error('Empty ASN source');
  return [...asns].sort((a, b) => a - b);
}

export async function loadNativeRouting(root) {
  await assertManagedPaths(root, ['metadata/native-routing.json', 'src/native-rules/china-asn.json', metadata.asn.path, metadata.asn.licensePath]);
  const registry = JSON.parse(await readFile(path.join(root, 'metadata/native-routing.json'), 'utf8'));
  assert.deepEqual(registry, metadata, 'Native routing metadata differs from the loaded registry');
  const data = JSON.parse(await readFile(path.join(root, registry.asn.canonicalPath), 'utf8'));
  const bytes = await readFile(path.join(root, registry.asn.path));
  const license = await readFile(path.join(root, registry.asn.licensePath));
  assert.equal(registry.version, 1);
  assert.equal(registry.asn.repository, 'missuo/ASN-China');
  assert.match(registry.asn.revision, /^[a-f0-9]{40}$/);
  assert.equal(registry.asn.license, 'MIT');
  assert.equal(bytes.length, registry.asn.bytes, 'ASN source byte length mismatch');
  assert.equal(sha256(bytes), registry.asn.sha256, 'ASN source SHA-256 mismatch');
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), registry.asn.gitBlob, 'ASN Git blob mismatch');
  assert.equal(sha256(license), registry.asn.licenseSha256, 'ASN license hash mismatch');
  assert.equal(data.version, 1);
  assert.equal(data.id, 'china-asn');
  assert.equal(data.type, 'ip-asn');
  assert.equal(data.sourceSha256, registry.asn.sha256);
  assert.equal(data.asns.length, registry.asn.count, 'ASN count mismatch');
  assert.deepEqual(data.asns, parseAsnSource(bytes.toString('utf8')), 'ASN canonical source replay mismatch');
  assert.deepEqual(data, canonical, 'ASN canonical data differs from loaded data');
  for (const value of Object.values(registry.databaseUrls)) {
    const url = new URL(value);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'raw.githubusercontent.com');
    assert.equal(url.username + url.password + url.hash + url.search, '');
  }
  return { ...registry, asns: [...data.asns] };
}

function clientFor(client, registry) {
  const item = registry.clients[client];
  if (!item) throw new Error(`Unknown native routing client: ${client}`);
  return item;
}

export function nativeRoutingFor(client, registry = nativeRoutingRegistry) {
  const support = clientFor(client, registry);
  if (!support.asn || !support.geoip) return [];
  const source = `https://github.com/${registry.asn.repository}/blob/${registry.asn.revision}/${registry.asn.upstream}`;
  const header = `# NetAtlas native destination-IP matching; database lookup, not CIDR expansion.\n# ASN source: ${source}\n# ASN source license: MIT, Copyright (c) 2022 Vincent Young; see THIRD_PARTY_NOTICES.md.\n`;
  return [
    { id: 'china-asn', entries: registry.asns.map(asn => ({ type: 'ip-asn', value: String(asn) })), license: 'MIT', source },
    { id: 'geoip-cn', entries: [{ type: 'geoip', value: registry.geoip.country }], license: 'MIT', source: support.references[0] },
  ].map(resource => {
    let content;
    if (client === 'egern') {
      content = stringify(resource.id === 'china-asn' ? { asn_set: registry.asns.map(asn => `AS${asn}`) } : { geoip_set: [registry.geoip.country] });
    } else {
      const lines = resource.entries.map(entry => client === 'quantumultX'
        ? `${entry.type}, ${entry.type === 'geoip' ? entry.value.toLowerCase() : entry.value}, direct`
        : `${entry.type === 'geoip' ? 'GEOIP' : 'IP-ASN'},${entry.value}`);
      content = ['stash', 'mihomo'].includes(client) ? stringify({ payload: lines }) : lines.join('\n') + '\n';
    }
    return { ...resource, sourceId: 'china-ipv4', path: `rules/${resource.id}.${extensions[client]}`, content: header + content, format: support.syntax, policy: 'DIRECT', domainOnly: false, entryTypes: [...new Set(resource.entries.map(entry => entry.type))] };
  });
}

export function nativeRoutingSettings(client, registry = nativeRoutingRegistry) {
  const support = clientFor(client, registry);
  const iniFields = {};
  const configFields = {};
  if (client === 'surge') iniFields['disable-geoip-db-auto-update'] = false;
  if (client === 'loon') Object.assign(iniFields, { 'geoip-url': registry.databaseUrls.country, 'ipasn-url': registry.databaseUrls.asn });
  if (client === 'egern') Object.assign(configFields, { geoip_db_url: registry.databaseUrls.country, asn_db_url: registry.databaseUrls.asn });
  if (client === 'mihomo') Object.assign(configFields, {
    'geodata-mode': false, 'geo-auto-update': true, 'geo-update-interval': 24,
    'geox-url': { mmdb: registry.databaseUrls.country, asn: registry.databaseUrls.asn },
  });
  return { supported: support.asn && support.geoip, iniFields, configFields, guidance: [...support.guidance], references: [...support.references], databaseUpdate: support.databaseUpdate };
}

export function renderNativeRoutingFragment(client, registry = nativeRoutingRegistry, { baseUrl = defaultBaseUrl } = {}) {
  const settings = nativeRoutingSettings(client, registry);
  if (!settings.supported) return { path: 'fragments/native-routing.md', format: 'markdown', content: '# Native ASN / GeoIP support\n\n' + settings.guidance.map(line => `- ${line}`).join('\n') + '\n\n' + settings.references.map(url => `- <${url}>`).join('\n') + '\n' };
  const urls = nativeRoutingFor(client, registry).map(resource => publicArtifactUrl(baseUrl, client, resource.path));
  const header = '# NetAtlas native routing fragment. The default and standalone profiles already enable these conditions.\n# Merge into a custom profile after explicit service/domain rules and before static CN CIDRs/final.\n# This is a manual merge fragment; do not replace a complete profile with it.\n' + settings.guidance.map(line => `# ${line}`).join('\n') + '\n';
  if (['quantumultX', 'surge', 'loon', 'shadowrocket'].includes(client)) {
    const fields = Object.entries(settings.iniFields).map(([key, value]) => `${key} = ${value}`);
    const general = fields.length ? `[General]\n${fields.join('\n')}\n\n` : '';
    const section = client === 'quantumultX' ? 'filter_remote' : client === 'loon' ? 'Remote Rule' : 'Rule';
    const rules = urls.map((url, index) => client === 'quantumultX'
      ? `${url}, tag=netatlas-${index === 0 ? 'china-asn' : 'geoip-cn'}, force-policy=direct, update-interval=86400, enabled=true`
      : client === 'loon' ? `${url}, policy=DIRECT, tag=netatlas-${index === 0 ? 'china-asn' : 'geoip-cn'}, enabled=true` : `RULE-SET,${url},DIRECT`);
    return { path: 'fragments/native-routing.conf', format: 'ini', content: `${header}${general}[${section}]\n${rules.join('\n')}\n` };
  }
  const config = { ...settings.configFields };
  if (client === 'egern') config.rules = urls.map(url => ({ rule_set: { match: url, policy: 'DIRECT', update_interval: 86400 } }));
  else {
    config['rule-providers'] = Object.fromEntries(urls.map((url, index) => [`netatlas-${index === 0 ? 'china-asn' : 'geoip-cn'}`, {
      ...(client === 'mihomo' ? { type: 'http', proxy: 'DIRECT' } : {}), behavior: 'classical', format: 'yaml', url,
      path: `./rules/netatlas-${index === 0 ? 'china-asn' : 'geoip-cn'}.yaml`, interval: 86400,
    }]));
    config.rules = ['RULE-SET,netatlas-china-asn,DIRECT', 'RULE-SET,netatlas-geoip-cn,DIRECT'];
  }
  return { path: 'fragments/native-routing.yaml', format: 'yaml', content: header + stringify(config) };
}
