import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderYouTubeEnhance, loadYouTubeEnhance } from '../../tools/lib/youtube-enhance.mjs';
import { renderFeatures } from '../../tools/lib/features.mjs';
import { renderManagedProfile } from '../../tools/lib/managed-profiles.mjs';
import { renderProfile } from '../../tools/lib/profiles.mjs';
import { runFixture, fixtureProgram, summarizeProgram } from '../helpers/youtube-fixtures.mjs';

const outputs = () => new Map(renderYouTubeEnhance('quantumultX').map(item => [item.path, item.content]));
const active = content => content.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
const request = worker => outputs().get('scripts/youtube-request' + (worker ? '-worker' : '') + '.js');
const response = () => outputs().get('scripts/youtube-response.js');
function isolated(result) {
  assert.equal(result.calls.length, 1, 'host completion must occur exactly once');
  assert.equal(result.network, 0);
  assert.deepEqual(result.capabilities, ['undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
  return result.calls[0];
}
function emptyResponse(result) {
  const done = isolated(result);
  assert.deepEqual(done.keys, ['status', 'headers', 'bodyBytes']);
  assert.equal(done.status, 'HTTP/1.1 200 OK');
  assert.deepEqual(done.headers, { 'Content-Type': 'text/plain' });
  assert.equal(done.response, null);
  assert.equal(done.bodyType, '[object Undefined]');
  assert.equal(done.bodyBytesType, '[object ArrayBuffer]');
  assert.deepEqual(done.bodyBytes, []);
}

test('both QX request variants adapt empty/mismatched-key responses to top-level status and ArrayBuffer bytes', () => {
  for (const worker of [false, true]) for (const scenario of ['empty', 'mismatch']) {
    const result = runFixture(request(worker), 'request', scenario);
    emptyResponse(result);
    assert.deepEqual(result.writes, scenario === 'mismatch' ? [{ key: 'YouTubeConfig', value: '{}' }] : []);
  }
});

test('privacy default neither intercepts initplayback nor returns a Worker URL when manually invoked', () => {
  const rules = active(outputs().get('rewrites/youtube-enhance.snippet'));
  assert.equal(rules.filter(line => line.includes(' url ')).length, 2);
  assert.doesNotMatch(rules.join('\n'), /initplayback|googlevideo|worker/);
  assert.deepEqual(rules.filter(line => line.startsWith('hostname')), ['hostname = youtubei.googleapis.com']);
  const done = isolated(runFixture(request(false), 'request', 'redirect'));
  assert.deepEqual(done.keys, []);
  assert.equal(done.url, undefined);
});

test('Worker behavior is a separate explicit opt-in and keeps the original default parameters', () => {
  const done = isolated(runFixture(request(true), 'request', 'redirect'));
  const url = new URL(done.url);
  assert.equal(url.origin, 'https://init-stream.maasea.workers.dev');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    ck: 'fixture-key', target: 'https://fixture.googlevideo.com/initplayback?x=1&ack=1',
    captionLang: 'off', blockUpload: 'true', blockImmersive: 'true', blockShorts: 'false',
  });
  const text = outputs().get('rewrites/youtube-enhance-worker.snippet');
  assert.match(text, /DISABLED BY DEFAULT/);
  assert.match(text, /runtime onesie clientKey and original playback target URL/);
  assert.deepEqual(active(text).filter(line => line.startsWith('hostname')), ['hostname = *.googlevideo.com']);
});

test('request header/exit paths and response binary/error paths complete once without network capabilities', () => {
  const headers = isolated(runFixture(request(false), 'request', 'headers'));
  assert.deepEqual(headers.headers, { 'User-Agent': 'fixture' });
  assert.deepEqual(isolated(runFixture(request(false), 'request', 'exit')).keys, []);
  const binary = isolated(runFixture(response(), 'response'));
  assert.deepEqual(binary.keys, ['bodyBytes']);
  assert.equal(binary.bodyBytesType, '[object ArrayBuffer]');
  assert.ok(binary.bodyBytes.length > 0);
  assert.deepEqual(isolated(runFixture(response(), 'response', 'error')).keys, []);
});

test('non-QX request behavior and the entire response bundle remain unchanged beneath notices', () => {
  const { contents } = loadYouTubeEnhance();
  const raw = contents.get('upstream/youtube.request.js');
  assert.ok(response().endsWith(contents.get('upstream/youtube.response.js')));
  for (const host of ['surge', 'loon']) for (const scenario of ['empty', 'mismatch', 'headers', 'exit', 'redirect']) {
    const expected = runFixture(raw, 'request', scenario, host);
    for (const worker of [false, true]) assert.deepEqual(runFixture(request(worker), 'request', scenario, host), expected);
  }
});

