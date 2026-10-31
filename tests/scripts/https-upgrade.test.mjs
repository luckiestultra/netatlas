// SPDX-License-Identifier: GPL-2.0-only
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import { renderHttpsUpgrade } from '../../tools/lib/https-upgrade.mjs';

const expectedHosts = ['www.jd.com', 'www.mi.com', 'suning.com', 'taobao.com', 'yhd.com', 'you.163.com'];
const outputs = {
  quantumultX: 'rewrites/https-upgrade.snippet',
  surge: 'rewrites/https-upgrade.sgmodule',
  loon: 'rewrites/https-upgrade.plugin',
  shadowrocket: 'rewrites/https-upgrade.conf',
  egern: 'rewrites/https-upgrade.yaml',
  stash: 'rewrites/https-upgrade.stoverride',
};
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const metadata = () => JSON.parse(read('metadata/https-upgrade.json'));

// Parse the actual serialized native resources, rather than testing source data alone.
function nativeRules(client, content) {
  if (client === 'egern' || client === 'stash') {
    const document = parseDocument(content, { uniqueKeys: true });
    assert.deepEqual(document.errors, []);
    const value = document.toJS();
    if (client === 'egern') {
      assert.deepEqual(Object.keys(value).sort(), ['author', 'description', 'homepage', 'name', 'url_rewrites']);
      return value.url_rewrites.map((entry) => {
        assert.deepEqual(Object.keys(entry).sort(), ['location', 'match', 'status_code']);
        assert.equal(entry.status_code, 302);
        return { pattern: entry.match, replacement: entry.location };
      });
    }
    assert.deepEqual(Object.keys(value).sort(), ['desc', 'http', 'name']);
    assert.deepEqual(Object.keys(value.http), ['url-rewrite']);
    return value.http['url-rewrite'].map((line) => parseClassic(line));
  }
  const lines = content.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const section = { surge: '[URL Rewrite]', shadowrocket: '[URL Rewrite]', loon: '[Rewrite]' }[client];
  if (section) assert.equal(lines.shift(), section);
  assert.equal(lines.some((line) => line.startsWith('[')), false);
  if (client === 'loon') {
    return lines.map((line) => {
      const match = /^request if \$\{url\} ~= \/(.+)\/ as target then redirect\(302, "([^"]+)"\)$/.exec(line);
      assert.ok(match, 'Loon 3.5.1 native rewrite contract: ' + line);
      assert.equal(match[2], 'https://${target.1}${target.2}');
      return { pattern: match[1], replacement: 'https://$1$2' };
    });
  }
  if (client === 'quantumultX') {
    return lines.map((line) => {
      const match = /^(\S+) url 302 (\S+)$/.exec(line);
      assert.ok(match, 'Quantumult X rewrite-resource syntax: ' + line);
      return { pattern: match[1], replacement: match[2] };
    });
  }
  return lines.map((line) => parseClassic(line));
}

function parseClassic(line) {
  const match = /^(\S+) (\S+) 302$/.exec(line);
  assert.ok(match, 'Three-field native URL Rewrite syntax: ' + line);
  return { pattern: match[1], replacement: match[2] };
}

for (const [client, path] of Object.entries(outputs)) {
  test(client + ' parses its emitted native rewrite and preserves hostname, path and encoded query', () => {
    const artifacts = renderHttpsUpgrade(client);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].path, path);
    const rules = nativeRules(client, artifacts[0].content);
    assert.equal(rules.length, expectedHosts.length);
    for (const host of expectedHosts) {
      const positives = ['/', '/item/%2f%2F?q=a%20b%26c&x=1&x=2&empty=', '/a//b;v=1?return=http%3A%2F%2Fexample.com%2Fa'];
      for (const suffix of positives) {
        const input = 'http://' + host + suffix;
        const matches = rules.filter((rule) => new RegExp(rule.pattern).test(input));
        assert.equal(matches.length, 1, input);
        const result = input.replace(new RegExp(matches[0].pattern), matches[0].replacement);
        assert.equal(result, 'https://' + host + suffix);
        assert.equal(new URL(result).hostname, host);
        assert.equal(rules.some((rule) => new RegExp(rule.pattern).test(result)), false, 'No HTTPS redirect loop');
      }
      for (const input of [
        'https://' + host + '/', 'http://' + host + '.evil.example/',
        'http://sub.' + host + '/', 'http://evil.example/' + host + '/',
        'http://' + host + ':80/', 'http://user@' + host + '/',
        'http://' + host + '@evil.example/', 'http://' + host + '/#fragment',
        'http://' + host + '/\n', 'http://' + host + '/ space',
      ]) assert.equal(rules.some((rule) => new RegExp(rule.pattern).test(input)), false, input);
    }
    for (const host of ['aicoin.cn', 'www.aicoin.cn', 'jd.com', 'mi.com', 'www.suning.com', 'www.taobao.com', 'www.yhd.com']) {
      assert.equal(rules.some((rule) => new RegExp(rule.pattern).test('http://' + host + '/')), false, 'No cross-host canonicalization: ' + host);
    }
  });

  test(client + ' emits only optional HTTP redirects, attribution and GPL source links', () => {
    const { content } = renderHttpsUpgrade(client, { baseUrl: 'https://example.test/netatlas/v1/' })[0];
    assert.match(content, /SPDX-License-Identifier: GPL-2\.0-only/);
    assert.match(content, /blackmatrix7/);
    assert.match(content, /Changed by NetAtlas on 2026-10-31/);
    assert.match(content, /https:\/\/example\.test\/netatlas\/v1\/src\/features\/https-upgrade\/LICENSE/);
    assert.doesNotMatch(content, /\[(?:MITM|Script|General|Rule)\]|(?:^|\n)(?:mitm|script|rules|hosts|proxies|dns):|\$persistentStore|\$prefs|script-path/i);
    assert.equal(metadata().defaultEnabled, false);
  });
}

