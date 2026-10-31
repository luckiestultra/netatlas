// SPDX-License-Identifier: MIT
import { completeResource } from './core.mjs';
import { installParserHelper } from './helper.mjs';

if (typeof $parser === 'object' && $parser !== null) installParserHelper($parser);
if (typeof $resource !== 'undefined' && typeof $done === 'function') completeResource($resource,$done);
