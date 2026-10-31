import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { loadResourceParsers, renderResourceParsers, validateResourceParsers } from '../../tools/lib/resource-parsers.mjs';

const registry = loadResourceParsers();
const base = 'https://raw.githubusercontent.com/luckiestultra/netatlas/main';
const qxFiles = () => new Map(renderResourceParsers('quantumultX').map(file => [file.path, file.content]));

test('QX publishes an original browser parser and a matching native general setting', () => {
  const parser = registry.clients.quantumultX;
  const files = qxFiles();
  assert.deepEqual([...files.keys()], ['scripts/resource-parser.js', 'fragments/resource-parser.conf']);
  const setting = files.get('fragments/resource-parser.conf').split('\n').filter(line => line && !line.startsWith('#'));
  assert.deepEqual(setting, ['[general]', 'resource_parser_url = ' + base + '/clients/quantumultX/scripts/resource-parser.js']);
  assert.equal(parser.implementation, 'netatlas');
  assert.equal(parser.defaultEnabled, true);
  assert.equal(parser.externalOnly, false);
  assert.equal(parser.implementationLicense, 'MIT');
  assert.equal(parser.license, 'MIT AND ISC');
  assert.equal(parser.nativeApp, 'not-run');
  assert.equal(existsSync(new URL('../../' + parser.entrySource, import.meta.url)), true);
  assert.ok(parser.sourceMarkers.includes('hashSchema'));
  assert.equal(parser.sourceContract.helperUiMinimumBuild, 918);
  assert.equal(parser.permissions.noNetworkNoEval, true);
  assert.doesNotMatch([...files.values()].join('\n'), /KOP-XIAO|f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/);
  assert.match(files.get('scripts/resource-parser.js'), /NetAtlas/);
  assert.match(files.get('scripts/resource-parser.js'), /ISC/);
  new vm.Script(files.get('scripts/resource-parser.js'));
});

