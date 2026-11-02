// SPDX-License-Identifier: MIT
// Exact regex-to-glob compilation for a deliberately finite, positive grammar.
// No JS RegExp evaluation or widening of unsupported assertions/classes.
const fail = () => { throw new Error('Rule conversion: DOMAIN-REGEX is outside the exact bounded glob grammar'); };
const MAX_PATTERNS = 2048;

export function domainRegexGlobs(expression) {
  if (typeof expression !== 'string' || !expression || expression.length > 512 || /[^\x20-\x7e]/.test(expression)) fail();
  // Anchors bind to their own branch: ^foo|bar$ is not ^(foo|bar)$.
  const branches = []; let branchStart = 0, nesting = 0, inClass = false, escaped = false;
  for (let index = 0; index < expression.length; index++) {
    const character = expression[index];
    if (escaped) { escaped = false; continue; }
    if (character === '\\') { escaped = true; continue; }
    if (character === '[') inClass = true;
    else if (character === ']') inClass = false;
    else if (!inClass && character === '(') nesting++;
    else if (!inClass && character === ')') nesting--;
    else if (!inClass && !nesting && character === '|') { branches.push(expression.slice(branchStart, index)); branchStart = index + 1; }
  }
  if (branches.length) {
    branches.push(expression.slice(branchStart));
    const values = [...new Set(branches.flatMap(domainRegexGlobs))];
    if (values.length > MAX_PATTERNS || values.reduce((size, value) => size + value.length, 0) > 1048576) fail();
    return values;
  }
  let source = expression, start = false, end = false;
  if (source.startsWith('^')) { start = true; source = source.slice(1); }
  if (source.endsWith('$') && !source.endsWith('\\$')) { end = true; source = source.slice(0, -1); }
  let offset = 0, operations = 0;
  const bounded = values => {
    if (++operations > 10000 || values.length > MAX_PATTERNS || values.reduce((size, value) => size + value.length, 0) > 1048576) fail();
    return [...new Set(values.map(value => value.replace(/\*+/g, '*')))];
  };
  const combine = (left, right) => {
    if (left.length * right.length > MAX_PATTERNS) fail();
    return bounded(left.flatMap(a => right.map(b => a + b)));
  };
  const literal = value => {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9._-]$/.test(value)) fail();
    return value.toLowerCase();
  };
  function atom(depth) {
    if (depth > 16) fail();
    const character = source[offset++];
    if (character === '(') {
      if (source.slice(offset, offset + 2) === '?:') offset += 2;
      else if (source[offset] === '?') fail();
      const values = alternatives(depth + 1);
      if (source[offset++] !== ')') fail();
      return values;
    }
    if (character === '.') return ['?'];
    if (character === '\\') {
      const next = source[offset++];
      if (next === 'd') return [...'0123456789'];
      if (next === 'w') return [...'abcdefghijklmnopqrstuvwxyz0123456789_'];
      if (next !== '.' && next !== '-') fail();
      return [next];
    }
    if (character === '[') {
      const values = [];
      if (source[offset] === '^') fail();
      while (offset < source.length && source[offset] !== ']') {
        const rawFrom = source[offset++], from = literal(rawFrom);
        if (source[offset] === '-' && source[offset + 1] !== ']') {
          offset++;
          const rawTo = source[offset++]; literal(rawTo);
          if (rawFrom > rawTo || rawTo.charCodeAt(0) - rawFrom.charCodeAt(0) > 64) fail();
          for (let code = rawFrom.charCodeAt(0); code <= rawTo.charCodeAt(0); code++) values.push(literal(String.fromCharCode(code)));
        } else values.push(from);
      }
      if (source[offset++] !== ']' || !values.length) fail();
      return bounded(values);
    }
    return [literal(character)];
  }
  function sequence(depth) {
    let output = [''];
    while (offset < source.length && source[offset] !== ')' && source[offset] !== '|') {
      let values = atom(depth);
      const quantifier = source[offset];
      if (quantifier === '*' || quantifier === '+') {
        offset++;
        // Only any-character repetition is a single exact glob. A repeated
        // literal/group is a regular language that globs cannot express.
        if (values.length !== 1 || values[0] !== '?') fail();
        values = [quantifier === '*' ? '*' : '?*'];
      } else if (quantifier === '?') { offset++; values = bounded(['', ...values]); }
      else if (quantifier === '{') {
        const match = /^\{(\d+)(?:,(\d+))?\}/.exec(source.slice(offset));
        if (!match) fail();
        const min = Number(match[1]), max = Number(match[2] ?? match[1]);
        if (min > max || max > 32) fail();
        offset += match[0].length;
        const choices = []; let repeated = [''];
        for (let count = 0; count <= max; count++) {
          if (count >= min) choices.push(...repeated);
          if (count < max) repeated = combine(repeated, values);
          if (choices.length > MAX_PATTERNS) fail();
        }
        values = bounded(choices);
      }
      output = combine(output, values);
    }
    return output;
  }
  function alternatives(depth) {
    const output = sequence(depth);
    while (source[offset] === '|') { offset++; output.push(...sequence(depth)); if (output.length > MAX_PATTERNS) fail(); }
    return bounded(output);
  }
  const values = alternatives(0);
  if (offset !== source.length) fail();
  return bounded(values.map(value => (start ? '' : '*') + value + (end ? '' : '*')));
}
