// Original implementation of the official QX 1.5.6(918)+ helper protocol:
// https://github.com/crossutility/Quantumult-X/blob/97fdae00a91f69e69d84898c686aa94a112dd4bd/parser-helper-protocol.md
// QX extracts these three functions independently; only $parser is shared.
export function installParserHelper(parser) {
  if (!parser || typeof parser !== 'object' || Array.isArray(parser)) throw new Error('Parser helper: invalid parameters');
  parser.hashSchema = function () {
    const select = (key, label, values) => ({ type: 'select', key, label, options: values.map(value => ({ label: value, value })) });
    return { version: 1, sections: [
      { type: 'group', title: '资源类型', items: [
        select('type', '资源类型', ['auto', 'server', 'filter', 'rewrite', 'domain-set']),
        select('format', '来源格式', ['auto', 'classical', 'qx', 'domain-set', 'clash', 'sing-box']),
        { type: 'text', key: 'policy', label: '覆盖规则策略', description: '留空保留来源策略；仅对规则生效。' },
      ] },
      { type: 'group', title: '筛选与名称', items: [
        { type: 'tags', key: 'in', label: '保留关键字', description: '以 + 分隔任意项。节点名称不区分大小写，. 表示同时满足；分流正文区分大小写，重写正文不区分大小写，正文中的点均为字面字符。' },
        { type: 'tags', key: 'out', label: '排除关键字', description: '以 + 分隔任意项。节点名称不区分大小写，. 表示同时满足；分流正文区分大小写，重写正文不区分大小写，正文中的点均为字面字符。' },
        { type: 'tags', key: 'inhn', label: '保留重写主机名', description: '以 + 分隔任意项，区分大小写，点为字面字符。' },
        { type: 'tags', key: 'outhn', label: '排除重写主机名', description: '以 + 分隔任意项，区分大小写，点为字面字符。' },
        { type: 'text', key: 'prefix', label: '名称前缀' },
        { type: 'text', key: 'suffix', label: '名称后缀' },
        select('sort', '名称排序', ['none', 'name', 'name-desc']),
        { type: 'select', key: 'emoji', label: '地区旗帜（按节点名称）', options: [
          { label: '保持原样', value: '0' }, { label: '添加', value: '1' },
          { label: '国行显示模式', value: '2' }, { label: '删除', value: '-1' },
        ] },
        { type: 'switch', key: 'info', label: '订阅流量通知', description: '成功转换后提示已有流量数据，不含订阅地址或凭据。', onValue: '1', offValue: '0' },
      ] },
      { type: 'group', title: '高级选项', items: [
        { type: 'text', key: 'rename', label: '字面替换', description: '旧名@新名，用 + 连接；前缀@、@后缀、字段☠️ 也可用。字面 @/+ 编码为 %40/%2B；也接受 JSON 配对列表。' },
        select('domain-mode', '纯域名匹配方式', ['exact', 'suffix']),
        { type: 'switch', key: 'allow-resolve', label: '允许丢弃 no-resolve', description: '仅显式允许时转换；可能增加 DNS 查询。', onValue: '1', offValue: '0' },
        { type: 'text', key: 'script-compat', label: '脚本兼容声明', description: '可选填写 qx；省略也会转换声明，脚本 API 不会自动翻译。' },
      ] },
    ] };
  };
  parser.hashToUI = function (hash) {
    const fail = () => { throw new Error('Parser helper: invalid parameters'); };
    if (typeof hash !== 'string' || hash.length > 32768) fail();
    const validTerms = terms => {
      return terms.length <= 128 && terms.every(term => typeof term === 'string' && term.length > 0 && term.length <= 512 && !/[\x00-\x1f\x7f\u2028\u2029]/.test(term));
    };
    const schema = $parser.hashSchema();
    const known = Object.create(null), counts = Object.create(null), values = Object.create(null), unknown = [];
    for (const group of schema.sections) for (const item of group.items) known[item.key] = item;
    const pairs = hash ? hash.split('&').map(raw => {
      const equal = raw.indexOf('=');
      let key;
      try { key = decodeURIComponent(equal < 0 ? raw : raw.slice(0, equal)); } catch { return { raw }; }
      counts[key] = (counts[key] || 0) + 1;
      return { raw, key, value: equal < 0 ? null : raw.slice(equal + 1) };
    }) : [];
    for (const pair of pairs) {
      const meta = known[pair.key];
      if (!meta || counts[pair.key] !== 1 || pair.value === null) { unknown.push(pair.raw); continue; }
      try {
        let value;
        if (meta.type === 'tags') {
          value = pair.value === '' ? [] : pair.value.split('+').map(term => decodeURIComponent(term));
          if (!validTerms(value)) throw new Error();
        } else {
          value = decodeURIComponent(pair.value);
          if (value.length > (pair.key === 'rename' ? 16384 : 512) || /[\x00-\x1f\x7f\u2028\u2029]/.test(value)) throw new Error();
          if (pair.key === 'rename') {
            // JSON is shown decoded; legacy operators retain encoded literal delimiters.
            let json = false;
            try { json = Array.isArray(JSON.parse(value)); } catch { /* Legacy expression. */ }
            if (!json) value = pair.value;
          }
          if (pair.key === 'type') {
            const aliases = { nodes: 'server', list: 'server', rule: 'filter', module: 'rewrite' };
            if (Object.prototype.hasOwnProperty.call(aliases, value)) value = aliases[value];
          }
          if (pair.key === 'sort') value = value === '1' ? 'name' : value === '-1' ? 'name-desc' : value;
          if (meta.type === 'select' && !meta.options.some(option => option.value === value)) throw new Error();
          if (meta.type === 'switch') {
            if (value !== meta.onValue && value !== meta.offValue) throw new Error();
            value = value === meta.onValue;
          }
        }
        values[pair.key] = value;
      } catch { unknown.push(pair.raw); }
    }
    const sections = [];
    for (const group of schema.sections) {
      const items = group.items.filter(item => Object.prototype.hasOwnProperty.call(values, item.key)).map(item => ({ ...item, value: values[item.key] }));
      if (items.length) sections.push({ ...group, items });
    }
    return { version: 1, sections, unknown: unknown.join('&') };
  };
  parser.uiToHash = function (values) {
    const fail = () => { throw new Error('Parser helper: invalid parameters'); };
    if (!values || typeof values !== 'object' || Array.isArray(values)) fail();
    const validTerms = terms => {
      return terms.length <= 128 && terms.every(term => typeof term === 'string' && term.length > 0 && term.length <= 512 && !/[\x00-\x1f\x7f\u2028\u2029]/.test(term));
    };
    const schema = $parser.hashSchema(), known = Object.create(null), parts = [];
    for (const group of schema.sections) for (const item of group.items) known[item.key] = item;
    const encode = value => { try { return encodeURIComponent(value); } catch { return fail(); } };
    for (const key of Object.keys(values)) {
      if (key === '__unknown') continue;
      const meta = known[key]; let value = values[key];
      if (key === 'type' && typeof value === 'string') {
        const aliases = { nodes: 'server', list: 'server', rule: 'filter', module: 'rewrite' };
        if (Object.prototype.hasOwnProperty.call(aliases, value)) value = aliases[value];
      }
      if (key === 'sort') value = value === '1' ? 'name' : value === '-1' ? 'name-desc' : value;
      if (!meta) fail();
      let serialized;
      if (meta.type === 'tags') {
        if (!Array.isArray(value) || value.some(term => typeof term !== 'string') || !validTerms(value)) fail();
        serialized = value.map(encode).join('+');
      } else if (meta.type === 'switch') {
        if (typeof value !== 'boolean') fail();
        serialized = value ? meta.onValue : meta.offValue;
      } else {
        if (typeof value !== 'string' || value.length > (key === 'rename' ? 32768 : 512) || /[\x00-\x1f\x7f\u2028\u2029]/.test(value)) fail();
        if (meta.type === 'select' && !meta.options.some(option => option.value === value)) fail();
        if (value === '' && ['policy', 'rename', 'script-compat'].includes(key)) continue;
        if (key === 'rename') {
          let json = false;
          try { json = Array.isArray(JSON.parse(value)); } catch { /* Legacy expression. */ }
          if (json) { if (value.length > 16384) fail(); serialized = encode(value); }
          else {
            try {
              const decoded = decodeURIComponent(value);
              if (decoded.length > 16384 || /[\x00-\x1f\x7f\u2028\u2029]/.test(decoded)) fail();
              serialized = value.split('+').map(step => step.split('@').map(field => encode(decodeURIComponent(field))).join('@')).join('+');
            } catch { fail(); }
          }
        } else serialized = encode(value);
      }
      parts.push(encode(key) + '=' + serialized);
    }
    if (Object.prototype.hasOwnProperty.call(values, '__unknown')) {
      if (typeof values.__unknown !== 'string') fail();
      if (values.__unknown) parts.push(values.__unknown);
    }
    const hash = parts.join('&');
    if (hash.length > 32768) fail();
    return hash;
  };
  return parser;
}
