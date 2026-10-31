import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

export const ruleTypes = ['domain', 'domain-suffix', 'domain-keyword', 'ip-cidr', 'ip-cidr6'];
export const stableId = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function domain(value) {
  // domainToASCII also accepts URL-host input and can discard path/query data.
  // Reject URL syntax before applying IDNA, so invalid upstream rules fail closed.
  if (/[\\/?:#%@\s\u0000-\u001f\u007f]/u.test(value)) throw new Error(`Invalid domain: ${value}`);
  const ascii = domainToASCII(value.replace(/\.$/, '')).toLowerCase();
  const labels = ascii.split('.');
  if (!ascii || ascii.length > 253 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error(`Invalid domain: ${value}`);
  }
  return ascii;
}

function ipNumber(address) {
  if (address.includes('%')) throw new Error('Scoped addresses are not portable rules');
  const family = isIP(address);
  if (family === 4) return { family, bits: 32, value: address.split('.').reduce((n, part) => (n << 8n) | BigInt(part), 0n) };
  if (family !== 6) throw new Error(`Invalid IP address: ${address}`);
  let text = address.toLowerCase();
  if (text.includes('.')) {
    const split = text.lastIndexOf(':');
    const v4 = ipNumber(text.slice(split + 1)).value;
    text = `${text.slice(0, split)}:${(v4 >> 16n).toString(16)}:${(v4 & 65535n).toString(16)}`;
  }
  const halves = text.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return { family, bits: 128, value: groups.reduce((n, group) => (n << 16n) | BigInt(`0x${group}`), 0n) };
}

function ipText(value, family) {
  if (family === 4) return [24n, 16n, 8n, 0n].map(shift => Number((value >> shift) & 255n)).join('.');
  const groups = Array.from({ length: 8 }, (_, i) => ((value >> BigInt((7 - i) * 16)) & 65535n).toString(16));
  return new URL(`http://[${groups.join(':')}]/`).hostname.slice(1, -1);
}

export function parseCidr(value, expectedFamily) {
  const parts = value.split('/');
  if (parts.length !== 2 || !/^(?:0|[1-9][0-9]*)$/.test(parts[1])) throw new Error(`Invalid CIDR: ${value}`);
  const address = ipNumber(parts[0]);
  const prefix = Number(parts[1]);
  if ((expectedFamily && address.family !== expectedFamily) || prefix > address.bits) throw new Error(`Invalid CIDR family or prefix: ${value}`);
  const hostBits = BigInt(address.bits - prefix);
  const network = (address.value >> hostBits) << hostBits;
  return { ...address, prefix, network, canonical: `${ipText(network, address.family)}/${prefix}` };
}

export function normalizeEntry(entry) {
  if (!entry || !ruleTypes.includes(entry.type) || typeof entry.value !== 'string' || !entry.value.trim()) {
    throw new Error(`Unsupported or invalid rule: ${JSON.stringify(entry)}`);
  }
  const value = entry.value.trim();
  if (entry.type === 'domain-keyword') {
    if (value.length > 253 || !/^[a-z0-9._-]+$/i.test(value)) throw new Error('Invalid domain keyword');
    return { type: entry.type, value: value.toLowerCase() };
  }
  return {
    type: entry.type,
    value: entry.type.startsWith('domain') ? domain(value) : parseCidr(value, entry.type === 'ip-cidr' ? 4 : 6).canonical
  };
}

export function normalizeRuleset(ruleset) {
  if (!ruleset || ruleset.version !== 1 || !stableId.test(ruleset.id) || !stableId.test(ruleset.category) || !Array.isArray(ruleset.entries) || ruleset.entries.length === 0) {
    throw new Error(`Invalid or empty ruleset: ${ruleset?.id}`);
  }
  const entries = new Map();
  for (const raw of ruleset.entries) {
    const entry = normalizeEntry(raw);
    entries.set(`${entry.type}:${entry.value}`, entry);
  }
  return { version: 1, id: ruleset.id, category: ruleset.category, entries: [...entries.values()].sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`, 'en')) };
}

export function matchesEntry(entry, { host, ip } = {}) {
  if (entry.type.startsWith('domain')) {
    if (!host) return false;
    const candidate = domain(host);
    if (entry.type === 'domain-keyword') return candidate.includes(entry.value);
    return candidate === entry.value || (entry.type === 'domain-suffix' && candidate.endsWith(`.${entry.value}`));
  }
  if (!ip) return false;
  const cidr = parseCidr(entry.value);
  const address = ipNumber(ip);
  return address.family === cidr.family && (address.value >> BigInt(cidr.bits - cidr.prefix)) === (cidr.network >> BigInt(cidr.bits - cidr.prefix));
}
