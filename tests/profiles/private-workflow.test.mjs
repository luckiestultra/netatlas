import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { parse as yaml } from 'yaml';
import { loadCatalog } from '../../tools/lib/build.mjs';
import { validateProfile } from '../../tools/lib/validation.mjs';
import { createPrivateProfile } from '../../tools/lib/private-profile.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const execute = promisify(execFile);
const formats = { quantumultX: 'conf', surge: 'conf', loon: 'conf', shadowrocket: 'conf', egern: 'yaml', stash: 'yaml', mihomo: 'yaml', singBox: 'json' };
const token = 'netatlas-fixture-private-token';
const password = 'netatlas-fixture-private-password';
const dnsUpstreams = { bootstrap: '223.6.6.6', domestic: 'https://223.6.6.6/dns-query', remote: 'https://9.9.9.9/dns-query', local: 'system' };
const nativeNode = (client, name, port = 18081) => {
  if (client === 'quantumultX') return `http=127.0.0.1:${port}, username=fixture, password=${password}, tag=${name}`;
  if (['surge', 'loon', 'shadowrocket'].includes(client)) return `${name} = http, 127.0.0.1, ${port}, username=fixture, password=${password}`;
  if (client === 'egern') return { http: { name, server: '127.0.0.1', port, username: 'fixture', password } };
  if (client === 'singBox') return { type: 'http', tag: name, server: '127.0.0.1', server_port: port, username: 'fixture', password };
  return { type: 'http', name, server: '127.0.0.1', port, username: 'fixture', password };
};

