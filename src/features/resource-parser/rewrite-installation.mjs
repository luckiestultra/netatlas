// SPDX-License-Identifier: MIT
// Extract explicit QX installation sections from leading JavaScript comments.
// The script body is opaque text and is never evaluated or inspected for rules.
import { stripComment } from './comments.mjs';

const fail = message => { throw new Error('Rewrite conversion: ' + message); };
const heading = /^\[([^\]]+)\]$/;
const debugBoundary = /^[=*-]{2,}.*(?:调试|debug).*(?:忽略|ignore).*[=*-]{2,}$/i;
const decoration = /^[=*-]+$/;
const taskLine = /^(?:(?:[0-9A-Za-z*\/?#,\-]+\s+){5,6}|event-[a-z-]+\s+)https?:\/\/\S+(?:\s*,.*)?$/i;
const javascriptStart = /^(?:(?:const|let|var|function|class|async|if|try|throw)\b|["']use strict["']\s*;|\(\s*(?:function\b|\([^)]*\)\s*=>)|[!~]\s*function\b|\$[A-Za-z_$][\w$]*\s*\(|[A-Za-z_$][\w$]*\s*=\s*(?:[~!+\-]\s*)?[\[({]|(?:globalThis|window|self|this)\s*[.[])/;
const commentLine = line => line.trim().replace(/^\*(?:[ \t]+|$)/, '').trim();

function leadingComments(text) {
  const comments = [];
  let cursor = 0;
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] ?? '') && cursor < text.length) cursor++;
    if (text.startsWith('/*', cursor)) {
      const end = text.indexOf('*/', cursor + 2);
      if (end < 0) fail('unterminated script installation comment');
      comments.push(text.slice(cursor + 2, end).split(/\r?\n/).map(commentLine));
      cursor = end + 2;
    } else if (text.startsWith('//', cursor)) {
      const lines = [];
      while (text.startsWith('//', cursor)) {
        const end = text.indexOf('\n', cursor + 2);
        lines.push(commentLine(text.slice(cursor + 2, end < 0 ? text.length : end)));
        cursor = end < 0 ? text.length : end + 1;
        while (cursor < text.length && /[ \t\r]/.test(text[cursor])) cursor++;
      }
      comments.push(lines);
    } else break;
  }
  return { comments, remainder: text.slice(cursor).trim() };
}

export function extractRewriteInstallation(text) {
  const { comments, remainder } = leadingComments(text);
  // An explicit section, rather than an incidental URL or JS string, selects
  // a candidate comment. Other leading copyright/documentation blocks stay out.
  if (!comments.some(lines => lines.some(line => /^\[rewrite_local\]$/i.test(line)))) return null;
  const candidates = comments.filter(lines => lines.some(line => /^\[(?:rewrite_local|mitm|task_local)\]$/i.test(line)));
  let rewriteSection = false;
  let ruleCount = 0;
  const output = [];
  for (const lines of comments) for (const line of lines) {
    if (/^[#;]/.test(line) || line.startsWith('//')) stripComment(line, fail);
    const match = heading.exec(line);
    if (match && !/^(?:rewrite_local|mitm|task_local)$/i.test(match[1].trim())) fail('unsupported script installation section');
    if (!candidates.includes(lines) && (/^[a-z][\w-]*\s*=/i.test(line) || /\surl(?:-and-header)?\s/.test(line))) fail('ambiguous script installation comment');
  }
  for (const lines of candidates) {
    let section = null, debug = false;
    for (const line of lines) {
      if (debugBoundary.test(line)) { debug = !debug; continue; }
      if (debug || !line || decoration.test(line)) continue;
      if (/^[#;]/.test(line) || line.startsWith('//')) continue;
      const match = heading.exec(line);
      if (match) {
        section = match[1].trim().toLowerCase();
        if (section === 'task_local') continue; // Separate task installation, never a rewrite.
        if (!['rewrite_local', 'mitm'].includes(section)) fail('unsupported script installation section');
        if (section === 'rewrite_local') rewriteSection = true;
        output.push('[' + section + ']');
        continue;
      }
      if (section === 'task_local') {
        if (!taskLine.test(line)) fail('unsupported script installation task row');
        continue;
      }
      if (section === null) {
        if (/^[a-z][\w-]*\s*=/i.test(line)) fail('unsupported script installation field');
        continue;
      }
      // Preserve every row in selected sections. The native parser must reject
      // unknown options/actions rather than returning a partial installation.
      output.push(line);
      if (section === 'rewrite_local' && /\surl(?:-and-header)?\s/.test(line)) ruleCount++;
    }
    if (debug) fail('unterminated script installation debug block');
  }
  if (!rewriteSection) return null;
  if (!ruleCount) fail('empty script rewrite installation');
  if (remainder && !javascriptStart.test(remainder)) fail('unexpected content after script installation comment');
  return output.join('\n');
}
