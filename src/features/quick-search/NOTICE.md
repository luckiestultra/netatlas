<!-- SPDX-License-Identifier: MIT -->

NetAtlas Quick Search is an original MIT-licensed implementation of 47 optional
DuckDuckGo query actions: 34 searches, nine Apple storefront links, three
translations, and ordinary-query Google fallback. It is separate from the
existing Bing-to-Google `search-redirect` feature. Set a browser's search engine
to DuckDuckGo, import the optional native resource, and type a command and search
term, for example `gh NetAtlas`, `yt 中国`, or `tren 你好`. Storefront commands such
as `usr` take no term. Disabling/removing the imported resource disables this
feature; it is absent from default profiles.

The functional command inventory was reviewed at
[Centralmatrix3/Matrix-io, a2f8c41](https://github.com/Centralmatrix3/Matrix-io/blob/a2f8c41c1bc81518d6ea39087e2b2f756503ca3b/Module/QuantumultX/Search.snippet).
That reference credits ddgksf2013. No license grant was established for that
file. Its configuration text and regexes are not copied, vendored, or distributed
here; this feature does not claim to relicense it. The new query grammar,
renderer, tests, and command definitions are NetAtlas source under the included
MIT license. Public service endpoint URLs and command names are recorded as
functional facts, rather than reproducing the upstream expression of them.

Intentional endpoint changes preserve the search function: `jd` opens JD's HTTPS
search page and `tb` opens Taobao's HTTPS search page instead of app-only schemes.
The old JD destination also embedded unescaped JSON; a raw user term could break
its structure. All search terms are now inserted into query values, including
the five previously path-based actions: `qm` uses
`www.qimai.cn/search/index?search=`, `up` uses Unsplash's public GET form entry
`unsplash.com/s?searchKeyword=`, `wb` uses `s.weibo.com/weibo?q=`, `wk` uses
Wikipedia's `w/index.php?search=`, and `ssp` uses the current
`sspai.com/search?q=` UI. This preserves form-query semantics: `Alan+Turing`
means `Alan Turing`, `%2B` means a literal plus, and `%26` remains part of the
term. A raw `?` in the term cannot start a destination query or change its fixed
path. Appending these raw form values to paths would lose those guarantees.
GitHub code/user searches use the current `type=code` and
`type=users` parameters; Google's Translate page uses query parameters rather
than a fragment. Apple nested destination parameters are percent encoded, with
fixed country/storefront values and no user-controlled destination.

Apple commands (`cnr hkr jpr krr rur sgr trr twr usr`) open the legacy
`itunes.apple.com` storefront reset route. This is a link action only, not a
promise to change an Apple Account's country, bypass regional availability, or
complete a store switch. Availability, sign-in, application behavior, adult-site
access restrictions, and service-owned redirects are outside this package.
Endpoint URLs are not a guarantee of each service's continued availability.

Only the exact HTTPS host `duckduckgo.com`, root path, and one nonempty literal
`q` parameter are eligible. Tracking parameters may precede or follow `q`.
Prefixes require a complete command boundary (`+`, `%20`, or `%2B`) and a nonblank
term; country commands require the complete `q` value. Encoded terms, including
Chinese, `%26`, and `%2B`, are passed unchanged without decoding or encoding them
again. An empty/malformed command never falls through to Google. Ordinary
nonempty queries use Google fallback. Duplicate `q`, encoded parameter keys,
invalid percent triplets, raw whitespace, fragments, lookalike hosts, explicit
ports and userinfo are rejected. Other query keys are plain ASCII letters,
digits, `_`, `.`, `~`, or `-`.

Importing opts in to HTTPS interception for `duckduckgo.com` only, using the
client's existing trusted MITM CA. No CA material, trust installation, TLS
verification bypass, JavaScript, persistent storage, or background request is
provided. The destination site receives the search term when the browser follows
the 302. A 302 can change a non-GET request into GET; method/body preservation is
not promised.

Native wrappers follow official contracts:
[Quantumult X](https://github.com/crossutility/Quantumult-X/blob/master/sample-import-rewrite.snippet),
[Surge URL Rewrite](https://manual.nssurge.com/http/url-rewrite.html) and
[modules](https://manual.nssurge.com/profile/module.html),
[Loon 3.5.1(978)+ Rewrite DSL](https://nsloon.app/docs/Rewrite/rewrite_v2/) and
[plugins](https://nsloon.app/docs/Plugin/),
[Egern URL rewrites](https://egernapp.com/docs/configuration/url_rewrites/) and
[modules](https://egernapp.com/docs/configuration/modules/),
[Stash rewriting](https://stash.wiki/http-engine/rewrite),
[MITM](https://stash.wiki/http-engine/mitm), and
[override merge semantics](https://stash.wiki/configuration/override).
Shadowrocket is a manual merge fragment because a complete public vendor grammar
has not been established: merge the rewrite rules and add the one hostname to
the existing MITM list, preserving existing configuration. Mihomo and sing-box
produce no artifacts because HTTP URL rewriting is not claimed for them.

The 2026-10-31 endpoint review used the sites' public interfaces: Unsplash's
homepage form declares GET `/s` with input `searchKeyword`; verified HTTPS HEAD
requests for `Alan+Turing` returned 307 to `/s/photos/Alan-Turing`, while
`a%2Bb%26c` retained its encoded literal characters in the service-generated
path. Wikipedia's query search returned 302 to the Alan Turing article. Sspai's
current public search component reads the `q` query parameter on `/search`; the
obsolete `/search/post/...` route is no longer assumed. Qimai's query entry
rendered Alan Turing, `中文 搜索` and literal `a+b&c` search titles through
agent-reach/Jina; direct-origin responses varied with user agent between a 403
and its public SPA shell. Weibo's query entry reached
its visitor/login gate. These observations establish entry-point contracts,
not logged-in search-result availability. The relevant primary interfaces are
[Unsplash's form](https://unsplash.com/),
[Qimai search](https://www.qimai.cn/search/index?search=Alan%20Turing),
[Sspai search](https://sspai.com/search?q=Alan%20Turing),
[Weibo search](https://s.weibo.com/weibo?q=Alan%20Turing), and
[Wikipedia search](https://zh.wikipedia.org/w/index.php?search=Alan%20Turing).

Tests parse all six serialized native resources and execute positive/negative
URL fixtures for every action. Native GUI import and actual HTTPS interception
have not been run; Node regex execution and syntax-contract checks are not a
substitute for native app execution. The software is provided without warranty;
see the included MIT license.
