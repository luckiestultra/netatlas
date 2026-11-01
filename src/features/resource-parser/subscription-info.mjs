// Original, opt-in quota notices. Never include a subscription URL, tag,
// credentials or arbitrary header/node text in a notification.
export function subscriptionNotification(resource, nativeNodes) {
  const date = seconds => {
    if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 253402300799) return '';
    return new Date(seconds * 1000).toISOString().slice(0, 10);
  };
  const header = resource.info;
  if (typeof header === 'string' && header.length <= 8192 && !/[\x00-\x1f\x7f]/.test(header)) {
    const values = Object.create(null);
    let valid = true;
    for (const part of header.split(/[;,]/)) {
      const match = /^\s*(upload|download|total|expire)\s*=\s*(.*?)\s*$/i.exec(part);
      if (!match) continue;
      const key = match[1].toLowerCase();
      if (Object.prototype.hasOwnProperty.call(values, key) || !/^\d+$/.test(match[2]) || !Number.isSafeInteger(Number(match[2]))) { valid = false; break; }
      values[key] = Number(match[2]);
    }
    const used = (values.upload ?? 0) + values.download;
    if (valid && Number.isSafeInteger(values.total) && Number.isSafeInteger(used)) {
      const gib = bytes => (bytes / 1073741824).toFixed(2) + ' GiB';
      const expiry = date(values.expire);
      return { title: '订阅流量信息', subtitle: expiry ? '到期日期: ' + expiry + ' (UTC)' : '',
        message: '总量: ' + gib(values.total) + '\n已用: ' + gib(used) + '\n剩余: ' + gib(values.total - used) };
    }
  }
  // Read quota pseudo-nodes before out filtering. Only bounded numeric quota
  // and valid calendar dates survive; arbitrary node labels are never echoed.
  let remaining = '', expiry = '';
  for (const line of nativeNodes.split('\n')) {
    const match = /(?:^|,)\s*tag\s*=\s*("(?:[^"]|"")*"|[^,]*)/.exec(line);
    if (!match) continue;
    const name = match[1].replace(/^"|"$/g, '').replace(/""/g, '"');
    const quota = /剩余流量\s*[:：]?\s*(\d{1,12}(?:\.\d{1,6})?)\s*(GiB|MiB|TiB|KiB|GB|MB|TB|KB|B)(?=$|[^A-Za-z])/i.exec(name);
    if (quota) remaining = quota[1] + ' ' + quota[2];
    const end = /到期时间\s*[:：]?\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/.exec(name);
    if (end) {
      const year = Number(end[1]), month = Number(end[2]), day = Number(end[3]);
      const utc = new Date(Date.UTC(year, month - 1, day));
      if (year >= 100 && utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day) expiry = utc.toISOString().slice(0, 10);
    }
  }
  if (!remaining && !expiry) return null;
  return { title: '订阅流量信息', subtitle: expiry ? '到期日期: ' + expiry : '', message: remaining ? '剩余流量: ' + remaining : '' };
}
