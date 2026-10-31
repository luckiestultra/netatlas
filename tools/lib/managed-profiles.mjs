import { stringify } from 'yaml';
import settings from '../../metadata/managed-policies.json' with { type: 'json' };
import routing from '../../metadata/routing.json' with { type: 'json' };
import { getClient } from './clients.mjs';
import { profileRulesetsFor, orderedRulesets } from './policies.mjs';
import { renderProfile } from './profiles.mjs';
import { surge, loon, shadowrocket, egern } from './managed-apple.mjs';
import { stash, mihomo, singBox } from './managed-native.mjs';
import { profileRoutingResources, withNativeRoutingSettings } from './routing-extensions.mjs';

export const managedBaseUrl = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';

export function managedModel(clientId, { rulesets = [], baseUrl = managedBaseUrl } = {}) {
  const client = getClient(clientId);
  const base = new URL(baseUrl);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) || base.username || base.password || base.search || base.hash || /[\s,#]/.test(baseUrl)) throw new Error('Managed resources require a clean HTTPS repository URL');
  baseUrl = baseUrl.replace(/\/+$/, '');
  const choices = [settings.root, '自动选择', 'DIRECT', ...settings.regions.map(region => region.name)];
  const groups = [
    { name: settings.root, kind: 'select', choices: ['REJECT', 'DIRECT', '自动选择', ...settings.regions.map(region => region.name)] },
    { name: '自动选择', kind: 'auto', choices: [], regex: '.+' },
    ...settings.businesses.map(business => ({ name: business.name, kind: 'select', choices: business.initial === 'DIRECT' ? ['DIRECT', ...choices.filter(choice => choice !== 'DIRECT')] : [...choices] })),
    { name: settings.fallback, kind: 'select', choices: [...choices] },
    ...settings.regions.map(region => ({ ...region, kind: 'region', choices: [] })),
  ];
  const byId = new Map();
  for (const business of settings.businesses) for (const id of business.rules) {
    if (byId.has(id)) throw new Error(`Duplicate business mapping: ${id}`);
    byId.set(id, business.name);
  }
  const selected = profileRulesetsFor(orderedRulesets(rulesets));
  const extensions = profileRoutingResources(clientId, selected);
  const rules = selected.flatMap(rule => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.id)) throw new Error('Invalid managed rule ID');
    const entryTypes = [...new Set(rule.entries.map(entry => entry.type))];
    const original = { id: rule.id, policy: routing.fixed[rule.id] ?? byId.get(rule.id) ?? settings.defaultBusiness,
      url: `${baseUrl}/clients/${clientId}/rules/${rule.id}.${client.ruleExtension}`,
      entryTypes, domainOnly: entryTypes.every(type => type === 'domain' || type === 'domain-suffix' || type === 'domain-keyword') };
    return [...extensions.filter(resource => resource.sourceId === rule.id).map(resource => ({
      id: resource.id, policy: original.policy, url: `${baseUrl}/clients/${clientId}/${resource.path}`,
      entryTypes: [...new Set(resource.entries.map(entry => entry.type))], domainOnly: resource.domainOnly,
    })), original];
  });
  return { groups, rules, baseUrl, ruleBase: `${baseUrl}/clients/${clientId}/rules`, root: settings.root, fallback: settings.fallback, checkUrl: 'https://www.gstatic.com/generate_204', updateInterval: 86400 };
}

