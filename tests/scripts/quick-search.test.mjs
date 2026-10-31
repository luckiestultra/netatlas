// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import { renderQuickSearch } from '../../tools/lib/quick-search.mjs';

const outputs = {
  quantumultX: 'rewrites/quick-search.snippet', surge: 'rewrites/quick-search.sgmodule',
  loon: 'rewrites/quick-search.plugin', shadowrocket: 'rewrites/quick-search.conf',
  egern: 'rewrites/quick-search.yaml', stash: 'rewrites/quick-search.stoverride',
};
// An independent functional contract: prefixes and destinations, not upstream regexes.
const searches = {
  af: 'https://www.acfun.cn/search?keyword=', bd: 'https://www.baidu.com/s?wd=',
  bl: 'https://m.bilibili.com/search?keyword=', by: 'https://www.bing.com/search?q=',
  cf: 'https://cupfox.app/search?key=', db: 'https://m.douban.com/search?query=',
  gc: 'https://github.com/search?type=code&q=', gd: 'https://www.google.com/search?q=%22Google%20Drive%22%20',
  gh: 'https://github.com/search?q=', gi: 'https://www.google.com/search?tbm=isch&q=',
  gu: 'https://github.com/search?type=users&q=', jd: 'https://search.jd.com/Search?keyword=',
  ph: 'https://cn.pornhub.com/video/search?search=', qm: 'https://www.qimai.cn/search/index?search=',
  rd: 'https://www.reddit.com/search?q=', se: 'https://stackexchange.com/search?q=',
  so: 'https://stackoverflow.com/search?q=', tb: 'https://s.taobao.com/search?q=',
  td: 'https://t.me/s/gdurl?q=', tt: 'https://so.toutiao.com/search?keyword=',
  tw: 'https://twitter.com/search?q=', up: 'https://unsplash.com/s?searchKeyword=',
  wa: 'https://www.wolframalpha.com/input/?i=', wb: 'https://s.weibo.com/weibo?q=',
  wk: 'https://zh.wikipedia.org/w/index.php?search=', wx: 'https://weixin.sogou.com/weixinwap?query=',
  wz: 'https://www.wuzhuiso.com/s?q=', yd: 'https://dict.youdao.com/search?q=',
  yh: 'https://greasyfork.org/zh-CN/scripts?q=', yt: 'https://www.youtube.com/results?search_query=',
  zh: 'https://www.zhihu.com/search?q=', gssp: 'https://www.google.com/search?as_sitesearch=sspai.com&as_q=',
  ssp: 'https://sspai.com/search?q=', zdm: 'https://search.m.smzdm.com/?v=b&s=',
  tren: 'https://translate.google.com/?sl=auto&tl=en&op=translate&text=',
  trja: 'https://translate.google.com/?sl=auto&tl=ja&op=translate&text=',
  trzh: 'https://translate.google.com/?sl=auto&tl=zh-CN&op=translate&text=',
};
const stores = { cnr: ['143465', 'cn'], hkr: ['143463', 'hk'], jpr: ['143462', 'jp'], krr: ['143466', 'kr'], rur: ['143469', 'ru'], sgr: ['143464', 'sg'], trr: ['143480', 'tr'], twr: ['143470', 'tw'], usr: ['143441', 'us'] };

function parseClassic(line) {
  const match = /^(\S+) (\S+) 302$/.exec(line);
  assert.ok(match, 'native three-field redirect: ' + line);
  return { pattern: match[1], replacement: match[2] };
}

// Exercise what users actually import. The parser checks each vendor's wrapper
// and translates Loon's documented capture notation only for test execution.
function nativeResource(client, content) {
  if (client === 'egern' || client === 'stash') {
    const document = parseDocument(content, { uniqueKeys: true });
    assert.deepEqual(document.errors, []);
    const value = document.toJS();
    if (client === 'egern') {
      assert.deepEqual(Object.keys(value).sort(), ['author', 'description', 'homepage', 'mitm', 'name', 'url_rewrites']);
      assert.deepEqual(value.mitm, { hostnames: ['duckduckgo.com'] });
      return value.url_rewrites.map((entry) => {
        assert.deepEqual(Object.keys(entry).sort(), ['location', 'match', 'status_code']);
        assert.equal(entry.status_code, 302);
        return { pattern: entry.match, replacement: entry.location };
      });
    }
    assert.deepEqual(Object.keys(value).sort(), ['desc', 'http', 'name']);
    assert.deepEqual(Object.keys(value.http).sort(), ['mitm', 'url-rewrite']);
    assert.deepEqual(value.http.mitm, ['duckduckgo.com']);
    return value.http['url-rewrite'].map(parseClassic);
  }
  const lines = content.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  if (client === 'quantumultX') {
    assert.equal(lines.pop(), 'hostname = duckduckgo.com');
    return lines.map((line) => {
      const match = /^(\S+) url 302 (\S+)$/.exec(line);
      assert.ok(match, 'Quantumult X rewrite resource: ' + line);
      return { pattern: match[1], replacement: match[2] };
    });
  }
  assert.equal(lines.shift(), client === 'loon' ? '[Rewrite]' : '[URL Rewrite]');
  assert.equal(lines.pop(), client === 'surge' ? 'hostname = %APPEND% duckduckgo.com' : 'hostname = duckduckgo.com');
  assert.equal(lines.pop(), '[MITM]');
  if (client === 'loon') return lines.map((line) => {
    const match = /^request if \$\{url\} ~= \/(.+)\/ as search then redirect\(302, "([^"]+)"\)$/.exec(line);
    assert.ok(match, 'Loon 3.5.1 native DSL: ' + line);
    assert.doesNotMatch(match[2], /\$\d/);
    return { pattern: match[1], replacement: match[2].replace(/\$\{search\.(\d+)\}/g, '$$$1') };
  });
  return lines.map(parseClassic);
}

