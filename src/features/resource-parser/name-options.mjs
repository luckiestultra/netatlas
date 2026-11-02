// SPDX-License-Identifier: MIT
// Unicode presentation characters are generated from the Unicode alphabet
// blocks; legacy table typos (notably q/k and 7/8) are deliberately not copied.
export function styleNodeName(name, letters = '', numbers = '', cap = '') {
  if (cap === '1') name = name.toUpperCase();
  else if (cap === '-1') name = name.toLowerCase();
  else if (cap === '0') name = name.split(' ').map(word => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  if (letters !== '') {
    const upper = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };
    const superscript = Array.from('ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖᑫʳˢᵗᵘᵛʷˣʸᶻ');
    const modifier = Array.from('ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᑫᴿˢᵀᵁᵛᵂˣʸᶻ');
    name = name.replace(/[A-Za-z]/g, char => {
      const at = char.toLowerCase().charCodeAt(0) - 97;
      if (letters === '0') return char.toLowerCase();
      if (letters === '7') return superscript[at];
      if (letters === '8') return modifier[at];
      if (letters === '5' && upper[char.toUpperCase()]) return upper[char.toUpperCase()];
      return String.fromCodePoint(({ 1: 0x1f170, 2: 0x1f130, 3: 0x1d400, 4: 0x1d5ee, 5: 0x1d538, 6: 0x1d552 })[letters] + at);
    });
  }
  if (numbers !== '' && numbers !== '0') name = name.replace(/[0-9]/g, char => {
    const at = Number(char);
    if (numbers === '5') return Array.from('⁰¹²³⁴⁵⁶⁷⁸⁹')[at];
    if (numbers === '6') return String.fromCodePoint(0x2080 + at);
    if (['1', '2', '3'].includes(numbers)) return at === 0 ? '⓪' : String.fromCodePoint(({ 1: 0x2460, 2: 0x2776, 3: 0x24f5 })[numbers] + at - 1);
    return String.fromCodePoint(({ 4: 0x1d7d8, 7: 0x1d7ce, 8: 0x1d7f6 })[numbers] + at);
  });
  return name;
}

export function protocolName(fields) {
  const type = fields[0].split('=')[0].trim().toLowerCase();
  return type === 'shadowsocks' ? fields.some(field => /^\s*ssr-protocol\s*=/i.test(field)) ? 'SSR' : 'SS' : type === 'socks5' ? 'SOCKS' : type.toUpperCase();
}

