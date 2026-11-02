// SPDX-License-Identifier: MIT
const fail = () => { throw new Error('Rewrite conversion: invalid or unresolved module arguments'); };
export function resolveModuleArguments(text, overrides = {}) {
  const values = Object.create(null);
  for (const line of text.split('\n')) {
    const match = /^\s*#!arguments\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    for (const field of match[1].split(',')) {
      const boundary = field.indexOf(':');
      if (boundary < 1) fail();
      const name = field.slice(0, boundary).trim(), raw = field.slice(boundary + 1).trim();
      if (!name || Object.prototype.hasOwnProperty.call(values, name) || name.length > 128 || /[\x00-\x1f]/.test(name)) fail();
      let value = raw;
      if (/^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?)$/.test(raw)) { try { value = JSON.parse(raw); } catch { fail(); } }
      values[name] = value;
    }
  }
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) fail();
  for (const [name, value] of Object.entries(overrides)) {
    if (!Object.prototype.hasOwnProperty.call(values, name) || !['string', 'number', 'boolean'].includes(typeof value) && value !== null || typeof value === 'number' && !Number.isFinite(value)) fail();
    values[name] = value;
  }
  return text.split('\n').map(line => {
    if (/^\s*(?:#!|\/\/|;)/.test(line)) return line;
    return line.replace(/\{\{\{([^{}]+)\}\}\}/g, (marker, name, offset) => {
      if (!Object.prototype.hasOwnProperty.call(values, name)) fail();
      // Argument templates commonly contain JSON inside an outer, unescaped
      // source quote. Determine the JSON string state from the object start.
      const objectStart = line.lastIndexOf('{', offset);
      const argumentStart = line.indexOf('argument=');
      let inString = false, escaped = false;
      const start = argumentStart >= 0 ? line.indexOf('{', argumentStart) : objectStart;
      if (start >= 0 && start < offset) for (let index = start; index < offset; index++) {
        const character = line[index];
        if (escaped) { escaped = false; continue; }
        if (character === '\\') { escaped = true; continue; }
        if (character === '"') inString = !inString;
      }
      const value = values[name];
      return inString ? JSON.stringify(String(value)).slice(1, -1) : typeof value === 'string' ? value : JSON.stringify(value);
    });
  }).join('\n');
}
