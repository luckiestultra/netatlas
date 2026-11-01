import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { renderManagedProfile } from '../../tools/lib/managed-profiles.mjs';
import { createPrivateProfile } from '../../tools/lib/private-profile.mjs';
import { renderProfile } from '../../tools/lib/profiles.mjs';
import { normalizeRuleset } from '../../tools/lib/rules.mjs';

const lan = normalizeRuleset({ version: 1, id: 'lan', category: 'network', entries: [
  { type: 'domain-suffix', value: 'home.arpa' },
  { type: 'domain-suffix', value: 'local' },
  { type: 'domain-suffix', value: 'localhost' },
] });
const rulesets = [lan];
const localNames = ['home.arpa', 'nas.home.arpa', 'localhost', 'app.localhost', 'local', 'printer.local', 'lan', 'router.lan'];

// This checks the generated native contract, not a running Surge app. Once
// encrypted-dns-server is set, dns-server=system only provides bootstrap DNS.
// The native [Host] server: mapping must explicitly preserve LAN resolution.
// https://manual.nssurge.com/dns/encrypted-dns.html
// https://manual.nssurge.com/dns/local-dns-mapping.html
function hostDns(text, hostname) {
  const host = text.split('[Host]\n')[1]?.split(/^\[/m)[0] ?? '';
  for (const line of host.split('\n')) {
    const match = /^([^=]+?)\s*=\s*server:(.+)$/.exec(line.trim());
    if (!match) continue;
    const pattern = match[1].trim();
    if (pattern === hostname || pattern.startsWith('*.') && hostname.endsWith(pattern.slice(1))) return match[2].trim();
  }
}

function assertLocalDns(text, expected) {
  assert.match(text, /^encrypted-dns-server = https:\/\/dns\.alidns\.com\/dns-query$/m);
  for (const name of localNames) assert.equal(hostDns(text, name), expected, `${name} must use local DNS despite global encrypted DNS`);
  for (const name of ['example.com', 'nothome.arpa', 'nas.home.arpa.example']) assert.equal(hostDns(text, name), undefined, `${name} must keep ordinary DNS handling`);
}

for (const [kind, render] of [['App default', renderManagedProfile], ['standalone', renderProfile]]) {
  test(`Surge ${kind} preserves system LAN DNS with global encrypted DNS enabled`, () => {
    assertLocalDns(render('surge', { rulesets }).content, 'system');
  });
  test(`Surge ${kind} binds LAN DNS to the supplied local resolver only`, () => {
    for (const local of ['127.0.0.1:1053', ['127.0.0.1:1053', '192.0.2.53']]) {
      const profile = render('surge', { rulesets, dnsUpstreams: { local } });
      assertLocalDns(profile.content, [local].flat().join(','));
    }
  });
}

test('Surge private generation preserves LAN DNS without accessing a client or subscription', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'netatlas-surge-lan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'metadata'));
  await mkdir(path.join(root, 'src/rules/network'), { recursive: true });
  await mkdir(path.join(root, 'private'));
  const catalog = JSON.stringify(lan, null, 2) + '\n';
  await writeFile(path.join(root, 'src/rules/network/lan.json'), catalog);
  await writeFile(path.join(root, 'metadata/upstreams.json'), JSON.stringify({ version: 1, rulesets: [{
    id: 'lan', category: 'network', entryCount: lan.entries.length,
    outputSha256: createHash('sha256').update(catalog).digest('hex'),
    source: { type: 'local', license: 'MIT', references: ['https://example.invalid/synthetic-lan-fixture'] },
  }] }));
  const inputFile = path.join(root, 'private/input.json');
  const outputFile = path.join(root, 'private/output.conf');
  await writeFile(inputFile, JSON.stringify({ version: 1,
    nodes: ['Synthetic-Node = http, 127.0.0.1, 18080'],
    dnsUpstreams: { local: '127.0.0.1:1053' },
  }));
  await createPrivateProfile({ root, client: 'surge', inputFile, outputFile });
  const generated = await readFile(outputFile, 'utf8');
  assert.match(generated, /^Proxy = select, Synthetic-Node,/m);
  assertLocalDns(generated, '127.0.0.1:1053');
});
