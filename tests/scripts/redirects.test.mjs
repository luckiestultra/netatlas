// SPDX-License-Identifier: GPL-2.0-only
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import { expandRedirectHostAst, renderRedirects, renderBiliIntlRegion } from '../../tools/lib/redirects.mjs';

const extensions = { quantumultX: 'snippet', surge: 'sgmodule', loon: 'plugin', shadowrocket: 'conf', egern: 'yaml', stash: 'stoverride' };
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const data = () => JSON.parse(read('src/features/redirects/rules.json'));
// Deliberately independent enumeration of the small declarative host grammar.
function fixtureHosts(ast) {
  if (ast.type === 'hosts') return ast.values;
  assert.equal(ast.type, 'optional-www');
  return fixtureHosts(ast.child).flatMap((host) => [host, 'www.' + host]);
}
function classic(line) {
  const m = /^(\S+) (\S+) 302$/.exec(line);
  assert.ok(m, 'three-field native redirect: ' + line);
  return { pattern: m[1], replacement: m[2] };
}
function parseNative(client, content, expectedMitm) {
  if (client === 'egern' || client === 'stash') {
    const doc = parseDocument(content, { uniqueKeys: true });
    assert.deepEqual(doc.errors, []);
    const value = doc.toJS();
    if (client === 'egern') {
      assert.deepEqual(Object.keys(value).sort(), ['author', 'description', 'homepage', 'mitm', 'name', 'url_rewrites']);
      assert.deepEqual(value.mitm, { hostnames: expectedMitm });
      return value.url_rewrites.map((entry) => {
        assert.deepEqual(Object.keys(entry).sort(), ['location', 'match', 'status_code']);
        assert.equal(entry.status_code, 302);
        return { pattern: entry.match, replacement: entry.location };
      });
    }
    assert.deepEqual(Object.keys(value).sort(), ['desc', 'http', 'name']);
    assert.deepEqual(Object.keys(value.http).sort(), ['mitm', 'url-rewrite']);
    assert.deepEqual(value.http.mitm, expectedMitm);
    return value.http['url-rewrite'].map(classic);
  }
  const lines = content.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  if (client === 'quantumultX') {
    assert.equal(lines.pop(), 'hostname = ' + expectedMitm.join(', '));
    return lines.map((line) => {
      const m = /^(\S+) url 302 (\S+)$/.exec(line);
      assert.ok(m, 'Quantumult X native resource: ' + line);
      return { pattern: m[1], replacement: m[2] };
    });
  }
  assert.equal(lines.shift(), client === 'loon' ? '[Rewrite]' : '[URL Rewrite]');
  assert.equal(lines.pop(), 'hostname = ' + (client === 'surge' ? '%APPEND% ' : '') + expectedMitm.join(', '));
  assert.equal(lines.pop(), '[MITM]');
  if (client === 'loon') return lines.map((line) => {
    const m = /^request if \$\{url\} ~= \/(.+)\/ as redirect then redirect\(302, "([^"]+)"\)$/.exec(line);
    assert.ok(m, 'Loon 3.5.1 native DSL: ' + line);
    assert.doesNotMatch(m[2], /\$\d/);
    return { pattern: m[1], replacement: m[2].replace(/\$\{redirect\.(\d+)\}/g, '$$$1') };
  });
  return lines.map(classic);
}
function apply(rules, input) {
  const matches = rules.filter((rule) => new RegExp(rule.pattern).test(input));
  assert.ok(matches.length <= 1, 'one applicable action: ' + input);
  return matches.length ? input.replace(new RegExp(matches[0].pattern), matches[0].replacement) : null;
}
function generalMitm() {
  return data().actions.filter((action) => action.schemes.includes('https')).flatMap((action) => fixtureHosts(action.host)).sort();
}

test('finite host AST permits only canonical exact host aliases', () => {
  assert.deepEqual(expandRedirectHostAst({ type: 'optional-www', child: { type: 'hosts', values: ['jd.com', 'betterzip.net'] } }), ['jd.com', 'www.jd.com', 'betterzip.net', 'www.betterzip.net']);
  for (const host of ['*.example.com', 'wwwXjd.com/', 'google.cn.evil/', 'example.com:443', 'user@example.com', 'EXAMPLE.com', '.example.com', 'example..com']) {
    assert.throws(() => expandRedirectHostAst({ type: 'hosts', values: [host] }), /host/i);
  }
  assert.throws(() => expandRedirectHostAst({ type: 'hosts', values: ['jd.com', 'jd.com'] }), /duplicate/i);
  assert.throws(() => expandRedirectHostAst({ type: 'optional-www', child: { type: 'hosts', values: ['www.jd.com'] } }), /www/i);
});

