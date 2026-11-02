// SPDX-License-Identifier: MIT
export function splitRuleNote(line) {
  if (!line.startsWith('{#')) return { note: '', body: line };
  const match = /^\{#([^\r\n]*?)#\}\s*(.+)$/.exec(line);
  if (!match || match[1].length > 4096 || /[\x00-\x1f\x7f]/.test(match[1])) throw new Error('Resource parser: invalid rule note');
  return { note: match[1].trim(), body: match[2] };
}

export function withRuleNote(note, body, build = 0) {
  if (!note) return body;
  return build >= 950 ? '{# ' + note + ' #} ' + body : '# note: ' + note + '\n' + body;
}

export function isPlainRuleToken(value) {
  return /^(?:\.?[a-z0-9_*?-]+(?:\.[a-z0-9_*?-]+)+|[0-9.]+\/\d+|[a-f0-9]*:[a-f0-9:.]+(?:\/\d+)?)$/i.test(value);
}
