// Original, literal-only resource options. Kept self-contained for the QX host.
export function parseOptions(link) {
  const fail = () => { throw new Error('Resource parser options: invalid parameters'); };
  const decode = value => { try { return decodeURIComponent(value); } catch { return fail(); } };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const safeText = (value, limit = 512) => typeof value === 'string' && value.length <= limit && !/[\x00-\x1f\x7f\u2028\u2029]/.test(value);
  const tagPart = value => safeText(value) && !/[,\"]/.test(value);
  const result = { type: 'auto', sourceFormat: 'auto', in: [], out: [], prefix: '', suffix: '', rename: [], sort: 'none', allowResolve: false };
  if (typeof link !== 'string' || link.length > 65536) fail();
  const boundary = link.indexOf('#');
  const hash = boundary < 0 ? '' : link.slice(boundary + 1);
  if (!hash) return result;
  if (hash.length > 32768) fail();
  const seen = Object.create(null);
  const allowed = ['type', 'format', 'domain-mode', 'policy', 'allow-resolve', 'script-compat', 'in', 'out', 'prefix', 'suffix', 'rename', 'sort'];
  for (const pair of hash.split('&')) {
    const equal = pair.indexOf('=');
    if (equal < 1) fail();
    const key = decode(pair.slice(0, equal));
    if (!allowed.includes(key) || own(seen, key)) fail();
    seen[key] = true;
    const raw = pair.slice(equal + 1);
    // Split before decoding: an encoded %2B is a literal plus in one term.
    if (key === 'in' || key === 'out') {
      const terms = raw === '' ? [] : raw.split('+').map(decode);
      if (terms.length > 128 || terms.some(term => !term || !safeText(term))) fail();
      result[key] = terms;
      continue;
    }
    const value = decode(raw);
    if (!safeText(value, key === 'rename' ? 16384 : 512)) fail();
    if (key === 'type') {
      if (!['auto', 'server', 'filter', 'rewrite'].includes(value)) fail();
      result.type = value;
    } else if (key === 'format') {
      if (!['auto', 'classical', 'qx', 'domain-set', 'clash', 'sing-box'].includes(value)) fail();
      result.sourceFormat = value;
    } else if (key === 'domain-mode') {
      if (!['exact', 'suffix'].includes(value)) fail();
      result.domainSetMode = value;
    } else if (key === 'policy') {
      if (!value || value !== value.trim() || value.length > 128 || /[,\"=]/.test(value)) fail();
      result.policy = value;
    } else if (key === 'allow-resolve') {
      if (value !== '0' && value !== '1') fail();
      result.allowResolve = value === '1';
    } else if (key === 'script-compat') {
      if (value !== 'qx') fail();
      result.scriptCompatibility = value;
    } else if (key === 'prefix' || key === 'suffix') {
      if (!tagPart(value)) fail();
      result[key] = value;
    } else if (key === 'rename') {
      let pairs;
      try { pairs = JSON.parse(value); } catch { fail(); }
      if (!Array.isArray(pairs) || pairs.length > 100 || pairs.some(pair => !Array.isArray(pair) || pair.length !== 2 || !pair[0] || !tagPart(pair[0]) || !tagPart(pair[1]))) fail();
      result.rename = pairs;
    } else if (key === 'sort') {
      if (!['none', 'name', 'name-desc'].includes(value)) fail();
      result.sort = value;
    }
  }
  return result;
}

export function applyNodeOptions(content, options = {}) {
  const fail = () => { throw new Error('Node options failed: invalid node names or parameters'); };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const part = value => typeof value === 'string' && value.length <= 512 && !/[,\"\x00-\x1f\x7f\u2028\u2029]/.test(value);
  const validName = value => part(value) && value !== '' && value === value.trim();
  if (typeof content !== 'string' || !content || content.length > 4194304 || !options || typeof options !== 'object' || Array.isArray(options)) fail();
  const supported = ['type', 'sourceFormat', 'domainSetMode', 'policy', 'allowResolve', 'scriptCompatibility', 'in', 'out', 'prefix', 'suffix', 'rename', 'sort'];
  if (Object.keys(options).some(key => !supported.includes(key))) fail();
  const include = own(options, 'in') ? options.in : [];
  const exclude = own(options, 'out') ? options.out : [];
  const rename = own(options, 'rename') ? options.rename : [];
  const prefix = own(options, 'prefix') ? options.prefix : '';
  const suffix = own(options, 'suffix') ? options.suffix : '';
  const sort = own(options, 'sort') ? options.sort : 'none';
  if (![include, exclude].every(list => Array.isArray(list) && list.length <= 128 && list.every(term => typeof term === 'string' && term && term.length <= 512 && !/[\x00-\x1f\x7f\u2028\u2029]/.test(term))) || !Array.isArray(rename) || rename.length > 100 || rename.some(pair => !Array.isArray(pair) || pair.length !== 2 || !pair[0] || !part(pair[0]) || !part(pair[1])) || !part(prefix) || !part(suffix) || !['none', 'name', 'name-desc'].includes(sort)) fail();
  const nodes = [], originalNames = new Set(), finalNames = new Set();
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^(?:shadowsocks|vmess|vless|trojan|http|socks5|anytls)\s*=/i.test(line.trim()) || /[\x00-\x1f\x7f\u2028\u2029]/.test(line)) fail();
    // Preserve other fields byte-for-byte, including quoted native credentials.
    const fields = [];
    let start = 0, quote = false;
    for (let index = 0; index < line.length; index++) {
      if (line[index] === '"') {
        if (quote && line[index + 1] === '"') index++;
        else quote = !quote;
      } else if (line[index] === ',' && !quote) { fields.push(line.slice(start, index)); start = index + 1; }
    }
    if (quote) fail();
    fields.push(line.slice(start));
    let position = -1, name = '', lead = '', tail = '';
    for (let index = 1; index < fields.length; index++) {
      const match = /^(\s*tag\s*=\s*)(.*?)(\s*)$/i.exec(fields[index]);
      if (!match) continue;
      if (position !== -1) fail();
      position = index; lead = match[1]; tail = match[3]; name = match[2];
      if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).replace(/""/g, '"');
    }
    if (position === -1 || !validName(name) || originalNames.has(name)) fail();
    originalNames.add(name);
    if ((include.length && !include.some(term => name.includes(term))) || exclude.some(term => name.includes(term))) continue;
    let changed = name;
    for (const [from, to] of rename) {
      changed = changed.split(from).join(to);
      // Bound every step, not only the final name: repeated literal expansion
      // must not allocate an exponentially growing intermediate string.
      if (!part(changed)) fail();
    }
    changed = prefix + changed + suffix;
    if (!validName(changed) || finalNames.has(changed)) fail();
    finalNames.add(changed);
    if (changed !== name) fields[position] = lead + changed + tail;
    nodes.push({ name: changed, line: changed === name ? line : fields.join(','), index: nodes.length });
    if (nodes.length > 2000) fail();
  }
  if (!nodes.length) fail();
  if (sort !== 'none') nodes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.index - b.index) * (sort === 'name-desc' ? -1 : 1));
  if (!include.length && !exclude.length && !rename.length && !prefix && !suffix && sort === 'none') return content;
  return nodes.map(node => node.line).join('\n') + '\n';
}
