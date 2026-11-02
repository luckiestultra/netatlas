// SPDX-License-Identifier: MIT
// Original implementation of the official QX 1.5.6(918)+ helper protocol:
// https://github.com/crossutility/Quantumult-X/blob/97fdae00a91f69e69d84898c686aa94a112dd4bd/parser-helper-protocol.md
// QX extracts these three functions independently; only $parser is shared.
export function installParserHelper(parser) {
  if (!parser || typeof parser !== 'object' || Array.isArray(parser)) throw new Error('Parser helper: invalid parameters');
  parser.hashSchema = function () {
    const text = (key, label, description) => ({ type: 'text', key, label, ...(description ? { description } : {}) });
    const select = (key, label, values, description) => ({ type: 'select', key, label, options: values.map(value => typeof value === 'string' ? { label: value, value } : value), ...(description ? { description } : {}) });
    const toggle = (key, label, description) => ({ type: 'switch', key, label, onValue: '1', offValue: '0', ...(description ? { description } : {}) });
    const enabled = [{ label: '开启', value: '1' }, { label: '关闭', value: '0' }, { label: '关闭（旧写法）', value: '-1' }];
    const operators = '旧值@新值，用 + 连接；字面 @/+ 写为 %40/%2B。';
    const naming = operators + '也可用 前缀@、@后缀、字段☠️ 或 JSON 配对；支持 $type/$index/$emoji/$tag。';
    return { version: 1, sections: [
      { type: 'group', title: '资源类型', items: [
        select('type', '资源类型', ['auto', 'server', 'filter', 'rewrite', 'domain-set']),
        select('format', '来源格式', ['auto', 'classical', 'qx', 'domain-set', 'clash', 'sing-box']),
        select('dst', '模块输出内容', ['rewrite', 'filter'], '按需仅提取模块中的重写或规则。'),
        text('arguments', '模块参数', '填写 JSON 对象；参数名须由来源模块声明，值可用文字、数字、布尔值或 null。'),
      ] },
      { type: 'group', title: '筛选', items: [
        ...['in', 'out'].map(key => ({ type: 'tags', key, label: key === 'in' ? '保留关键字' : '排除关键字', description: '以 + 分隔任意项。节点名称不区分大小写，. 表示同时满足；分流正文区分大小写，重写正文不区分大小写，正文中的点均为字面字符。' })),
        text('regex', '正则保留', '匹配完整声明；同时作用于重写主机名。支持受限正则，复杂表达式或处理量过大会拒绝。'),
        text('regout', '正则排除', '匹配完整声明；不执行脚本，不支持回溯引用、环视或可空分组重复。'),
        ...['inhn', 'outhn'].map(key => ({ type: 'tags', key, label: key === 'inhn' ? '保留重写主机名' : '排除重写主机名', description: '以 + 分隔任意项，区分大小写，点为字面字符。' })),
        toggle('hide', '隐藏筛除项', '开启时删除筛除的规则或重写；关闭时保留为禁用行。'),
      ] },
      { type: 'group', title: '节点名称', items: [
        text('prefix', '名称前缀'), text('suffix', '名称后缀', '文字直接追加；1 追加协议标签，-1 前置协议标签，0 不添加。'),
        text('rename', '名称替换', naming), text('rrname', '先行名称替换', naming),
        text('delreg', '名称正则删除', '仅删除节点名称中匹配的内容。'),
        text('sort', '名称排序', 'none 保持；name 升序；name-desc 降序；random 随机；JP>HK 优先分组，JP<HK 靠后分组。也接受 0/1/-1/x。'),
        select('sortx', '分组内排序', [{ label: '保持原顺序', value: '0' }, { label: '升序', value: '1' }, { label: '降序', value: '-1' }], '仅与关键词分组排序一起使用。'),
        select('emoji', '地区旗帜（按节点名称）', [{ label: '保持原样', value: '0' }, { label: '添加', value: '1' }, { label: '国行显示模式', value: '2' }, { label: '删除', value: '-1' }]),
        select('cap', '英文字母大小写', [{ label: '大写', value: '1' }, { label: '小写', value: '-1' }, { label: '词首大写', value: '0' }]),
        select('ptn', '英文字母样式', ['0', '1', '2', '3', '4', '5', '6', '7', '8']),
        select('npt', '数字样式', ['0', '1', '2', '3', '4', '5', '6', '7', '8']),
        toggle('del', '删除后续重名节点', '未开启时自动编号；开启时保留首个节点并删除后续同名节点。'),
      ] },
      { type: 'group', title: '节点连接', items: [
        select('udp', 'UDP 转发', enabled), select('tfo', 'TCP 快速打开', enabled, 'Reality 不支持开启。'),
        select('uot', 'UDP 转 TCP', [{ label: '关闭', value: '0' }, { label: '旧 SSR Python', value: '1' }, { label: '版本 1', value: 'sp.v1' }, { label: '版本 2', value: 'sp.v2' }], '仅用于 Shadowsocks；须与服务端版本匹配。旧 SSR Python 不支持 SS2022。'),
        text('cert', '证书校验', '1 开启，0 或 -1 关闭；也可填写校验证书的域名（需 QX 1.7.0 build 938）。留空保留来源。'),
        text('csha', '证书 SHA-256', '64 位十六进制；必须开启证书校验，不能与公钥指纹同时指定。'),
        text('psha', '公钥 SHA-256', '64 位十六进制；必须开启证书校验。'),
        text('alpn', 'TLS 协议协商', '如 h2,http/1.1，也可填写原生十六进制；Reality 不适用。'),
        select('aead', 'VMess AEAD 握手', enabled),
        text('host', '连接域名', '替换已有域名；以 ☠️ 结尾时可为支持的连接添加域名。'),
        select('obfs', 'HTTP 混淆类型', [{ label: 'VMess HTTP（用于 SS）', value: 'vhttp' }, { label: 'SS HTTP（用于 VMess）', value: 'shttp' }]),
        select('tsession', '停用 TLS 会话', [{ label: '停用会话票据', value: '0' }, { label: '停用会话复用', value: '1' }, { label: '全部停用', value: '2' }], 'Reality 不适用。'),
        text('checkurl', '节点测试网址', '填写 HTTP 或 HTTPS 地址。'),
        select('tls13', '旧 TLS 版本标记', [{ label: '写入开启', value: '1' }, { label: '写入关闭', value: '0' }], '此字段已废弃；Quantumult X 始终支持 TLS 1.3，不能用它限制版本。'),
      ] },
      { type: 'group', title: '规则与重写', items: [
        text('policy', '覆盖规则策略', '留空保留来源策略；仅对规则生效。'),
        text('pset', '按条件指定策略', '正则@策略，用 + 连接；' + operators),
        text('replace', '正则替换', operators + '可显式修改声明字段；修改后仍须满足原生格式与安全约束。'),
        select('domain-mode', '纯域名匹配方式', ['exact', 'suffix']),
        toggle('allow-resolve', '允许丢弃 no-resolve', '仅显式允许时转换；可能增加 DNS 查询。'),
        select('fcr', '网络使用方式', [{ label: '强制移动数据', value: '1' }, { label: '混合网络', value: '2' }, { label: '网络负载均衡', value: '3' }]),
        text('via', '指定网络接口', '如 en0；0 表示隧道接口 %TUN%。'),
        text('relay', '节点转规则策略', '将节点地址转为指向所填策略的规则，用于代理链。'),
        text('script-compat', '脚本兼容声明', '已登记脚本自动适配 API 和参数；其他来源仅转换声明，可选 qx 声明其已支持 QX。'),
      ] },
      { type: 'group', title: '通知与导入', items: [
        toggle('info', '订阅流量通知', '成功转换后提示已有流量数据，不含订阅地址或凭据。'),
        text('flow', '手填流量', '到期日:总 GiB:已用 GiB，如 2030-01-01:100:20；1 使用来源流量。'),
        select('ntf', '通知开关', [{ label: '关闭', value: '0' }, { label: '开启', value: '1' }, { label: '按资源默认', value: '2' }]),
        toggle('cnt', '条目数量通知', '仅提示汇总数量，不显示来源正文或凭据。'),
        toggle('dbg', '诊断摘要', '仅提示汇总诊断，不显示来源正文或凭据。'),
        toggle('b64', 'Base64 节点输出'),
        toggle('UA', '换用订阅客户端标识', '让 QX 以 Shadowrocket 标识重试一次；需 QX 1.5.6 build 921 或更新版本。'),
        text('profile', '配置资源导入', '三位 0/1 分别选择节点、规则、重写；111 选择全部。通过通知打开导入页。'),
      ] },
    ] };
  };
  parser.hashToUI = function (hash) {
    const fail = () => { throw new Error('Parser helper: invalid parameters'); };
    if (typeof hash !== 'string' || hash.length > 32768) fail();
    const schema = $parser.hashSchema(), known = Object.create(null), counts = Object.create(null), values = Object.create(null), unknown = [];
    for (const group of schema.sections) for (const item of group.items) known[item.key] = item;
    const pairs = hash ? hash.split('&').map(raw => {
      const equal = raw.indexOf('='); let key;
      try { key = decodeURIComponent(equal < 0 ? raw : raw.slice(0, equal)); } catch { return { raw }; }
      if (key === 'tls-verification') key = 'cert';
      counts[key] = (counts[key] || 0) + 1;
      return { raw, key, value: equal < 0 ? null : raw.slice(equal + 1) };
    }) : [];
    const rawValue = key => { const pair = pairs.find(item => item.key === key && counts[key] === 1 && item.value !== null); if (!pair) return undefined; try { return decodeURIComponent(pair.value); } catch { return undefined; } };
    const domainSetConflict = rawValue('type') === 'domain-set' && (rawValue('format') !== undefined && !['auto', 'domain-set'].includes(rawValue('format')) || rawValue('domain-mode') !== undefined && rawValue('domain-mode') !== 'exact');
    for (const pair of pairs) {
      if (domainSetConflict && ['type', 'format', 'domain-mode'].includes(pair.key)) { unknown.push(pair.raw); continue; }
      const meta = known[pair.key];
      if (!meta || counts[pair.key] !== 1 || pair.value === null) { unknown.push(pair.raw); continue; }
      try {
        let value = meta.type === 'tags' ? pair.value === '' ? [] : pair.value.split('+').map(decodeURIComponent) : decodeURIComponent(pair.value);
        if (['rename', 'rrname', 'replace', 'pset'].includes(pair.key)) {
          let json = false; try { json = ['rename', 'rrname'].includes(pair.key) && Array.isArray(JSON.parse(value)); } catch { /* Operator expression. */ }
          if (!json) value = pair.value;
        }
        if (pair.key === 'type') { const aliases = { nodes: 'server', list: 'server', rule: 'filter', module: 'rewrite' }; value = aliases[value] || value; }
        if (pair.key === 'sort') value = ({ 0: 'none', 1: 'name', '-1': 'name-desc', x: 'random' })[value] || value;
        if (meta.type === 'switch') { if (value !== meta.onValue && value !== meta.offValue) throw new Error(); value = value === meta.onValue; }
        // The serializer owns validation and has no dependency on this method.
        const validation = { [pair.key]: value };
        if (pair.key === 'sortx' && value !== '0') { const sort = pairs.find(item => item.key === 'sort' && counts.sort === 1 && item.value !== null); if (!sort) throw new Error(); validation.sort = decodeURIComponent(sort.value); }
        if (!$parser.uiToHash(validation)) throw new Error();
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
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const safe = (value, limit = 512) => typeof value === 'string' && value.length <= limit && !/[\x00-\x1f\x7f\u2028\u2029]/.test(value);
    const tagPart = value => safe(value) && !/[,"]/.test(value);
    const encode = value => { try { return encodeURIComponent(value); } catch { return fail(); } };
    const decode = value => { try { return decodeURIComponent(value); } catch { return fail(); } };
    const placeholders = value => { for (const match of value.matchAll(/\$[A-Za-z][A-Za-z0-9_]*/g)) if (!/^\$(?:type[0-8]?|index[0-8]?|emoji[12]?|tag[0-8]{0,2})$/.test(match[0])) fail(); };
    // Syntax-only validation mirrors the bounded runtime grammar. No matching,
    // source evaluation, or generated executable code occurs in the helper.
    const pattern = source => {
      if (!safe(source) || !source) fail();
      let offset = 0, captures = 0, depth = 0;
      const escaped = () => { const char = source[offset++]; if (!char || /[A-Za-z0-9]/.test(char) && !'dDwWsS'.includes(char)) fail(); return 'dDwWsS'.includes(char) ? null : char; };
      const expression = () => { let result = sequence(); while (source[offset] === '|') { offset++; const branch = sequence(); result = { cost: result.cost + branch.cost + 1, nullable: result.nullable || branch.nullable }; } return result; };
      const sequence = () => {
        let cost = 0, nullable = true;
        while (offset < source.length && source[offset] !== ')' && source[offset] !== '|') {
          const value = source[offset++]; let atom = 1, empty = false, captured = 0, repeatable = true;
          if (value === '(') {
            const before = captures; let group = true;
            if (source.slice(offset, offset + 2) === '?:') { offset += 2; group = false; }
            else if (source[offset] === '?' || ++captures > 16) fail();
            if (++depth > 16) fail(); const child = expression(); depth--;
            atom = child.cost + (group ? 2 : 0); empty = child.nullable; captured = captures - before; repeatable = !empty;
            if (source[offset++] !== ')') fail();
          } else if (value === '[') {
            const start = offset - 1; if (source[offset] === '^') offset++;
            let count = 0;
            while (offset < source.length && source[offset] !== ']') { let start = source[offset++]; if (start === '\\') start = escaped(); if (start !== null && source[offset] === '-' && source[offset + 1] !== ']' && offset + 1 < source.length) { offset++; let end = source[offset++]; if (end === '\\') end = escaped(); if (end === null || start.charCodeAt(0) > end.charCodeAt(0)) fail(); } count++; }
            if (source[offset++] !== ']' || !count) fail();
            try { new RegExp('^(?:' + source.slice(start, offset) + ')$', 'i'); } catch { fail(); }
          } else if (value === '^' || value === '$') { repeatable = false; empty = true; }
          else if (value === '\\') { if (source[offset] === 'b') { offset++; repeatable = false; empty = true; } else escaped(); }
          else if ('*+?{}]'.includes(value)) fail();
          const next = source[offset];
          if (next && '*+?{'.includes(next)) {
            if (!repeatable) fail(); offset++; let min, max;
            if (next === '*') { min = 0; max = Infinity; }
            else if (next === '+') { min = 1; max = Infinity; }
            else if (next === '?') { min = 0; max = 1; }
            else { const range = /^(\d{1,3})(?:,(\d{0,3}))?\}/.exec(source.slice(offset)); if (!range) fail(); offset += range[0].length; min = Number(range[1]); max = range[2] === undefined ? min : range[2] === '' ? Infinity : Number(range[2]); if (min > 128 || max !== Infinity && (max > 128 || max < min)) fail(); }
            const iteration = atom + (captured ? 1 : 0);
            atom = max === Infinity ? min * iteration + iteration + 1 : min * iteration + (max - min) * (iteration + 1);
            empty = min === 0; if (source[offset] === '?') offset++;
          }
          cost += atom; nullable = nullable && empty; if (cost > 1023) fail();
        }
        return { cost, nullable };
      };
      if (expression().cost > 1023 || offset !== source.length) fail();
    };
    const validPolicy = value => { if (!safe(value, 128) || !value || value !== value.trim() || /[,"=]/.test(value)) fail(); };
    if (!values || typeof values !== 'object' || Array.isArray(values)) fail();
    const known = Object.create(null), parts = [], seen = new Set();
    for (const group of $parser.hashSchema().sections) for (const item of group.items) known[item.key] = item;
    for (const inputKey of Object.keys(values)) {
      if (inputKey === '__unknown') continue;
      const key = inputKey === 'tls-verification' ? 'cert' : inputKey, meta = known[key]; let value = values[inputKey];
      if (!meta || seen.has(key)) fail(); seen.add(key);
      if (key === 'type' && typeof value === 'string') { const aliases = { nodes: 'server', list: 'server', rule: 'filter', module: 'rewrite' }; if (own(aliases, value)) value = aliases[value]; }
      if (key === 'sort') value = ({ 0: 'none', 1: 'name', '-1': 'name-desc', x: 'random' })[value] || value;
      let serialized;
      if (meta.type === 'tags') {
        if (!Array.isArray(value) || value.length > 128 || value.some(term => !safe(term) || !term)) fail();
        serialized = value.map(encode).join('+');
      } else if (meta.type === 'switch') {
        if (typeof value !== 'boolean') fail(); serialized = value ? meta.onValue : meta.offValue;
      } else {
        const operators = ['rename', 'rrname', 'replace', 'pset'].includes(key);
        if (!safe(value, operators ? 32768 : key === 'arguments' ? 8192 : ['sort', 'alpn', 'checkurl'].includes(key) ? 2048 : 512)) fail();
        if (value === '' && meta.type === 'text' && !['prefix', 'suffix'].includes(key)) continue;
        if (meta.type === 'select' && !meta.options.some(option => option.value === value)) fail();
        if (key === 'prefix' || key === 'suffix') { if (!tagPart(value)) fail(); placeholders(value); }
        if (['policy', 'relay'].includes(key)) validPolicy(value);
        if (key === 'script-compat' && value !== 'qx') fail();
        if (['regex', 'regout', 'delreg'].includes(key)) pattern(value);
        if (key === 'sort' && !['none', 'name', 'name-desc', 'random'].includes(value)) { const groups = value.split(/[<>]/); if (!value || groups.length > 32 || value.includes('<') && value.includes('>')) fail(); groups.forEach(pattern); }
        if (key === 'cert' && !['0', '1', '-1', 'true', 'false'].includes(value)) { if (value.length > 253 || !value.includes('.') || value.split('.').some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) fail(); }
        if (['csha', 'psha'].includes(key) && !/^[A-Fa-f0-9]{64}$/.test(value)) fail();
        if (key === 'host') { const host = value.endsWith('☠️') ? value.slice(0, -2) : value; if (!host || host.length > 253 || !/^[A-Za-z0-9._-]+$/.test(host)) fail(); }
        if (key === 'checkurl') { const url = /^https?:\/\/(?:\[[A-Fa-f0-9:]+\]|[A-Za-z0-9._-]+)(?::([0-9]{1,5}))?(?:[/?][^\s,#"]*)?$/.exec(value); if (!url || url[1] && (+url[1] < 1 || +url[1] > 65535)) fail(); }
        if (key === 'alpn') {
          if (/^[A-Fa-f0-9:]+$/.test(value)) { const hex = value.replace(/:/g, ''); if (!/^(?:[A-Fa-f0-9]{2})+$/.test(hex) || value.includes(':') && !/^[A-Fa-f0-9]{2}(?::[A-Fa-f0-9]{2})*$/.test(value)) fail(); let at = 0; while (at < hex.length) { const size = parseInt(hex.slice(at, at + 2), 16); if (!size) fail(); at += 2 + size * 2; } if (at !== hex.length || hex.length > 1024) fail(); }
          else { let size = 0; for (const protocol of value.split(',')) { if (!/^[\x21-\x7e]{1,255}$/.test(protocol)) fail(); size += 2 + protocol.length * 2; } if (size > 1024) fail(); }
        }
        if (key === 'via' && !/^(?:0|%TUN%|[A-Za-z][A-Za-z0-9_.:-]{0,63})$/.test(value)) fail();
        if (key === 'profile' && !/^[01]{3}$/.test(value)) fail();
        if (key === 'flow' && value !== '1') { const fields = /^(\d{4}-\d{2}-\d{2}):(\d{1,7}(?:\.\d{1,3})?):(\d{1,7}(?:\.\d{1,3})?)$/.exec(value); if (!fields || +fields[3] > +fields[2]) fail(); const date = new Date(fields[1] + 'T00:00:00Z'); if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== fields[1]) fail(); }
        if (key === 'arguments') { let object; try { object = JSON.parse(value); } catch { fail(); } if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).length > 64) fail(); for (const [name, item] of Object.entries(object)) { if (!name || !safe(name, 128) || /[\x7f-\x9f]/.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)) fail(); if (typeof item === 'string' ? !safe(item, 2048) || /[\x7f-\x9f]/.test(item) : typeof item === 'number' ? !Number.isFinite(item) : item !== null && typeof item !== 'boolean') fail(); } }
        if (operators) {
          let json; try { if (['rename', 'rrname'].includes(key)) json = JSON.parse(value); } catch { /* Operator expression. */ }
          const decoded = Array.isArray(json) ? value : decode(value); if (!safe(decoded, 16384)) fail();
          if (Array.isArray(json)) {
            placeholders(value); if (value.length > 16384 || json.length > 100 || json.some(pair => !Array.isArray(pair) || pair.length !== 2 || !pair[0] || !tagPart(pair[0]) || !tagPart(pair[1]))) fail(); serialized = encode(value);
          } else {
            if (['rename', 'rrname'].includes(key)) placeholders(decoded);
            const steps = value.split('+'); let count = 0; if (!value || steps.length > 100) fail();
            serialized = steps.map(step => {
              if (!step) fail(); const fields = step.split('@'), parts = fields.map(decode);
              if (['replace', 'pset'].includes(key)) { if (parts.length !== 2 || !safe(parts[0]) || !safe(parts[1])) fail(); pattern(parts[0]); if (key === 'pset') validPolicy(parts[1]); else placeholders(parts[1].replace(/\$(?:\$|&|[1-9][0-9]?)/g, '')); }
              else if (parts.length === 2) { if (parts.some(part => !tagPart(part))) fail(); count++; }
              else if (parts.length === 1 && parts[0].endsWith('☠️')) { const deletion = parts[0].slice(0, -2).replace(/\\\./g, '\u0000').split('.'); if (deletion.some(part => !part || !tagPart(part.replace(/\u0000/g, '.')))) fail(); count += deletion.length; }
              else fail();
              if (count > 100) fail(); return parts.map(encode).join('@');
            }).join('+');
          }
        } else serialized = encode(value);
      }
      parts.push(encode(key) + '=' + serialized);
    }
    const sort = values.sort === undefined ? 'none' : ({ 0: 'none', 1: 'name', '-1': 'name-desc', x: 'random' })[values.sort] || values.sort;
    if (values.sortx !== undefined && values.sortx !== '0' && ['none', 'name', 'name-desc', 'random'].includes(sort)) fail();
    if (own(values, 'cert') && own(values, 'tls-verification')) fail();
    if (values.type === 'domain-set' && (values.format !== undefined && !['auto', 'domain-set'].includes(values.format) || values['domain-mode'] !== undefined && values['domain-mode'] !== 'exact')) fail();
    if (own(values, '__unknown')) { if (typeof values.__unknown !== 'string') fail(); if (values.__unknown) parts.push(values.__unknown); }
    const hash = parts.join('&'); if (hash.length > 32768) fail(); return hash;
  };
  return parser;
}
