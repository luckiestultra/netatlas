// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 NetAtlas contributors.
// Adapted from blackmatrix7's Redirect. Complete source, GPL v2 license,
// changes and NO WARRANTY notice are in src/features/redirects/.
import { stringify } from 'yaml';
import catalog from '../../src/features/redirects/rules.json' with { type: 'json' };

const clients = new Set(['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']);
const defaultBase = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const finish = '(?![\\s\\S])';
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Only a finite domain grammar is allowed. Expanding before rendering means an
// accidental dot/wildcard in an upstream regex cannot become a hostname match.
export function expandRedirectHostAst(ast) {
  let values;
  if (ast?.type === 'hosts' && Array.isArray(ast.values) && ast.values.length) {
    values = [...ast.values];
    for (const host of values) {
      if (typeof host !== 'string' || host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) throw new Error('Invalid canonical redirect host');
    }
  } else if (ast?.type === 'optional-www') {
    const base = expandRedirectHostAst(ast.child);
    if (base.some((host) => host.startsWith('www.'))) throw new Error('Optional www host must not already contain www');
    values = base.flatMap((host) => [host, 'www.' + host]);
  } else throw new Error('Unsupported redirect host AST');
  if (new Set(values).size !== values.length) throw new Error('Duplicate redirect host aliases');
  return values;
}

export const redirectMitmHosts = Object.freeze(catalog.actions.filter((action) => action.schemes.includes('https')).flatMap((action) => expandRedirectHostAst(action.host)).sort());
export const biliIntlMitmHosts = Object.freeze(catalog.regionActions.map((action) => action.host).sort());
if (new Set(redirectMitmHosts).size !== redirectMitmHosts.length) throw new Error('Redirect actions contain overlapping host aliases');

const generalRules = catalog.actions.map((action) => {
  const hosts = expandRedirectHostAst(action.host).map(escape).join('|');
  const protocol = action.schemes.length === 2 ? 'https?' : action.schemes[0];
  const prefix = '^' + protocol + ':\\/\\/';
  if (action.mode === 'upgrade') return {
    pattern: prefix + '(' + hosts + ')(\\/[^\\s#]*)' + finish,
    replacement: 'https://$1$2',
  };
  if (action.mode === 'google') return {
    pattern: prefix + '(?:' + hosts + ')(\\/[^\\s#]*)' + finish,
    replacement: action.target + '$1',
  };
  const suffix = action.mode === 'root' ? '\\/' : action.mode === 'firefox' ? '\\/(?:download\\/)?' : '\\/[^\\s#]*';
  return { pattern: prefix + '(?:' + hosts + ')' + suffix + finish, replacement: action.target };
});

const valueAtom = "(?:[A-Za-z0-9._~!$'()*+,;=:@\\/?-]|%[0-9A-Fa-f]{2})";
const keyAtom = "(?:[A-Za-z0-9._~!$'()*+,;:@\\/?-]|%[0-9A-Fa-f]{2})";
// Reject duplicate target keys, including percent-encoded spellings, while
// preserving encoded names and values of unrelated parameters byte for byte.
const encodedKey = (name) => [...name].map((character) => {
  const hex = character.charCodeAt(0).toString(16).padStart(2, '0').replace(/[a-f]/g, (letter) => '[' + letter + letter.toUpperCase() + ']');
  return '(?:' + escape(character) + '|%' + hex + ')';
}).join('');
const other = '(?!(?:' + encodedKey('s_locale') + '|' + encodedKey('sim_code') + ')(?:=|&|$))' + keyAtom + '+(?:=' + valueAtom + '*)?';
const regionRules = catalog.regionActions.flatMap((action) => {
  const path = action.pathKind === 'app'
    ? '\\/(?:x\\/)?(?:intl|dm|reply|history|v[0-9]\\/(?:fav|msgfeed))(?:\\/[^?\\s#]*)?'
    : '\\/x\\/intl\\/passport-login\\/[^?\\s#]+';
  const start = '(^https?:\\/\\/' + escape(action.host) + path + '\\?(?:' + other + '&)*)';
  const middle = '((?:&' + other + ')*)';
  const end = '((?:&' + other + ')*)' + finish;
  return [{
    pattern: start + 's_locale=(?!zh-Hans_PH(?:&' + other + ')*&sim_code=51503(?:&|$))zh-Hans_[A-Z]{2}' + middle + '&sim_code=[0-9]+' + end,
    replacement: '$1s_locale=zh-Hans_PH$2&sim_code=51503$3',
  }, {
    pattern: start + 'sim_code=(?!51503(?:&' + other + ')*&s_locale=zh-Hans_PH(?:&|$))[0-9]+' + middle + '&s_locale=zh-Hans_[A-Z]{2}' + end,
    replacement: '$1sim_code=51503$2&s_locale=zh-Hans_PH$3',
  }];
});

