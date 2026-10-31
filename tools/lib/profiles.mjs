import { stringify as stringifyYaml } from 'yaml';
import { isIP } from 'node:net';
import { surge, loon, shadowrocket, egern } from './profiles-apple.mjs';
import { stash, mihomo, singBox } from './profiles-native.mjs';
import { policyGroupsFor, profileRulesetsFor } from './policies.mjs';
import { expandedProfileEntries, qxRoutingTypes, withNativeRoutingSettings } from './routing-extensions.mjs';

export const profileFormats = Object.freeze({
  quantumultX: { extension: 'conf', format: 'ini' },
  surge: { extension: 'conf', format: 'ini' },
  loon: { extension: 'conf', format: 'ini' },
  shadowrocket: { extension: 'conf', format: 'ini' },
  egern: { extension: 'yaml', format: 'yaml' },
  stash: { extension: 'yaml', format: 'yaml' },
  mihomo: { extension: 'yaml', format: 'yaml' },
  singBox: { extension: 'json', format: 'json' },
});

const qxRuleTypes = {
  ...qxRoutingTypes,
  domain: 'host',
  'domain-suffix': 'host-suffix',
  'domain-keyword': 'host-keyword',
  'ip-cidr': 'ip-cidr',
  'ip-cidr6': 'ip6-cidr',
};
const egernRuleTypes = {
  domain: 'domain',
  'domain-suffix': 'domain_suffix',
  'domain-keyword': 'domain_keyword',
  'ip-cidr': 'ip_cidr',
  'ip-cidr6': 'ip_cidr6',
};
const singBoxRuleTypes = {
  domain: 'domain',
  'domain-suffix': 'domain_suffix',
  'domain-keyword': 'domain_keyword',
  'ip-cidr': 'ip_cidr',
  'ip-cidr6': 'ip_cidr',
};

const preamble = '# NetAtlas — complete client configuration\n'
  + '# Proxy defaults to REJECT. Add your own nodes and select them before use.\n'
  + '# DIRECT is an explicit alternative. Rules are inline; no remote rule files are needed.\n';

function qxBuiltin(policy) {
  return policy === 'DIRECT' || policy === 'REJECT' ? policy.toLowerCase() : policy;
}

