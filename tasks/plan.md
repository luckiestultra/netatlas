# Implementation plan

Approved scope: implement all eight clients locally; remove previous reference-project branding; canonical client IDs use `quantumultX` and `singBox`. Do not edit running client settings. Do not commit, push, or open a PR without a separate explicit request.

## Naming and boundaries

- Consumer paths: `clients/<client>/{profiles,rules,rewrites,modules,scripts}`; rules are flat by concrete service ID; emit only real supported artifacts.
- Canonical IDs: `quantumultX`, `surge`, `loon`, `shadowrocket`, `egern`, `stash`, `mihomo`, `singBox`.
- Rule/feature IDs and filenames: lowercase kebab-case; native extensions stay native.
- Shared portable data and parsing functions; explicit native adapters. No universal runtime/config DSL.
- Standalone profiles inline rules, so they work without an unpublished remote URL. Optional standalone rule files remain available.
- Profiles contain no private nodes; the Proxy group defaults to rejection until users add/select their own upstream. DIRECT remains an explicit option.

## Interfaces for parallel work

Rule sets are `{ version: 1, id, category, entries: [{ type, value }] }`. Supported types: `domain`, `domain-suffix`, `ip-cidr`, `ip-cidr6`. Each file's provenance is registered in `metadata/upstreams.json`.

`tools/lib/profiles.mjs` exports `renderProfile(client, { rulesets, baseUrl })` and `profileFormats`. A return value is `{ path: 'profiles/default.<extension>', content, format: 'ini' | 'yaml' | 'json' }`. `rulesets` contain canonical entries. Profiles are native self-contained text; module/script artifacts are separate.

`tools/lib/features.mjs` exports `renderFeatures(client, { baseUrl })`, returning an array of `{ path, content }` relative to the client output directory. Metadata is in `metadata/features.json`. Unsupported capabilities produce no placeholder files. Pure geo parsing is reusable and isolated from host globals.

Root owns the build pipeline, rule adapters, validators, package metadata, CI and integration. Profile agent owns profile rendering/native references and profile tests. Feature agent owns features and their tests. Data agent owns rule sources, provenance and sync tool/tests.

## Verification

Build a complete portable-rule slice first; test failures before implementations. Integrate each independent slice with targeted tests. Then generate all clients, validate native references/structure/semantics, run available Mihomo and sing-box binaries, and exercise actual local routing with fixture upstreams where possible. Fetch live GeoIP responses without committing personal IP data. Report unsupported native-app checks honestly.

Completion: all eight profiles are nonempty and parseable, all catalog rules have all target exports, shared semantics are tested, live script normalization works, generated outputs are deterministic, documentation has no removed branding/old client IDs, and the working tree retains all local implementation changes for user review.