async function fixture(t, input, client = 'singBox') {
  await mkdir(path.join(root, 'private'), { recursive: true });
  const directory = await mkdtemp(path.join(root, 'private/acceptance-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inputFile = path.join(directory, 'input.json');
  const outputFile = path.join(directory, `output.${formats[client]}`);
  const bytes = `${JSON.stringify({ version: 1, ...input }, null, 2)}\n`;
  await writeFile(inputFile, bytes, { mode: 0o600 });
  return { directory, inputFile, outputFile, bytes, args: { root, client, inputFile, outputFile } };
}

async function origin(t, sources) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    const source = sources[new URL(request.url, 'http://fixture').pathname];
    if (!source) { response.writeHead(404).end('not found'); return; }
    response.writeHead(source.status ?? 200, { 'content-type': source.type ?? 'text/plain' });
    response.end(source.body);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { requests, url: file => `http://127.0.0.1:${server.address().port}${file}?token=${token}` };
}

function section(text, name) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === `[${name}]`);
  assert.notEqual(start, -1, `missing native section ${name}`);
  const end = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).map(line => line.trim()).filter(line => line && !/^[#;]/.test(line));
}

function parsedObject(client, text) {
  return client === 'singBox' ? JSON.parse(text) : ['egern', 'stash', 'mihomo'].includes(client) ? yaml(text) : undefined;
}

function selectedNode(client, text, config = parsedObject(client, text)) {
  if (client === 'singBox') {
    const selector = config.outbounds.find(item => item.tag === 'Proxy');
    assert.ok(selector.outbounds.includes(selector.default));
    return config.outbounds.find(item => item.tag === selector.default);
  }
  if (client === 'egern') {
    const proxy = config.policy_groups.find(item => item.select?.name === 'Proxy').select;
    return config.proxies.map(item => Object.values(item)[0]).find(item => item.name === proxy.policies[0]);
  }
  if (['stash', 'mihomo'].includes(client)) {
    const selector = config['proxy-groups'].find(item => item.name === 'Proxy');
    const selected = selector['default-selected'] ?? selector.proxies[0];
    assert.ok(selector.proxies.includes(selected));
    return config.proxies.find(item => item.name === selected);
  }
  const proxyLine = section(text, client === 'quantumultX' ? 'policy' : 'Proxy Group').find(line => client === 'quantumultX' ? /^static\s*=\s*Proxy,/.test(line) : /^Proxy\s*=/.test(line));
  assert.ok(proxyLine, 'the final Proxy policy must exist');
  const selected = proxyLine.split(',')[1].trim();
  const nodeLine = section(text, client === 'quantumultX' ? 'server_local' : 'Proxy').find(line => client === 'quantumultX'
    ? new RegExp(`(?:^|,)\\s*tag\\s*=\\s*${selected}(?:,|$)`).test(line)
    : line.split('=')[0].trim() === selected);
  return nodeLine;
}

async function verifyPrivateFile(f, result) {
  assert.equal(await readFile(f.inputFile, 'utf8'), f.bytes, 'generation must preserve the original private input');
  const stat = await lstat(f.outputFile);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(stat.mode & 0o777, 0o600, 'credentials must only be readable by their owner');
  assert.doesNotMatch(JSON.stringify(result), new RegExp(`${token}|${password}|127\\.0\\.0\\.1`), 'API metadata must not contain the private payload');
  return readFile(f.outputFile, 'utf8');
}

for (const client of Object.keys(formats)) {
  test(`${client}: private local workflow connects the explicitly selected real node and preserves canonical routing`, async t => {
    const f = await fixture(t, { nodes: [nativeNode(client, 'First-Node'), nativeNode(client, 'Selected-Node', 18082)], selectedProxy: 'Selected-Node', dnsUpstreams }, client);
    const result = await createPrivateProfile(f.args);
    const text = await verifyPrivateFile(f, result);
    const config = parsedObject(client, text);
    const chosen = selectedNode(client, text, config);
    assert.ok(chosen, 'Proxy must resolve to a supplied native protocol endpoint');
    if (typeof chosen === 'string') assert.match(chosen, /18082/);
    else {
      assert.equal(chosen.server, '127.0.0.1');
      assert.equal(chosen.port ?? chosen.server_port, 18082);
      assert.equal(chosen.password, password);
    }
    const { rulesets } = await loadCatalog(root);
    const check = validateProfile(client, text, rulesets);
    assert.ok(check.rules > 1000, 'full source routing must survive the private workflow');
    if (client === 'singBox') {
      const servers = new Map(config.dns.servers.map(server => [server.tag, server]));
      assert.equal(servers.get('bootstrap').server, '223.6.6.6');
      assert.equal(servers.get('remote').server, '9.9.9.9');
      assert.equal(servers.get('remote').detour, 'Proxy');
      assert.equal(config.route.default_domain_resolver, 'bootstrap');
    } else if (['stash', 'mihomo'].includes(client)) {
      assert.ok(config.dns['proxy-server-nameserver'].some(value => value.startsWith('223.6.6.6')));
      assert.ok(config.dns.nameserver.some(value => value.startsWith(dnsUpstreams.remote)));
      assert.ok(Object.values(config.dns['nameserver-policy']).some(value => Array.isArray(value) && value.some(server => server.startsWith(dnsUpstreams.domestic))));
      assert.equal(config.dns['nameserver-policy']['+.home.arpa'], 'system');
    } else if (client === 'egern') {
      assert.ok(config.dns.bootstrap.includes(dnsUpstreams.bootstrap));
      assert.deepEqual(config.dns.upstreams.domestic, [dnsUpstreams.domestic]);
      assert.deepEqual(config.dns.upstreams.remote, [dnsUpstreams.remote]);
    } else {
      const dns = section(text, client === 'quantumultX' ? 'dns' : 'General').join('\n');
      assert.ok(dns.includes(dnsUpstreams.bootstrap), 'the configured node bootstrap resolver must be active');
      assert.ok(dns.includes('223.6.6.6'), 'the supplied DNS configuration must reach the native file');
    }
  });
}

for (const client of ['mihomo', 'singBox']) {
  test(`${client}: isolated listener ports reach the native file without opening a LAN or system proxy`, async t => {
    const listenerPorts = client === 'singBox' ? { mixed: 18101 } : { mixed: 18101, dns: 18102 };
    const f = await fixture(t, { nodes: [nativeNode(client, 'Private-Node')], listenerPorts }, client);
    const text = await verifyPrivateFile(f, await createPrivateProfile(f.args));
    if (client === 'singBox') {
      const config = JSON.parse(text);
      assert.equal(config.inbounds[0].listen_port, 18101);
      assert.equal(config.inbounds[0].listen, '127.0.0.1');
      assert.equal(config.inbounds[0].set_system_proxy, false);
    } else {
      const config = yaml(text);
      assert.equal(config['mixed-port'], 18101);
      assert.equal(config.dns.listen, '127.0.0.1:18102');
      assert.equal(config['bind-address'], '127.0.0.1');
      assert.equal(config['allow-lan'], false);
    }
  });

  test(`${client}: malformed listener ports and host overrides cannot replace a last good profile`, async t => {
    const f = await fixture(t, {}, client);
    const unsupported = client === 'singBox' ? [{ mixed: 18101, dns: 18102 }] : [];
    for (const listenerPorts of [{ mixed: 0 }, { mixed: 65536 }, { mixed: '18101' }, { mixed: 18101.5 }, { dns: 0 }, { mixed: 18101, host: '0.0.0.0' }, { 'bind-address': '0.0.0.0' }, ...unsupported]) {
      await writeFile(f.inputFile, JSON.stringify({ version: 1, nodes: [nativeNode(client, 'Private-Node')], listenerPorts }), { mode: 0o600 });
      await writeFile(f.outputFile, 'last-good-profile\n', { mode: 0o600 });
      await assert.rejects(() => createPrivateProfile(f.args), /port|listener|option|native|render/i);
      assert.equal(await readFile(f.outputFile, 'utf8'), 'last-good-profile\n');
    }
  });
}

for (const client of ['quantumultX', 'surge', 'loon', 'egern', 'stash', 'mihomo']) {
  test(`${client}: native subscription URL is attached to Proxy using its own schema (structural acceptance)`, async t => {
    const source = await origin(t, { '/native': { body: 'a native source fetched later by the client' } });
    const url = source.url('/native');
    const f = await fixture(t, { subscriptions: [{ name: 'Fixture-Source', url, interval: 1234 }] }, client);
    const result = await createPrivateProfile(f.args);
    const text = await verifyPrivateFile(f, result);
    assert.deepEqual(source.requests, [], 'native source fetching belongs to the client, not this compiler');
    if (client === 'quantumultX') {
      assert.ok(section(text, 'server_remote').some(line => line.startsWith(`${url},`) && /tag=Fixture-Source/.test(line)));
      assert.ok(section(text, 'policy').some(line => /^static=Proxy,/.test(line) && /(?:server|resource)-tag-regex=/.test(line)));
    } else if (client === 'surge') {
      const groups = section(text, 'Proxy Group');
      const sourceGroup = groups.find(line => line.startsWith('Fixture-Source ='));
      assert.ok(sourceGroup?.includes(`policy-path=${url}`));
      assert.ok(groups.find(line => line.startsWith('Proxy ='))?.split(',').map(value => value.trim()).includes('Fixture-Source'));
    } else if (client === 'loon') {
      assert.ok(section(text, 'Remote Proxy').includes(`Fixture-Source = ${url}`));
      assert.ok(section(text, 'Proxy Group').find(line => line.startsWith('Proxy ='))?.split(',').map(value => value.trim()).includes('Fixture-Source'));
    } else if (client === 'egern') {
      const config = yaml(text);
      const proxy = config.policy_groups.find(item => item.select?.name === 'Proxy').select;
      assert.deepEqual(proxy.urls, [url]);
      assert.equal(proxy.update_interval, 1234);
      assert.equal(config['proxy-providers'], undefined, 'Egern is not a Clash document');
    } else {
      const config = yaml(text);
      const proxy = config['proxy-groups'].find(item => item.name === 'Proxy');
      assert.ok(proxy.use.includes('Fixture-Source'));
      assert.equal(config['proxy-providers']['Fixture-Source'].url, url);
      assert.equal(config['proxy-providers']['Fixture-Source'].interval, 1234);
    }
  });
}

for (const client of ['shadowrocket', 'singBox']) {
  test(`${client}: a real loopback subscription is materialized into a selectable protocol endpoint`, async t => {
    const node = nativeNode(client, 'Remote-Node', 18083);
    const body = client === 'singBox' ? JSON.stringify({ outbounds: [node] }) : `${node}\n`;
    const source = await origin(t, { '/native': { body } });
    const f = await fixture(t, { subscriptions: [{ name: 'Fixture-Source', url: source.url('/native') }], selectedProxy: 'Remote-Node' }, client);
    const text = await verifyPrivateFile(f, await createPrivateProfile(f.args));
    assert.equal(source.requests.length, 1, 'the local importer must really fetch the native source');
    const chosen = selectedNode(client, text);
    assert.ok(chosen);
    if (typeof chosen === 'string') assert.match(chosen, /18083/);
    else assert.equal(chosen.server_port, 18083);
    assert.doesNotMatch(text, new RegExp(token), 'materialized sources must not leave a refresh URL in unsupported client syntax');
  });
}

test('sing-box imports real Clash YAML and base64 URI subscriptions without losing protocol credentials', async t => {
  const uuid = '7c9a3d20-44b0-493e-90d2-9b219674d04c';
  const vmess = Buffer.from(JSON.stringify({ v: '2', ps: 'VMess-Node', add: '127.0.0.1', port: '18443', id: uuid, aid: '0', scy: 'auto', net: 'tcp', tls: 'tls', sni: 'edge.fixture.test' })).toString('base64');
  const uris = [
    `vless://${uuid}@127.0.0.1:18443?security=tls&sni=edge.fixture.test#VLESS-Node`,
    `trojan://${password}@127.0.0.1:18443?security=tls&sni=edge.fixture.test#Trojan-Node`,
    `ss://${Buffer.from(`aes-128-gcm:${password}`).toString('base64url')}@127.0.0.1:18388#SS-Node`,
    `vmess://${vmess}`,
  ].join('\n');
  const source = await origin(t, {
    '/clash.yaml': { body: 'proxies:\n  - name: Clash-SOCKS\n    type: socks5\n    server: 127.0.0.1\n    port: 18084\n    username: fixture\n    password: fixture-password\n' },
    '/uris': { body: Buffer.from(uris).toString('base64') },
  });
  const f = await fixture(t, { subscriptions: [{ name: 'Clash', url: source.url('/clash.yaml') }, { name: 'URI', url: source.url('/uris') }], selectedProxy: 'Trojan-Node' });
  const config = JSON.parse(await verifyPrivateFile(f, await createPrivateProfile(f.args)));
  assert.equal(source.requests.length, 2);
  const byTag = new Map(config.outbounds.map(node => [node.tag, node]));
  const proxy = byTag.get('Proxy');
  assert.equal(proxy.default, 'Trojan-Node');
  for (const name of ['Clash-SOCKS', 'VLESS-Node', 'Trojan-Node', 'SS-Node', 'VMess-Node']) assert.ok(proxy.outbounds.includes(name), `${name} must be reachable from Proxy`);
  assert.equal(byTag.get('Clash-SOCKS').type, 'socks');
  assert.equal(byTag.get('Clash-SOCKS').server_port, 18084);
  assert.equal(byTag.get('Clash-SOCKS').password, 'fixture-password');
  assert.equal(byTag.get('VLESS-Node').uuid, uuid);
  assert.equal(byTag.get('Trojan-Node').password, password);
  assert.equal(byTag.get('SS-Node').method, 'aes-128-gcm');
  assert.equal(byTag.get('SS-Node').password, password);
  assert.equal(byTag.get('VMess-Node').uuid, uuid);
});

for (const client of ['shadowrocket', 'singBox']) {
  for (const source of [{ name: 'empty', status: 200, body: '' }, { name: 'empty-native-collection', status: 200, body: '{"nodes":[],"outbounds":[]}' }, { name: 'malformed', status: 200, body: `<html>${password}</html>` }, { name: 'http-error', status: 503, body: password }]) {
    test(`${client}: ${source.name} subscription fails without replacing the last good private profile or exposing secrets`, async t => {
      const server = await origin(t, { '/source': source });
      const f = await fixture(t, { subscriptions: [{ name: 'Private', url: server.url('/source') }] }, client);
      await writeFile(f.outputFile, 'last-known-good-profile\n', { mode: 0o600 });
      let failure;
      try { await createPrivateProfile(f.args); } catch (error) { failure = error; }
      assert.ok(failure, 'invalid source must not silently create an empty Proxy');
      assert.doesNotMatch(String(failure.message), new RegExp(`${token}|${password}`));
      assert.equal(await readFile(f.outputFile, 'utf8'), 'last-known-good-profile\n');
      assert.equal(await readFile(f.inputFile, 'utf8'), f.bytes);
      assert.deepEqual((await readdir(f.directory)).sort(), [path.basename(f.inputFile), path.basename(f.outputFile)].sort(), 'failed attempts must remove temporary credential files');
    });
  }
}

test('private workflow rejects output traversal, input overwrite, symlinks and hardlinked input without changing existing bytes', async t => {
  const f = await fixture(t, { nodes: [nativeNode('singBox', 'Private-Node')] });
  const outside = path.join(root, `private-neighbor-${path.basename(f.directory)}`);
  t.after(() => rm(outside, { force: true }));
  await assert.rejects(() => createPrivateProfile({ ...f.args, outputFile: outside }), /private|output|path/i);
  await assert.rejects(() => createPrivateProfile({ ...f.args, outputFile: f.inputFile }), /input|output|same|overwrite/i);
  assert.equal(await readFile(f.inputFile, 'utf8'), f.bytes);
  const original = path.join(f.directory, 'original');
  await writeFile(original, 'original-sentinel\n', { mode: 0o600 });
  const fileLink = path.join(f.directory, 'file-link.json');
  await symlink(original, fileLink);
  await assert.rejects(() => createPrivateProfile({ ...f.args, outputFile: fileLink }), /symlink|symbolic|path|output/i);
  const directoryLink = path.join(f.directory, 'directory-link');
  await symlink(f.directory, directoryLink);
  await assert.rejects(() => createPrivateProfile({ ...f.args, outputFile: path.join(directoryLink, 'escaped.json') }), /symlink|symbolic|path|output/i);
  const hardlink = path.join(f.directory, 'hardlink.json');
  await link(f.inputFile, hardlink);
  await assert.rejects(() => createPrivateProfile({ ...f.args, outputFile: hardlink }), /input|link|same|overwrite/i);
  assert.equal(await readFile(f.inputFile, 'utf8'), f.bytes);
  assert.equal(await readFile(original, 'utf8'), 'original-sentinel\n');
  assert.ok((await lstat(fileLink)).isSymbolicLink());
});

test('private workflow tightens an existing output to mode 0600 and accepts root-relative private paths', async t => {
  const f = await fixture(t, { nodes: [nativeNode('singBox', 'Private-Node')] });
  await writeFile(f.outputFile, 'old-public-mode');
  await chmod(f.outputFile, 0o644);
  const args = { ...f.args, inputFile: path.relative(root, f.inputFile), outputFile: path.relative(root, f.outputFile) };
  const result = await createPrivateProfile(args);
  const text = await verifyPrivateFile(f, result);
  assert.equal(selectedNode('singBox', text).tag, 'Private-Node');
});

for (const changed of ['input', 'output']) {
  test(`private workflow preserves a user ${changed} edit made while a subscription is loading`, async t => {
    const f = await fixture(t, { subscriptions: [{ name: 'Private', url: `https://subscription.fixture.test/nodes?token=${token}` }] });
    await writeFile(f.outputFile, 'last-good-profile\n', { mode: 0o600 });
    const fetchText = async () => {
      await writeFile(changed === 'input' ? f.inputFile : f.outputFile, 'new-user-edited-bytes\n', { mode: 0o600 });
      return JSON.stringify({ outbounds: [nativeNode('singBox', 'Remote-Node')] });
    };
    await assert.rejects(() => createPrivateProfile({ ...f.args, fetchText }), /changed|concurrent|modified/i);
    assert.equal(await readFile(f.inputFile, 'utf8'), changed === 'input' ? 'new-user-edited-bytes\n' : f.bytes);
    assert.equal(await readFile(f.outputFile, 'utf8'), changed === 'output' ? 'new-user-edited-bytes\n' : 'last-good-profile\n');
    assert.deepEqual((await readdir(f.directory)).sort(), ['input.json', 'output.json']);
  });
}

test('an HTML login page cannot replace a usable profile when one of multiple subscribed sources fails', async t => {
  const source = await origin(t, {
    '/valid': { body: JSON.stringify({ outbounds: [nativeNode('singBox', 'Remote-Node')] }) },
    '/expired': { body: '<!doctype html><html><body>Login required</body></html>' },
  });
  const f = await fixture(t, { subscriptions: [{ name: 'Good', url: source.url('/valid') }, { name: 'Expired', url: source.url('/expired') }] });
  await writeFile(f.outputFile, 'last-good-profile\n', { mode: 0o600 });
  await assert.rejects(() => createPrivateProfile(f.args));
  assert.equal(source.requests.length, 2);
  assert.equal(await readFile(f.outputFile, 'utf8'), 'last-good-profile\n', 'partial imports must not silently remove previously configured endpoints');
});

test('private workflow rejects invalid private input without echoing its payload or changing a published template', async t => {
  const f = await fixture(t, {});
  const published = path.join(root, 'clients/singBox/profiles/default.json');
  const publicBytes = await readFile(published);
  const payloads = [
    `{\"version\":1,\"password\":\"${password}\",`,
    JSON.stringify({ version: 2, nodes: [nativeNode('singBox', 'Private-Node')] }),
    JSON.stringify({ version: 1, nodes: 'not-an-array' }),
    JSON.stringify({ version: 1, subscriptions: [{ name: 'Unsafe', url: `http://remote.fixture.test/sub?token=${token}` }] }),
    JSON.stringify({ version: 1, nodes: [nativeNode('singBox', 'Private-Node')], selectedProxy: password }),
  ];
  for (const payload of payloads) {
    await writeFile(f.inputFile, payload, { mode: 0o600 });
    await writeFile(f.outputFile, 'last-good-profile\n', { mode: 0o600 });
    let failure;
    try { await createPrivateProfile(f.args); } catch (error) { failure = error; }
    assert.ok(failure, 'the invalid input must be reported');
    assert.doesNotMatch(String(failure.message), new RegExp(`${token}|${password}`));
    assert.equal(await readFile(f.inputFile, 'utf8'), payload);
    assert.equal(await readFile(f.outputFile, 'utf8'), 'last-good-profile\n');
  }
  assert.deepEqual(await readFile(published), publicBytes);
});

test('the real local profile CLI writes a usable native file and keeps private material out of its diagnostics', async t => {
  const f = await fixture(t, { nodes: [nativeNode('singBox', 'CLI-Node')] });
  const { stdout, stderr } = await execute(process.execPath, [path.join(root, 'tools/profile.mjs'), '--client', 'singBox', '--input', path.relative(root, f.inputFile), '--output', path.relative(root, f.outputFile)], { cwd: root, timeout: 30_000 });
  assert.equal(stderr, '');
  assert.doesNotMatch(stdout, new RegExp(`${token}|${password}|127\\.0\\.0\\.1`));
  const text = await verifyPrivateFile(f, { client: 'singBox' });
  assert.equal(selectedNode('singBox', text).tag, 'CLI-Node');
  await writeFile(f.inputFile, JSON.stringify({ version: 1, nodes: [nativeNode('singBox', 'CLI-Node')], selectedProxy: password }), { mode: 0o600 });
  let failure;
  try {
    await execute(process.execPath, [path.join(root, 'tools/profile.mjs'), '--client', 'singBox', '--input', f.inputFile, '--output', f.outputFile], { cwd: root, timeout: 30_000 });
  } catch (error) { failure = error; }
  assert.equal(failure?.code, 1);
  assert.doesNotMatch(`${failure.stdout}${failure.stderr}`, new RegExp(`${token}|${password}`));
  assert.equal(await readFile(f.outputFile, 'utf8'), text, 'CLI errors must retain the last usable profile');
});

for (const client of Object.keys(formats)) {
  test(`${client}: private node input cannot smuggle task or script sections into a profile`, async t => {
    let node;
    if (client === 'quantumultX') node = `http=127.0.0.1:18081, tag=Injected\n[task_local]\n0 * * * * script-path=https://fixture.test/remote.js`;
    else if (['surge', 'loon', 'shadowrocket'].includes(client)) node = 'Injected = script, https://fixture.test/remote.js';
    else if (client === 'egern') node = { script: { name: 'Injected', server: '127.0.0.1', port: 18081, path: 'https://fixture.test/remote.js' } };
    else if (client === 'singBox') node = { type: 'selector', tag: 'Injected', server: '127.0.0.1', server_port: 18081, outbounds: ['DIRECT'] };
    else node = { type: 'script', name: 'Injected', server: '127.0.0.1', port: 18081, script: 'https://fixture.test/remote.js' };
    const f = await fixture(t, { nodes: [node] }, client);
    await writeFile(f.outputFile, 'last-good-profile\n', { mode: 0o600 });
    await assert.rejects(() => createPrivateProfile(f.args), /node|native|protocol|render|invalid/i);
    assert.equal(await readFile(f.outputFile, 'utf8'), 'last-good-profile\n');
  });

  test(`${client}: a named HTTP endpoint with an invalid port fails before output replacement`, async t => {
    const f = await fixture(t, { nodes: [nativeNode(client, 'Invalid-Port', 99999)] }, client);
    await writeFile(f.outputFile, 'last-good-profile\n', { mode: 0o600 });
    await assert.rejects(() => createPrivateProfile(f.args), /node|native|port|render|invalid/i);
    assert.equal(await readFile(f.outputFile, 'utf8'), 'last-good-profile\n');
  });
}
