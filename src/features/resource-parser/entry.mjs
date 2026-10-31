// SPDX-License-Identifier: MIT
export { completeResource as runResource } from './core.mjs';
import { installParserHelper } from './helper.mjs';

if (typeof $parser === 'object' && $parser !== null) installParserHelper($parser);
