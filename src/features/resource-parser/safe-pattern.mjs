// SPDX-License-Identifier: MIT
// Original Thompson-NFA matcher: no eval, generated code or backtracking.
// Deliberate subset: literals, . ^ $ \b, classes, groups, alternation and
// atom and non-nullable group quantifiers. Backreferences and lookaround fail.
export function safePattern(source, caseSensitive = false, budget) {
  const fail = () => { throw new Error('Resource parser options: invalid parameters'); };
  if (typeof source !== 'string' || !source || source.length > 512 || /[\x00-\x1f\x7f\u2028\u2029]/.test(source)) fail();
  let offset = 0, captures = 0, depth = 0;
  const fold = value => {
    if (caseSensitive) return value;
    const upper = value.toUpperCase();
    // ECMAScript's legacy /i canonicalization works on one UTF-16 unit and
    // cannot map a non-ASCII character into the ASCII alphabet.
    return upper.length !== 1 || value.charCodeAt(0) >= 128 && upper.charCodeAt(0) < 128 ? value : upper;
  };
  const escaped = () => {
    const value = source[offset++];
    if (!value) fail();
    if ('dDwWsS'.includes(value)) {
      const tests = { d: c => /[0-9]/.test(c), w: c => /[A-Za-z0-9_]/.test(c), s: c => /\s/.test(c) };
      const test = tests[value.toLowerCase()]; return c => value === value.toLowerCase() ? test(c) : !test(c);
    }
    if (/[A-Za-z0-9]/.test(value)) fail();
    return value;
  };
  const nullable = node => node.kind === 'seq' ? node.items.every(nullable) : node.kind === 'alt' ? node.branches.some(nullable) : node.kind === 'group' ? nullable(node.child) : node.kind === 'repeat' ? node.min === 0 || nullable(node.child) : node.kind !== 'char';
  const expression = () => {
    const branches = [sequence()];
    while (source[offset] === '|') { offset++; branches.push(sequence()); }
    return branches.length === 1 ? branches[0] : { kind: 'alt', branches };
  };
  const sequence = () => {
    const items = [];
    while (offset < source.length && source[offset] !== ')' && source[offset] !== '|') {
      let value = source[offset++], atom;
      if (value === '(') {
        const captureFrom = captures + 1; let group = 0;
        if (source.slice(offset, offset + 2) === '?:') offset += 2;
        else { if (source[offset] === '?') fail(); group = ++captures; if (captures > 16) fail(); }
        if (++depth > 16) fail();
        atom = { kind: 'group', group, child: expression() }; atom.captureFrom = captureFrom; atom.captureTo = captures; depth--;
        if (source[offset++] !== ')') fail();
      } else if (value === '[') {
        const classStart = offset - 1;
        const negate = source[offset] === '^'; if (negate) offset++;
        const tests = [];
        while (offset < source.length && source[offset] !== ']') {
          let start = source[offset++]; if (start === '\\') start = escaped();
          if (typeof start === 'function') tests.push(start);
          else if (source[offset] === '-' && source[offset + 1] !== ']' && offset + 1 < source.length) {
            offset++; let end = source[offset++]; if (end === '\\') end = escaped();
            if (typeof end !== 'string' || start.charCodeAt(0) > end.charCodeAt(0)) fail();
            const low = fold(start), high = fold(end); tests.push(c => fold(c) >= low && fold(c) <= high);
          } else { const literal = fold(start); tests.push(c => fold(c) === literal); }
        }
        if (source[offset++] !== ']' || !tests.length) fail();
        // Only this validated, single-character class uses the native engine.
        // It contains no group, repetition or alternation and cannot backtrack.
        let characterClass;
        try { characterClass = new RegExp('^(?:' + source.slice(classStart, offset) + ')$', caseSensitive ? '' : 'i'); } catch { fail(); }
        atom = { kind: 'char', test: c => characterClass.test(c) };
      } else if (value === '.') atom = { kind: 'char', test: c => !/[\r\n\u2028\u2029]/.test(c) };
      else if (value === '^' || value === '$') atom = { kind: value };
      else if (value === '\\' && source[offset] === 'b') { offset++; atom = { kind: 'boundary' }; }
      else {
        if ('*+?{}]'.includes(value)) fail();
        if (value === '\\') value = escaped();
        atom = { kind: 'char', test: typeof value === 'function' ? value : c => fold(c) === fold(value) };
      }
      const next = source[offset];
      if (next && '*+?{'.includes(next)) {
        // Every group iteration must consume input; this prevents nullable
        // epsilon loops while retaining ordinary nested capturing groups.
        if (atom.kind !== 'char' && (atom.kind !== 'group' || nullable(atom))) fail();
        offset++; let min, max;
        if (next === '*') { min = 0; max = Infinity; }
        else if (next === '+') { min = 1; max = Infinity; }
        else if (next === '?') { min = 0; max = 1; }
        else {
          const range = /^(\d{1,3})(?:,(\d{0,3}))?\}/.exec(source.slice(offset)); if (!range) fail();
          offset += range[0].length; min = Number(range[1]); max = range[2] === undefined ? min : range[2] === '' ? Infinity : Number(range[2]);
          if (min > 128 || max !== Infinity && (max > 128 || max < min)) fail();
        }
        const lazy = source[offset] === '?'; if (lazy) offset++;
        atom = { kind: 'repeat', child: atom, min, max, lazy };
      }
      items.push(atom);
    }
    return { kind: 'seq', items };
  };
  const tree = expression(); if (offset !== source.length) fail();
  const states = [];
  const state = value => { if (states.length >= 1024) fail(); states.push(value); return states.length - 1; };
  const compile = (node, next) => {
    if (node.kind === 'seq') { for (let i = node.items.length - 1; i >= 0; i--) next = compile(node.items[i], next); return next; }
    if (node.kind === 'alt') { let head = compile(node.branches[node.branches.length - 1], next); for (let i = node.branches.length - 2; i >= 0; i--) head = state({ kind: 'split', first: compile(node.branches[i], next), second: head }); return head; }
    if (node.kind === 'group') { if (!node.group) return compile(node.child, next); const end = state({ kind: 'save', slot: node.group * 2 + 1, next }); return state({ kind: 'save', slot: node.group * 2, next: compile(node.child, end) }); }
    if (node.kind === 'repeat') {
      const iteration = tail => {
        const body = compile(node.child, tail);
        // ECMAScript clears every capture inside the quantified atom before
        // entering the next iteration, including optional nested captures.
        return node.child.captureFrom <= node.child.captureTo ? state({ kind: 'clear', from: node.child.captureFrom, to: node.child.captureTo, next: body }) : body;
      };
      if (node.max === Infinity) { const branch = state({ kind: 'split' }); const body = iteration(branch); states[branch].first = node.lazy ? next : body; states[branch].second = node.lazy ? body : next; next = branch; }
      else {
        const exit = next;
        // Skipping an optional iteration exits the complete repeat. It must
        // not jump into another optional clone and change capture priority.
        for (let i = node.min; i < node.max; i++) { const body = iteration(next); next = state({ kind: 'split', first: node.lazy ? exit : body, second: node.lazy ? body : exit }); }
      }
      for (let i = 0; i < node.min; i++) next = iteration(next); return next;
    }
    return state({ ...node, next });
  };
  const start = compile(tree, state({ kind: 'match' }));
  let work = 0;
  const spend = () => { if (++work > 4194304 || budget && --budget.remaining < 0) fail(); };
  const exec = (text, from = 0) => {
    if (typeof text !== 'string' || text.length > 65536) fail();
    let threads = [], best;
    const closure = (pc, caps, position, list, seen) => {
      const stack = [[pc, caps]];
      while (stack.length) {
        spend(); const [at, saved] = stack.pop(); if (seen.has(at)) continue; seen.add(at);
        const instruction = states[at];
        if (instruction.kind === 'split') { stack.push([instruction.second, saved], [instruction.first, saved]); }
        else if (instruction.kind === 'clear') { const copy = saved.slice(); for (let group = instruction.from; group <= instruction.to; group++) { copy[group * 2] = undefined; copy[group * 2 + 1] = undefined; } stack.push([instruction.next, copy]); }
        else if (instruction.kind === 'save') { const copy = saved.slice(); copy[instruction.slot] = position; stack.push([instruction.next, copy]); }
        else if (instruction.kind === '^' || instruction.kind === '$' || instruction.kind === 'boundary') {
          const before = position > 0 && /[A-Za-z0-9_]/.test(text[position - 1]); const after = position < text.length && /[A-Za-z0-9_]/.test(text[position]);
          if (instruction.kind === '^' ? position === 0 : instruction.kind === '$' ? position === text.length : before !== after) stack.push([instruction.next, saved]);
        } else list.push({ pc: at, caps: saved });
      }
    };
    for (let position = from; position <= text.length; position++) {
      if (!best) closure(start, [position], position, threads, new Set(threads.map(thread => thread.pc)));
      const matched = threads.findIndex(thread => states[thread.pc].kind === 'match');
      if (matched >= 0) { const caps = threads[matched].caps.slice(); caps[1] = position; best = caps; threads = threads.slice(0, matched); }
      if ((!threads.length || position === text.length) && best) return best;
      if (position === text.length) break;
      const next = [], seen = new Set();
      for (const thread of threads) { const instruction = states[thread.pc]; if (instruction.kind === 'char' && instruction.test(text[position])) closure(instruction.next, thread.caps, position + 1, next, seen); }
      threads = next;
    }
    return best;
  };
  return {
    test: text => { work = 0; return !!exec(text); },
    replace(text, replacement, limit = 65536) {
      if (typeof text !== 'string' || text.length > 65536 || typeof replacement !== 'string' || replacement.length > 512) fail();
      work = 0; let result = '', copied = 0, position = 0, match;
      while (position <= text.length && (match = exec(text, position))) {
        let insert = '', last = 0;
        const tokens = /\$(\$|&|`|'|[0-9]{1,2})/g; let token;
        while ((token = tokens.exec(replacement))) {
          const key = token[1]; let value;
          if (key === '$') value = '$';
          else if (key === '&') value = text.slice(match[0], match[1]);
          else if (key === '`') value = text.slice(0, match[0]);
          else if (key === "'") value = text.slice(match[1]);
          else {
            let group = Number(key), tail = '';
            if (group > captures && key.length === 2 && Number(key[0]) >= 1 && Number(key[0]) <= captures) { group = Number(key[0]); tail = key[1]; }
            value = group < 1 || group > captures ? token[0] : (match[group * 2] === undefined ? '' : text.slice(match[group * 2], match[group * 2 + 1])) + tail;
          }
          if (insert.length + token.index - last + value.length > limit) fail();
          insert += replacement.slice(last, token.index) + value; last = tokens.lastIndex;
        }
        insert += replacement.slice(last); if (insert.length > limit) fail();
        result += text.slice(copied, match[0]) + insert; if (result.length > limit) fail();
        copied = match[1]; position = match[1] + (match[0] === match[1] ? 1 : 0);
      }
      result += text.slice(copied); if (result.length > limit) fail(); return result;
    },
    // Internal, trusted callback API for preserving source-data provenance.
    // This callback cannot originate from a parsed user option or source text.
    replaceWith(text, transform, limit = 65536) {
      if (typeof text !== 'string' || text.length > 65536 || typeof transform !== 'function' || !Number.isInteger(limit) || limit < 0 || limit > 65536) fail();
      work = 0; let result = '', copied = 0, position = 0, match;
      while (position <= text.length && (match = exec(text, position))) {
        const spans = Array.from({ length: captures + 1 }, (_, group) => match[group * 2] === undefined ? undefined : [match[group * 2], match[group * 2 + 1]]);
        const insert = transform(spans, text);
        if (typeof insert !== 'string' || insert.length > limit || result.length + match[0] - copied + insert.length > limit) fail();
        result += text.slice(copied, match[0]) + insert;
        copied = match[1]; position = match[1] + (match[0] === match[1] ? 1 : 0);
      }
      result += text.slice(copied); if (result.length > limit) fail(); return result;
    },
  };
}
