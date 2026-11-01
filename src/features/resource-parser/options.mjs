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
  const allowed = ['type', 'format', 'domain-mode', 'policy', 'allow-resolve', 'script-compat', 'in', 'out', 'prefix', 'suffix', 'rename', 'sort', 'info', 'emoji'];
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
    } else if (key === 'info') {
      if (value !== '0' && value !== '1') fail();
      result.info = value === '1';
    } else if (key === 'emoji') {
      if (!['0', '1', '2', '-1'].includes(value)) fail();
      result.emoji = value;
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
  const supported = ['type', 'sourceFormat', 'domainSetMode', 'policy', 'allowResolve', 'scriptCompatibility', 'in', 'out', 'prefix', 'suffix', 'rename', 'sort', 'info', 'emoji'];
  if (Object.keys(options).some(key => !supported.includes(key))) fail();
  const include = own(options, 'in') ? options.in : [];
  const exclude = own(options, 'out') ? options.out : [];
  const rename = own(options, 'rename') ? options.rename : [];
  const prefix = own(options, 'prefix') ? options.prefix : '';
  const suffix = own(options, 'suffix') ? options.suffix : '';
  const sort = own(options, 'sort') ? options.sort : 'none';
  const emoji = own(options, 'emoji') ? options.emoji : '0';
  if (!['0', '1', '2', '-1'].includes(emoji) || own(options, 'info') && typeof options.info !== 'boolean') fail();
  // These are node-name labels, never an IP geolocation lookup. Country codes
  // require token boundaries so e.g. USAGE cannot be mistaken for US.
  const places = [
    ['TW', /台湾|台灣|台北|新北|台中|高雄|Taiwan|Taipei/i],
    ['HK', /香港|Hong[ -]?Kong/i], ['MO', /澳门|澳門|Macao|Macau/i],
    ['JP', /日本|东京|東京|大阪|Japan|Tokyo|Osaka/i],
    ['US', /美国|美國|洛杉矶|洛杉磯|圣荷西|聖荷西|西雅图|西雅圖|United[ -]?States|America|Los[ -]?Angeles|San[ -]?Jose|Seattle/i],
    ['SG', /新加坡|狮城|獅城|Singapore/i], ['KR', /韩国|韓國|首尔|首爾|Korea|Seoul/i],
    ['GB', /英国|英國|伦敦|倫敦|United[ -]?Kingdom|Britain|London/i],
    ['DE', /德国|德國|法兰克福|法蘭克福|Germany|Frankfurt/i], ['FR', /法国|法國|巴黎|France|Paris/i],
    ['CA', /加拿大|Canada|Toronto|Vancouver/i], ['AU', /澳大利亚|澳大利亞|澳洲|悉尼|Australia|Sydney/i],
    ['CN', /中国|中國|大陆|大陸|北京|上海|广州|廣州|深圳|China/i],
    ['NL', /荷兰|荷蘭|Netherlands|Amsterdam/i], ['RU', /俄罗斯|俄羅斯|Russia|Moscow/i],
    ['IN', /印度|India/i], ['VN', /越南|Vietnam/i], ['TH', /泰国|泰國|Thailand|Bangkok/i],
    ['MY', /马来西亚|馬來西亞|Malaysia/i], ['PH', /菲律宾|菲律賓|Philippines/i], ['ID', /印度尼西亚|印度尼西亞|印尼|Indonesia/i],
    ['TR', /土耳其|Türkiye|Turkey/i], ['BR', /巴西|Brazil/i], ['AR', /阿根廷|Argentina/i],
    ['CH', /瑞士|Switzerland/i], ['SE', /瑞典|Sweden/i], ['FI', /芬兰|芬蘭|Finland/i],
    ['NO', /挪威|Norway/i], ['DK', /丹麦|丹麥|Denmark/i], ['IE', /爱尔兰|愛爾蘭|Ireland/i],
    ['IT', /意大利|義大利|Italy/i], ['ES', /西班牙|Spain/i], ['PT', /葡萄牙|Portugal/i],
    ['NZ', /新西兰|紐西蘭|New[ -]?Zealand/i], ['IS', /冰岛|冰島|Iceland/i],
    ['ZA', /南非|South[ -]?Africa/i], ['AE', /阿联酋|阿聯酋|迪拜|Emirates|Dubai/i],
    ['IL', /以色列|Israel/i], ['PL', /波兰|波蘭|Poland/i], ['UA', /乌克兰|烏克蘭|Ukraine/i],
  ];
  const decorate = name => {
    if (emoji === '0') return name;
    const flags = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g;
    const supplied = name.match(flags);
    const plain = name.replace(flags, '').trim();
    if (emoji === '-1') return plain;
    let code = places.find(([, pattern]) => pattern.test(plain))?.[0];
    if (!code) code = /(?:^|[^A-Za-z])(UK)(?=$|[^A-Za-z])/i.test(plain) ? 'GB'
      : places.find(([candidate]) => new RegExp('(?:^|[^A-Za-z])' + candidate + '(?=$|[^A-Za-z])', 'i').test(plain))?.[0];
    if (emoji === '2' && code === 'TW') code = 'CN';
    let flag = code ? String.fromCodePoint(127397 + code.charCodeAt(0), 127397 + code.charCodeAt(1)) : supplied?.[0] || '🏴‍☠️';
    if (emoji === '2' && flag === '🇹🇼') flag = '🇨🇳';
    return flag + ' ' + plain;
  };
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
    changed = decorate(prefix + changed + suffix);
    if (!validName(changed) || finalNames.has(changed)) fail();
    finalNames.add(changed);
    if (changed !== name) fields[position] = lead + changed + tail;
    nodes.push({ name: changed, line: changed === name ? line : fields.join(','), index: nodes.length });
    if (nodes.length > 2000) fail();
  }
  if (!nodes.length) fail();
  if (sort !== 'none') nodes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.index - b.index) * (sort === 'name-desc' ? -1 : 1));
  if (!include.length && !exclude.length && !rename.length && !prefix && !suffix && sort === 'none' && emoji === '0') return content;
  return nodes.map(node => node.line).join('\n') + '\n';
}
