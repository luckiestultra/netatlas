// SPDX-License-Identifier: MIT
// Positive domain conjunctions are intersections, never a list of OR operands.
// Product states advance monotonically; the only consuming cycle is two stars,
// represented by one star. Enumerating the remaining DAG gives an exact union.
const fail = () => { throw new Error('Rule conversion: domain AND syntax or expansion limit is unsupported'); };
const defaults = { maxStates: 65536, maxCharacters: 2097152, maxPatterns: 512 };
function budget(limits = {}) {
  const result = { ...defaults, ...limits, states: 0, characters: 0 };
  for (const key of Object.keys(defaults)) if (!Number.isSafeInteger(result[key]) || result[key] < 1 || result[key] > defaults[key]) fail();
  return result;
}
const normalize = pattern => pattern.replace(/\*+/g, '*');
function intersection(left, right, limits) {
  if (![left, right].every(value => typeof value === 'string' && value.length <= 1024 && /^[a-zA-Z0-9._*\-]*$/.test(value))) fail();
  left = normalize(left.toLowerCase()); right = normalize(right.toLowerCase());
  const memo = new Map();
  function visit(i, j) {
    const key = i + ':' + j;
    if (memo.has(key)) return memo.get(key);
    if (++limits.states > limits.maxStates) fail();
    const output = new Set();
    function add(value) {
      value = normalize(value);
      if (value.length > 1024) fail();
      if (!output.has(value)) {
        limits.characters += value.length + 1;
        if (limits.characters > limits.maxCharacters || output.size >= limits.maxPatterns) fail();
        output.add(value);
      }
    }
    const a = left[i], b = right[j];
    if (i === left.length || j === right.length) {
      if (/^\**$/.test(left.slice(i)) && /^\**$/.test(right.slice(j))) add('');
    } else if (a === '*' && b === '*') {
      for (const value of visit(i + 1, j)) add('*' + value);
      for (const value of visit(i, j + 1)) add('*' + value);
    } else if (a === '*') {
      for (const value of visit(i + 1, j)) add(value);
      for (const value of visit(i, j + 1)) add(b + value);
    } else if (b === '*') {
      for (const value of visit(i, j + 1)) add(value);
      for (const value of visit(i + 1, j)) add(a + value);
    } else if (a === b) {
      for (const value of visit(i + 1, j + 1)) add(a + value);
    }
    const result = [...output]; memo.set(key, result); return result;
  }
  return visit(0, 0);
}

export function intersectGlobs(left, right, limits = {}) {
  return intersection(left, right, budget(limits));
}
function primitive(term) {
  if (!term || typeof term.type !== 'string' || typeof term.value !== 'string' || !/^[a-zA-Z0-9._-]{1,253}$/.test(term.value)) fail();
  const type = term.type.toUpperCase(), value = term.value.toLowerCase();
  if (['DOMAIN-KEYWORD', 'HOST-KEYWORD'].includes(type)) return ['*' + value + '*'];
  if (value.startsWith('.') || value.endsWith('.') || value.split('.').some(label => !label || label.length > 63 || !/^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/.test(label))) fail();
  if (['DOMAIN', 'HOST'].includes(type)) return [value];
  if (['DOMAIN-SUFFIX', 'HOST-SUFFIX'].includes(type)) return [value, '*.' + value];
  fail();
}
function compile(conditions, limits) {
  if (!Array.isArray(conditions) || conditions.length < 2 || conditions.length > 4) fail();
  const primitives = conditions.map(primitive);
  let patterns = primitives[0];
  for (const choices of primitives.slice(1)) {
    const next = new Set();
    for (const left of patterns) for (const right of choices) for (const value of intersection(left, right, limits)) {
      if (next.size >= limits.maxPatterns && !next.has(value)) fail();
      next.add(value);
    }
    patterns = [...next];
  }
  return patterns;
}
export function compileDomainAnd(conditions) {
  return compile(conditions, budget());
}
export function createDomainAndCompiler() {
  const limits = budget();
  return conditions => compile(conditions, limits);
}
export function parseDomainAnd(line) {
  const match = /^AND\s*,\s*\((.*)\)\s*,\s*([^,]+)$/i.exec(line);
  if (!match) fail();
  const terms = [], body = match[1];
  let offset = 0;
  while (offset < body.length) {
    const item = /^\s*\(\s*((?:DOMAIN|HOST)(?:-SUFFIX|-KEYWORD)?)\s*,\s*([a-zA-Z0-9._-]+)\s*\)\s*(,|$)/i.exec(body.slice(offset));
    if (!item) fail();
    terms.push({ type: item[1], value: item[2] }); offset += item[0].length;
    if (item[3] === ',' && !body.slice(offset).trim()) fail();
  }
  if (terms.length < 2 || terms.length > 4) fail();
  return { conditions: terms, policy: match[2].trim() };
}
