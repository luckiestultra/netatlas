// SPDX-License-Identifier: Apache-2.0
// Original NetAtlas adapter for separately licensed, pinned Maasea bundles.
import assert from 'node:assert/strict';
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getClient } from './clients.mjs';
import { publicArtifactUrl } from './public-url.mjs';

const root = new URL('../../src/features/youtube-enhance/', import.meta.url);
const defaultBase = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const allowed = new Set(['upstream/youtube.request.js', 'upstream/youtube.response.js', 'upstream/YouTube.Enhance.sgmodule', 'LICENSE', 'licenses/protobuf-ts-Apache-2.0.txt', 'licenses/protobuf-google-BSD-3-Clause.txt', 'licenses/protobuf-daniel-wirtz-BSD-3-Clause.txt', 'licenses/polyfill-CC0-1.0.txt']);

export function loadYouTubeEnhance() {
  for (const path of ['', 'upstream/', 'licenses/', 'provenance.json', 'NOTICE.md']) assert.equal(lstatSync(new URL(path, root)).isSymbolicLink(), false);
  const registry = JSON.parse(readFileSync(new URL('provenance.json', root), 'utf8'));
  assert.equal(registry.version, 1);
  assert.equal(registry.repository, 'Maasea/sgmodule');
  assert.match(registry.commit, /^[a-f0-9]{40}$/);
  assert.match(registry.tree, /^[a-f0-9]{40}$/);
  assert.deepEqual(registry.files.map(file => file.path), ['upstream/youtube.request.js', 'upstream/youtube.response.js', 'upstream/YouTube.Enhance.sgmodule']);
  assert.equal(new Set([...registry.files, ...registry.licenses].map(file => file.path)).size, allowed.size);
  const contents = new Map();
  for (const file of [...registry.files, ...registry.licenses]) {
    assert.ok(allowed.has(file.path));
    const path = new URL(file.path, root);
    assert.equal(lstatSync(path).isSymbolicLink(), false);
    const bytes = readFileSync(path);
    assert.equal(bytes.length, file.bytes, 'YouTube source/license byte count changed');
    assert.equal(sha256(bytes), file.sha256, 'YouTube source/license hash changed');
    contents.set(file.path, bytes.toString('utf8'));
  }
  return { registry, contents };
}

const emptyBefore = '$done({response:{status:200,headers:{"Content-Type":"text/plain"},body:new Uint8Array}})';
const emptyAfter = 'R.className==="QuanX"?R.done({response:{status:"200 OK",headers:{"Content-Type":"text/plain"},bodyBytes:new Uint8Array}}):' + emptyBefore;
const redirectBefore = '$done({url:n.redirectUrl})';
const redirectAfter = 'R.className==="QuanX"?R.exit():' + redirectBefore;
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'Pinned YouTube patch location changed');
  return source.replace(before, after);
}

export function renderYouTubeEnhance(client, { baseUrl = defaultBase } = {}) {
  getClient(client);
  if (client !== 'quantumultX') return [];
  const base = new URL(baseUrl);
  assert.equal(base.protocol, 'https:', 'YouTube public base must use HTTPS');
  const url = path => publicArtifactUrl(baseUrl, client, path);
  const { registry, contents } = loadYouTubeEnhance();
  const notice = readFileSync(new URL('NOTICE.md', root), 'utf8');
  const banner = '/*!\nSPDX-License-Identifier: Apache-2.0 AND BSD-3-Clause AND CC0-1.0\n' + notice + '\n' + registry.licenses.map(file => contents.get(file.path)).join('\n\n') + '\n*/\n';
  const requestWorker = replaceOnce(contents.get('upstream/youtube.request.js'), emptyBefore, emptyAfter);
  // Privacy default: do not return the upstream Worker redirect even if this script is invoked manually for initplayback.
  const request = replaceOnce(requestWorker, redirectBefore, redirectAfter);
  const header = '# SPDX-License-Identifier: Apache-2.0\n# Adapted from Maasea/sgmodule@' + registry.commit + '.\n# Optional; native QX import/playback has not been tested. No CA is supplied.\n# Source, licenses, changes and limitations: ' + String(baseUrl).replace(/\/+$/, '') + '/src/features/youtube-enhance/NOTICE.md\n';
  const responsePattern = String.raw`^https:\/\/youtubei\.googleapis\.com\/(youtubei\/v1\/(browse|next|player|search|reel\/reel_watch_sequence|guide|account\/get_setting|get_watch|log_event|config))(\?(.*))?$`;
  const initPattern = String.raw`^https?:\/\/[\w-]+\.googlevideo\.com\/initplayback.+&ack.*`;
  const logPattern = String.raw`^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/log_event`;
  return [
    { path: 'scripts/youtube-request.js', content: banner + request },
    { path: 'scripts/youtube-response.js', content: banner + contents.get('upstream/youtube.response.js') },
    { path: 'scripts/youtube-request-worker.js', content: banner + requestWorker },
    { path: 'rewrites/youtube-enhance.snippet', content: header + '# Response/log_event only. No initplayback interception or third-party Worker redirect.\n' + responsePattern + ' url script-response-body ' + url('scripts/youtube-response.js') + '\n' + logPattern + ' url script-request-body ' + url('scripts/youtube-request.js') + '\n\nhostname = youtubei.googleapis.com\n' },
    { path: 'rewrites/youtube-enhance-worker.snippet', content: header + '# DISABLED BY DEFAULT: separate manual opt-in; requires youtube-enhance.\n# Sends the runtime onesie clientKey and original playback target URL to https://init-stream.maasea.workers.dev/.\n# Matching cached keys redirect to that Worker; missing/mismatched keys return an empty response as upstream does.\n' + initPattern + ' url script-request-body ' + url('scripts/youtube-request-worker.js') + '\n\nhostname = *.googlevideo.com\n' },
  ];
}
