import { readFileSync } from 'node:fs';
import { createGeoIP } from '../../src/features/geoip/core.mjs';
import { renderAntiAd } from './anti-ad.mjs';
import { publicArtifactUrl } from './public-url.mjs';
import { renderHttpsUpgrade } from './https-upgrade.mjs';
import { renderQuickSearch } from './quick-search.mjs';
import { renderRedirects, renderBiliIntlRegion } from './redirects.mjs';
import { renderIntegrations } from './integrations.mjs';
import { renderBodyReplacement } from './body-replacement.mjs';
import { renderResourceParsers } from './resource-parsers.mjs';
import { renderQxCompatibility } from './qx-compat.mjs';

const clientIds = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const source = (path) => readFileSync(new URL('../../src/features/' + path, import.meta.url), 'utf8');
const nativeScript = (adapter) => '// Generated from the portable GeoIP core and an explicit native adapter.\n'
  + '/* Chinese territory labels: Unicode CLDR 48 (Unicode-3.0).\n' + source('geoip/localization/LICENSE-Unicode').trimEnd() + '\n*/\n'
  + 'var AtlasGeoIP = (' + createGeoIP.toString() + ')();\n' + source('geoip/' + adapter + '.js');

function publicScript(baseUrl, client) {
  return publicArtifactUrl(baseUrl,client,'scripts/geoip.js');
}

function renderBuiltinFeatures(client, { baseUrl } = {}) {
  if (!clientIds.has(client)) throw new Error('Unknown client: ' + client);
  if (client === 'quantumultX') {
    const scriptUrl = publicScript(baseUrl, client);
    const artifacts = [
      { path: 'scripts/geoip.js', content: nativeScript('quantumultX') },
      { path: 'rewrites/search-redirect.snippet', content: source('search-redirect/quantumultX.snippet') },
    ];
    // A remote URL is required: local GeoIP script path support is not established.
    if (scriptUrl) artifacts.push({
      path: 'fragments/geoip.conf',
      content: '# General-section fragment. Merge into the existing profile; this is not a rewrite subscription.\n[general]\ngeo_location_checker=http://ipwho.is/?lang=zh-CN, ' + scriptUrl + '\n',
    });
    return artifacts;
  }
  if (client === 'surge') {
    const scriptPath = publicScript(baseUrl, client) || '../scripts/geoip.js';
    return [
      { path: 'scripts/geoip.js', content: nativeScript('surge') },
      {
        path: 'modules/geoip.sgmodule',
        content: '#!name=NetAtlas GeoIP\n#!desc=Manual GeoIP lookup via the existing 节点选择 policy; no policy selection is changed. Requires the named policy and a published script URL or the documented local layout.\n\n[Script]\natlas-geoip = type=generic,script-path=' + scriptPath + ',timeout=8,argument=节点选择\n\n[Panel]\natlas-geoip = title=GeoIP lookup,content=Refresh to query via 节点选择,style=info,script-name=atlas-geoip\n',
      },
      { path: 'rewrites/search-redirect.sgmodule', content: source('search-redirect/surge.sgmodule') },
    ];
  }
  return [];
}

export function renderFeatures(client,options={}) {
  return [...renderBuiltinFeatures(client,options),...renderAntiAd(client,options),...renderHttpsUpgrade(client,options),...renderQuickSearch(client,options),...renderRedirects(client,options),...renderBiliIntlRegion(client,options),...renderIntegrations(client,options),...renderBodyReplacement(client,options),...renderResourceParsers(client,options),...renderQxCompatibility(client,options)];
}
