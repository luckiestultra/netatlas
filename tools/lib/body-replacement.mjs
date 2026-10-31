import { createBodyReplacer } from '../../src/features/body-replacement/core.mjs';
import { getClient } from './clients.mjs';
import { publicArtifactUrl } from './public-url.mjs';

// Native contracts: https://manual.nssurge.com/scripting/http-request.html
// https://manual.nssurge.com/scripting/http-response.html
export function renderBodyReplacement(client, { baseUrl } = {}) {
  getClient(client);
  if (client !== 'surge') return [];
  const script = '// SPDX-License-Identifier: MIT\n// Original NetAtlas body replacement utility.\n'
    + 'var NetAtlasBody = (' + createBodyReplacer.toString() + ')();\n'
    + '(function () {\n'
    + '  var type = typeof $script === "object" && $script && $script.type;\n'
    + '  var body = type === "http-response" ? (typeof $response === "object" && $response ? $response.body : undefined)\n'
    + '    : type === "http-request" ? (typeof $request === "object" && $request ? $request.body : undefined) : undefined;\n'
    + '  $done(NetAtlasBody.replace(body, typeof $argument === "string" ? $argument : undefined));\n'
    + '}());\n';
  const url = publicArtifactUrl(baseUrl, client, 'scripts/replace-body.js') || '../scripts/replace-body.js';
  return [
    { path: 'scripts/replace-body.js', content: script },
    { path: 'fragments/replace-body.conf', content: '# Optional setup example; every executable line is commented out.\n'
      + '# Select a URL and recipe yourself. HTTPS needs your existing trusted MITM CA for that host.\n'
      + '# Recipes: from->to or /from/gi->to; use percent-encoded JSON {"rules":[{"pattern":"from","replacement":"to","flags":"g"}]} for literal delimiters.\n'
      + '# This utility never changes headers, contacts a server or edits client settings.\n'
      + '[Script]\n# netatlas-replace = type=http-response,pattern=^https://example\\.invalid/only-this-path$,script-path=' + url + ',requires-body=true,max-size=1048576,argument=from->to\n' },
  ];
}
