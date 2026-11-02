import { readFileSync } from 'node:fs';
import { renderGeoIPScript, quantumultXGeoIPChecker } from './geoip.mjs';
import { renderAntiAd } from './anti-ad.mjs';
import { publicArtifactUrl } from './public-url.mjs';
import { renderHttpsUpgrade } from './https-upgrade.mjs';
import { renderQuickSearch } from './quick-search.mjs';
import { renderRedirects, renderBiliIntlRegion } from './redirects.mjs';
import { renderIntegrations } from './integrations.mjs';
import { renderBodyReplacement } from './body-replacement.mjs';
import { renderResourceParsers } from './resource-parsers.mjs';
import { renderQxCompatibility } from './qx-compat.mjs';
import { renderYouTubeEnhance } from './youtube-enhance.mjs';
import { renderScriptRuntime } from './script-runtime.mjs';
import { renderRewriteActions } from './rewrite-actions.mjs';

const clientIds = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const source = (path) => readFileSync(new URL('../../src/features/' + path, import.meta.url), 'utf8');


function publicScript(baseUrl, client) {
  return publicArtifactUrl(baseUrl,client,'scripts/geoip.js');
}

function renderBuiltinFeatures(client, { baseUrl } = {}) {
  if (!clientIds.has(client)) throw new Error('Unknown client: ' + client);
  if (client === 'quantumultX') {
    const checker = quantumultXGeoIPChecker(baseUrl);
    const artifacts = [
      { path: 'scripts/geoip.js', content: renderGeoIPScript('quantumultX') },
      { path: 'rewrites/search-redirect.snippet', content: source('search-redirect/quantumultX.snippet') },
      { path: 'rules/app-exceptions.list', content: source('app-exceptions/quantumultX.list') },
      { path: 'rewrites/wps-account.snippet', content: source('wps-account/quantumultX.snippet') },
    ];
    // A remote URL is required: local GeoIP script path support is not established.
    if (checker) artifacts.push({
      path: 'fragments/geoip.conf',
      content: '# General-section fragment. Merge into the existing profile; this is not a rewrite subscription.\n[general]\n' + checker + '\n',
    });
    return artifacts;
  }
  if (client === 'surge') {
    const scriptPath = publicScript(baseUrl, client) || '../scripts/geoip.js';
    return [
      { path: 'scripts/geoip.js', content: renderGeoIPScript('surge') },
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
  return [...renderBuiltinFeatures(client,options),...renderAntiAd(client,options),...renderHttpsUpgrade(client,options),...renderQuickSearch(client,options),...renderRedirects(client,options),...renderBiliIntlRegion(client,options),...renderIntegrations(client,options),...renderBodyReplacement(client,options),...renderResourceParsers(client,options),...renderQxCompatibility(client,options),...renderYouTubeEnhance(client,options),...renderScriptRuntime(client,options),...renderRewriteActions(client,options)];
}