test('published QX bundle executes the host completion contract without browser or Node globals', () => {
  const script = qxFiles().get('scripts/resource-parser.js');
  const outputs = [];
  const forbidden = new Proxy({}, { get() { throw new Error('Unexpected host API'); } });
  vm.runInNewContext(script, {
    $resource: { type: 'filter', content: 'DOMAIN,example.com,Proxy', link: 'https://example.net/list' },
    $done(value) { outputs.push(JSON.parse(JSON.stringify(value))); },
    $task: forbidden, $prefs: forbidden, $httpClient: forbidden, $persistentStore: forbidden,
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.deepEqual(outputs, [{ content: 'host,example.com,Proxy\n' }]);
});

test('QX public base redirects its own script only and leaves Loon upstream unchanged', () => {
  const relocated = new Map(renderResourceParsers('quantumultX', { baseUrl: 'https://example.test/custom/publish' }).map(file => [file.path, file.content]));
  assert.match(relocated.get('fragments/resource-parser.conf'), /resource_parser_url = https:\/\/example\.test\/custom\/publish\/clients\/quantumultX\/scripts\/resource-parser\.js/);
  assert.equal(relocated.get('scripts/resource-parser.js'), qxFiles().get('scripts/resource-parser.js'));
  assert.deepEqual(renderResourceParsers('loon', { baseUrl: 'https://example.test/custom/publish' }), renderResourceParsers('loon'));
});

test('Loon retains the exact AGPL release URL, integrity and complete source contract', () => {
  const parser = registry.clients.loon;
  const [artifact] = renderResourceParsers('loon');
  assert.equal(artifact.path, 'fragments/resource-parser.conf');
  assert.deepEqual(artifact.content.split('\n').filter(line => line && !line.startsWith('#')), ['[General]', 'resource-parser = ' + parser.url]);
  assert.match(parser.url, /^https:\/\/raw\.githubusercontent\.com\/sub-store-org\/Sub-Store\/[a-f0-9]{40}\/.+\.js$/);
  assert.equal(parser.bytes, 1276648);
  assert.equal(parser.sha256, '54756d35c1777ef73aa384de4bea022d96ed58d8128f3610a14e202ee300d16c');
  assert.equal(parser.httpStatus, 200);
  assert.equal(parser.tlsVerified, true);
  assert.equal(parser.syntaxCheck, 'node --check (no execution)');
  assert.equal(parser.upstreamLicense, 'AGPL-3.0-only');
  assert.equal(parser.release, '2.44.2');
  assert.equal(parser.sourceCommit, 'c1018115a7eee4cdcb9042cce5e94afda41e48ba');
  assert.deepEqual(parser.sourceContract.supportedResourceTypes, { 1: 'nodes', 2: 'rules' });
  assert.equal(parser.externalOnly, true);
  assert.equal(parser.defaultEnabled, false);
  assert.match(artifact.content, /parser-enabled=true/);
  assert.match(artifact.content, /not run/);
  assert.ok(artifact.content.includes(parser.author));
  assert.ok(artifact.content.includes(parser.completeSourceUrl));
  assert.doesNotMatch(artifact.content, /^\[(?:Script|MITM|Task|Remote Proxy)\]|ca[-_]p12|type=cron|^\s*cron\s|script-path=|(?:^|\n)(?:function|var|let|const)\s/m);
});

test('the six other clients receive no invented parser key', () => {
  for (const client of ['surge', 'shadowrocket', 'egern', 'stash', 'mihomo', 'singBox']) assert.deepEqual(renderResourceParsers(client), []);
  assert.throws(() => renderResourceParsers('unknown'), /client/i);
});

test('mixed registry rejects altered ownership, runtime permissions, host contract and external integrity', () => {
  for (const mutate of [
    value => { value.version = 1; },
    value => { value.clients.quantumultX.url = value.clients.loon.url; },
    value => { value.clients.quantumultX.implementation = 'external'; },
    value => { value.clients.quantumultX.entrySource = '../../outside.mjs'; },
    value => { value.clients.quantumultX.implementationLicense = 'AGPL-3.0-only'; },
    value => { value.clients.quantumultX.dependencies[0].license = 'MIT'; },
    value => { value.clients.quantumultX.defaultEnabled = false; },
    value => { value.clients.quantumultX.externalOnly = true; },
    value => { value.clients.quantumultX.permissions.network = true; },
    value => { value.clients.quantumultX.permissions.storage = true; },
    value => { value.clients.quantumultX.permissions.userSuppliedScriptEval = true; },
    value => { value.clients.quantumultX.permissions.sourceScriptReferenceExecution = true; },
    value => { value.clients.quantumultX.ownArtifacts = ['fragments/resource-parser.conf']; },
    value => { value.clients.quantumultX.sourceMarkers = ['$done']; },
    value => { value.clients.quantumultX.sourceContract.helperUiMinimumBuild = 1; },
    value => { value.clients.loon.commit = '0'.repeat(40); },
    value => { value.clients.loon.sha256 = '0'.repeat(64); },
    value => { value.clients.loon.bytes++; },
    value => { value.clients.loon.sourceCommit = '0'.repeat(40); },
    value => { value.clients.loon.defaultEnabled = true; },
    value => { value.clients.loon.permissions.automaticTasks = true; },
    value => { value.clients.loon.artifacts = ['scripts/parser.js']; },
    value => { value.clients.loon.nativeApp = 'passed'; },
    value => { value.sourceRegistry.independentQxImplementation = false; },
  ]) {
    const value = structuredClone(registry);
    mutate(value);
    assert.throws(() => validateResourceParsers(value));
  }
});

test('all resources validate the public base before emitting any settings', () => {
  for (const baseUrl of ['http://example.test', 'https://user:secret@example.test', 'https://example.test?token=secret', 'https://example.test/#bad', 'https://example.test/\n[Script]', 'https://example.test/a,b']) assert.throws(() => renderResourceParsers('quantumultX', { baseUrl }), /baseUrl/);
});

test('QX dependency notice retains the actual bundled yaml ISC license', () => {
  const license = readFileSync(new URL('../../src/features/resource-parser/vendor/LICENSE-yaml', import.meta.url), 'utf8');
  assert.equal(license, readFileSync(new URL('../../node_modules/yaml/LICENSE', import.meta.url), 'utf8'));
  assert.match(license, /Eemeli Aro/);
  assert.match(license, /Permission to use, copy, modify, and\/or distribute/);
});
