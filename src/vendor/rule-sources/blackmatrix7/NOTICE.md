<!-- SPDX-License-Identifier: GPL-2.0-only -->

# Archived rule source data

These original YAML data files are authored by blackmatrix7 and contributors in [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script), pinned at commit `0b6897dc17e0c513d25449c935a9694818e32f0c` (2026-10-27T21:45:18Z). They are redistributed under **GPL-2.0-only**, with the full original license in [LICENSE](LICENSE). They are not covered by this repository's MIT license.

The archive preserves the original source bytes, author/source headers and source URLs. [manifest.json](manifest.json) records every immutable URL, SHA-256 and Git blob SHA. Derived canonical rule files and generated client rules retain this source license and attribution in their registered provenance. Keep this notice, the full GPL license and corresponding source files when redistributing the GPL-derived data.

This directory contains data and notices only. No archived source is executable or used as an installation script. First-party parsing and export tooling retains its separately stated license. There is no warranty; see the full license.

`rule/Clash/Direct/Direct.yaml` is preserved in full, including conditions outside
the selected feature. The `unbreak` resource selects exactly 48 registered domain,
suffix and keyword tokens from that original file; unrelated domain and process
conditions are not imported. Two independently authored exact endpoint exceptions
in [the MIT supplement](../../../supplements/unbreak.json), with primary Android
and Chromium references, complete its 50 conditions. The combined derived
`unbreak` data is distributed under GPL-2.0-only; this does not relicense the
original MIT supplement. The separate `connectivity-probes` data retains its
first-party MIT provenance and is not counted as part of those 50 conditions.
