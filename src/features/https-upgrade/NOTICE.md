<!-- SPDX-License-Identifier: GPL-2.0-only -->

This optional feature is adapted from **Redirect**, authored by **blackmatrix7** in
[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script),
commit `0b6897dc17e0c513d25449c935a9694818e32f0c`.
Its complete original configuration is preserved in `upstream/Redirect.conf.txt`;
the original GPL version 2 license is preserved in `LICENSE`. The archived source
is read as reference data for provenance validation and included in the build
input hashes; it is never imported as an active configuration. It contains many
rules and a MITM list that this feature does not enable.

**Changed by NetAtlas contributors on 2026-10-31:** only the six HTTP upgrade
rules from upstream lines 13–18 are selected. Each host is restricted to the
exact host of the original destination: `www.jd.com`, `www.mi.com`, `suning.com`,
`taobao.com`, `yhd.com`, and `you.163.com`. The optional `www` source alternatives
are deliberately removed. The `aicoin.cn` rule is excluded because it changes
the hostname to `www.aicoin.com`. Captures explicitly retain the whole original
host, path and query; a strict end assertion rejects raw whitespace or fragments.
The URL must contain the normal leading `/` path and have no explicit port or
userinfo. Fragments are not sent in HTTP requests. HTTPS URLs never match.

The six rules are translated into the native formats documented in
`metadata/https-upgrade.json`. Loon uses the current 3.5.1(978)+ Rewrite DSL;
Shadowrocket is an explicitly labeled manual merge fragment because a complete
public vendor grammar has not been established. Native GUI import and network
interception were not run. Tests parse emitted resource text and check positive
and negative URL behavior; this does not substitute for native app execution.

The feature and its generated rewrites are licensed under **GPL-2.0-only** and
are not licensed under the repository's MIT license. The renderer and all rule
data are public source in this repository. Keep this notice, the upstream source
and the full GPL license when redistributing it. There is **NO WARRANTY**; see
`LICENSE` for the full terms.

The package is absent from default profiles. Importing it opts in to temporary
302 redirects. A client following a 302 can change a non-GET request into GET;
the feature promises URL preservation, not method or body preservation. It
cannot prevent an initial HTTP request made outside the client's HTTP engine,
does not implement HSTS, and does not override a site's later redirects. No
JavaScript, MITM certificate, persistent storage or background API is required.