function redirect(rules, input) {
  const matching = rules.filter((rule) => new RegExp(rule.pattern).test(input));
  assert.ok(matching.length <= 1, 'unambiguous routing: ' + input);
  if (!matching.length) return null;
  return input.replace(new RegExp(matching[0].pattern), matching[0].replacement);
}

for (const [client, path] of Object.entries(outputs)) {
  test(client + ' serializes all 47 actions with encoded query preservation and arbitrary query ordering', () => {
    const artifacts = renderQuickSearch(client);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].path, path);
    const rules = nativeResource(client, artifacts[0].content);
    assert.equal(rules.length, 47);
    for (const [prefix, destination] of Object.entries(searches)) {
      for (const delimiter of ['+', '%20', '%2B', '%2b']) {
        for (const term of ['hello', '%E4%B8%AD%E6%96%87%26x%3D1', 'a%20b%2Bc', 'https%3A%2F%2Fevil.example%2F']) {
          for (const [before, after] of [['', ''], ['', '&t=h_&ia=web'], ['t=h_&ia=web&', ''], ['t=h_&', '&ia=web']]) {
            const input = 'https://duckduckgo.com/?' + before + 'q=' + prefix + delimiter + term + after;
            assert.equal(redirect(rules, input), destination + term, input);
            assert.equal(new URL(redirect(rules, input)).hostname, new URL(destination).hostname, 'fixed destination hostname');
          }
        }
      }
      for (const delimiter of ['+', '%20', '%2B']) {
        assert.equal(redirect(rules, 'https://duckduckgo.com/?q=' + prefix + delimiter), null, 'command needs a term');
      }
      assert.equal(redirect(rules, 'https://duckduckgo.com/?q=' + prefix + 'suffix+word'), 'https://www.google.com/search?q=' + prefix + 'suffix+word');
    }
    for (const [command, [storefront, country]] of Object.entries(stores)) {
      const expected = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/resetAndRedirect?dsf=' + storefront + '&mt=8&url=%2FWebObjects%2FMZStore.woa%2Fwa%2FviewSoftware%3Fmt%3D8%26id%3D1108187390%26cc%3D' + country + '%26urlDesc%3D';
      for (const query of ['q=' + command, 't=h_&q=' + command, 'q=' + command + '&ia=web']) {
        assert.equal(redirect(rules, 'https://duckduckgo.com/?' + query), expected);
      }
      for (const suffix of ['%26x%3D1', 'suffix', '+word']) {
        const result = redirect(rules, 'https://duckduckgo.com/?q=' + command + suffix);
        assert.ok(result === null || new URL(result).hostname === 'www.google.com', 'no country-command prefix smuggling');
      }
    }
    for (const query of ['hello', '%E4%B8%AD%E6%96%87%26x', 'hello+world', 'a%2Bb']) {
      for (const input of ['https://duckduckgo.com/?q=' + query, 'https://duckduckgo.com/?t=h_&q=' + query + '&ia=web']) {
        assert.equal(redirect(rules, input), 'https://www.google.com/search?q=' + query);
      }
    }
  });

  test(client + ' rejects malformed sources, empty/duplicate q, lookalike hosts and injection', () => {
    const rules = nativeResource(client, renderQuickSearch(client)[0].content);
    for (const input of [
      'https://duckduckgoXcom/?q=gh+test', 'https://duckduckgo.com.evil.example/?q=gh+test',
      'https://sub.duckduckgo.com/?q=gh+test', 'https://duckduckgo.com@evil.example/?q=gh+test',
      'https://user@duckduckgo.com/?q=gh+test', 'https://duckduckgo.com:443/?q=gh+test',
      'http://duckduckgo.com/?q=gh+test', 'ftp://duckduckgo.com/?q=gh+test',
      'https://duckduckgo.com/search?q=gh+test', 'https://duckduckgo.com/?notq=gh+test',
      'https://duckduckgo.com/?q=', 'https://duckduckgo.com/?t=h_&q=',
      'https://duckduckgo.com/?q=+', 'https://duckduckgo.com/?q=%20',
      'https://duckduckgo.com/?q=gh+test&q=bd+test', 'https://duckduckgo.com/?q=cnr&q=usr',
      'https://duckduckgo.com/?q=cnr&%71=usr', 'https://duckduckgo.com/?q=gh+test#fragment',
      'https://duckduckgo.com/?q=gh+test\n', 'https://duckduckgo.com/?q=gh+test\r\nLocation:https://evil.example/',
      'https://duckduckgo.com/?q=gh+bad term', 'https://duckduckgo.com/?q=bad%escape',
      'https://evil.example/?redirect=https://duckduckgo.com/?q=gh+test',
    ]) assert.equal(redirect(rules, input), null, input);
  });

  test(client + ' keeps decoded search meaning and URL boundaries for formerly path-based destinations', () => {
    const rules = nativeResource(client, renderQuickSearch(client)[0].content);
    const parameterNames = { qm: 'search', up: 'searchKeyword', wb: 'q', wk: 'search', ssp: 'q' };
    const fixedPaths = { qm: '/search/index', up: '/s', wb: '/weibo', wk: '/w/index.php', ssp: '/search' };
    for (const [prefix, parameter] of Object.entries(parameterNames)) {
      for (const term of ['Alan+Turing', 'Alan%20Turing', '%E4%B8%AD%E6%96%87+%E6%90%9C%E7%B4%A2', 'a%2Bb%26c', 'what?x=y', 'a%2526b', 'what%23tag', 'a/b']) {
        const input = 'https://duckduckgo.com/?q=' + prefix + '+' + term;
        const output = new URL(redirect(rules, input));
        const decodedInput = new URLSearchParams('term=' + term).get('term');
        const decodedOutput = output.searchParams.get(parameter);
        assert.equal(decodedOutput, decodedInput, prefix + ' must preserve the decoded term: ' + term);
        assert.equal(output.pathname, fixedPaths[prefix], prefix + ' keeps a fixed destination path');
        assert.deepEqual([...output.searchParams.keys()], [parameter]);
        assert.equal(output.searchParams.has('x'), false, prefix + ' must not turn term text into a query key');
        assert.equal(output.hash, '');
      }
      assert.equal(redirect(rules, 'https://duckduckgo.com/?q=' + prefix + '+what#fragment'), null);
    }
  });

  test(client + ' is opt-in, MITM limited to DuckDuckGo, and contains no runtime script or certificate', () => {
    const { content } = renderQuickSearch(client, { baseUrl: 'https://example.test/netatlas/v1/' })[0];
    nativeResource(client, content);
    assert.match(content, /SPDX-License-Identifier: MIT/);
    assert.match(content, /Optional; absent from default profiles/);
    assert.match(content, /https:\/\/example\.test\/netatlas\/v1\/src\/features\/quick-search\/NOTICE\.md/);
    assert.match(content, /existing trusted MITM CA/);
    assert.doesNotMatch(content, /\[(?:Script|General|Rule)\]|(?:^|\n)(?:scriptings|rules|proxies|dns):|\$persistentStore|\$prefs|script-path|skip-server-cert-verify|ca-passphrase|p12/i);
    if (client === 'shadowrocket') assert.match(content, /Manual merge fragment/);
  });
}

