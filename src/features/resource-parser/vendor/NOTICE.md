# YAML dependency notice

The generated Quantumult X resource parser includes the browser build of
[`yaml` 2.9.1](https://github.com/eemeli/yaml/tree/v2.9.1), by Eemeli Aro.
The package is pinned in `package.json` and `package-lock.json` and distributed
under the ISC license. Its complete, unmodified license is in `LICENSE-yaml`
and in the generated script's banner.

The parser adapter and resource conversion logic are original NetAtlas code,
covered by the repository's MIT license. No upstream subscription-conversion
implementation is included. The build uses esbuild 0.28.2; esbuild itself is
a development dependency and is not embedded in the generated script.

The adapter uses the YAML 1.2 core schema, accepts anchors and merge keys,
and rejects custom tags, parse errors or warnings, unsafe object keys, cycles,
non-finite numbers and documents exceeding its published resource limits.
