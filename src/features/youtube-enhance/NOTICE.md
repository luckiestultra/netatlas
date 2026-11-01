# NetAtlas YouTube Enhance adaptation notice

Upstream: YouTube Enhance by Maasea, Maasea/sgmodule, Apache-2.0.
Fixed commit: 65075cdb388fc5e3094afd7e7314c67b243f3525
Source: https://github.com/Maasea/sgmodule/tree/65075cdb388fc5e3094afd7e7314c67b243f3525
The exact request/response bundles and original Surge module are archived in upstream/;
LICENSE contains the complete upstream Apache-2.0 terms. The author only guarantees
its Surge testing scope. This adaptation does not imply author endorsement.

Changed by NetAtlas contributors on 2026-11-02:
- In the request empty-response branch, QuanX alone uses the existing done adapter
  with bodyBytes and status "200 OK", producing a top-level HTTP status and sliced
  ArrayBuffer. The original non-QX branch remains unchanged.
- The privacy-default request script makes the QuanX redirect branch pass the
  original request through without returning a third-party Worker URL.
- A separate Worker request script retains upstream redirect behavior with the
  same empty-response fix. It is never enabled by the default native resource.
- The response bundle is behaviorally unchanged; only this notice/licenses are added.
- No code or settings from the closed, unmerged PR #105 is used. Upstream options
  stay captionLang=off, blockUpload=true, blockImmersive=true, blockShorts=false,
  debug=false; no new user settings or task is installed.

The primary youtube-enhance resource includes only the original binary response
and log_event request declarations, with youtubei.googleapis.com as its sole MITM
hostname. It does not intercept initplayback and is not a full stream-processing
replacement. Existing client size limits still apply; no equivalence to Surge's
max-size=-1 setting or complete playback compatibility is claimed.

The separate youtube-enhance-worker resource is DISABLED BY DEFAULT and requires
explicit opt-in in addition to the primary resource. It alone adds the original
initplayback declaration and *.googlevideo.com hostname. Its Worker destination is
https://init-stream.maasea.workers.dev/. Matching cached keys send the runtime
onesie clientKey, the original playback target URL and default options to that
third party. Missing/mismatched keys return an empty response to force upstream's
v1/player fallback. This path is not limited to advertising requests. There is no
local equivalent of the Worker implementation in these bundles. The key comes
from response hotConfig.onesieHotConfig.clientKey, not a hardcoded API credential;
this remains runtime data and is not transmitted by the privacy-default resource.

The scripts retain upstream host storage behavior: YouTubeConfig contains onesie
clientKey/encryptKey values and YouTubeAdvertiseInfo contains advertisement caches.
Only the original registered destinations/keys are present. Public protobuf field
IDs, UI labels and base64 helpers are protocol identifiers, not user credentials.
No hardcoded account token, password or private key was found in these fixed bundles.

Identified embedded dependencies and retained terms:
- protobuf-ts runtime, author Timo Stamm (upstream package.json), Apache-2.0 AND
  BSD-3-Clause. Complete Apache terms: licenses/protobuf-ts-Apache-2.0.txt.
  Google varint code: Copyright 2008 Google Inc. All rights reserved.
  Complete terms: licenses/protobuf-google-BSD-3-Clause.txt.
  The package also retains Copyright (c) 2016, Daniel Wirtz. All rights reserved.
  Complete terms: licenses/protobuf-daniel-wirtz-BSD-3-Clause.txt. Its separate UTF-8
  implementation was not identified in these bundles; its package terms are kept.
  License evidence: timostamm/protobuf-ts@657e64e80009e503e94f608fda423fbcbf4fb5a7.
- FastestSmallestTextEncoderDecoder, author AnonyCo, CC0-1.0.
  Complete terms: licenses/polyfill-CC0-1.0.txt.
  License evidence: anonyco/FastestSmallestTextEncoderDecoder@f04c88cf11024672e4d3e3dd59b9530b50eefbed.
The author bundles omit dependency license comments, so complete retained terms are
also included in each generated script banner. License evidence identifies these
components; it does not recover the exact protobuf npm version or prove a fully
locked/reproducible upstream build. No unobserved compression dependency is asserted.
Public source/license paths, hashes, Git blobs and extraction details are recorded
in provenance.json. These components are not relicensed under the repository MIT.

All native resources are optional and absent from public default/standalone
profiles. No CA, trust installation, task, node, DNS or policy change is supplied.
Tests run synthetic binary fixtures in isolated Node VM and JavaScriptCore contexts
with no network/file host capabilities. No YouTube or Worker request, native QX
import, playback, picture-in-picture, background play, ad removal or subtitle result
has been tested. Native application verification remains not-run.
