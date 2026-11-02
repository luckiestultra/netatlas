// SPDX-License-Identifier: MIT
// Native field meanings: crossutility/Quantumult-X/sample.conf, server_local.
export function nativeOptionValue(key, value) {
  const fail = () => { throw new Error('Resource parser options: invalid parameters'); };
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\x00-\x1f\x7f\u2028\u2029]/.test(value)) fail();
  if (['udp', 'tfo', 'aead', 'tls13'].includes(key)) { if (!['-1', '0', '1'].includes(value)) fail(); return value === '-1' ? '0' : value; }
  if (key === 'uot') { if (!['0', '1', 'sp.v1', 'sp.v2'].includes(value)) fail(); return value; }
  if (key === 'cert') {
    if (['0', '1', '-1', 'true', 'false'].includes(value)) return ['1', 'true'].includes(value) ? 'true' : 'false';
    if (value.length > 253 || !value.includes('.') || value.split('.').some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) fail(); return value;
  }
  if (key === 'csha' || key === 'psha') { if (!/^[A-Fa-f0-9]{64}$/.test(value)) fail(); return value.toLowerCase(); }
  if (key === 'tsession') { if (!['0', '1', '2'].includes(value)) fail(); return value; }
  if (key === 'host') { const host = value.endsWith('☠️') ? value.slice(0, -2) : value; if (!host || !/^[A-Za-z0-9._-]+$/.test(host) || host.length > 253) fail(); return value; }
  if (key === 'obfs') { if (!['shttp', 'vhttp'].includes(value)) fail(); return value; }
  if (key === 'checkurl') { const match = /^https?:\/\/(?:\[[A-Fa-f0-9:]+\]|[A-Za-z0-9._-]+)(?::([0-9]{1,5}))?(?:[/?][^\s,#"]*)?$/.exec(value); if (!match || match[1] && (Number(match[1]) < 1 || Number(match[1]) > 65535)) fail(); return value; }
  if (key === 'alpn') {
    let hex = value.replace(/:/g, '');
    if (/^[A-Fa-f0-9:]+$/.test(value)) {
      if (!/^(?:[A-Fa-f0-9]{2})+$/.test(hex) || value.includes(':') && !/^[A-Fa-f0-9]{2}(?::[A-Fa-f0-9]{2})*$/.test(value)) fail();
      let at = 0; while (at < hex.length) { const size = parseInt(hex.slice(at, at + 2), 16); if (!size) fail(); at += 2 + size * 2; } if (at !== hex.length) fail();
    } else {
      hex = value.split(',').map(protocol => { if (!/^[\x21-\x7e]{1,255}$/.test(protocol)) fail(); return protocol.length.toString(16).padStart(2, '0') + Array.from(protocol, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(''); }).join('');
    }
    if (hex.length > 1024) fail(); return hex.toLowerCase();
  }
  fail();
}

export function applyNativeOverrides(fields, options) {
  const fail = () => { throw new Error('Node options failed: unsupported or invalid native override'); };
  const selected = ['udp', 'tfo', 'uot', 'cert', 'csha', 'psha', 'alpn', 'aead', 'host', 'obfs', 'tsession', 'checkurl', 'tls13'].filter(key => Object.prototype.hasOwnProperty.call(options, key));
  if (!selected.length) return fields;
  const values = {};
  for (const key of selected) {
    try { values[key] = nativeOptionValue(key, options[key]); } catch { fail(); }
  }
  const type = fields[0].split('=')[0].trim().toLowerCase();
  const map = new Map();
  fields.slice(1).forEach((field, index) => { const match = /^\s*([\w-]+)\s*=\s*(.*?)\s*$/.exec(field); if (match) map.set(match[1].toLowerCase(), { index: index + 1, value: match[2].startsWith('"') && match[2].endsWith('"') ? match[2].slice(1, -1).replace(/""/g, '"') : match[2] }); });
  const get = key => map.get(key)?.value;
  const put = (key, value) => { if (map.has(key)) fields[map.get(key).index] = ' ' + key + '=' + value; else { map.set(key, { index: fields.length, value }); fields.push(' ' + key + '=' + value); } map.get(key).value = value; };
  const tls = get('over-tls') === 'true' || ['over-tls', 'wss'].includes(get('obfs'));
  const reality = !!get('reality-base64-pubkey');
  if (selected.some(key => ['cert', 'csha', 'psha', 'alpn', 'tsession', 'tls13'].includes(key)) && !tls) fail();
  // QX ignores ALPN/session settings and cannot use TFO on Reality. An explicit
  // request for these settings must not be reported as an effective override.
  if (reality && (values.alpn || values.tsession !== undefined || values.tfo === '1')) fail();
  if (values.udp !== undefined) put('udp-relay', String(values.udp === '1'));
  if (values.tfo !== undefined) put('fast-open', String(values.tfo === '1'));
  if (values.aead !== undefined) { if (type !== 'vmess') fail(); put('aead', String(values.aead === '1')); }
  if (values.uot !== undefined) { if (type !== 'shadowsocks' || values.uot === '1' && /^2022-/.test(get('method') || '')) fail(); put('udp-over-tcp', values.uot === '0' ? 'false' : values.uot === '1' ? 'true' : values.uot); }
  if (values.cert !== undefined) put('tls-verification', values.cert);
  if ((values.csha || values.psha) && (get('tls-verification') === 'false' || reality)) fail();
  // Do not enable verification implicitly just because a pin was supplied.
  if (values.csha || values.psha) { if (get('tls-verification') === undefined) fail(); }
  if (values.csha && (values.psha || get('tls-pubkey-sha256'))) fail();
  if (values.csha) put('tls-cert-sha256', values.csha);
  if (values.psha) put('tls-pubkey-sha256', values.psha);
  if (values.alpn) put('tls-alpn', values.alpn);
  if (values.tsession === '0' || values.tsession === '2') put('tls-no-session-ticket', 'true');
  if (values.tsession === '1' || values.tsession === '2') put('tls-no-session-reuse', 'true');
  if (values.tls13 !== undefined) put('tls13', String(values.tls13 === '1'));
  if (values.checkurl) put('server_check_url', values.checkurl);
  if (values.host) {
    const append = values.host.endsWith('☠️'), host = append ? values.host.slice(0, -2) : values.host;
    const keys = ['obfs-host', 'tls-host'].filter(key => map.has(key));
    if (!keys.length) { if (!append) fail(); if (get('obfs')) keys.push('obfs-host'); else if (get('over-tls') === 'true') keys.push('tls-host'); else fail(); }
    for (const key of keys) put(key, host);
  }
  if (values.obfs) {
    if (get('obfs') !== 'http') fail();
    if (values.obfs === 'vhttp' && type === 'shadowsocks') put('obfs', 'vmess-http');
    else if (values.obfs === 'shttp' && type === 'vmess') put('obfs', 'shadowsocks-http'); else fail();
  }
  return fields;
}

// Full-declaration replace is explicit, but newly requested security fields
// still obey the same effectiveness checks as their dedicated hash options.
export function validateNativeReplacement(before, after) {
  const read = fields => {
    const values = new Map();
    for (const field of fields.slice(1)) {
      const match = /^\s*([\w-]+)\s*=\s*(.*?)\s*$/.exec(field); if (!match) continue;
      const raw = match[2], value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
      values.set(match[1].toLowerCase(), value);
    }
    return values;
  };
  const previous = read(before), current = read(after), options = {};
  const mapping = { 'udp-relay': 'udp', 'fast-open': 'tfo', 'udp-over-tcp': 'uot', 'aead': 'aead', 'tls-verification': 'cert', 'tls-cert-sha256': 'csha', 'tls-pubkey-sha256': 'psha', 'tls-alpn': 'alpn', 'tls13': 'tls13', 'server_check_url': 'checkurl' };
  for (const [field, option] of Object.entries(mapping)) {
    const value = current.get(field);
    if (value === undefined || value === previous.get(field)) continue;
    options[option] = ['udp', 'tfo', 'uot', 'aead', 'tls13'].includes(option) && ['true', 'false'].includes(value) ? value === 'true' ? '1' : '0' : value;
  }
  for (const field of ['tls-host', 'obfs-host']) if (current.has(field) && current.get(field) !== previous.get(field)) options.host = current.get(field);
  const ticket = current.has('tls-no-session-ticket') && current.get('tls-no-session-ticket') !== previous.get('tls-no-session-ticket');
  const reuse = current.has('tls-no-session-reuse') && current.get('tls-no-session-reuse') !== previous.get('tls-no-session-reuse');
  if (ticket || reuse) options.tsession = ticket && reuse ? '2' : ticket ? '0' : '1';
  applyNativeOverrides(after.slice(), options);
}
