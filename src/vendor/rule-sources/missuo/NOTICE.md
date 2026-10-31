# China ASN source

- Author: Vincent Young (missuo).
- Source: <https://github.com/missuo/ASN-China/tree/5f374b8a70bbff10272de8ed0366abb7b45d160f>.
- License: MIT; the original `LICENSE` and unmodified `ASN.China.list` are retained here.
- `metadata/native-routing.json` records source size, SHA-256, Git blob, revision and update date. `src/native-rules/china-asn.json` retains every active source IP-ASN condition as an ASN number, without expanding it into CIDRs.
- The 5,231 ASN identifiers equal the fixed reference inventory's active identifiers (no missing/extra identifiers). This proves ASN identifier equality at those snapshots, not identical results across different clients' ASN databases and versions, or physical country location of every IP in an ASN.
- Public database URLs select third-party refreshed MaxMind-format files at runtime. Those database binaries are not redistributed here, and future contents are intentionally mutable. Their data licenses and update behavior remain governed by their authors and the native client.
