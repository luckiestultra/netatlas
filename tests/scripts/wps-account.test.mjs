import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFeatures } from '../../tools/lib/features.mjs';
import { renderManagedProfile } from '../../tools/lib/managed-profiles.mjs';
import { renderProfile } from '../../tools/lib/profiles.mjs';

const path = 'rewrites/wps-account.snippet';
const scriptUrl = 'https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Wps.js';
const statement = String.raw`^https?:\/\/[a-z-]*account\.wps\.c(n|om)(:\d+|)\/api\/users url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Wps.js`;
const activeLines = text => text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
function output() {
  const artifact = renderFeatures('quantumultX').find(item => item.path === path);
  assert.ok(artifact, 'QX optional wps-account resource must exist');
  return artifact.content;
}

test('WPS optional resource preserves the approved declaration and external script URL verbatim', () => {
  const content = output();
  assert.deepEqual(activeLines(content), [statement]);
  assert.equal(content, readFileSync(new URL('../../src/features/wps-account/quantumultX.snippet', import.meta.url), 'utf8'));
  const [pattern, url] = activeLines(content)[0].split(' url script-response-body ');
  assert.equal(url, scriptUrl);
  const matches = new RegExp(pattern);
  for (const origin of ['https://account.wps.cn/api/users', 'http://web-account.wps.com:443/api/users/profile']) assert.equal(matches.test(origin), true);
  for (const origin of ['ftp://account.wps.cn/api/users', 'https://account.wps.com.evil/api/users', 'https://account.wps.cn/api/user', 'https://123account.wps.cn/api/users']) assert.equal(matches.test(origin), false);
});

test('WPS resource supplies one remote-script declaration without MITM expansion, certificates or tasks', () => {
  const content = output();
  assert.equal(activeLines(content).length, 1);
  assert.doesNotMatch(content, /^\s*(?:hostname\s*=|\[|ca[-_](?:p12|passphrase)|(?:cron|task)\s*=|(?:const|let|var|function)\s)/im);
  assert.match(content, /declaration only/i);
  assert.match(content, /not redistributed or relicensed/i);
  assert.ok(!renderFeatures('quantumultX').some(item => /scripts\/wps/i.test(item.path)));
});

test('WPS resource is QX-only and not automatically referenced by either public profile', () => {
  for (const client of ['surge', 'loon', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']) assert.ok(!renderFeatures(client).some(item => item.path === path));
  for (const render of [renderManagedProfile, renderProfile]) assert.doesNotMatch(render('quantumultX').content, /wps-account|NobyDa\/Script\/master\/Surge\/JS\/Wps\.js/);
});

test('WPS metadata separates the optional MIT declaration from the unbundled upstream script', () => {
  const registry = JSON.parse(readFileSync(new URL('../../metadata/features.json', import.meta.url), 'utf8'));
  const feature = registry.features.find(item => item.id === 'wps-account');
  assert.ok(feature, 'wps-account feature must be registered');
  assert.equal(feature.defaultEnabled, false);
  assert.match(feature.license, /^MIT .*declaration only/i);
  assert.deepEqual(Object.keys(feature.clients), ['quantumultX']);
  assert.deepEqual(feature.clients.quantumultX.artifacts, [path]);
  assert.equal(feature.clients.quantumultX.kind, 'rewrite-resource');
  assert.equal(feature.clients.quantumultX.nativeApp, 'not-run');
  assert.equal(feature.upstream.url, scriptUrl);
  assert.equal(feature.upstream.externalOnly, true);
  assert.equal(feature.upstream.bundleRedistributed, false);
  assert.notEqual(feature.upstream.license, 'MIT');
  assert.ok(feature.sources.includes(scriptUrl));
});