for (const [client, extension] of Object.entries(extensions)) {
  test(client + ' emits all 59 general Redirect actions, exact aliases, safe destinations and intended URL behavior', () => {
    const artifacts = renderRedirects(client);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].path, 'rewrites/redirects.' + extension);
    const rules = parseNative(client, artifacts[0].content, generalMitm());
    assert.equal(rules.length, 59);
    for (const action of data().actions) {
      for (const host of fixtureHosts(action.host)) {
        for (const scheme of action.schemes) {
          const suffixes = action.mode === 'root' ? ['/'] : action.mode === 'firefox' ? ['/', '/download/'] : ['/', '/a%2Fb/%E4%B8%AD?q=a%20b%26c&x=1&x=2&empty='];
          for (const suffix of suffixes) {
            const input = scheme + '://' + host + suffix;
            const expected = action.mode === 'upgrade' ? 'https://' + host + suffix : action.mode === 'google' ? action.target + suffix : action.target;
            assert.equal(apply(rules, input), expected, action.id + ': ' + input);
            assert.equal(new URL(expected).protocol, 'https:', 'never downgrade to HTTP');
            assert.equal(apply(rules, expected), null, 'no immediate redirect loop');
          }
        }
        for (const scheme of ['http', 'https']) {
          for (const invalid of [
            scheme + '://' + host + '.evil.example/', scheme + '://sub.' + host + '/',
            scheme + '://' + host + ':443/', scheme + '://user@' + host + '/',
            scheme + '://' + host + '@evil.example/', scheme + '://' + host + '/\n',
            scheme + '://' + host + '/\r\n', scheme + '://' + host + '/raw space',
            scheme + '://' + host + '/#fragment', 'ftp://' + host + '/',
          ]) assert.equal(apply(rules, invalid), null, invalid);
        }
        if (action.mode === 'upgrade') assert.equal(apply(rules, 'https://' + host + '/a?q=1'), null);
        if (action.mode === 'root' || action.mode === 'firefox') {
          for (const suffix of ['/other', '/?q=x', '/download/file', '/download']) assert.equal(apply(rules, 'http://' + host + suffix), null);
        }
      }
    }
    for (const input of ['https://google.cn.evil/', 'https://dituXgoogle.cn/', 'https://wwwXgoogle.cn/', 'http://wwwXjd.com/', 'https://zbrushcnXcom/', 'https://www.logoshejishi.com.evil/']) assert.equal(apply(rules, input), null, input);
  });

  test(client + ' separates BiliIntl PH normalization and preserves all other query pairs in either order', () => {
    const artifacts = renderBiliIntlRegion(client);
    assert.equal(artifacts[0].path, 'rewrites/biliintl-region.' + extension);
    const rules = parseNative(client, artifacts[0].content, ['app.biliintl.com', 'passport.biliintl.com']);
    assert.equal(rules.length, 4);
    for (const [host, path] of [
      ['app.biliintl.com', '/intl/gateway/v2/app/resource/region'],
      ['app.biliintl.com', '/x/dm/list'], ['app.biliintl.com', '/reply/list'],
      ['app.biliintl.com', '/history/list'], ['app.biliintl.com', '/x/v1/fav/list'],
      ['app.biliintl.com', '/v2/msgfeed/list'], ['passport.biliintl.com', '/x/intl/passport-login/web/key'],
    ]) {
      for (const scheme of ['http', 'https']) {
        const origin = scheme + '://' + host + path + '?';
        for (const query of [
          's_locale=zh-Hans_CN&sim_code=46000', 'sim_code=46000&s_locale=zh-Hans_CN',
          'a=%26%3D&s_locale=zh-Hans_CN&x=1&x=2&empty=&sim_code=46000&end=a%2Bb',
          '%75id=%E4%B8%AD&sim_code=46000&x=1&s_locale=zh-Hans_CN&empty=',
          's_locale=zh-Hans_PH&sim_code=46000', 'sim_code=51503&s_locale=zh-Hans_CN',
        ]) {
          const expected = origin + query.replace(/s_locale=zh-Hans_[A-Z]{2}/, 's_locale=zh-Hans_PH').replace(/sim_code=[0-9]+/, 'sim_code=51503');
          assert.equal(apply(rules, origin + query), expected);
          assert.equal(apply(rules, expected), null, 'already-normalized request has no loop');
        }
        for (const query of [
          '', 'x=1', 's_locale=zh-Hans_CN', 'sim_code=46000', 's_locale=&sim_code=46000',
          's_locale=en_US&sim_code=46000', 's_locale=zh-Hans_cn&sim_code=46000',
          's_locale=zh-Hans_CN&sim_code=unknown', 's_locale=zh-Hans_PH&sim_code=51503',
          's_locale=zh-Hans_CN&s_locale=zh-Hans_TW&sim_code=46000',
          'sim_code=46000&s_locale=zh-Hans_CN&sim_code=51503',
          '%73_locale=zh-Hans_CN&sim_code=46000',
          's_locale=zh-Hans_CN&sim_code=46000&s%5flocale=zh-Hans_TW',
          's_locale=zh-Hans_CN&sim_code=46000&sim%5Fcode=51503',
          's_locale=zh-Hans_CN&sim_code=46000&bad=%oops',
        ]) assert.equal(apply(rules, origin + query), null, origin + query);
      }
    }
    for (const input of [
      'https://app.biliintl.com.evil/intl/list?s_locale=zh-Hans_CN&sim_code=46000',
      'https://user@app.biliintl.com/intl/list?s_locale=zh-Hans_CN&sim_code=46000',
      'https://app.biliintl.com:443/intl/list?s_locale=zh-Hans_CN&sim_code=46000',
      'https://app.biliintl.com/intlwrong/list?s_locale=zh-Hans_CN&sim_code=46000',
      'https://passport.biliintl.com/x/intl/passport-login/?s_locale=zh-Hans_CN&sim_code=46000',
      'https://app.biliintl.com/intl/list?s_locale=zh-Hans_CN&sim_code=46000\n',
    ]) assert.equal(apply(rules, input), null, input);
  });

  test(client + ' records GPL source, independent opt-in scope and no certificates or runtime code', () => {
    for (const render of [renderRedirects, renderBiliIntlRegion]) {
      const { content } = render(client, { baseUrl: 'https://example.test/netatlas/v1/' })[0];
      assert.match(content, /SPDX-License-Identifier: GPL-2\.0-only/);
      assert.match(content, /blackmatrix7/);
      assert.match(content, /WITHOUT ANY WARRANTY/);
      assert.match(content, /https:\/\/example\.test\/netatlas\/v1\/src\/features\/redirects\/upstream\/Redirect\.conf\.txt/);
      assert.match(content, /https:\/\/example\.test\/netatlas\/v1\/src\/features\/redirects\/LICENSE/);
      assert.match(content, /Optional; absent from default profiles/);
      assert.doesNotMatch(content, /\[(?:Script|General|Rule)\]|(?:^|\n)(?:scriptings|rules|proxies|dns):|\$persistentStore|\$prefs|script-path|skip-server-cert-verify|ca-passphrase|p12|\bMatrix\b/i);
      if (client === 'shadowrocket') assert.match(content, /Manual merge fragment/);
    }
  });
}

