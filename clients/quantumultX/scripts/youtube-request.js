/*!
SPDX-License-Identifier: Apache-2.0 AND BSD-3-Clause AND CC0-1.0
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

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.


                                Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.


Creative Commons Legal Code

CC0 1.0 Universal

    CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE
    LEGAL SERVICES. DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN
    ATTORNEY-CLIENT RELATIONSHIP. CREATIVE COMMONS PROVIDES THIS
    INFORMATION ON AN "AS-IS" BASIS. CREATIVE COMMONS MAKES NO WARRANTIES
    REGARDING THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS
    PROVIDED HEREUNDER, AND DISCLAIMS LIABILITY FOR DAMAGES RESULTING FROM
    THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED
    HEREUNDER.

Statement of Purpose

The laws of most jurisdictions throughout the world automatically confer
exclusive Copyright and Related Rights (defined below) upon the creator
and subsequent owner(s) (each and all, an "owner") of an original work of
authorship and/or a database (each, a "Work").

Certain owners wish to permanently relinquish those rights to a Work for
the purpose of contributing to a commons of creative, cultural and
scientific works ("Commons") that the public can reliably and without fear
of later claims of infringement build upon, modify, incorporate in other
works, reuse and redistribute as freely as possible in any form whatsoever
and for any purposes, including without limitation commercial purposes.
These owners may contribute to the Commons to promote the ideal of a free
culture and the further production of creative, cultural and scientific
works, or to gain reputation or greater distribution for their Work in
part through the use and efforts of others.

For these and/or other purposes and motivations, and without any
expectation of additional consideration or compensation, the person
associating CC0 with a Work (the "Affirmer"), to the extent that he or she
is an owner of Copyright and Related Rights in the Work, voluntarily
elects to apply CC0 to the Work and publicly distribute the Work under its
terms, with knowledge of his or her Copyright and Related Rights in the
Work and the meaning and intended legal effect of CC0 on those rights.

1. Copyright and Related Rights. A Work made available under CC0 may be
protected by copyright and related or neighboring rights ("Copyright and
Related Rights"). Copyright and Related Rights include, but are not
limited to, the following:

  i. the right to reproduce, adapt, distribute, perform, display,
     communicate, and translate a Work;
 ii. moral rights retained by the original author(s) and/or performer(s);
iii. publicity and privacy rights pertaining to a person's image or
     likeness depicted in a Work;
 iv. rights protecting against unfair competition in regards to a Work,
     subject to the limitations in paragraph 4(a), below;
  v. rights protecting the extraction, dissemination, use and reuse of data
     in a Work;
 vi. database rights (such as those arising under Directive 96/9/EC of the
     European Parliament and of the Council of 11 March 1996 on the legal
     protection of databases, and under any national implementation
     thereof, including any amended or successor version of such
     directive); and
vii. other similar, equivalent or corresponding rights throughout the
     world based on applicable law or treaty, and any national
     implementations thereof.

2. Waiver. To the greatest extent permitted by, but not in contravention
of, applicable law, Affirmer hereby overtly, fully, permanently,
irrevocably and unconditionally waives, abandons, and surrenders all of
Affirmer's Copyright and Related Rights and associated claims and causes
of action, whether now known or unknown (including existing as well as
future claims and causes of action), in the Work (i) in all territories
worldwide, (ii) for the maximum duration provided by applicable law or
treaty (including future time extensions), (iii) in any current or future
medium and for any number of copies, and (iv) for any purpose whatsoever,
including without limitation commercial, advertising or promotional
purposes (the "Waiver"). Affirmer makes the Waiver for the benefit of each
member of the public at large and to the detriment of Affirmer's heirs and
successors, fully intending that such Waiver shall not be subject to
revocation, rescission, cancellation, termination, or any other legal or
equitable action to disrupt the quiet enjoyment of the Work by the public
as contemplated by Affirmer's express Statement of Purpose.

3. Public License Fallback. Should any part of the Waiver for any reason
be judged legally invalid or ineffective under applicable law, then the
Waiver shall be preserved to the maximum extent permitted taking into
account Affirmer's express Statement of Purpose. In addition, to the
extent the Waiver is so judged Affirmer hereby grants to each affected
person a royalty-free, non transferable, non sublicensable, non exclusive,
irrevocable and unconditional license to exercise Affirmer's Copyright and
Related Rights in the Work (i) in all territories worldwide, (ii) for the
maximum duration provided by applicable law or treaty (including future
time extensions), (iii) in any current or future medium and for any number
of copies, and (iv) for any purpose whatsoever, including without
limitation commercial, advertising or promotional purposes (the
"License"). The License shall be deemed effective as of the date CC0 was
applied by Affirmer to the Work. Should any part of the License for any
reason be judged legally invalid or ineffective under applicable law, such
partial invalidity or ineffectiveness shall not invalidate the remainder
of the License, and in such case Affirmer hereby affirms that he or she
will not (i) exercise any of his or her remaining Copyright and Related
Rights in the Work or (ii) assert any associated claims and causes of
action with respect to the Work, in either case contrary to Affirmer's
express Statement of Purpose.

4. Limitations and Disclaimers.

 a. No trademark or patent rights held by Affirmer are waived, abandoned,
    surrendered, licensed or otherwise affected by this document.
 b. Affirmer offers the Work as-is and makes no representations or
    warranties of any kind concerning the Work, express, implied,
    statutory or otherwise, including without limitation warranties of
    title, merchantability, fitness for a particular purpose, non
    infringement, or the absence of latent or other defects, accuracy, or
    the present or absence of errors, whether or not discoverable, all to
    the greatest extent permissible under applicable law.
 c. Affirmer disclaims responsibility for clearing rights of other persons
    that may apply to the Work or any use thereof, including without
    limitation any person's Copyright and Related Rights in the Work.
    Further, Affirmer disclaims responsibility for obtaining any necessary
    consents, permissions or other rights required for any use of the
    Work.
 d. Affirmer understands and acknowledges that Creative Commons is not a
    party to this document and has no duty or obligation with respect to
    this CC0 or use of the Work.



Copyright 2008 Google Inc.  All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

* Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
* Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Code generated by the Protocol Buffer compiler is owned by the owner
of the input file used when generating it.  This code is not
standalone and requires a support library to be linked with it.  This
support library is itself covered by the above license.


Copyright (c) 2016, Daniel Wirtz  All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

* Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.
* Neither the name of its author, nor the names of its contributors
  may be used to endorse or promote products derived from this software
  without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/
// Build: 2026/7/12 22:44:32
(()=>{var nt=Object.create;var ge=Object.defineProperty;var it=Object.getOwnPropertyDescriptor;var st=Object.getOwnPropertyNames;var ot=Object.getPrototypeOf,at=Object.prototype.hasOwnProperty;var ft=(n,e,t)=>e in n?ge(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var ut=(n,e)=>()=>(e||n((e={exports:{}}).exports,e),e.exports);var ct=(n,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of st(e))!at.call(n,i)&&i!==t&&ge(n,i,{get:()=>e[i],enumerable:!(r=it(e,i))||r.enumerable});return n};var h=(n,e,t)=>(t=n!=null?nt(ot(n)):{},ct(e||!n||!n.__esModule?ge(t,"default",{value:n,enumerable:!0}):t,n));var Y=(n,e,t)=>(ft(n,typeof e!="symbol"?e+"":e,t),t);var l=ut(Ae=>{"use strict";(function(n){function e(){}function t(){}var r=String.fromCharCode,i={}.toString,s=i.call(n.SharedArrayBuffer),o=i(),a=n.Uint8Array,u=a||Array,c=a?ArrayBuffer:u,d=c.isView||function(w){return w&&"length"in w},I=i.call(c.prototype);c=t.prototype;var y=n.TextEncoder,m=new(a?Uint16Array:u)(32);e.prototype.decode=function(w){if(!d(w)){var U=i.call(w);if(U!==I&&U!==s&&U!==o)throw TypeError("Failed to execute 'decode' on 'TextDecoder': The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");w=a?new u(w):w||[]}for(var x=U="",p=0,k=w.length|0,G=k-32|0,B,T,A=0,J=0,K,V=0,L=-1;p<k;){for(B=p<=G?32:k-p|0;V<B;p=p+1|0,V=V+1|0){switch(T=w[p]&255,T>>4){case 15:if(K=w[p=p+1|0]&255,K>>6!==2||247<T){p=p-1|0;break}A=(T&7)<<6|K&63,J=5,T=256;case 14:K=w[p=p+1|0]&255,A<<=6,A|=(T&15)<<6|K&63,J=K>>6===2?J+4|0:24,T=T+256&768;case 13:case 12:K=w[p=p+1|0]&255,A<<=6,A|=(T&31)<<6|K&63,J=J+7|0,p<k&&K>>6===2&&A>>J&&1114112>A?(T=A,A=A-65536|0,0<=A&&(L=(A>>10)+55296|0,T=(A&1023)+56320|0,31>V?(m[V]=L,V=V+1|0,L=-1):(K=L,L=T,T=K))):(T>>=8,p=p-T-1|0,T=65533),A=J=0,B=p<=G?32:k-p|0;default:m[V]=T;continue;case 11:case 10:case 9:case 8:}m[V]=65533}if(x+=r(m[0],m[1],m[2],m[3],m[4],m[5],m[6],m[7],m[8],m[9],m[10],m[11],m[12],m[13],m[14],m[15],m[16],m[17],m[18],m[19],m[20],m[21],m[22],m[23],m[24],m[25],m[26],m[27],m[28],m[29],m[30],m[31]),32>V&&(x=x.slice(0,V-32|0)),p<k){if(m[0]=L,V=~L>>>31,L=-1,x.length<U.length)continue}else L!==-1&&(x+=r(L));U+=x,x=""}return U},c.encode=function(w){w=w===void 0?"":""+w;var U=w.length|0,x=new u((U<<1)+8|0),p,k=0,G=!a;for(p=0;p<U;p=p+1|0,k=k+1|0){var B=w.charCodeAt(p)|0;if(127>=B)x[k]=B;else{if(2047>=B)x[k]=192|B>>6;else{e:{if(55296<=B)if(56319>=B){var T=w.charCodeAt(p=p+1|0)|0;if(56320<=T&&57343>=T){if(B=(B<<10)+T-56613888|0,65535<B){x[k]=240|B>>18,x[k=k+1|0]=128|B>>12&63,x[k=k+1|0]=128|B>>6&63,x[k=k+1|0]=128|B&63;continue}break e}B=65533}else 57343>=B&&(B=65533);!G&&p<<1<k&&p<<1<(k-7|0)&&(G=!0,T=new u(3*U),T.set(x),x=T)}x[k]=224|B>>12,x[k=k+1|0]=128|B>>6&63}x[k=k+1|0]=128|B&63}}return a?x.subarray(0,k):x.slice(0,k)},y||(n.TextDecoder=e,n.TextEncoder=t)})(""+void 0==typeof global?""+void 0==typeof globalThis?Ae:globalThis:global)});var ni=h(l(),1);var Kn=h(l(),1);var Nn=h(l());var At=h(l());function Q(n){let e=typeof n;if(e=="object"){if(Array.isArray(n))return"array";if(n===null)return"null"}return e}function Se(n){return n!==null&&typeof n=="object"&&!Array.isArray(n)}var Ut=h(l()),C="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""),ee=[];for(let n=0;n<C.length;n++)ee[C[n].charCodeAt(0)]=n;ee["-".charCodeAt(0)]=C.indexOf("+");ee["_".charCodeAt(0)]=C.indexOf("/");function Z(n){let e=n.length*3/4;n[n.length-2]=="="?e-=2:n[n.length-1]=="="&&(e-=1);let t=new Uint8Array(e),r=0,i=0,s,o=0;for(let a=0;a<n.length;a++){if(s=ee[n.charCodeAt(a)],s===void 0)switch(n[a]){case"=":i=0;case`
`:case"\r":case"	":case" ":continue;default:throw Error("invalid base64 string.")}switch(i){case 0:o=s,i=1;break;case 1:t[r++]=o<<2|(s&48)>>4,o=s,i=2;break;case 2:t[r++]=(o&15)<<4|(s&60)>>2,o=s,i=3;break;case 3:t[r++]=(o&3)<<6|s,i=0;break}}if(i==1)throw Error("invalid base64 string.");return t.subarray(0,r)}function ye(n){let e="",t=0,r,i=0;for(let s=0;s<n.length;s++)switch(r=n[s],t){case 0:e+=C[r>>2],i=(r&3)<<4,t=1;break;case 1:e+=C[i|r>>4],i=(r&15)<<2,t=2;break;case 2:e+=C[i|r>>6],e+=C[r&63],t=0;break}return t&&(e+=C[i],e+="=",t==1&&(e+="=")),e}var Dt=h(l()),D;(function(n){n.symbol=Symbol.for("protobuf-ts/unknown"),n.onRead=(t,r,i,s,o)=>{(e(r)?r[n.symbol]:r[n.symbol]=[]).push({no:i,wireType:s,data:o})},n.onWrite=(t,r,i)=>{for(let{no:s,wireType:o,data:a}of n.list(r))i.tag(s,o).raw(a)},n.list=(t,r)=>{if(e(t)){let i=t[n.symbol];return r?i.filter(s=>s.no==r):i}return[]},n.last=(t,r)=>n.list(t,r).slice(-1)[0];let e=t=>t&&Array.isArray(t[n.symbol])})(D||(D={}));var b;(function(n){n[n.Varint=0]="Varint",n[n.Bit64=1]="Bit64",n[n.LengthDelimited=2]="LengthDelimited",n[n.StartGroup=3]="StartGroup",n[n.EndGroup=4]="EndGroup",n[n.Bit32=5]="Bit32"})(b||(b={}));var Xt=h(l());var $t=h(l());var Lt=h(l());function Ue(){let n=0,e=0;for(let r=0;r<28;r+=7){let i=this.buf[this.pos++];if(n|=(i&127)<<r,!(i&128))return this.assertBounds(),[n,e]}let t=this.buf[this.pos++];if(n|=(t&15)<<28,e=(t&112)>>4,!(t&128))return this.assertBounds(),[n,e];for(let r=3;r<=31;r+=7){let i=this.buf[this.pos++];if(e|=(i&127)<<r,!(i&128))return this.assertBounds(),[n,e]}throw new Error("invalid varint")}function re(n,e,t){for(let s=0;s<28;s=s+7){let o=n>>>s,a=!(!(o>>>7)&&e==0),u=(a?o|128:o)&255;if(t.push(u),!a)return}let r=n>>>28&15|(e&7)<<4,i=!!(e>>3);if(t.push((i?r|128:r)&255),!!i){for(let s=3;s<31;s=s+7){let o=e>>>s,a=!!(o>>>7),u=(a?o|128:o)&255;if(t.push(u),!a)return}t.push(e>>>31&1)}}var te=(1<<16)*(1<<16);function be(n){let e=n[0]=="-";e&&(n=n.slice(1));let t=1e6,r=0,i=0;function s(o,a){let u=Number(n.slice(o,a));i*=t,r=r*t+u,r>=te&&(i=i+(r/te|0),r=r%te)}return s(-24,-18),s(-18,-12),s(-12,-6),s(-6),[e,r,i]}function ne(n,e){if(e>>>0<=2097151)return""+(te*e+(n>>>0));let t=n&16777215,r=(n>>>24|e<<8)>>>0&16777215,i=e>>16&65535,s=t+r*6777216+i*6710656,o=r+i*8147497,a=i*2,u=1e7;s>=u&&(o+=Math.floor(s/u),s%=u),o>=u&&(a+=Math.floor(o/u),o%=u);function c(d,I){let y=d?String(d):"";return I?"0000000".slice(y.length)+y:y}return c(a,0)+c(o,a)+c(s,1)}function we(n,e){if(n>=0){for(;n>127;)e.push(n&127|128),n=n>>>7;e.push(n)}else{for(let t=0;t<9;t++)e.push(n&127|128),n=n>>7;e.push(1)}}function Ve(){let n=this.buf[this.pos++],e=n&127;if(!(n&128))return this.assertBounds(),e;if(n=this.buf[this.pos++],e|=(n&127)<<7,!(n&128))return this.assertBounds(),e;if(n=this.buf[this.pos++],e|=(n&127)<<14,!(n&128))return this.assertBounds(),e;if(n=this.buf[this.pos++],e|=(n&127)<<21,!(n&128))return this.assertBounds(),e;n=this.buf[this.pos++],e|=(n&15)<<28;for(let t=5;n&128&&t<10;t++)n=this.buf[this.pos++];if(n&128)throw new Error("invalid varint");return this.assertBounds(),e>>>0}var O;function lt(){let n=new DataView(new ArrayBuffer(8));O=globalThis.BigInt!==void 0&&typeof n.getBigInt64=="function"&&typeof n.getBigUint64=="function"&&typeof n.setBigInt64=="function"&&typeof n.setBigUint64=="function"?{MIN:BigInt("-9223372036854775808"),MAX:BigInt("9223372036854775807"),UMIN:BigInt("0"),UMAX:BigInt("18446744073709551615"),C:BigInt,V:n}:void 0}lt();function De(n){if(!n)throw new Error("BigInt unavailable, see https://github.com/timostamm/protobuf-ts/blob/v1.0.8/MANUAL.md#bigint-support")}var Ke=/^-?[0-9]+$/,se=4294967296,ie=2147483648,oe=class{constructor(e,t){this.lo=e|0,this.hi=t|0}isZero(){return this.lo==0&&this.hi==0}toNumber(){let e=this.hi*se+(this.lo>>>0);if(!Number.isSafeInteger(e))throw new Error("cannot convert to safe number");return e}},E=class extends oe{static from(e){if(O)switch(typeof e){case"string":if(e=="0")return this.ZERO;if(e=="")throw new Error("string is no integer");e=O.C(e);case"number":if(e===0)return this.ZERO;e=O.C(e);case"bigint":if(!e)return this.ZERO;if(e<O.UMIN)throw new Error("signed value for ulong");if(e>O.UMAX)throw new Error("ulong too large");return O.V.setBigUint64(0,e,!0),new E(O.V.getInt32(0,!0),O.V.getInt32(4,!0))}else switch(typeof e){case"string":if(e=="0")return this.ZERO;if(e=e.trim(),!Ke.test(e))throw new Error("string is no integer");let[t,r,i]=be(e);if(t)throw new Error("signed value for ulong");return new E(r,i);case"number":if(e==0)return this.ZERO;if(!Number.isSafeInteger(e))throw new Error("number is no integer");if(e<0)throw new Error("signed value for ulong");return new E(e,e/se)}throw new Error("unknown value "+typeof e)}toString(){return O?this.toBigInt().toString():ne(this.lo,this.hi)}toBigInt(){return De(O),O.V.setInt32(0,this.lo,!0),O.V.setInt32(4,this.hi,!0),O.V.getBigUint64(0,!0)}};E.ZERO=new E(0,0);var N=class extends oe{static from(e){if(O)switch(typeof e){case"string":if(e=="0")return this.ZERO;if(e=="")throw new Error("string is no integer");e=O.C(e);case"number":if(e===0)return this.ZERO;e=O.C(e);case"bigint":if(!e)return this.ZERO;if(e<O.MIN)throw new Error("signed long too small");if(e>O.MAX)throw new Error("signed long too large");return O.V.setBigInt64(0,e,!0),new N(O.V.getInt32(0,!0),O.V.getInt32(4,!0))}else switch(typeof e){case"string":if(e=="0")return this.ZERO;if(e=e.trim(),!Ke.test(e))throw new Error("string is no integer");let[t,r,i]=be(e);if(t){if(i>ie||i==ie&&r!=0)throw new Error("signed long too small")}else if(i>=ie)throw new Error("signed long too large");let s=new N(r,i);return t?s.negate():s;case"number":if(e==0)return this.ZERO;if(!Number.isSafeInteger(e))throw new Error("number is no integer");return e>0?new N(e,e/se):new N(-e,-e/se).negate()}throw new Error("unknown value "+typeof e)}isNegative(){return(this.hi&ie)!==0}negate(){let e=~this.hi,t=this.lo;return t?t=~t+1:e+=1,new N(t,e)}toString(){if(O)return this.toBigInt().toString();if(this.isNegative()){let e=this.negate();return"-"+ne(e.lo,e.hi)}return ne(this.lo,this.hi)}toBigInt(){return De(O),O.V.setInt32(0,this.lo,!0),O.V.setInt32(4,this.hi,!0),O.V.getBigInt64(0,!0)}};N.ZERO=new N(0,0);var Le={readUnknownField:!0,readerFactory:n=>new Ie(n)};function Ce(n){return n?Object.assign(Object.assign({},Le),n):Le}var Ie=class{constructor(e,t){this.varint64=Ue,this.uint32=Ve,this.buf=e,this.len=e.length,this.pos=0,this.view=new DataView(e.buffer,e.byteOffset,e.byteLength),this.textDecoder=t??new TextDecoder("utf-8",{fatal:!0,ignoreBOM:!0})}tag(){let e=this.uint32(),t=e>>>3,r=e&7;if(t<=0||r<0||r>5)throw new Error("illegal tag: field no "+t+" wire type "+r);return[t,r]}skip(e){let t=this.pos;switch(e){case b.Varint:for(;this.buf[this.pos++]&128;);break;case b.Bit64:this.pos+=4;case b.Bit32:this.pos+=4;break;case b.LengthDelimited:let r=this.uint32();this.pos+=r;break;case b.StartGroup:let i;for(;(i=this.tag()[1])!==b.EndGroup;)this.skip(i);break;default:throw new Error("cant skip wire type "+e)}return this.assertBounds(),this.buf.subarray(t,this.pos)}assertBounds(){if(this.pos>this.len)throw new RangeError("premature EOF")}int32(){return this.uint32()|0}sint32(){let e=this.uint32();return e>>>1^-(e&1)}int64(){return new N(...this.varint64())}uint64(){return new E(...this.varint64())}sint64(){let[e,t]=this.varint64(),r=-(e&1);return e=(e>>>1|(t&1)<<31)^r,t=t>>>1^r,new N(e,t)}bool(){let[e,t]=this.varint64();return e!==0||t!==0}fixed32(){return this.view.getUint32((this.pos+=4)-4,!0)}sfixed32(){return this.view.getInt32((this.pos+=4)-4,!0)}fixed64(){return new E(this.sfixed32(),this.sfixed32())}sfixed64(){return new N(this.sfixed32(),this.sfixed32())}float(){return this.view.getFloat32((this.pos+=4)-4,!0)}double(){return this.view.getFloat64((this.pos+=8)-8,!0)}bytes(){let e=this.uint32(),t=this.pos;return this.pos+=e,this.assertBounds(),this.buf.subarray(t,t+e)}string(){return this.textDecoder.decode(this.bytes())}};var zt=h(l());var _t=h(l());function g(n,e){if(!n)throw new Error(e)}var ht=34028234663852886e22,mt=-34028234663852886e22,dt=4294967295,pt=2147483647,gt=-2147483648;function P(n){if(typeof n!="number")throw new Error("invalid int 32: "+typeof n);if(!Number.isInteger(n)||n>pt||n<gt)throw new Error("invalid int 32: "+n)}function j(n){if(typeof n!="number")throw new Error("invalid uint 32: "+typeof n);if(!Number.isInteger(n)||n>dt||n<0)throw new Error("invalid uint 32: "+n)}function X(n){if(typeof n!="number")throw new Error("invalid float 32: "+typeof n);if(Number.isFinite(n)&&(n>ht||n<mt))throw new Error("invalid float 32: "+n)}var qe={writeUnknownFields:!0,writerFactory:()=>new Ne};function $e(n){return n?Object.assign(Object.assign({},qe),n):qe}var Ne=class{constructor(e){this.stack=[],this.textEncoder=e??new TextEncoder,this.chunks=[],this.buf=[]}finish(){this.chunks.push(new Uint8Array(this.buf));let e=0;for(let i=0;i<this.chunks.length;i++)e+=this.chunks[i].length;let t=new Uint8Array(e),r=0;for(let i=0;i<this.chunks.length;i++)t.set(this.chunks[i],r),r+=this.chunks[i].length;return this.chunks=[],t}fork(){return this.stack.push({chunks:this.chunks,buf:this.buf}),this.chunks=[],this.buf=[],this}join(){let e=this.finish(),t=this.stack.pop();if(!t)throw new Error("invalid state, fork stack empty");return this.chunks=t.chunks,this.buf=t.buf,this.uint32(e.byteLength),this.raw(e)}tag(e,t){return this.uint32((e<<3|t)>>>0)}raw(e){return this.buf.length&&(this.chunks.push(new Uint8Array(this.buf)),this.buf=[]),this.chunks.push(e),this}uint32(e){for(j(e);e>127;)this.buf.push(e&127|128),e=e>>>7;return this.buf.push(e),this}int32(e){return P(e),we(e,this.buf),this}bool(e){return this.buf.push(e?1:0),this}bytes(e){return this.uint32(e.byteLength),this.raw(e)}string(e){let t=this.textEncoder.encode(e);return this.uint32(t.byteLength),this.raw(t)}float(e){X(e);let t=new Uint8Array(4);return new DataView(t.buffer).setFloat32(0,e,!0),this.raw(t)}double(e){let t=new Uint8Array(8);return new DataView(t.buffer).setFloat64(0,e,!0),this.raw(t)}fixed32(e){j(e);let t=new Uint8Array(4);return new DataView(t.buffer).setUint32(0,e,!0),this.raw(t)}sfixed32(e){P(e);let t=new Uint8Array(4);return new DataView(t.buffer).setInt32(0,e,!0),this.raw(t)}sint32(e){return P(e),e=(e<<1^e>>31)>>>0,we(e,this.buf),this}sfixed64(e){let t=new Uint8Array(8),r=new DataView(t.buffer),i=N.from(e);return r.setInt32(0,i.lo,!0),r.setInt32(4,i.hi,!0),this.raw(t)}fixed64(e){let t=new Uint8Array(8),r=new DataView(t.buffer),i=E.from(e);return r.setInt32(0,i.lo,!0),r.setInt32(4,i.hi,!0),this.raw(t)}int64(e){let t=N.from(e);return re(t.lo,t.hi,this.buf),this}sint64(e){let t=N.from(e),r=t.hi>>31,i=t.lo<<1^r,s=(t.hi<<1|t.lo>>>31)^r;return re(i,s,this.buf),this}uint64(e){let t=E.from(e);return re(t.lo,t.hi,this.buf),this}};var Qt=h(l()),Pe={emitDefaultValues:!1,enumAsInteger:!1,useProtoFieldName:!1,prettySpaces:0},Me={ignoreUnknownFields:!1};function Je(n){return n?Object.assign(Object.assign({},Me),n):Me}function je(n){return n?Object.assign(Object.assign({},Pe),n):Pe}var tr=h(l()),ae=Symbol.for("protobuf-ts/message-type");var bn=h(l());var or=h(l());var nr=h(l());function ke(n){let e=!1,t=[];for(let r=0;r<n.length;r++){let i=n.charAt(r);i=="_"?e=!0:/\d/.test(i)?(t.push(i),e=!0):e?(t.push(i.toUpperCase()),e=!1):r==0?t.push(i.toLowerCase()):t.push(i)}return t.join("")}var f;(function(n){n[n.DOUBLE=1]="DOUBLE",n[n.FLOAT=2]="FLOAT",n[n.INT64=3]="INT64",n[n.UINT64=4]="UINT64",n[n.INT32=5]="INT32",n[n.FIXED64=6]="FIXED64",n[n.FIXED32=7]="FIXED32",n[n.BOOL=8]="BOOL",n[n.STRING=9]="STRING",n[n.BYTES=12]="BYTES",n[n.UINT32=13]="UINT32",n[n.SFIXED32=15]="SFIXED32",n[n.SFIXED64=16]="SFIXED64",n[n.SINT32=17]="SINT32",n[n.SINT64=18]="SINT64"})(f||(f={}));var F;(function(n){n[n.BIGINT=0]="BIGINT",n[n.STRING=1]="STRING",n[n.NUMBER=2]="NUMBER"})(F||(F={}));var v;(function(n){n[n.NO=0]="NO",n[n.PACKED=1]="PACKED",n[n.UNPACKED=2]="UNPACKED"})(v||(v={}));function Xe(n){var e,t,r,i;return n.localName=(e=n.localName)!==null&&e!==void 0?e:ke(n.name),n.jsonName=(t=n.jsonName)!==null&&t!==void 0?t:ke(n.name),n.repeat=(r=n.repeat)!==null&&r!==void 0?r:v.NO,n.opt=(i=n.opt)!==null&&i!==void 0?i:n.repeat||n.oneof?!1:n.kind=="message",n}var hr=h(l());var fr=h(l());function We(n){if(typeof n!="object"||n===null||!n.hasOwnProperty("oneofKind"))return!1;switch(typeof n.oneofKind){case"string":return n[n.oneofKind]===void 0?!1:Object.keys(n).length==2;case"undefined":return Object.keys(n).length==1;default:return!1}}var fe=class{constructor(e){var t;this.fields=(t=e.fields)!==null&&t!==void 0?t:[]}prepare(){if(this.data)return;let e=[],t=[],r=[];for(let i of this.fields)if(i.oneof)r.includes(i.oneof)||(r.push(i.oneof),e.push(i.oneof),t.push(i.oneof));else switch(t.push(i.localName),i.kind){case"scalar":case"enum":(!i.opt||i.repeat)&&e.push(i.localName);break;case"message":i.repeat&&e.push(i.localName);break;case"map":e.push(i.localName);break}this.data={req:e,known:t,oneofs:Object.values(r)}}is(e,t,r=!1){if(t<0)return!0;if(e==null||typeof e!="object")return!1;this.prepare();let i=Object.keys(e),s=this.data;if(i.length<s.req.length||s.req.some(o=>!i.includes(o))||!r&&i.some(o=>!s.known.includes(o)))return!1;if(t<1)return!0;for(let o of s.oneofs){let a=e[o];if(!We(a))return!1;if(a.oneofKind===void 0)continue;let u=this.fields.find(c=>c.localName===a.oneofKind);if(!u||!this.field(a[a.oneofKind],u,r,t))return!1}for(let o of this.fields)if(o.oneof===void 0&&!this.field(e[o.localName],o,r,t))return!1;return!0}field(e,t,r,i){let s=t.repeat;switch(t.kind){case"scalar":return e===void 0?t.opt:s?this.scalars(e,t.T,i,t.L):this.scalar(e,t.T,t.L);case"enum":return e===void 0?t.opt:s?this.scalars(e,f.INT32,i):this.scalar(e,f.INT32);case"message":return e===void 0?!0:s?this.messages(e,t.T(),r,i):this.message(e,t.T(),r,i);case"map":if(typeof e!="object"||e===null)return!1;if(i<2)return!0;if(!this.mapKeys(e,t.K,i))return!1;switch(t.V.kind){case"scalar":return this.scalars(Object.values(e),t.V.T,i,t.V.L);case"enum":return this.scalars(Object.values(e),f.INT32,i);case"message":return this.messages(Object.values(e),t.V.T(),r,i)}break}return!0}message(e,t,r,i){return r?t.isAssignable(e,i):t.is(e,i)}messages(e,t,r,i){if(!Array.isArray(e))return!1;if(i<2)return!0;if(r){for(let s=0;s<e.length&&s<i;s++)if(!t.isAssignable(e[s],i-1))return!1}else for(let s=0;s<e.length&&s<i;s++)if(!t.is(e[s],i-1))return!1;return!0}scalar(e,t,r){let i=typeof e;switch(t){case f.UINT64:case f.FIXED64:case f.INT64:case f.SFIXED64:case f.SINT64:switch(r){case F.BIGINT:return i=="bigint";case F.NUMBER:return i=="number"&&!isNaN(e);default:return i=="string"}case f.BOOL:return i=="boolean";case f.STRING:return i=="string";case f.BYTES:return e instanceof Uint8Array;case f.DOUBLE:case f.FLOAT:return i=="number"&&!isNaN(e);default:return i=="number"&&Number.isInteger(e)}}scalars(e,t,r,i){if(!Array.isArray(e))return!1;if(r<2)return!0;if(Array.isArray(e)){for(let s=0;s<e.length&&s<r;s++)if(!this.scalar(e[s],t,i))return!1}return!0}mapKeys(e,t,r){let i=Object.keys(e);switch(t){case f.INT32:case f.FIXED32:case f.SFIXED32:case f.SINT32:case f.UINT32:return this.scalars(i.slice(0,r).map(s=>parseInt(s)),t,r);case f.BOOL:return this.scalars(i.slice(0,r).map(s=>s=="true"?!0:s=="false"?!1:s),t,r);default:return this.scalars(i,t,r,F.STRING)}}};var Or=h(l());var pr=h(l());function S(n,e){switch(e){case F.BIGINT:return n.toBigInt();case F.NUMBER:return n.toNumber();default:return n.toString()}}var ue=class{constructor(e){this.info=e}prepare(){var e;if(this.fMap===void 0){this.fMap={};let t=(e=this.info.fields)!==null&&e!==void 0?e:[];for(let r of t)this.fMap[r.name]=r,this.fMap[r.jsonName]=r,this.fMap[r.localName]=r}}assert(e,t,r){if(!e){let i=Q(r);throw(i=="number"||i=="boolean")&&(i=r.toString()),new Error(`Cannot parse JSON ${i} for ${this.info.typeName}#${t}`)}}read(e,t,r){this.prepare();let i=[];for(let[s,o]of Object.entries(e)){let a=this.fMap[s];if(!a){if(!r.ignoreUnknownFields)throw new Error(`Found unknown field while reading ${this.info.typeName} from JSON format. JSON key: ${s}`);continue}let u=a.localName,c;if(a.oneof){if(o===null&&(a.kind!=="enum"||a.T()[0]!=="google.protobuf.NullValue"))continue;if(i.includes(a.oneof))throw new Error(`Multiple members of the oneof group "${a.oneof}" of ${this.info.typeName} are present in JSON.`);i.push(a.oneof),c=t[a.oneof]={oneofKind:u}}else c=t;if(a.kind=="map"){if(o===null)continue;this.assert(Se(o),a.name,o);let d=c[u];for(let[I,y]of Object.entries(o)){this.assert(y!==null,a.name+" map value",null);let m;switch(a.V.kind){case"message":m=a.V.T().internalJsonRead(y,r);break;case"enum":if(m=this.enum(a.V.T(),y,a.name,r.ignoreUnknownFields),m===!1)continue;break;case"scalar":m=this.scalar(y,a.V.T,a.V.L,a.name);break}this.assert(m!==void 0,a.name+" map value",y);let w=I;a.K==f.BOOL&&(w=w=="true"?!0:w=="false"?!1:w),w=this.scalar(w,a.K,F.STRING,a.name).toString(),d[w]=m}}else if(a.repeat){if(o===null)continue;this.assert(Array.isArray(o),a.name,o);let d=c[u];for(let I of o){this.assert(I!==null,a.name,null);let y;switch(a.kind){case"message":y=a.T().internalJsonRead(I,r);break;case"enum":if(y=this.enum(a.T(),I,a.name,r.ignoreUnknownFields),y===!1)continue;break;case"scalar":y=this.scalar(I,a.T,a.L,a.name);break}this.assert(y!==void 0,a.name,o),d.push(y)}}else switch(a.kind){case"message":if(o===null&&a.T().typeName!="google.protobuf.Value"){this.assert(a.oneof===void 0,a.name+" (oneof member)",null);continue}c[u]=a.T().internalJsonRead(o,r,c[u]);break;case"enum":let d=this.enum(a.T(),o,a.name,r.ignoreUnknownFields);if(d===!1)continue;c[u]=d;break;case"scalar":c[u]=this.scalar(o,a.T,a.L,a.name);break}}}enum(e,t,r,i){if(e[0]=="google.protobuf.NullValue"&&g(t===null||t==="NULL_VALUE",`Unable to parse field ${this.info.typeName}#${r}, enum ${e[0]} only accepts null.`),t===null)return 0;switch(typeof t){case"number":return g(Number.isInteger(t),`Unable to parse field ${this.info.typeName}#${r}, enum can only be integral number, got ${t}.`),t;case"string":let s=t;e[2]&&t.substring(0,e[2].length)===e[2]&&(s=t.substring(e[2].length));let o=e[1][s];return typeof o>"u"&&i?!1:(g(typeof o=="number",`Unable to parse field ${this.info.typeName}#${r}, enum ${e[0]} has no value for "${t}".`),o)}g(!1,`Unable to parse field ${this.info.typeName}#${r}, cannot parse enum value from ${typeof t}".`)}scalar(e,t,r,i){let s;try{switch(t){case f.DOUBLE:case f.FLOAT:if(e===null)return 0;if(e==="NaN")return Number.NaN;if(e==="Infinity")return Number.POSITIVE_INFINITY;if(e==="-Infinity")return Number.NEGATIVE_INFINITY;if(e===""){s="empty string";break}if(typeof e=="string"&&e.trim().length!==e.length){s="extra whitespace";break}if(typeof e!="string"&&typeof e!="number")break;let o=Number(e);if(Number.isNaN(o)){s="not a number";break}if(!Number.isFinite(o)){s="too large or small";break}return t==f.FLOAT&&X(o),o;case f.INT32:case f.FIXED32:case f.SFIXED32:case f.SINT32:case f.UINT32:if(e===null)return 0;let a;if(typeof e=="number"?a=e:e===""?s="empty string":typeof e=="string"&&(e.trim().length!==e.length?s="extra whitespace":a=Number(e)),a===void 0)break;return t==f.UINT32?j(a):P(a),a;case f.INT64:case f.SFIXED64:case f.SINT64:if(e===null)return S(N.ZERO,r);if(typeof e!="number"&&typeof e!="string")break;return S(N.from(e),r);case f.FIXED64:case f.UINT64:if(e===null)return S(E.ZERO,r);if(typeof e!="number"&&typeof e!="string")break;return S(E.from(e),r);case f.BOOL:if(e===null)return!1;if(typeof e!="boolean")break;return e;case f.STRING:if(e===null)return"";if(typeof e!="string"){s="extra whitespace";break}try{encodeURIComponent(e)}catch(u){u="invalid UTF8";break}return e;case f.BYTES:if(e===null||e==="")return new Uint8Array(0);if(typeof e!="string")break;return Z(e)}}catch(o){s=o.message}this.assert(!1,i+(s?" - "+s:""),e)}};var Fr=h(l());var ce=class{constructor(e){var t;this.fields=(t=e.fields)!==null&&t!==void 0?t:[]}write(e,t){let r={},i=e;for(let s of this.fields){if(!s.oneof){let c=this.field(s,i[s.localName],t);c!==void 0&&(r[t.useProtoFieldName?s.name:s.jsonName]=c);continue}let o=i[s.oneof];if(o.oneofKind!==s.localName)continue;let a=s.kind=="scalar"||s.kind=="enum"?Object.assign(Object.assign({},t),{emitDefaultValues:!0}):t,u=this.field(s,o[s.localName],a);g(u!==void 0),r[t.useProtoFieldName?s.name:s.jsonName]=u}return r}field(e,t,r){let i;if(e.kind=="map"){g(typeof t=="object"&&t!==null);let s={};switch(e.V.kind){case"scalar":for(let[u,c]of Object.entries(t)){let d=this.scalar(e.V.T,c,e.name,!1,!0);g(d!==void 0),s[u.toString()]=d}break;case"message":let o=e.V.T();for(let[u,c]of Object.entries(t)){let d=this.message(o,c,e.name,r);g(d!==void 0),s[u.toString()]=d}break;case"enum":let a=e.V.T();for(let[u,c]of Object.entries(t)){g(c===void 0||typeof c=="number");let d=this.enum(a,c,e.name,!1,!0,r.enumAsInteger);g(d!==void 0),s[u.toString()]=d}break}(r.emitDefaultValues||Object.keys(s).length>0)&&(i=s)}else if(e.repeat){g(Array.isArray(t));let s=[];switch(e.kind){case"scalar":for(let u=0;u<t.length;u++){let c=this.scalar(e.T,t[u],e.name,e.opt,!0);g(c!==void 0),s.push(c)}break;case"enum":let o=e.T();for(let u=0;u<t.length;u++){g(t[u]===void 0||typeof t[u]=="number");let c=this.enum(o,t[u],e.name,e.opt,!0,r.enumAsInteger);g(c!==void 0),s.push(c)}break;case"message":let a=e.T();for(let u=0;u<t.length;u++){let c=this.message(a,t[u],e.name,r);g(c!==void 0),s.push(c)}break}(r.emitDefaultValues||s.length>0||r.emitDefaultValues)&&(i=s)}else switch(e.kind){case"scalar":i=this.scalar(e.T,t,e.name,e.opt,r.emitDefaultValues);break;case"enum":i=this.enum(e.T(),t,e.name,e.opt,r.emitDefaultValues,r.enumAsInteger);break;case"message":i=this.message(e.T(),t,e.name,r);break}return i}enum(e,t,r,i,s,o){if(e[0]=="google.protobuf.NullValue")return!s&&!i?void 0:null;if(t===void 0){g(i);return}if(!(t===0&&!s&&!i))return g(typeof t=="number"),g(Number.isInteger(t)),o||!e[1].hasOwnProperty(t)?t:e[2]?e[2]+e[1][t]:e[1][t]}message(e,t,r,i){return t===void 0?i.emitDefaultValues?null:void 0:e.internalJsonWrite(t,i)}scalar(e,t,r,i,s){if(t===void 0){g(i);return}let o=s||i;switch(e){case f.INT32:case f.SFIXED32:case f.SINT32:return t===0?o?0:void 0:(P(t),t);case f.FIXED32:case f.UINT32:return t===0?o?0:void 0:(j(t),t);case f.FLOAT:X(t);case f.DOUBLE:return t===0?o?0:void 0:(g(typeof t=="number"),Number.isNaN(t)?"NaN":t===Number.POSITIVE_INFINITY?"Infinity":t===Number.NEGATIVE_INFINITY?"-Infinity":t);case f.STRING:return t===""?o?"":void 0:(g(typeof t=="string"),t);case f.BOOL:return t===!1?o?!1:void 0:(g(typeof t=="boolean"),t);case f.UINT64:case f.FIXED64:g(typeof t=="number"||typeof t=="string"||typeof t=="bigint");let a=E.from(t);return a.isZero()&&!o?void 0:a.toString();case f.INT64:case f.SFIXED64:case f.SINT64:g(typeof t=="number"||typeof t=="string"||typeof t=="bigint");let u=N.from(t);return u.isZero()&&!o?void 0:u.toString();case f.BYTES:return g(t instanceof Uint8Array),t.byteLength?ye(t):o?"":void 0}}};var Pr=h(l());var Dr=h(l());function z(n,e=F.STRING){switch(n){case f.BOOL:return!1;case f.UINT64:case f.FIXED64:return S(E.ZERO,e);case f.INT64:case f.SFIXED64:case f.SINT64:return S(N.ZERO,e);case f.DOUBLE:case f.FLOAT:return 0;case f.BYTES:return new Uint8Array(0);case f.STRING:return"";default:return 0}}var le=class{constructor(e){this.info=e}prepare(){var e;if(!this.fieldNoToField){let t=(e=this.info.fields)!==null&&e!==void 0?e:[];this.fieldNoToField=new Map(t.map(r=>[r.no,r]))}}read(e,t,r,i){this.prepare();let s=i===void 0?e.len:e.pos+i;for(;e.pos<s;){let[o,a]=e.tag(),u=this.fieldNoToField.get(o);if(!u){let y=r.readUnknownField;if(y=="throw")throw new Error(`Unknown field ${o} (wire type ${a}) for ${this.info.typeName}`);let m=e.skip(a);y!==!1&&(y===!0?D.onRead:y)(this.info.typeName,t,o,a,m);continue}let c=t,d=u.repeat,I=u.localName;switch(u.oneof&&(c=c[u.oneof],c.oneofKind!==I&&(c=t[u.oneof]={oneofKind:I})),u.kind){case"scalar":case"enum":let y=u.kind=="enum"?f.INT32:u.T,m=u.kind=="scalar"?u.L:void 0;if(d){let x=c[I];if(a==b.LengthDelimited&&y!=f.STRING&&y!=f.BYTES){let p=e.uint32()+e.pos;for(;e.pos<p;)x.push(this.scalar(e,y,m))}else x.push(this.scalar(e,y,m))}else c[I]=this.scalar(e,y,m);break;case"message":if(d){let x=c[I],p=u.T().internalBinaryRead(e,e.uint32(),r);x.push(p)}else c[I]=u.T().internalBinaryRead(e,e.uint32(),r,c[I]);break;case"map":let[w,U]=this.mapEntry(u,e,r);c[I][w]=U;break}}}mapEntry(e,t,r){let i=t.uint32(),s=t.pos+i,o,a;for(;t.pos<s;){let[u,c]=t.tag();switch(u){case 1:e.K==f.BOOL?o=t.bool().toString():o=this.scalar(t,e.K,F.STRING);break;case 2:switch(e.V.kind){case"scalar":a=this.scalar(t,e.V.T,e.V.L);break;case"enum":a=t.int32();break;case"message":a=e.V.T().internalBinaryRead(t,t.uint32(),r);break}break;default:throw new Error(`Unknown field ${u} (wire type ${c}) in map entry for ${this.info.typeName}#${e.name}`)}}if(o===void 0){let u=z(e.K);o=e.K==f.BOOL?u.toString():u}if(a===void 0)switch(e.V.kind){case"scalar":a=z(e.V.T,e.V.L);break;case"enum":a=0;break;case"message":a=e.V.T().create();break}return[o,a]}scalar(e,t,r){switch(t){case f.INT32:return e.int32();case f.STRING:return e.string();case f.BOOL:return e.bool();case f.DOUBLE:return e.double();case f.FLOAT:return e.float();case f.INT64:return S(e.int64(),r);case f.UINT64:return S(e.uint64(),r);case f.FIXED64:return S(e.fixed64(),r);case f.FIXED32:return e.fixed32();case f.BYTES:return e.bytes();case f.UINT32:return e.uint32();case f.SFIXED32:return e.sfixed32();case f.SFIXED64:return S(e.sfixed64(),r);case f.SINT32:return e.sint32();case f.SINT64:return S(e.sint64(),r)}}};var _r=h(l());var he=class{constructor(e){this.info=e}prepare(){if(!this.fields){let e=this.info.fields?this.info.fields.concat():[];this.fields=e.sort((t,r)=>t.no-r.no)}}write(e,t,r){this.prepare();for(let s of this.fields){let o,a,u=s.repeat,c=s.localName;if(s.oneof){let d=e[s.oneof];if(d.oneofKind!==c)continue;o=d[c],a=!0}else o=e[c],a=!1;switch(s.kind){case"scalar":case"enum":let d=s.kind=="enum"?f.INT32:s.T;if(u)if(g(Array.isArray(o)),u==v.PACKED)this.packed(t,d,s.no,o);else for(let I of o)this.scalar(t,d,s.no,I,!0);else o===void 0?g(s.opt):this.scalar(t,d,s.no,o,a||s.opt);break;case"message":if(u){g(Array.isArray(o));for(let I of o)this.message(t,r,s.T(),s.no,I)}else this.message(t,r,s.T(),s.no,o);break;case"map":g(typeof o=="object"&&o!==null);for(let[I,y]of Object.entries(o))this.mapEntry(t,r,s,I,y);break}}let i=r.writeUnknownFields;i!==!1&&(i===!0?D.onWrite:i)(this.info.typeName,e,t)}mapEntry(e,t,r,i,s){e.tag(r.no,b.LengthDelimited),e.fork();let o=i;switch(r.K){case f.INT32:case f.FIXED32:case f.UINT32:case f.SFIXED32:case f.SINT32:o=Number.parseInt(i);break;case f.BOOL:g(i=="true"||i=="false"),o=i=="true";break}switch(this.scalar(e,r.K,1,o,!0),r.V.kind){case"scalar":this.scalar(e,r.V.T,2,s,!0);break;case"enum":this.scalar(e,f.INT32,2,s,!0);break;case"message":this.message(e,t,r.V.T(),2,s);break}e.join()}message(e,t,r,i,s){s!==void 0&&(r.internalBinaryWrite(s,e.tag(i,b.LengthDelimited).fork(),t),e.join())}scalar(e,t,r,i,s){let[o,a,u]=this.scalarInfo(t,i);(!u||s)&&(e.tag(r,o),e[a](i))}packed(e,t,r,i){if(!i.length)return;g(t!==f.BYTES&&t!==f.STRING),e.tag(r,b.LengthDelimited),e.fork();let[,s]=this.scalarInfo(t);for(let o=0;o<i.length;o++)e[s](i[o]);e.join()}scalarInfo(e,t){let r=b.Varint,i,s=t===void 0,o=t===0;switch(e){case f.INT32:i="int32";break;case f.STRING:o=s||!t.length,r=b.LengthDelimited,i="string";break;case f.BOOL:o=t===!1,i="bool";break;case f.UINT32:i="uint32";break;case f.DOUBLE:r=b.Bit64,i="double";break;case f.FLOAT:r=b.Bit32,i="float";break;case f.INT64:o=s||N.from(t).isZero(),i="int64";break;case f.UINT64:o=s||E.from(t).isZero(),i="uint64";break;case f.FIXED64:o=s||E.from(t).isZero(),r=b.Bit64,i="fixed64";break;case f.BYTES:o=s||!t.byteLength,r=b.LengthDelimited,i="bytes";break;case f.FIXED32:r=b.Bit32,i="fixed32";break;case f.SFIXED32:r=b.Bit32,i="sfixed32";break;case f.SFIXED64:o=s||N.from(t).isZero(),r=b.Bit64,i="sfixed64";break;case f.SINT32:i="sint32";break;case f.SINT64:o=s||N.from(t).isZero(),i="sint64";break}return[r,i,s||o]}};var vr=h(l());function _e(n){let e=n.messagePrototype?Object.create(n.messagePrototype):Object.defineProperty({},ae,{value:n});for(let t of n.fields){let r=t.localName;if(!t.opt)if(t.oneof)e[t.oneof]={oneofKind:void 0};else if(t.repeat)e[r]=[];else switch(t.kind){case"scalar":e[r]=z(t.T,t.L);break;case"enum":e[r]=0;break;case"map":e[r]={};break}}return e}var Hr=h(l());function M(n,e,t){let r,i=t,s;for(let o of n.fields){let a=o.localName;if(o.oneof){let u=i[o.oneof];if(u?.oneofKind==null)continue;if(r=u[a],s=e[o.oneof],s.oneofKind=u.oneofKind,r==null){delete s[a];continue}}else if(r=i[a],s=e,r==null)continue;switch(o.repeat&&(s[a].length=r.length),o.kind){case"scalar":case"enum":if(o.repeat)for(let c=0;c<r.length;c++)s[a][c]=r[c];else s[a]=r;break;case"message":let u=o.T();if(o.repeat)for(let c=0;c<r.length;c++)s[a][c]=u.create(r[c]);else s[a]===void 0?s[a]=u.create(r):u.mergePartial(s[a],r);break;case"map":switch(o.V.kind){case"scalar":case"enum":Object.assign(s[a],r);break;case"message":let c=o.V.T();for(let d of Object.keys(r))s[a][d]=c.create(r[d]);break}break}}}var tn=h(l());function Ze(n,e,t){if(e===t)return!0;if(!e||!t)return!1;for(let r of n.fields){let i=r.localName,s=r.oneof?e[r.oneof][i]:e[i],o=r.oneof?t[r.oneof][i]:t[i];switch(r.kind){case"enum":case"scalar":let a=r.kind=="enum"?f.INT32:r.T;if(!(r.repeat?Ge(a,s,o):ve(a,s,o)))return!1;break;case"map":if(!(r.V.kind=="message"?Ye(r.V.T(),me(s),me(o)):Ge(r.V.kind=="enum"?f.INT32:r.V.T,me(s),me(o))))return!1;break;case"message":let u=r.T();if(!(r.repeat?Ye(u,s,o):u.equals(s,o)))return!1;break}}return!0}var me=Object.values;function ve(n,e,t){if(e===t)return!0;if(n!==f.BYTES)return!1;let r=e,i=t;if(r.length!==i.length)return!1;for(let s=0;s<r.length;s++)if(r[s]!=i[s])return!1;return!0}function Ge(n,e,t){if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(!ve(n,e[r],t[r]))return!1;return!0}function Ye(n,e,t){if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(!n.equals(e[r],t[r]))return!1;return!0}var yt=Object.getOwnPropertyDescriptors(Object.getPrototypeOf({})),W=class{constructor(e,t,r){this.defaultCheckDepth=16,this.typeName=e,this.fields=t.map(Xe),this.options=r??{},this.messagePrototype=Object.create(null,Object.assign(Object.assign({},yt),{[ae]:{value:this}})),this.refTypeCheck=new fe(this),this.refJsonReader=new ue(this),this.refJsonWriter=new ce(this),this.refBinReader=new le(this),this.refBinWriter=new he(this)}create(e){let t=_e(this);return e!==void 0&&M(this,t,e),t}clone(e){let t=this.create();return M(this,t,e),t}equals(e,t){return Ze(this,e,t)}is(e,t=this.defaultCheckDepth){return this.refTypeCheck.is(e,t,!1)}isAssignable(e,t=this.defaultCheckDepth){return this.refTypeCheck.is(e,t,!0)}mergePartial(e,t){M(this,e,t)}fromBinary(e,t){let r=Ce(t);return this.internalBinaryRead(r.readerFactory(e),e.byteLength,r)}fromJson(e,t){return this.internalJsonRead(e,Je(t))}fromJsonString(e,t){let r=JSON.parse(e);return this.fromJson(r,t)}toJson(e,t){return this.internalJsonWrite(e,je(t))}toJsonString(e,t){var r;let i=this.toJson(e,t);return JSON.stringify(i,null,(r=t?.prettySpaces)!==null&&r!==void 0?r:0)}toBinary(e,t){let r=$e(t);return this.internalBinaryWrite(e,r.writerFactory(),r).finish()}internalJsonRead(e,t,r){if(e!==null&&typeof e=="object"&&!Array.isArray(e)){let i=r??this.create();return this.refJsonReader.read(e,i,t),i}throw new Error(`Unable to parse message ${this.typeName} from JSON ${Q(e)}.`)}internalJsonWrite(e,t){return this.refJsonWriter.write(e,t)}internalBinaryWrite(e,t,r){return this.refBinWriter.write(e,t,r),t}internalBinaryRead(e,t,r,i){let s=i??this.create();return this.refBinReader.read(e,s,r,t),s}};var Sn=h(l(),1);var xe=class extends W{constructor(){super("youtube.request.init.OnesieRequest",[{no:3,name:"encryptedInnertubeRequest",kind:"message",T:()=>Oe}])}create(e){let t=globalThis.Object.create(this.messagePrototype);return e!==void 0&&M(this,t,e),t}internalBinaryRead(e,t,r,i){let s=i??this.create(),o=e.pos+t;for(;e.pos<o;){let[a,u]=e.tag();switch(a){case 3:s.encryptedInnertubeRequest=Oe.internalBinaryRead(e,e.uint32(),r,s.encryptedInnertubeRequest);break;default:let c=r.readUnknownField;if(c==="throw")throw new globalThis.Error(`Unknown field ${a} (wire type ${u}) for ${this.typeName}`);let d=e.skip(u);c!==!1&&(c===!0?D.onRead:c)(this.typeName,s,a,u,d)}}return s}internalBinaryWrite(e,t,r){e.encryptedInnertubeRequest&&Oe.internalBinaryWrite(e.encryptedInnertubeRequest,t.tag(3,b.LengthDelimited).fork(),r).join();let i=r.writeUnknownFields;return i!==!1&&(i==!0?D.onWrite:i)(this.typeName,e,t),t}},ze=new xe,Te=class extends W{constructor(){super("youtube.request.init.EncryptedInnertubeRequest",[{no:2,name:"encryptedOnesieInnertubeRequest",kind:"scalar",T:12},{no:5,name:"encryptedClientKey",kind:"scalar",T:12},{no:6,name:"iv",kind:"scalar",T:12},{no:7,name:"hmac",kind:"scalar",T:12}])}create(e){let t=globalThis.Object.create(this.messagePrototype);return t.encryptedOnesieInnertubeRequest=new Uint8Array(0),t.encryptedClientKey=new Uint8Array(0),t.iv=new Uint8Array(0),t.hmac=new Uint8Array(0),e!==void 0&&M(this,t,e),t}internalBinaryRead(e,t,r,i){let s=i??this.create(),o=e.pos+t;for(;e.pos<o;){let[a,u]=e.tag();switch(a){case 2:s.encryptedOnesieInnertubeRequest=e.bytes();break;case 5:s.encryptedClientKey=e.bytes();break;case 6:s.iv=e.bytes();break;case 7:s.hmac=e.bytes();break;default:let c=r.readUnknownField;if(c==="throw")throw new globalThis.Error(`Unknown field ${a} (wire type ${u}) for ${this.typeName}`);let d=e.skip(u);c!==!1&&(c===!0?D.onRead:c)(this.typeName,s,a,u,d)}}return s}internalBinaryWrite(e,t,r){e.encryptedOnesieInnertubeRequest.length&&t.tag(2,b.LengthDelimited).bytes(e.encryptedOnesieInnertubeRequest),e.encryptedClientKey.length&&t.tag(5,b.LengthDelimited).bytes(e.encryptedClientKey),e.iv.length&&t.tag(6,b.LengthDelimited).bytes(e.iv),e.hmac.length&&t.tag(7,b.LengthDelimited).bytes(e.hmac);let i=r.writeUnknownFields;return i!==!1&&(i==!0?D.onWrite:i)(this.typeName,e,t),t}},Oe=new Te;var bt="x-youtube-hot-hash-data",wt="content-encoding";function It(n,e){if(n.length!==e.length)return!1;for(let t=0;t<n.length;t++)if(n[t]!==e[t])return!1;return!0}function Nt(n,e){return n[e]?(delete n[e],!0):!1}function kt(n){let e=!!n.config[n.platformKey]?.clientKey,t={...n.headers};for(let r of Object.keys(t)){let i=r.toLowerCase();(i===wt||!e&&i===bt)&&delete t[r]}return{action:"headers",headers:t,config:n.config,changed:!1}}function Ot(n,e,t,r){let i=[`ck=${encodeURIComponent(e)}`,`target=${encodeURIComponent(t)}`];for(let[s,o]of Object.entries(r))i.push(`${s}=${encodeURIComponent(String(o))}`);return`${n}?${i.join("&")}`}function xt(n){let e=n.config[n.platformKey],t=e?.clientKey,r=e?.encryptKey;if(r&&t&&n.bodyBytes!=null){let i=ze.fromBinary(n.bodyBytes).encryptedInnertubeRequest?.encryptedClientKey;if(i&&It(i,Z(r)))return{action:"redirect",redirectUrl:Ot(n.workerUrl,t,n.url,n.params),config:n.config,changed:!1}}return{action:"empty",config:n.config,changed:Nt(n.config,n.platformKey)}}function He(n){return n.url.includes("log_event")?kt(n):n.url.includes("initplayback")?xt(n):{action:"exit",config:n.config,changed:!1}}var Xn=h(l(),1);var Cn=h(l(),1);var _=class{_times=new Map;name;isDebug;className;request;response;constructor(e,t,r){this.name=e??"",this.isDebug=r?.debug??!1,e&&this.debug(`${e} Start`),this.className=t??"",this.init()}static getInstance(e,t){let r="Surge";return typeof $loon<"u"?r="Loon":typeof $task<"u"&&(r="QuanX"),_.instances[r]||(_.instances[r]=_.classNames[r](e,r,t)),_.instances[r]}createProxy(e){return new Proxy(e,{get:this.getFn,set:this.setFn})}getFn(e,t,r){return e[t]}setFn(e,t,r,i){return e[t]=r,!0}getJSON(e,t={}){let r=this.getVal(e);return r?JSON.parse(r):t}setJSON(e,t){this.setVal(JSON.stringify(e),t)}msg(e=this.name,t="",r="",i){}debug(e){this.isDebug&&(typeof e=="object"&&(e=JSON.stringify(e)),console.log(e))}log(e){typeof e=="object"&&(e=JSON.stringify(e)),console.log(e)}timeStart(e){this._times.set(e,Date.now())}timeEnd(e){if(this._times.has(e)){let t=this._times.get(e)??0,r=Date.now()-t;this.debug(`${e}: ${r}ms`),this._times.delete(e)}else this.debug(`Timer with label ${e} does not exist.`)}exit(){$done({})}reject(){$done()}decodeParams(e){return e}},$=_;Y($,"instances",{}),Y($,"classNames",{QuanX:(e,t,r)=>new de(e,t,r),Surge:(e,t,r)=>new H(e,t,r),Loon:(e,t,r)=>new Ee(e,t,r)});var pe=class extends ${getFn(e,t,r){let i=pe.clientAdapter[t]||t;return super.getFn(e,i,r)}setFn(e,t,r,i){let s=pe.clientAdapter[t]||t;return super.setFn(e,s,r,i)}init(){try{this.request=this.createProxy($request),this.response=this.createProxy($response)}catch(e){this.debug(e.toString())}}getVal(e){return $persistentStore.read(e)}setVal(e,t){$persistentStore.write(e,t)}msg(e=this.name,t="",r="",i){let s={};i&&(s={action:{"open-url":i}}),$notification.post(e,t,r,s)}async fetch(e){return await new Promise((t,r)=>{let{method:i,body:s,bodyBytes:o,...a}=e,u=o??s,c=u instanceof Uint8Array;$httpClient[i.toLowerCase()]({...a,body:u,"binary-mode":c},(d,I,y)=>{d&&r(d);let m=c?"bodyBytes":"body";t({status:I.status??I.statusCode,headers:I.headers,[m]:y})})})}done(e){let t=e.response??e;t.bodyBytes&&(t.body=t.bodyBytes,delete t.bodyBytes),$done(e.response?{response:t}:t)}decodeParams(e){return typeof $argument=="string"&&!$argument.includes("{{{")&&Object.assign(e,JSON.parse($argument)),e}},H=pe;Y(H,"clientAdapter",{bodyBytes:"body"});var q=class extends ${static transferBodyBytes(e,t){return e instanceof ArrayBuffer?t==="Uint8Array"?new Uint8Array(e):e:e instanceof Uint8Array&&t==="ArrayBuffer"?e.buffer.slice(e.byteOffset,e.byteLength+e.byteOffset):e}init(){try{this.request=this.createProxy($request),this.response=this.createProxy($response)}catch(e){this.debug(e.toString())}}getFn(e,t,r){let i=q.clientAdapter[t]||t,s=super.getFn(e,i,r);return t==="bodyBytes"&&(s=q.transferBodyBytes(s,"Uint8Array")),s}setFn(e,t,r,i){let s=q.clientAdapter[t]||t,o=r;return t==="bodyBytes"&&(o=q.transferBodyBytes(o,"Uint8Array")),super.setFn(e,s,o,i)}getVal(e){return $prefs.valueForKey(e)}setVal(e,t){$prefs.setValueForKey(e,t)}msg(e=this.name,t="",r="",i){$notify(e,t,r,{"open-url":i??""})}async fetch(e){return await new Promise(t=>{let r={url:"",method:"GET"};for(let[i,s]of Object.entries(e))i==="id"?r.sessionIndex=s:i==="bodyBytes"?r.bodyBytes=q.transferBodyBytes(s,"ArrayBuffer"):r[i]=s;e.bodyBytes&&delete r.body,$task.fetch(r).then(i=>{let s={status:200,headers:{}};for(let[o,a]of Object.entries(i))o==="sessionIndex"?s.id=a:o==="bodyBytes"?s.bodyBytes=q.transferBodyBytes(a,"Uint8Array"):o==="statusCode"?s.status=a:s[o]=a;t(s)})})}done(e){let t=e.response??e,r={};for(let[i,s]of Object.entries(t))i==="status"?r.status=`HTTP/1.1 ${s}`:i==="bodyBytes"?r.bodyBytes=q.transferBodyBytes(s,"ArrayBuffer"):r[i]=s;$done(r)}},de=q;Y(de,"clientAdapter",{id:"sessionIndex",status:"statusCode"});var Ee=class extends H{decodeParams(e){if(typeof $argument<"u")for(let t of Object.keys(e)){let r=$argument?.[t];r!==void 0&&(e[t]=r)}return e}};var Pn=h(l(),1),Be={config:"YouTubeConfig",advertiseInfo:"YouTubeAdvertiseInfo"},Re={music:"youtubeMusic",video:"youtube"},Qe="https://init-stream.maasea.workers.dev/";var R=$.getInstance("YouTube");function Tt(){return(R.request.headers["user-agent"]??R.request.headers["User-Agent"]).includes("music")}function Fe(){return Tt()?Re.music:Re.video}var Gn=h(l(),1);function et(){return R.decodeParams({captionLang:"off",blockUpload:!0,blockImmersive:!0,blockShorts:!1})}var zn=h(l(),1);function tt(){return R.getJSON(Be.config)??{}}function rt(n){R.debug(`saveKeyConfig: ${JSON.stringify(n)}`),R.setJSON(n,Be.config)}function Et(){let n=He({url:R.request.url,headers:R.request.headers,bodyBytes:R.request.bodyBytes,config:tt(),params:et(),platformKey:Fe(),workerUrl:Qe});switch(n.changed&&rt(n.config),n.action){case"headers":R.debug("log_event: \u5265\u79BB content-encoding \u5934\uFF0C\u5E76\u6309\u7F13\u5B58\u72B6\u6001\u51B3\u5B9A\u662F\u5426\u5220 hot-hash \u5934"),R.done({headers:n.headers});break;case"redirect":R.debug("initplayback: \u547D\u4E2D\u7F13\u5B58 key\uFF0C\u91CD\u5B9A\u5411\u5230 Worker \u5904\u7406 UMP"),R.className==="QuanX"?R.exit():$done({url:n.redirectUrl});break;case"empty":R.debug("initplayback: encryptedClientKey \u4E0E\u7F13\u5B58\u4E0D\u4E00\u81F4\uFF0C\u9000\u56DE v1/player \u5E76\u6E05\u7F13\u5B58"),R.className==="QuanX"?R.done({response:{status:"200 OK",headers:{"Content-Type":"text/plain"},bodyBytes:new Uint8Array}}):$done({response:{status:200,headers:{"Content-Type":"text/plain"},body:new Uint8Array}});break;default:R.exit()}}Et();})();
