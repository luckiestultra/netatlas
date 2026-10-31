<!-- SPDX-License-Identifier: GPL-2.0-only -->

NetAtlas Redirects and NetAtlas BiliIntl Region are optional adaptations of
**Redirect** by **blackmatrix7** in
[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script),
fixed commit `0b6897dc17e0c513d25449c935a9694818e32f0c`, path
`rewrite/QuantumultX/Redirect/Redirect.conf`.
The complete original source is preserved, byte for byte, in
`upstream/Redirect.conf.txt` (7,188 bytes, SHA-256
`85311fcf996fbaf7279daba3ec4c3cff31d6035d333ae6b3c939d86039d16357`).
It is identical to the shared archive at
`src/features/https-upgrade/upstream/Redirect.conf.txt`. The complete original
GPL version 2 license is in `LICENSE`. The archived original is provenance data,
not an active configuration; its broad original MITM list is not imported.

These features, their renderer, data and generated resources are licensed under
**GPL-2.0-only**, separately from MIT-licensed repository components. Preserve
this notice, the full source and GPL license when redistributing them. They are
provided **WITHOUT ANY WARRANTY**; see `LICENSE` for the full terms.

**Changed by NetAtlas contributors on 2026-10-31:** the original 62 redirect
lines are accounted for as 59 general actions, two BiliIntl region actions in a
separate opt-in resource, and one removed duplicate ZBrush expression. The
duplicate at original line 67 has an unescaped domain dot; the intended ZBrush
domain at line 68 is retained once. No command/action family is silently dropped.
This does not alter the separate, narrower six-host `https-upgrade` feature.

General Redirect behavior:

- Domains are represented by a finite host AST and expanded into exact aliases.
  Optional `www` means the literal `www.` subdomain. Alternate suffixes and
  domain names are enumerated explicitly; the old unescaped dots and Google
  hostname-prefix matches cannot admit lookalikes such as `wwwXjd.com` or
  `google.cn.evil.example`. Every request must have a leading `/` path, no
  explicit port or userinfo, no fragment, and no raw whitespace/newline.
- The six HTTP upgrades preserve the exact source hostname (including a listed
  `www.` alias), path and query. They accept HTTP only. This avoids the old
  canonical-host change and loss of the requested path/query. The AICoin rule is
  separate: it retains its HTTP root-only cross-host destination and does not
  match queries or child paths.
- Google China web and maps aliases preserve the full path and query when
  redirecting to `www.google.com` or `maps.google.com`. An exact hostname boundary
  replaces the old permissive host-prefix match.
- Software/vendor alias actions go to the fixed upstream official-site
  destination. Their entire matched request is replaced by that destination;
  arbitrary source paths/queries are not appended to an unrelated vendor path.
  Firefox keeps the source's limited `/` and `/download/` entry points. The
  upstream destination identities are retained rather than asserting that every
  historical product/vendor URL is current or guessing rebranded destinations.
- The two upstream HTTP destinations are upgraded to HTTPS:
  `https://cn.ign.com/ccpref/us` and `https://www.kingdee.com/`. A 2026-10-31
  standard-verification HTTPS HEAD probe returned 302 with TLS verification
  result 0 for each. IGN returned `https://www.ign.com/?setccpref=US`; Kingdee
  returned `https://www.kingdee.com/cn`. The initial destination remains the fixed
  source route with its scheme corrected. No generated destination downgrades an
  HTTPS request to HTTP.

BiliIntl Region is a separate resource with exactly two MITM hosts,
`app.biliintl.com` and `passport.biliintl.com`. It normalizes a recognized
`s_locale=zh-Hans_XX` and numeric `sim_code` pair to `s_locale=zh-Hans_PH` and
`sim_code=51503`. This is an explicit Philippines parameter change. Four native
patterns cover the two original host/path families in either target-key order.
The old passport `$35` capture error is removed. All unrelated valid query pairs,
including duplicate unrelated keys, empty values and percent-encoded names or
values, retain their original bytes and order. Target keys must be literal and
appear once each; duplicate target keys, including encoded spellings, unknown
locale/value forms and missing keys produce no redirect. An already normalized
pair also produces no redirect, avoiding a loop. The app paths use complete
`intl`, `dm`, `reply`, `history`, `vN/fav`, or `vN/msgfeed` prefix boundaries,
optionally below `x/`; the passport login family requires a child path.

Both resources are absent from default profiles and independently opt in when
imported/enabled. General Redirect MITM hosts are derived only from its
HTTPS-capable exact aliases; its HTTP-only upgrade/AICoin hosts and both BiliIntl
hosts are excluded. BiliIntl Region lists only its two exact hosts. Neither list
contains wildcards. The user supplies an existing trusted MITM CA and controls
client HTTPS interception. No certificate/CA material, trust installation, TLS
verification bypass, runtime JavaScript, persistent storage or background API
request is supplied. A followed 302 can change a non-GET method; request-body or
method preservation is not promised. These redirects are not HSTS and cannot
control later service redirects or pinned apps.

Native resource wrappers follow official contracts for
[Quantumult X](https://github.com/crossutility/Quantumult-X/blob/master/sample-import-rewrite.snippet),
[Surge URL Rewrite](https://manual.nssurge.com/http/url-rewrite.html) and
[modules](https://manual.nssurge.com/profile/module.html),
[Loon 3.5.1(978)+ Rewrite DSL](https://nsloon.app/docs/Rewrite/rewrite_v2/) and
[plugins](https://nsloon.app/docs/Plugin/),
[Egern URL rewrites](https://egernapp.com/docs/configuration/url_rewrites/) and
[modules](https://egernapp.com/docs/configuration/modules/),
[Stash rewriting](https://stash.wiki/http-engine/rewrite),
[MITM](https://stash.wiki/http-engine/mitm) and
[override merge semantics](https://stash.wiki/configuration/override).
Surge appends its MITM hosts; Stash merges dictionaries and prepends arrays
without a replace directive. Shadowrocket is explicitly a manual merge fragment:
merge rewrite lines and add exact hosts to the existing MITM list, retaining
other configuration. No public vendor-verified standalone Shadowrocket module
contract is claimed. Mihomo and sing-box produce no artifacts because HTTP URL
rewriting is not claimed for them.

Tests parse every emitted native format and exercise positive/negative fixtures
for all 59 general actions, every finite host alias and both region families in
both query orders. This includes encoded paths/queries, source provenance,
duplicate keys, lookalike hosts and newline rejection. `https-probes.json`
records a small official-origin network sample, including both corrected HTTPS
destinations; it does not claim that every destination/path was checked. Native
GUI import and actual HTTPS interception have **not** been run. Node regex and
syntax-contract checks do not substitute for vendor app execution.
