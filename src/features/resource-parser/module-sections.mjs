// SPDX-License-Identifier: MIT
import { stripComment } from './comments.mjs';
import { splitRuleNote } from './resource-metadata.mjs';
const fail = () => { throw new Error('Rewrite conversion: no valid selected filter section or unsupported conditional directive'); };

export function extractModuleFilters(text) {
  let section = null;
  const rows = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(?:#|;|\/\/)/.test(line)) { stripComment(line, fail); continue; }
    const heading = /^\[([^\]]+)\]$/.exec(line);
    if (heading) { section = heading[1].trim().toLowerCase(); continue; }
    const body = splitRuleNote(line).body;
    if ((section === 'rule' || section === 'filter_local' || section === null && /^-?(?:DOMAIN|HOST|IP|GEOIP|USER-AGENT|AND|FINAL|MATCH)[A-Z0-9_-]*\s*,/i.test(body)) && !/^URL-REGEX\s*,/i.test(body)) rows.push(line);
  }
  if (!rows.length) fail();
  return rows.join('\n');
}