function sourceBase(baseUrl = defaultBase) {
  const normalized = String(baseUrl).replace(/\/+$/, '');
  const url = new URL(normalized);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[,\s]/.test(normalized)) throw new Error('Redirects baseUrl must be an HTTPS directory URL without credentials, query, fragment or whitespace');
  return normalized + '/src/features/redirects/';
}

function native(client, { baseUrl, region }) {
  if (!clients.has(client)) throw new Error('Unknown client: ' + client);
  if (client === 'mihomo' || client === 'singBox') return [];
  const source = sourceBase(baseUrl);
  const id = region ? 'biliintl-region' : 'redirects';
  const name = region ? 'NetAtlas BiliIntl Region' : 'NetAtlas Redirects';
  const description = region
    ? 'Optional BiliIntl PH parameters: s_locale=zh-Hans_PH and sim_code=51503; existing trusted MITM CA required.'
    : 'Optional official-site, HTTP upgrade and Google China redirects; existing trusted MITM CA required for listed HTTPS hosts.';
  const rules = region ? regionRules : generalRules;
  const hosts = region ? biliIntlMitmHosts : redirectMitmHosts;
  const notice = [
    '# SPDX-License-Identifier: GPL-2.0-only',
    '# Adapted from Redirect by blackmatrix7 (GPL-2.0); separate from repository MIT-licensed code.',
    '# Changed by NetAtlas on 2026-10-31: finite exact aliases, URL safeguards, no HTTP destination downgrades; region actions separated.',
    '# Complete original source: ' + source + 'upstream/Redirect.conf.txt',
    '# Source SHA-256: ' + catalog.upstream.sourceSha256,
    '# Changes and limitations: ' + source + 'NOTICE.md',
    '# Full GPL version 2 license: ' + source + 'LICENSE',
    '# Provided WITHOUT ANY WARRANTY; see the GNU General Public License for details.',
    '# Optional; absent from default profiles. Importing opts in to the listed redirects and exact HTTPS MITM hosts.',
    '# Requires your existing trusted MITM CA; no CA, certificate, runtime script, storage or background request is supplied.',
    '# Native app import/interception has not been run. A 302 can change a followed non-GET method.',
  ].join('\n') + '\n';
  const classic = rules.map(({ pattern, replacement }) => pattern + ' ' + replacement + ' 302').join('\n');
  const hostLine = 'hostname = ' + hosts.join(', ');
  if (client === 'quantumultX') return [{ path: 'rewrites/' + id + '.snippet', content: '#!name=' + name + '\n#!desc=' + description + '\n' + notice + '\n' + rules.map(({ pattern, replacement }) => pattern + ' url 302 ' + replacement).join('\n') + '\n\n' + hostLine + '\n' }];
  if (client === 'surge') return [{ path: 'rewrites/' + id + '.sgmodule', content: '#!name=' + name + '\n#!desc=' + description + '\n' + notice + '\n[URL Rewrite]\n' + classic + '\n\n[MITM]\nhostname = %APPEND% ' + hosts.join(', ') + '\n' }];
  if (client === 'loon') return [{
    path: 'rewrites/' + id + '.plugin',
    content: '#!name = ' + name + '\n#!desc = ' + description + '\n#!author = blackmatrix7, NetAtlas contributors\n#!loon_version = 3.5.1(978)\n#!date = 2026-10-31\n' + notice + '\n[Rewrite]\n' + rules.map(({ pattern, replacement }) => 'request if ${url} ~= /' + pattern + '/ as redirect then redirect(302, "' + replacement.replace(/\$(\d+)/g, '${redirect.$1}') + '")').join('\n') + '\n\n[MITM]\n' + hostLine + '\n',
  }];
  if (client === 'shadowrocket') return [{ path: 'rewrites/' + id + '.conf', content: '# Manual merge fragment: merge rewrite lines and append these exact hosts to your existing MITM hostname list.\n# Preserve existing configuration; not a complete profile or vendor-verified standalone module.\n' + notice + '\n[URL Rewrite]\n' + classic + '\n\n[MITM]\n' + hostLine + '\n' }];
  if (client === 'egern') return [{ path: 'rewrites/' + id + '.yaml', content: notice + '\n' + stringify({ name, description, author: 'blackmatrix7; adapted by NetAtlas contributors', homepage: 'https://github.com/luckiestultra/netatlas', url_rewrites: rules.map(({ pattern, replacement }) => ({ match: pattern, location: replacement, status_code: 302 })), mitm: { hostnames: hosts } }) }];
  return [{ path: 'rewrites/' + id + '.stoverride', content: notice + '\n' + stringify({ name, desc: description, http: { 'url-rewrite': classic.split('\n'), mitm: hosts } }) }];
}

export function renderRedirects(client, { baseUrl } = {}) {
  return native(client, { baseUrl, region: false });
}

export function renderBiliIntlRegion(client, { baseUrl } = {}) {
  return native(client, { baseUrl, region: true });
}