test('HTTPS feature metadata distinguishes documented syntax, manual fragments and untested GUI imports', () => {
  const info = metadata();
  assert.equal(info.selectedRuleCount, 6);
  assert.equal(info.license, 'GPL-2.0-only');
  assert.equal(info.requiresMitm, false);
  assert.deepEqual(info.permissions, { scripts: false, storage: false, externalRequests: false, mitm: false });
  assert.equal(info.clients.shadowrocket.kind, 'manual-merge-fragment');
  assert.equal(info.clients.shadowrocket.publicNativeContract, false);
  assert.equal(info.clients.loon.minimumVersion, '3.5.1(978)');
  for (const client of Object.keys(outputs)) {
    assert.equal(info.clients[client].nativeApp, 'not-run');
    assert.deepEqual(info.clients[client].artifacts, [outputs[client]]);
  }
});

test('selected rules have per-host positive and negative examples and pinned complete GPL upstream source', () => {
  const info = metadata();
  const data = JSON.parse(read('src/features/https-upgrade/rules.json'));
  assert.deepEqual(data.rules.map((rule) => rule.host), expectedHosts);
  const original = read(info.upstream.vendoredSource);
  const license = read(info.upstream.vendoredLicense);
  assert.equal(createHash('sha256').update(original).digest('hex'), info.upstream.sourceSha256);
  assert.equal(createHash('sha256').update(license).digest('hex'), info.upstream.licenseSha256);
  assert.equal(info.upstream.commit, '0b6897dc17e0c513d25449c935a9694818e32f0c');
  assert.match(original, /# AUTHOR: blackmatrix7/);
  assert.match(license, /GNU GENERAL PUBLIC LICENSE\s+Version 2, June 1991/);
  for (const rule of data.rules) {
    assert.equal(original.split('\n')[rule.upstreamLineNumber - 1], rule.upstreamLine);
    assert.ok(rule.examples.positive.length > 0);
    assert.ok(rule.examples.negative.length > 0);
    for (const client of Object.keys(outputs)) {
      const parsed = nativeRules(client, renderHttpsUpgrade(client)[0].content);
      for (const [input, expected] of rule.examples.positive) {
        const matching = parsed.filter((entry) => new RegExp(entry.pattern).test(input));
        assert.equal(matching.length, 1);
        assert.equal(input.replace(new RegExp(matching[0].pattern), matching[0].replacement), expected);
      }
      for (const input of rule.examples.negative) assert.equal(parsed.some((entry) => new RegExp(entry.pattern).test(input)), false);
    }
  }
});

test('HTTP rewrite incapable clients produce nothing and unknown clients fail', () => {
  assert.deepEqual(renderHttpsUpgrade('mihomo'), []);
  assert.deepEqual(renderHttpsUpgrade('singBox'), []);
  assert.throws(() => renderHttpsUpgrade('not-a-client'), /client/i);
});

test('source links reject config injection and credentials', () => {
  for (const baseUrl of ['http://example.test/', 'https://user:secret@example.test/', 'https://example.test/?token=secret', 'https://example.test/#bad', 'https://example.test/\n[Script]', 'https://example.test/a,b']) {
    assert.throws(() => renderHttpsUpgrade('surge', { baseUrl }), /baseUrl/);
  }
});
