// SPDX-License-Identifier: MIT
// Copyright (c) 2026 luckiestultra
// Original implementation. The unlicensed Matrix file is a functional inventory
// reference only; none of its regular expressions or configuration is included.
import { stringify } from 'yaml';
import catalog from '../../src/features/quick-search/actions.json' with { type: 'json' };

const clients = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const defaultBase = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';

function sourceBase(baseUrl = defaultBase) {
  const normalized = String(baseUrl).replace(/\/+$/, '');
  const url = new URL(normalized);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[,\s]/.test(normalized)) {
    throw new Error('Quick-search baseUrl must be an HTTPS directory URL without credentials, query, fragment or whitespace');
  }
  return normalized + '/src/features/quick-search/';
}

// Match a single literal q key, in any position. Other keys are deliberately
// plain ASCII, so percent-encoded aliases cannot smuggle a second decoded q.
// RFC 3986 query characters and complete percent triplets are accepted verbatim.
// All slashes are escaped for Loon's /regex/ literal as well as classic clients.
const atom = "(?:[A-Za-z0-9._~!$'()*+,;=:@\\/?-]|%[0-9A-Fa-f]{2})";
const other = '(?!q(?:=|&|$))[A-Za-z0-9_.~-]+(?:=' + atom + '*)?';
const start = '^https:\\/\\/duckduckgo\\.com\\/\\?(?:' + other + '&)*q=';
// Strict end avoids the pre-final-newline behavior of a bare dollar anchor.
const end = '(?:&' + other + ')*(?![\\s\\S])';
const delimiter = '(?:\\+|%20|%2[bB])';
const nonblank = '(?!(?:\\+|%20)*(?:&|$))' + atom + '+';
const terms = catalog.actions.filter((action) => action.kind === 'search' || action.kind === 'translation');
const storefronts = catalog.actions.filter((action) => action.kind === 'storefront');
const commands = terms.map((action) => action.command).join('|');
const countries = storefronts.map((action) => action.command).join('|');

// A form-encoded source value is safe to preserve only in another query value.
// In a path, raw '+' would lose its space meaning and raw '?' would start a new
// query. Keep every search/translation/fallback placeholder in query context.
for (const action of catalog.actions.filter((entry) => entry.kind !== 'storefront')) {
  const marker = 'NETATLAS_QUERY_VALUE';
  const target = new URL(action.target.replace('{query}', marker));
  if (action.target.split('{query}').length !== 2 || target.protocol !== 'https:' || target.username || target.password || target.pathname.includes(marker) || target.hash.includes(marker) || ![...target.searchParams.values()].some((value) => value.includes(marker))) {
    throw new Error('Quick-search term must occur once inside an HTTPS query value');
  }
}

const rules = catalog.actions.map((action) => {
  let pattern;
  if (action.kind === 'storefront') pattern = start + action.command + end;
  else if (action.kind === 'fallback') {
    // A malformed or empty known command is never turned into a generic search.
    pattern = start + '(?!(?:' + commands + ')' + delimiter + ')(?!(?:' + countries + ')(?:' + delimiter + '|&|$))(' + nonblank + ')' + end;
  } else pattern = start + action.command + delimiter + '(' + nonblank + ')' + end;
  return { pattern, replacement: action.target.replace('{query}', '$1') };
});

export function renderQuickSearch(client, { baseUrl } = {}) {
  if (!clients.has(client)) throw new Error('Unknown client: ' + client);
  if (client === 'mihomo' || client === 'singBox') return [];
  const source = sourceBase(baseUrl);
  const notice = [
    '# SPDX-License-Identifier: MIT',
    '# Original NetAtlas implementation; command inventory reference is not copied code.',
    '# Source, endpoint changes and limitations: ' + source + 'NOTICE.md',
    '# License: ' + source + 'LICENSE',
    '# Optional; absent from default profiles. Importing this resource opts in to its redirects.',
    '# Requires an existing trusted MITM CA and enabled HTTPS rewriting for duckduckgo.com only.',
    '# This file supplies no CA, runtime script, storage, background request or TLS bypass.',
    '# Native app import/interception has not been run. Shadowrocket is a manual merge fragment.',
    '# Apple commands open a legacy storefront route; no account-country change is promised.',
  ].join('\n') + '\n';
  const classic = rules.map(({ pattern, replacement }) => pattern + ' ' + replacement + ' 302').join('\n');
  const description = 'Optional DuckDuckGo prefix searches, Apple storefront links, translations and Google fallback; existing MITM CA required.';
  if (client === 'quantumultX') return [{
    path: 'rewrites/quick-search.snippet',
    content: '#!name=NetAtlas Quick Search\n#!desc=' + description + '\n' + notice + '\n' + rules.map(({ pattern, replacement }) => pattern + ' url 302 ' + replacement).join('\n') + '\n\nhostname = duckduckgo.com\n',
  }];
  if (client === 'surge') return [{
    path: 'rewrites/quick-search.sgmodule',
    content: '#!name=NetAtlas Quick Search\n#!desc=' + description + '\n' + notice + '\n[URL Rewrite]\n' + classic + '\n\n[MITM]\nhostname = %APPEND% duckduckgo.com\n',
  }];
  if (client === 'loon') return [{
    path: 'rewrites/quick-search.plugin',
    content: '#!name = NetAtlas Quick Search\n#!desc = ' + description + '\n#!author = NetAtlas contributors\n#!loon_version = 3.5.1(978)\n#!date = 2026-10-31\n' + notice + '\n[Rewrite]\n' + rules.map(({ pattern, replacement }) =>
      'request if ${url} ~= /' + pattern + '/ as search then redirect(302, "' + replacement.replace(/\$(\d+)/g, '${search.$1}') + '")'
    ).join('\n') + '\n\n[MITM]\nhostname = duckduckgo.com\n',
  }];
  if (client === 'shadowrocket') return [{
    path: 'rewrites/quick-search.conf',
    content: '# Manual merge fragment: merge URL Rewrite lines and add duckduckgo.com to your existing MITM hostname list.\n# Preserve all existing sections and MITM hosts. This is not a complete profile or vendor-verified standalone module.\n' + notice + '\n[URL Rewrite]\n' + classic + '\n\n[MITM]\nhostname = duckduckgo.com\n',
  }];
  if (client === 'egern') return [{
    path: 'rewrites/quick-search.yaml',
    content: notice + '\n' + stringify({
      name: 'NetAtlas Quick Search', description, author: 'NetAtlas contributors',
      homepage: 'https://github.com/luckiestultra/netatlas',
      url_rewrites: rules.map(({ pattern, replacement }) => ({ match: pattern, location: replacement, status_code: 302 })),
      mitm: { hostnames: ['duckduckgo.com'] },
    }),
  }];
  return [{
    path: 'rewrites/quick-search.stoverride',
    content: notice + '\n' + stringify({
      name: 'NetAtlas Quick Search', desc: description,
      http: { 'url-rewrite': classic.split('\n'), mitm: ['duckduckgo.com'] },
    }),
  }];
}
