// Surge directives affect execution; they cannot be discarded as comments.
const directive = /^(?:#!|\/\/!)(?:include|requirement|system|(?:ios|macos|tvos)-only)(?=$|[\s=])/i;

export function stripComment(line, fail) {
  let quote = '', escaped = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if ((char === '"' || char === "'") && (index === 0 || /[\s,=]/.test(line[index - 1]))) { quote = char; continue; }
    if ((index === 0 || /\s/.test(line[index - 1])) && (char === '#' || char === ';' || line.slice(index, index + 2) === '//')) {
      if (directive.test(line.slice(index))) fail('unsupported executable directive; its conditions cannot be preserved');
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
}
