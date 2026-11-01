import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import { inspectIntegrationInstaller, loadIntegrations, renderIntegrations, validateIntegrations } from '../../tools/lib/integrations.mjs';

const clients = ['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash'];
const catalog = loadIntegrations();
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

// Read handlers from each actual serialized format, not from the registry.
function handlers(client, content) {
  if (client === 'egern') return parseDocument(content).toJS().scriptings.map(entry => ({ pattern: entry.http_request.match, url: entry.http_request.script_url }));
  if (client === 'stash') {
    const value = parseDocument(content).toJS();
    return value.http.script.map(entry => ({ pattern: entry.match, url: value['script-providers'][entry.name].url }));
  }
  const result = [];
  for (const line of content.split('\n').filter(line => !line.startsWith('#'))) {
    let match;
    if (client === 'quantumultX') match = /^(\S+) url script-[a-z-]+ (\S+)$/.exec(line);
    else if (client === 'loon') {
      const current = /^request if \$\{url\} ~= \/(.+)\/([ims]*) then script\("([^"\n]+)"(?:,\s*"")?\)/.exec(line);
      if (current) { result.push({ pattern: current[1], flags: current[2], url: current[3] }); continue; }
      match = /^http-request (\S+) script-path=([^,\s]+)/.exec(line);
    }
    else match = /pattern=([^,\s]+),\s*script-path=([^,\s]+)/.exec(line);
    if (match) result.push({ pattern: match[1], url: match[2] });
  }
  return result;
}

for (const client of clients) {
  test(client + ' ScriptHub chooses only the unambiguous outer type selector', () => {
    const artifact = renderIntegrations(client).find(value => value.path.startsWith('modules/script-hub.'));
    const rows = handlers(client, artifact.content);
    const selected = url => rows.filter(row => new RegExp(row.pattern, row.flags).test(url)).map(row => row.url.split('/').at(-1));
    const base = 'https://script.hub/file/_start_/https://source.example/rules?type=qx-rewrite/_end_/list';
    for (const query of ['type=rule-set&target=surge', 'target=surge&type=rule-set&name=fixture', 'target=surge&name=x%26type%3Dqx-rewrite&type=rule-set']) {
      assert.deepEqual(selected(base + '?' + query), ['rule-parser.js'], base + '?' + query);
    }
    for (const type of ['qx-rewrite', 'surge-module', 'loon-plugin', 'all-module']) {
      assert.deepEqual(selected('https://script.hub/file/_start_/https://source.example/a?type=rule-set/_end_/a.conf?target=surge-module&type=' + type), ['Rewrite-Parser.js']);
    }
    for (const query of [
      'target=surge', 'notype=rule-set', 'type=rule-set-tail', 'type=qx-rewrite-tail',
      'type=rule-set&type=qx-rewrite', 'type=rule-set&type=rule-set',
      'type=rule-set&t%79pe=qx-rewrite', '%74ype=rule-set',
      'type=RULE-SET', 'TYPE=rule-set', 'type=rule%2Dset',
      'type=rule-set&name=second?type=qx-rewrite', 'type=rule-set&name=bad%ZZ',
    ]) assert.deepEqual(selected(base + '?' + query), [], query);
    for (const url of [
      'https://script.hub/file/_start_/https://source.example/a?type=rule-set',
      'https://script.hub/file/_start_/https://source.example/a/_end_/_end_/list?type=rule-set',
      'https://script.hub/file/_start_/https://source.example/a/_end_/list?type=rule-set&name=/_end_/extra',
      'https://script.hub/file/_start_/https://source.example/file/_start_/a/_end_/list?type=rule-set',
      'https://script.hub/file/_start_/https://source.example/a/_end_/?type=rule-set',
    ]) assert.deepEqual(selected(url), [], url);
  });
}