test('the three original patterns and two hostnames are preserved across the separated native resources', () => {
  const { contents } = loadYouTubeEnhance();
  const original = contents.get('upstream/YouTube.Enhance.sgmodule');
  const patterns = [...original.matchAll(/(?:^|,)pattern=([^,]+),requires-body=1/gm)].map(match => match[1]);
  const out = outputs();
  const lines = [...active(out.get('rewrites/youtube-enhance.snippet')), ...active(out.get('rewrites/youtube-enhance-worker.snippet'))];
  const emitted = lines.filter(line => line.includes(' url '));
  assert.deepEqual(emitted.map(line => line.split(' url ')[0]).sort(), patterns.sort());
  assert.equal(emitted.filter(line => line.includes('script-response-body')).length, 1);
  assert.equal(emitted.filter(line => line.includes('script-request-body')).length, 2);
  assert.deepEqual(lines.filter(line => line.startsWith('hostname = ')).flatMap(line => line.slice(11).split(', ')).sort(), ['*.googlevideo.com', 'youtubei.googleapis.com']);
  assert.ok(emitted.every(line => line.includes('https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/scripts/')));
  assert.doesNotMatch(lines.join('\n'), /ca[-_]p12|ca[-_]passphrase|\[task|force-policy|opt-parser/i);
});

test('fixed source hashes, complete dependency notices and optional feature metadata are explicit', () => {
  const { registry } = loadYouTubeEnhance();
  assert.equal(registry.commit, '65075cdb388fc5e3094afd7e7314c67b243f3525');
  assert.equal(registry.tree, '922245ec4d480e68a69e6a05b63f84d97f5eb219');
  assert.equal(registry.dependenciesFullyLocked, false);
  for (const script of [request(false), request(true), response()]) {
    for (const text of ['Apache License', 'Copyright 2008 Google Inc.', 'Copyright (c) 2016, Daniel Wirtz', 'CC0 1.0 Universal', 'Maasea', 'Timo Stamm', 'AnonyCo']) assert.ok(script.includes(text), text);
    assert.doesNotMatch(script, /\/private\/tmp|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
  }
  const metadata = JSON.parse(readFileSync(new URL('../../metadata/features.json', import.meta.url), 'utf8'));
  for (const id of ['youtube-enhance', 'youtube-enhance-worker']) {
    const feature = metadata.features.find(item => item.id === id);
    assert.equal(feature.defaultEnabled, false);
    assert.equal(feature.license, 'Apache-2.0 AND BSD-3-Clause AND CC0-1.0');
    assert.equal(feature.clients.quantumultX.nativeApp, 'not-run');
  }
});

test('YouTube resources remain QX-only, absent from default/standalone and support a public mirror', () => {
  const paths = [...outputs().keys()];
  for (const client of ['surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']) assert.deepEqual(renderYouTubeEnhance(client), []);
  for (const client of ['quantumultX', 'surge']) for (const render of [renderManagedProfile, renderProfile]) assert.doesNotMatch(render(client).content, /youtube-enhance|youtube-request|youtube-response/);
  const featurePaths = renderFeatures('quantumultX').map(item => item.path);
  for (const path of paths) assert.ok(featurePaths.includes(path));
  const mirrored = new Map(renderYouTubeEnhance('quantumultX', { baseUrl: 'https://mirror.example/netatlas/' }).map(item => [item.path, item.content]));
  assert.match(mirrored.get('rewrites/youtube-enhance.snippet'), /https:\/\/mirror\.example\/netatlas\/clients\/quantumultX\/scripts\/youtube-response\.js/);
  assert.equal(mirrored.get('scripts/youtube-response.js'), response());
  for (const baseUrl of ['http://example.test', 'https://user:pass@example.test', 'https://example.test/?token=fixture']) assert.throws(() => renderYouTubeEnhance('quantumultX', { baseUrl }));
});

test('JavaScriptCore executes the same QX completion/privacy fixtures without host network or file APIs', { skip: process.platform !== 'darwin' }, () => {
  const runner = fileURLToPath(new URL('../helpers/youtube-jsc.py', import.meta.url));
  const cases = [
    [request(false), 'request', 'empty'], [request(true), 'request', 'mismatch'],
    [request(false), 'request', 'redirect'], [request(true), 'request', 'redirect'],
    [response(), 'response', 'empty'], [response(), 'response', 'error'],
  ];
  for (const [source, kind, scenario] of cases) {
    const run = spawnSync('python3', [runner], { input: fixtureProgram(kind, scenario) + '\n' + source + '\n' + summarizeProgram, encoding: 'utf8', timeout: 10000, maxBuffer: 2_000_000 });
    assert.equal(run.status, 0, run.stderr + run.stdout);
    const result = JSON.parse(run.stdout);
    assert.deepEqual(result, runFixture(source, kind, scenario));
    isolated(result);
  }
});
