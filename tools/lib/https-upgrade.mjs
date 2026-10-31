// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 NetAtlas contributors.
// This optional feature adapts blackmatrix7's Redirect rules. See its complete
// source, change notice, GPL-2.0 license and NO WARRANTY terms in
// src/features/https-upgrade/. This feature is separate from MIT-licensed code.
import { stringify } from 'yaml';
import catalog from '../../src/features/https-upgrade/rules.json' with { type: 'json' };

const clients = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const defaultBase = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';

function sourceBase(baseUrl = defaultBase) {
  const normalized = String(baseUrl).replace(/\/+$/, '');
  const url = new URL(normalized);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[,\s]/.test(normalized)) {
    throw new Error('HTTPS-upgrade baseUrl must be an HTTPS directory URL without credentials, query, fragment or whitespace');
  }
  return normalized + '/src/features/https-upgrade/';
}

export function renderHttpsUpgrade(client, { baseUrl } = {}) {
  if (!clients.has(client)) throw new Error('Unknown client: ' + client);
  if (client === 'mihomo' || client === 'singBox') return [];
  const source = sourceBase(baseUrl);
  const notice = [
    '# SPDX-License-Identifier: GPL-2.0-only',
    '# Adapted from Redirect by blackmatrix7 (GPL-2.0), not covered by the repository MIT license.',
    '# Changed by NetAtlas on 2026-10-31: keep six same-host HTTP upgrades; preserve path and query.',
    '# Complete upstream source, modifications and license: ' + source,
    '# License: ' + source + 'LICENSE',
    '# Provided WITHOUT ANY WARRANTY; see the GNU General Public License for details.',
    '# Optional; not included in default profiles. Importing this resource enables its redirects.',
    '# Only HTTP URLs are matched. No MITM certificate, script, storage or background request is used.',
    '# A 302 may change a non-GET method when the caller follows it. This is not HSTS.',
  ].join('\n') + '\n';
  // Avoid permissive host wildcards. The strict end assertion also rejects raw
  // trailing newlines, unlike a bare "$" in several native regex engines.
  const rules = catalog.rules.map(({ host }) => ({
    pattern: '^http:\\/\\/(' + host.replaceAll('.', '\\.') + ')(\\/[^\\s#]*)(?![\\s\\S])',
    replacement: 'https://$1$2',
  }));
  const classic = rules.map(({ pattern, replacement }) => pattern + ' ' + replacement + ' 302').join('\n');
  if (client === 'quantumultX') return [{
    path: 'rewrites/https-upgrade.snippet',
    content: notice + '\n' + rules.map(({ pattern, replacement }) => pattern + ' url 302 ' + replacement).join('\n') + '\n',
  }];
  if (client === 'surge') return [{
    path: 'rewrites/https-upgrade.sgmodule',
    content: '#!name=NetAtlas HTTPS Upgrade\n#!desc=Optional six-host HTTP to HTTPS redirects; no MITM required.\n' + notice + '\n[URL Rewrite]\n' + classic + '\n',
  }];
  if (client === 'loon') return [{
    path: 'rewrites/https-upgrade.plugin',
    content: '#!name = NetAtlas HTTPS Upgrade\n#!desc = Optional six-host HTTP to HTTPS redirects; no MITM required.\n#!author = blackmatrix7, NetAtlas contributors\n#!loon_version = 3.5.1(978)\n#!date = 2026-10-31\n' + notice + '\n[Rewrite]\n' + rules.map(({ pattern }) =>
      'request if ${url} ~= /' + pattern + '/ as target then redirect(302, "https://${target.1}${target.2}")'
    ).join('\n') + '\n',
  }];
  if (client === 'shadowrocket') return [{
    path: 'rewrites/https-upgrade.conf',
    content: '# Manual merge fragment: merge these lines into your existing [URL Rewrite] section.\n# Not a complete profile or a vendor-verified standalone module.\n' + notice + '\n[URL Rewrite]\n' + classic + '\n',
  }];
  if (client === 'egern') return [{
    path: 'rewrites/https-upgrade.yaml',
    content: notice + '\n' + stringify({
      name: 'NetAtlas HTTPS Upgrade',
      description: 'Optional six-host HTTP to HTTPS redirects; no MITM required.',
      author: 'blackmatrix7; adapted by NetAtlas contributors',
      homepage: 'https://github.com/luckiestultra/netatlas',
      url_rewrites: rules.map(({ pattern, replacement }) => ({ match: pattern, location: replacement, status_code: 302 })),
    }),
  }];
  return [{
    path: 'rewrites/https-upgrade.stoverride',
    content: notice + '\n' + stringify({
      name: 'NetAtlas HTTPS Upgrade',
      desc: 'Optional six-host HTTP to HTTPS redirects; no MITM required.',
      http: { 'url-rewrite': classic.split('\n') },
    }),
  }];
}