for (const client of clients) {
  for (const item of catalog.integrations) {
    test(client + ' ' + item.id + ' resolves real request routes to pinned official scripts', () => {
      const adapter = item.clients[client];
      const artifact = renderIntegrations(client, { baseUrl: 'https://example.test/netatlas/v1' }).find(value => value.path === adapter.artifacts[0]);
      assert.ok(artifact);
      assert.match(artifact.path, /^modules\/(boxjs|sub-store|script-hub)\.[a-z]+$/);
      const expected = adapter.dependencyIds.map(id => catalog.remoteDependencies.find(dependency => dependency.id === id).url).sort();
      const parsed = inspectIntegrationInstaller(client, artifact.content);
      assert.deepEqual([...parsed.scriptUrls].sort(), expected);
      assert.deepEqual([...parsed.hosts].sort(), [...item.mitmHosts].sort());
      const rows = handlers(client, artifact.content);
      assert.equal(rows.length, expected.length);
      assert.deepEqual(rows.map(row => row.url).sort(), expected);
      const matching = url => rows.filter(row => new RegExp(row.pattern, row.flags).test(url));
      const first = url => matching(url)[0]?.url;
      if (item.id === 'boxjs') {
        for (const host of ['boxjs.com', 'boxjs.net', 'a.boxjs.com', 'a.b.boxjs.net']) {
          assert.equal(matching('https://' + host + '/api/getdata').length, 1);
          assert.match(first('http://' + host + '/'), /\/box\/chavy\.boxjs\.js$/);
        }
        for (const url of ['https://boxjs.com.evil.example/', 'https://fakeboxjs.com/', 'https://evil.example/boxjs.com', 'https://boxjsXcom/']) assert.equal(matching(url).length, 0, url);
      } else if (item.id === 'sub-store') {
        for (const path of ['/download/a', '/api/preview', '/api/sync', '/api/utils/node-info']) assert.match(first('https://sub.store' + path), /sub-store-1\.min\.js$/);
        for (const path of ['/', '/api/subs', '/api/collections', '/api/settings']) assert.match(first('https://sub.store' + path), /sub-store-0\.min\.js$/);
        for (const url of ['https://sub.store.evil.example/', 'https://evil.example/sub.store', 'https://subXstore/']) assert.equal(matching(url).length, 0, url);
        assert.doesNotMatch(artifact.content, /cron-sync-artifacts|type=cron|^\s*cron\s|^cron:|^\s*-\s*schedule:/m);
      } else {
        assert.match(first('https://script.hub/file/_start_/https://example.test/a/_end_/a.conf?type=qx-rewrite&target=surge-module'), /Rewrite-Parser\.js$/);
        assert.match(first('https://script.hub/file/_start_/https://example.test/a/_end_/a.list?type=rule-set&target=surge'), /rule-parser\.js$/);
        if (client === 'quantumultX') {
          assert.equal(first('https://script.hub/convert/_start_/a/_end_/b'), undefined);
          assert.match(artifact.content, /^\^https\?:.*script\\\.hub.*url 302 https:\/\/scripthub\.vercel\.app$/m);
        } else {
          assert.match(first('https://script.hub/'), /script-hub\.js$/);
          assert.match(first('https://script.hub/edit/fixture'), /script-hub\.js$/);
          assert.match(first('https://script.hub/reload'), /script-hub\.js$/);
          assert.match(first('https://script.hub/convert/_start_/a/_end_/b'), /script-converter\.js$/);
        }
        assert.equal(matching('https://script.hub.evil.example/').length, 0);
      }
      assert.match(artifact.content, new RegExp('SPDX-License-Identifier: ' + item.license.replaceAll('.', '\\.')));
      assert.match(artifact.content, new RegExp(item.sourceCommit));
      assert.ok(artifact.content.includes('https://example.test/netatlas/v1/src/vendor/integrations/' + item.id + '/LICENSE'));
      assert.ok(artifact.content.includes('https://example.test/netatlas/v1/tools/lib/integrations.mjs'));
      assert.ok(artifact.content.endsWith('\n')&&!artifact.content.endsWith('\n\n'),'published installers have one canonical final newline; original archives stay untouched');
      assert.doesNotMatch(artifact.content, /ca[-_]p12|ca[-_]passphrase|skip[-_]cert|insecure[-_]?tls|^#!icon=|^icon:|^\[Rule\]/mi);
      if (client === 'egern') for (const entry of parseDocument(artifact.content).toJS().scriptings) assert.ok(entry.http_request.timeout <= 600);
    });
  }
}

test('every configured entry script has an immutable URL and recorded real-byte/readiness checks', () => {
  assert.equal(catalog.remoteDependencies.length, 7);
  for (const dependency of catalog.remoteDependencies) {
    assert.match(dependency.url, /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\/.+\.js$/);
    assert.match(dependency.sha256, /^[a-f0-9]{64}$/);
    assert.ok(dependency.bytes > 1000);
    assert.equal(dependency.httpStatus, 200);
    assert.equal(dependency.tlsVerified, true);
    assert.equal(dependency.syntaxCheck, 'node --check (no execution)');
    assert.ok(dependency.sourceMarkers.includes('$done'));
  }
  for (const dependency of catalog.remoteDependencies.filter(value => value.project === 'sub-store')) {
    assert.equal(dependency.release, '2.44.2');
    assert.equal(dependency.sourceCommit, 'c1018115a7eee4cdcb9042cce5e94afda41e48ba');
    assert.notEqual(dependency.sourceCommit, dependency.commit);
  }
});

test('all eighteen optional installers retain complete separate licenses and explicit native limits', () => {
  assert.equal(catalog.integrations.reduce((sum, item) => sum + Object.keys(item.clients).length, 0), 18);
  for (const item of catalog.integrations) {
    assert.equal(item.defaultEnabled, false);
    assert.equal(item.permissions.automaticTasks, false);
    assert.match(read(item.licenseFile.path), /TERMS AND CONDITIONS/);
    assert.match(read('src/vendor/integrations/' + item.id + '/NOTICE.md'), /2026-10-31/);
    assert.match(read('src/vendor/integrations/' + item.id + '/README.md'), /尚未测试/);
    for (const adapter of Object.values(item.clients)) assert.equal(adapter.nativeApp, 'not-run');
  }
  const box = catalog.integrations.find(item => item.id === 'boxjs').clients.egern;
  assert.equal(box.upstreamInstaller, null);
  assert.match(box.scriptSupportEvidence, /isEgern/);
  assert.ok(box.schemaSources.includes('https://egernapp.com/docs/configuration/scriptings/'));
  assert.equal(catalog.integrations.find(item => item.id === 'script-hub').clients.loon.minimumVersion, '3.5.1(983)');
  const loonHub = renderIntegrations('loon').find(item => item.path === 'modules/script-hub.plugin').content;
  assert.match(loonHub, /#!loon_version=3\.5\.1\(983\)/);
  assert.match(loonHub, /#!input=Parser_body_max/);
  assert.match(loonHub, /#!input=Parser_http_timeout/);
});

test('core clients emit no fake HTTP-script packages and unknown clients fail', () => {
  assert.deepEqual(renderIntegrations('mihomo'), []);
  assert.deepEqual(renderIntegrations('singBox'), []);
  assert.throws(() => renderIntegrations('unknown'), /client/i);
  for (const client of ['mihomo', 'singBox']) {
    assert.equal(catalog.unsupportedClients[client].nativeJavaScript, false);
    assert.ok(catalog.unsupportedClients[client].frontend.startsWith('https://'));
  }
});

test('bad paths, hashes, moving references, default activation and native-success claims fail closed', () => {
  const mutations = [
    value => { value.remoteDependencies[0].url = value.remoteDependencies[0].url.replace(value.remoteDependencies[0].commit, 'master'); },
    value => { value.remoteDependencies[0].sha256 = 'bad'; },
    value => { value.remoteDependencies[0].httpStatus = 404; },
    value => { value.integrations[0].clients.surge.installer.path = '../private'; },
    value => { value.integrations[0].clients.surge.installer.sha256 = '0'.repeat(64); },
    value => { value.integrations[0].clients.surge.upstreamInstaller.url += '?token=secret'; },
    value => { value.integrations[0].clients.surge.artifacts = ['modules/nested/boxjs.sgmodule']; },
    value => { value.integrations[0].clients.surge.nativeApp = 'passed'; },
    value => { value.integrations[0].defaultEnabled = true; },
    value => { value.integrations[0].permissions.automaticTasks = true; },
    value => { value.integrations[0].mitmHosts.push('*'); },
    value => { value.integrations[0].license = 'MIT'; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(catalog);
    mutate(value);
    assert.throws(() => validateIntegrations(value));
  }
});

test('public source links reject configuration injection and credential-bearing URLs', () => {
  for (const baseUrl of ['http://example.test', 'https://user:secret@example.test', 'https://example.test?token=secret', 'https://example.test/#bad', 'https://example.test/\n[Script]', 'https://example.test/a,b']) assert.throws(() => renderIntegrations('surge', { baseUrl }), /baseUrl/);
});
