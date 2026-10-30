import { readFileSync } from 'node:fs';
import { createGeoIP } from '../../src/features/geoip/core.mjs';

const clientIds = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const source = (path) => readFileSync(new URL('../../src/features/' + path, import.meta.url), 'utf8');
const nativeScript = (adapter) => '// Generated from the portable GeoIP core and an explicit native adapter.\nvar AtlasGeoIP = (' + createGeoIP.toString() + ')();\n' + source('geoip/' + adapter + '.js');

function publicScript(baseUrl, client) {
  if (!baseUrl) return null;
  const normalized = String(baseUrl).replace(/\/+$/, '');
  const url = new URL(normalized);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password || /[,\s]/.test(normalized)) {
    throw new Error('Feature baseUrl must be a public HTTP(S) directory URL without credentials, query or fragment');
  }
  return normalized + '/clients/' + client + '/scripts/geoip.js';
}

export function renderFeatures(client, { baseUrl } = {}) {
  if (!clientIds.has(client)) throw new Error('Unknown client: ' + client);
  if (client === 'quantumultX') {
    const scriptUrl = publicScript(baseUrl, client);
    const artifacts = [
      { path: 'scripts/geoip.js', content: nativeScript('quantumultX') },
      { path: 'rewrites/search-redirect.snippet', content: source('search-redirect/quantumultX.snippet') },
    ];
    // A remote URL is required: local GeoIP script path support is not established.
    if (scriptUrl) artifacts.push({
      path: 'modules/geoip.conf',
      content: '# General-section fragment. Merge into the existing profile; this is not a rewrite subscription.\n[general]\ngeo_location_checker=http://ipwho.de/json, ' + scriptUrl + '\n',
    });
    return artifacts;
  }
  if (client === 'surge') {
    const scriptPath = publicScript(baseUrl, client) || '../scripts/geoip.js';
    return [
      { path: 'scripts/geoip.js', content: nativeScript('surge') },
      {
        path: 'modules/geoip.sgmodule',
        content: '#!name=NetAtlas GeoIP\n#!desc=Manual GeoIP lookup via the existing Proxy policy; no policy selection is changed. Requires the named policy and a published script URL or the documented local layout.\n\n[Script]\natlas-geoip = type=generic,script-path=' + scriptPath + ',timeout=8,argument=Proxy\n\n[Panel]\natlas-geoip = title=GeoIP lookup,content=Refresh to query via Proxy,style=info,script-name=atlas-geoip\n',
      },
      { path: 'rewrites/search-redirect.sgmodule', content: source('search-redirect/surge.sgmodule') },
    ];
  }
  return [];
}