// Provenance follows UTF-16 characters through ordered name transformations.
// Source data and regex captures keep their marks; only user-inserted template
// text may introduce a named placeholder. No reserved characters are needed.
export function nameValue(text, template = false, budget) {
  const templates = Array(text.length).fill(false);
  if (template) for (const match of text.matchAll(/\$(?:type[0-8]?|index[0-8]?|emoji[12]?|tag[0-8]{0,2})(?![A-Za-z0-9_])/g)) templates.fill(true, match.index, match.index + match[0].length);
  return { text, templates, budget };
}
export function joinName(...values) {
  return joinValues(values);
}
function joinValues(values) {
  const budget = values.find(value => value.budget)?.budget, parts = values.filter(value => value.text.length);
  if (parts.length === 1) return parts[0].budget === budget ? parts[0] : { ...parts[0], budget };
  return { text: parts.map(value => value.text).join(''), templates: parts.flatMap(value => value.templates), budget };
}
export function sliceName(value, start, end = value.text.length) {
  return { text: value.text.slice(start, end), templates: value.templates.slice(start, end), budget: value.budget };
}
function spendName(value, amount) {
  if (!value.budget) return;
  if (value.budget.nameRemaining === undefined) value.budget.nameRemaining = 4194304;
  if ((value.budget.nameRemaining -= amount) < 0) throw new Error('Resource parser options: invalid parameters');
}
export function trimName(value) {
  const start = value.text.length - value.text.trimStart().length;
  return sliceName(value, start, value.text.trimEnd().length);
}
export function replaceNameLiteral(value, from, to) {
  spendName(value, 1);
  // With no substitution token or named template, replacing a literal with
  // itself changes neither text nor provenance. Avoid per-character copies.
  if (from === to && !to.includes('$') || !value.text.includes(from)) return value;
  spendName(value, value.text.length);
  const parts = []; let copied = 0, at, length = 0;
  while ((at = value.text.indexOf(from, copied)) !== -1) {
    const insert = substituteName(value, to, [[at, at + from.length]], 512);
    length += at - copied + insert.text.length;
    if (length > 512) throw new Error('Resource parser options: invalid parameters');
    parts.push(sliceName(value, copied, at), insert); copied = at + from.length;
  }
  parts.push(sliceName(value, copied)); return joinValues(parts);
}
// GetSubstitution for both literal rename and bounded regex replacement.
// Copied spans retain their source provenance, including literal dollar text.
function substituteName(value, replacement, spans, limit) {
  if (typeof replacement !== 'string' || replacement.length > 512) throw new Error('Resource parser options: invalid parameters');
  spendName(value, 32 + replacement.length + spans[0][1] - spans[0][0]);
  const inserts = []; let last = 0, length = 0;
  const append = segment => { length += segment.text.length; if (length > limit) throw new Error('Resource parser options: invalid parameters'); spendName(value, segment.text.length); inserts.push(segment); };
  const capture = span => span ? sliceName(value, span[0], span[1]) : nameValue('');
  const tokens = /\$(\$|&|`|'|[0-9]{1,2})/g; let token;
  while ((token = tokens.exec(replacement))) {
    append(nameValue(replacement.slice(last, token.index), true));
    const key = token[1];
    if (key === '$') append(nameValue('$'));
    else if (key === '&') append(capture(spans[0]));
    else if (key === '`') append(sliceName(value, 0, spans[0][0]));
    else if (key === "'") append(sliceName(value, spans[0][1]));
    else {
      let group = Number(key), tail = '';
      if (group >= spans.length && key.length === 2 && Number(key[0]) >= 1 && Number(key[0]) < spans.length) { group = Number(key[0]); tail = key[1]; }
      if (group < 1 || group >= spans.length) append(nameValue(token[0], true));
      else { append(capture(spans[group])); append(nameValue(tail, true)); }
    }
    last = tokens.lastIndex;
  }
  append(nameValue(replacement.slice(last), true)); return joinValues(inserts);
}
export function replaceNamePattern(value, pattern, replacement, limit = 65536) {
  if (typeof replacement !== 'string' || replacement.length > 512) throw new Error('Resource parser options: invalid parameters');
  const parts = []; let copied = 0;
  pattern.replaceWith(value.text, spans => {
    const insert = substituteName(value, replacement, spans, limit);
    parts.push(sliceName(value, copied, spans[0][0]), insert); copied = spans[0][1];
    return insert.text;
  }, limit);
  parts.push(sliceName(value, copied)); return joinValues(parts);
}

// Compile the user template once. Inserted resource-tag data is always a
// literal segment and is never scanned again as a placeholder expression.
export function prepareNameTemplate(text, fields, tag, flag) {
  const templates = typeof text === 'string' ? null : text.templates;
  if (typeof text !== 'string') text = text.text;
  const type = protocolName(fields), segments = []; let last = 0;
  const pattern = /\$(type[0-8]?|index[0-8]?|emoji[12]?|tag[0-8]{0,2})(?![A-Za-z0-9_])/g;
  const typeText = font => {
    if (!font || font === '8') return type;
    if (font === '0') return Array.from(type.toLowerCase(), char => String.fromCodePoint(0x1d41a + char.charCodeAt(0) - 97)).join('');
    if (font === '1') return styleNodeName(type, '3');
    if (font === '2') return Array.from(type, char => String.fromCodePoint(0x1f150 + char.charCodeAt(0) - 65)).join('');
    if (font === '3') return styleNodeName(type, '1');
    if (font === '4') return Array.from(type.toLowerCase(), char => String.fromCodePoint(0x24d0 + char.charCodeAt(0) - 97)).join('');
    if (font === '5') return styleNodeName(type, '2');
    if (font === '6') return styleNodeName(type, '5');
    return styleNodeName(type, '7');
  };
  let match;
  while ((match = pattern.exec(text))) {
    if (templates && !templates.slice(match.index, pattern.lastIndex).every(Boolean)) continue;
    segments.push(text.slice(last, match.index)); const key = match[1];
    if (key.startsWith('index')) segments.push({ token: match[0], style: key.slice(5) || '0' });
    else if (key.startsWith('emoji')) segments.push(flag(key.slice(5) || '2'));
    else if (key.startsWith('tag')) segments.push(styleNodeName(tag, key.slice(3, 4), key.slice(4, 5)));
    else segments.push(typeText(key.slice(4)));
    last = pattern.lastIndex;
  }
  segments.push(text.slice(last));
  return { text: segments.map(segment => typeof segment === 'string' ? segment : segment.token).join(''), render: index => segments.map(segment => typeof segment === 'string' ? segment : styleNodeName(String(index), '', segment.style)).join('') };
}

export function protocolLabel(fields) {
  return '「' + Array.from(protocolName(fields).toLowerCase(), char => String.fromCodePoint(0x1d41a + char.charCodeAt(0) - 97)).join('') + '」';
}
