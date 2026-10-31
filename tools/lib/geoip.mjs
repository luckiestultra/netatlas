import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createGeoIP } from '../../src/features/geoip/core.mjs';
import { publicArtifactUrl } from './public-url.mjs';

const source = path => readFileSync(new URL('../../src/features/geoip/' + path, import.meta.url), 'utf8');

export function renderGeoIPScript(client) {
  if (!['quantumultX', 'surge'].includes(client)) throw new Error('Unsupported GeoIP adapter: ' + client);
  return '// Generated from the portable GeoIP core and an explicit native adapter.\n'
    + '/* Chinese territory labels: Unicode CLDR 48 (Unicode-3.0).\n' + source('localization/LICENSE-Unicode').trimEnd() + '\n*/\n'
    + 'var AtlasGeoIP = (' + createGeoIP.toString() + ')();\n' + source(client + '.js');
}

export function quantumultXGeoIPChecker(baseUrl) {
  const url = publicArtifactUrl(baseUrl, 'quantumultX', 'scripts/geoip.js');
  if (!url) return null;
  // QX caches by the complete script URL. A script update needs a new cache key.
  const revision = createHash('sha256').update(renderGeoIPScript('quantumultX')).digest('hex');
  return 'geo_location_checker=http://ipwho.is/?lang=zh-CN, ' + url + '?v=' + revision;
}
