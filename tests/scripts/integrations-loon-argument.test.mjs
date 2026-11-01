// SPDX-License-Identifier: GPL-3.0-only
// Small verbatim initialization excerpts from Script-Hub-Org/Script-Hub.
// Complete fixed source and license: see the URLs below and
// src/vendor/integrations/script-hub/LICENSE. No upstream code is modified.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadIntegrations, renderIntegrations } from '../../tools/lib/integrations.mjs';

const upstreamBase = 'https://raw.githubusercontent.com/Script-Hub-Org/Script-Hub/502cf03f7db2e077d96c07c2cb151a8f0b152a80/';
const upstreamInitializers = [
  {
    file: 'Rewrite-Parser.js', line: 21,
    sha256: 'c5e46afa219424e22bcba151dbd6f5e4c6caf518cfdf3317381f4c7e2068e51b',
    source: `let arg
if (typeof $argument != 'undefined') {
  arg = Object.fromEntries($argument.split('&').map(item => item.split('=')))
} else {
  arg = {}
}`,
  },
  {
    file: 'rule-parser.js', line: 9,
    sha256: '6d30380cc68e112b5bcb5d9b2013d553d3c48612b1c61e78f0e0bfae3e48ca2c',
    source: `let arg
if (typeof $argument != 'undefined') {
  arg = Object.fromEntries($argument.split('&').map(item => item.split('=')))
} else {
  arg = {}
}`,
  },
  {
    file: 'script-converter.js', line: 21,
    sha256: '27fc22ac5a40364fbe0728d7264e163431656e7b142cde6337ecad11e5d60b78',
    source: `let arg
if (typeof $argument != 'undefined') {
  arg = Object.fromEntries($argument.split('&').map(item => item.split('=')))
}`,
  },
];

// Official Loon Script v2: omitting script(path)'s second argument injects null,
// while an explicit string is passed unchanged. This differs from undefined.
// https://nsloon.app/docs/Script/script_v2/#argument-参数
const module = renderIntegrations('loon').find(item => item.path === 'modules/script-hub.plugin').content;
const dependencies = loadIntegrations().remoteDependencies;
for (const entry of upstreamInitializers) {
  test('Loon ScriptHub ' + entry.file + ' supplies the argument required by its fixed upstream entry', () => {
    const url = upstreamBase + entry.file;
    assert.equal(dependencies.find(item => item.url === url)?.sha256, entry.sha256);
    const lines = module.split('\n').filter(line => line.includes('then script(' + JSON.stringify(url)));
    assert.equal(lines.length, 1);
    const call = /then script\("[^"\n]+"(?:,\s*("[^"\n]*"))?\) with/.exec(lines[0]);
    assert.ok(call, 'read the actual emitted Script v2 invocation');
    const argument = call[1] === undefined ? null : JSON.parse(call[1]);
    assert.throws(() => vm.runInNewContext(entry.source, { $argument: null }), /reading 'split'/,
      'the pinned upstream initializer rejects the documented omitted-argument value');
    assert.doesNotThrow(() => vm.runInNewContext(entry.source, { $argument: argument }, { timeout: 100 }),
      entry.file + ':' + entry.line + ' must accept the emitted host input');
    assert.equal(argument, '');
  });
}