function section(text, name) {
  const marker = `[${name}]`;
  return text.slice(text.indexOf(marker) + marker.length).split(/^\[/m)[0].split('\n').filter(line => line.trim() && !line.trim().startsWith('#')).join('\n');
}
const qxPolicy = name => ['DIRECT', 'REJECT'].includes(name) ? name.toLowerCase() : name;
function quantumultX(model, options) {
  // Reuse the validated native node and DNS serialization of the standalone adapter.
  const base = renderProfile('quantumultX', { ...options, rulesets: [] }).content;
  const nodes = section(base, 'server_local');
  const names = nodes.split('\n').filter(Boolean).map(line => /(?:^|,)\s*tag\s*=\s*([^,]+)/.exec(line)?.[1]?.trim());
  if (names.some(name => model.groups.some(group => group.name.toLowerCase() === name.toLowerCase()))) throw new Error('QX node conflicts with a managed policy');
  const selected = qxPolicy(options.selectedProxy ?? names[0] ?? 'proxy');
  const groups = model.groups.map(group => {
    if (group.kind !== 'select') return `url-latency-benchmark=${group.name},server-tag-regex=${group.regex},check-interval=1800,tolerance=50,alive-checking=false`;
    const choices = group.name === model.root ? [...new Set([selected, 'proxy', '自动选择', 'direct', ...model.groups.filter(item => item.kind === 'region').map(item => item.name), ...names])] : group.choices.map(qxPolicy);
    return `static=${group.name},${choices.join(',')}${group.name === model.root ? ',server-tag-regex=.+' : ''}`;
  });
  const resources = model.rules.map(rule => `${rule.url}, tag=${rule.id}, force-policy=${qxPolicy(rule.policy)}, update-interval=${model.updateInterval}, opt-parser=false, enabled=true`);
  return `# NetAtlas — Quantumult X\n# Import as a separate configuration. Add your subscription in Nodes > Resources,\n# or add native QX node-resource URLs under [server_remote]. No build tool is required.\n# Region groups match node names; select a region only when it contains nodes.\n\n[general]\nnetwork_check_url=https://www.apple.com/library/test/success.html\nserver_check_url=${model.checkUrl}\nserver_check_timeout=5000\nfallback_udp_policy=reject\ngeo_location_checker=http://ipwho.de/json, ${model.baseUrl}/clients/quantumultX/scripts/geoip.js\n\n[dns]\n# Explicit bootstrap + domestic DoH; local names use system DNS. Proxy resolves its destinations.\n${section(base, 'dns')}\n\n[policy]\n${groups.join('\n')}\n\n[server_remote]\n# Add your own native QX subscription URL here, or through the App resource screen.\n${section(base, 'server_remote')}\n\n[server_local]\n# Add native nodes here, or through the App. 节点选择 initially uses the App built-in proxy.\n${nodes}\n\n[filter_remote]\n${resources.join('\n')}\n\n[filter_local]\nfinal,${model.fallback}\n\n[rewrite_remote]\n# Optional resources: ../rewrites/search-redirect.snippet or ../rewrites/https-upgrade.snippet.\n# Add only the features you choose; each has its own import instructions in the client README.\n\n[rewrite_local]\n\n[task_local]\n\n[mitm]\n# Enable only when a selected feature explicitly needs it. No certificate is bundled.\n`;
}

const renderers = { quantumultX, surge, loon, shadowrocket, egern, stash, mihomo, singBox };
export function renderManagedProfile(clientId, { rulesets = [], baseUrl = managedBaseUrl, ...options } = {}) {
  const client = getClient(clientId);
  const model = managedModel(clientId, { rulesets, baseUrl });
  const value = withNativeRoutingSettings(clientId, renderers[clientId](model, options), rulesets);
  const notes = '# NetAtlas — native App configuration with independently updated rule resources.\n'
    + '# Add native nodes or a native subscription in this App/configuration, then select the actual node.\n'
    + '# The client README lists the exact fields; no Node.js or build command is required.\n'
    + '# Region groups require matching node names. Optional rewrites/modules are separate.\n';
  const clientNotes = clientId === 'egern' ? '# App: edit 节点订阅.urls, then select its actual node under 节点选择.\n' : '';
  const content = client.profileFormat === 'json' ? JSON.stringify(value, null, 2) + '\n'
    : client.profileFormat === 'yaml' ? notes + clientNotes + stringify(value, { lineWidth: 0 }) : value;
  return { path: `profiles/default.${client.profileExtension}`, format: client.profileFormat, content };
}