test('definitions keep all command families and honest source/licensing provenance', () => {
  const data = JSON.parse(readFileSync(new URL('../../src/features/quick-search/actions.json', import.meta.url), 'utf8'));
  assert.equal(data.actions.length, 47);
  assert.equal(data.actions.filter((action) => action.kind === 'search').length, 34);
  assert.equal(data.actions.filter((action) => action.kind === 'translation').length, 3);
  assert.equal(data.actions.filter((action) => action.kind === 'storefront').length, 9);
  assert.equal(data.actions.filter((action) => action.kind === 'fallback').length, 1);
  assert.equal(data.reference.commit, 'a2f8c41c1bc81518d6ea39087e2b2f756503ca3b');
  assert.equal(data.reference.codeCopied, false);
  assert.equal(data.license, 'MIT');
});

test('unsupported clients emit no artifacts and unknown clients fail', () => {
  assert.deepEqual(renderQuickSearch('mihomo'), []);
  assert.deepEqual(renderQuickSearch('singBox'), []);
  assert.throws(() => renderQuickSearch('unknown-client'), /client/i);
});

test('source links reject credentials, query, fragment and native configuration injection', () => {
  for (const baseUrl of ['http://example.test/', 'https://user:secret@example.test/', 'https://example.test/?secret=x', 'https://example.test/#bad', 'https://example.test/\n[Script]', 'https://example.test/a,b']) {
    assert.throws(() => renderQuickSearch('surge', { baseUrl }), /baseUrl/);
  }
});