// Official sample: https://github.com/crossutility/Quantumult-X/blob/master/sample.conf
function quantumultX(entries, groups, options = {}) {
  const used = new Set(['direct','reject','proxy',...groups.map(group=>group.name.toLowerCase())]);
  const safeName = value => typeof value==='string' && value.trim()===value && value && !/[\x00-\x1f\x7f,=\[\]]/.test(value);
  if(options.nodes!==undefined&&!Array.isArray(options.nodes)||options.subscriptions!==undefined&&!Array.isArray(options.subscriptions))throw new Error('Invalid QX inputs');
  const nodeHosts=[];
  const nodes=(options.nodes??[]).map(line=>{
    if(typeof line!=='string'||/[\r\n\u2028\u2029]/.test(line)||/(?:^|,)\s*(?:script(?:[-_](?:path|file))?|program|exec|command|file)\s*=/i.test(line))throw new Error('Invalid QX node line');
    const match=/^(shadowsocks|vmess|vless|trojan|http|socks5|anytls)=([^,]+),/i.exec(line);
    const tag=/(?:^|,)\s*tag\s*=\s*([^,]+)/.exec(line)?.[1]?.trim();
    if(!match||!safeName(tag)||used.has(tag.toLowerCase()))throw new Error('Invalid or duplicate QX node');
    let endpoint;try{endpoint=new URL('socks://'+match[2].trim());}catch{throw new Error('Invalid QX node endpoint');}
    if(!endpoint.hostname||!endpoint.port||Number(endpoint.port)<1||Number(endpoint.port)>65535||endpoint.username||endpoint.password)throw new Error('Invalid QX node endpoint');
    nodeHosts.push(endpoint.hostname.replace(/^\[|\]$/g,''));used.add(tag.toLowerCase());return {tag,line};
  });
  const subscriptions=(options.subscriptions??[]).map(item=>{
    let url;try{url=new URL(item.url);}catch{throw new Error('Invalid QX subscription');}
    if(!safeName(item.name)||used.has(item.name.toLowerCase())||/[\s,#]/.test(item.url)||url.username||url.password||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Invalid QX subscription');
    const interval=item.interval??86400;if(!Number.isInteger(interval)||interval<1||interval>2592000)throw new Error('Invalid QX interval');
    used.add(item.name.toLowerCase());return `${item.url}, tag=${item.name}, update-interval=${interval}, enabled=true`;
  });
  const selected=options.selectedProxy??nodes[0]?.tag??'reject';
  if(!['reject','direct',...nodes.map(node=>node.tag)].includes(qxBuiltin(selected)))throw new Error('Unknown QX selected node');
  const nativeGroups=groups.map(({name,choices})=>{
    const members=name==='Proxy'?[...new Set([qxBuiltin(selected),...choices.map(qxBuiltin),...nodes.map(node=>node.tag)])]:choices.map(qxBuiltin);
    return `static=${name},${members.join(',')}${name==='Proxy'?',server-tag-regex=.+':''}`;
  }).join('\n');
  const upstreams={bootstrap:'223.5.5.5',domestic:'https://223.5.5.5/dns-query',local:'system',...(options.dnsUpstreams??{})};
  const dnsLine=(host,value)=>{
    if(typeof value!=='string'||/[\s,#]/.test(value))throw new Error('Invalid QX DNS upstream');
    if(value==='system')return `server=/${host}/system`;
    if(value.startsWith('https://')){
      const url=new URL(value);if(!isIP(url.hostname.replace(/^\[|\]$/g,''))||url.username||url.password||url.search||url.hash)throw new Error('QX DNS bootstrap must use IP endpoints');
      return `doh-server=${host?'/'+host+'/':''}${value}`;
    }
    const url=new URL(value.includes('://')?value:'udp://'+value);
    if(url.protocol!=='udp:'||!isIP(url.hostname.replace(/^\[|\]$/g,''))||url.username||url.password||url.search||url.hash)throw new Error('Invalid QX DNS server');
    return `server=${host?'/'+host+'/':''}${url.host}`;
  };
  const dns=[dnsLine('',upstreams.bootstrap),dnsLine('',upstreams.domestic)];
  for(const host of ['localhost','local','*.local','home.arpa','*.home.arpa'])dns.push(dnsLine(host,upstreams.local));
  for(const host of [...new Set(nodeHosts)])if(!isIP(host))dns.push(dnsLine(host,upstreams.bootstrap));
  const rules=entries.map(({type,value,policy})=>`${qxRuleTypes[type]},${value},${qxBuiltin(policy)}`);
  return `${preamble}
[general]
network_check_url=https://www.apple.com/library/test/success.html
server_check_url=https://www.gstatic.com/generate_204
server_check_timeout=3000
fallback_udp_policy=reject
# Optional GeoIP display: merge fragments/geoip.conf into this general section.

[dns]
# Bootstrap and direct destinations use explicit DNS. LAN names retain system resolution.
# QX forwards proxy destination hostnames to the selected node for remote resolution.
${dns.join('\n')}

[policy]
${nativeGroups}

[server_remote]
${subscriptions.join('\n')||'# Fill subscriptions in a private input file, then run npm run profile.'}
# Native QX node resources only; URI or other formats must be imported through the app.

[server_local]
${nodes.map(node=>node.line).join('\n')||'# Add private native nodes here, or use the local profile command.'}

[filter_local]
${[...rules,'final,Proxy'].join('\n')}

[rewrite_remote]
# Optional rewrites are separate resources; import only those you select.
`;
}

const renderers = { quantumultX, surge, loon, shadowrocket, egern, stash, mihomo, singBox };

export function renderProfile(client, { rulesets = [], ...options } = {}) {
  rulesets = profileRulesetsFor(rulesets);
  if (!Object.hasOwn(profileFormats, client)) throw new Error(`Unknown profile client: ${client}`);
  const { extension, format } = profileFormats[client];
  const rendered = withNativeRoutingSettings(client, renderers[client](expandedProfileEntries(client, rulesets), policyGroupsFor(rulesets), options), rulesets);
  let content;
  if (format === 'json') content = `${JSON.stringify(rendered, null, 2)}\n`;
  else if (format === 'yaml') content = `${preamble}\n${stringifyYaml(rendered, { lineWidth: 0 })}`;
  else content = rendered;
  return { path: `profiles/default.${extension}`, content, format };
}
