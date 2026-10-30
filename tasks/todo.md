# Implementation tasks

- [x] Establish canonical names, source contracts and regression tests.
- [x] Import a licensed, pinned rule catalog and implement bounded reproducible sync.
- [x] Implement portable rules and eight native rule exporters with semantic tests.
- [x] Implement self-contained profiles for all eight clients with official references.
- [x] Implement GeoIP core plus supported client adapters and optional feature modules.
- [x] Generate client outputs with provenance and artifact hashes.
- [x] Implement validators, local routing checks and native core checks.
- [x] Add CI and optional upstream update review workflow.
- [x] Rewrite user docs/specs to match actual naming and remove reference branding.
- [x] Complete independent review, tests, determinism, live API and native validation.

Evidence: docs/validation.md. Offline: 110 passed, 0 failed, 1 explicit native opt-in skipped. Native CLI: two full profiles, 15 rule compilations, 44 real routing cases passed on macOS ARM64. Live: two provider responses and generated QX adapter contract passed. Six GUI applications still require actual import. The user authorized commit and push to main; remote verification uses the corresponding GitHub Actions run and public artifact bytes. No PR, release or running-client changes are authorized by this publication step.

- [x] Rename the local directory, GitHub repository, package metadata and active references to netatlas.
- [x] Complete independent red/blue review and close the custom-base-URL validation issue with a real CLI regression.
- [x] Prepare the complete local implementation and obtain authorization to commit and push it to main.

Publication verification: compare the remote main commit and public artifact bytes, then inspect the matching CI run at https://github.com/luckiestultra/netatlas/actions/workflows/ci.yml.