test('all 62 pinned upstream lines are accounted for, with one duplicate and two separated region actions', () => {
  const registry = data();
  assert.equal(registry.actions.length, 59);
  assert.equal(registry.regionActions.length, 2);
  assert.deepEqual(registry.deduplicatedUpstreamLines, [67]);
  assert.equal(registry.defaultEnabled, false);
  const source = read(registry.upstream.vendoredSource);
  const license = read(registry.upstream.vendoredLicense);
  assert.equal(source, read('src/features/https-upgrade/upstream/Redirect.conf.txt'));
  assert.equal(createHash('sha256').update(source).digest('hex'), registry.upstream.sourceSha256);
  assert.equal(createHash('sha256').update(license).digest('hex'), registry.upstream.licenseSha256);
  const covered = [...registry.actions.flatMap((action) => action.upstreamLines), ...registry.regionActions.flatMap((action) => action.upstreamLines), ...registry.deduplicatedUpstreamLines].sort((a, b) => a - b);
  assert.deepEqual(covered, source.split('\n').flatMap((line, index) => line.includes(' url 302 ') ? [index + 1] : []));
  for (const action of registry.actions) {
    const originalTarget = source.split('\n')[action.upstreamLines[0] - 1].split(' url 302 ')[1];
    assert.equal(action.upstreamTarget, originalTarget, 'retain fixed-source destination identity');
    if (action.mode !== 'upgrade') assert.equal(action.target, originalTarget.replace(/^http:/, 'https:'), 'only the documented two HTTP target schemes change');
  }
  assert.match(license, /GNU GENERAL PUBLIC LICENSE\s+Version 2, June 1991/);
  const report = JSON.parse(read('src/features/redirects/https-probes.json'));
  for (const url of ['https://cn.ign.com/ccpref/us', 'https://www.kingdee.com/']) {
    const result = report.results.find((entry) => entry.url === url);
    assert.equal(result.curlExit, 0);
    assert.equal(result.sslVerifyResult, 0);
    assert.ok(result.httpCode >= 200 && result.httpCode < 400);
  }
});

test('incapable clients emit nothing; unknown clients and unsafe base URLs fail', () => {
  for (const render of [renderRedirects, renderBiliIntlRegion]) {
    assert.deepEqual(render('mihomo'), []);
    assert.deepEqual(render('singBox'), []);
    assert.throws(() => render('unknown-client'), /client/i);
    for (const baseUrl of ['http://example.test/', 'https://user:secret@example.test/', 'https://example.test/?x=1', 'https://example.test/#bad', 'https://example.test/\n[Script]', 'https://example.test/a,b']) assert.throws(() => render('surge', { baseUrl }), /baseUrl/);
  }
});
