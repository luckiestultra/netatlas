import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadCatalog } from './build.mjs';
import { renderRuleset } from './exporters.mjs';
import { renderManagedProfile, managedModel } from './managed-profiles.mjs';
import { waitForMihomoRunning } from './native.mjs';
import { assertManagedPaths } from './managed-paths.mjs';

const execute = promisify(execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const nodeHost = 'chat.openai.com';
const publicFixtureAddress = '198.51.100.23';
const cases = [
  { host: '127.0.0.1', permitted: true, proxied: false, behavior: 'lan-ip' },
  { host: 'managed.home.arpa', permitted: true, proxied: false, dnsRole: 'local', behavior: 'lan-name' },
  { host: 'www.baidu.com', permitted: true, proxied: false, dnsRole: 'domestic', behavior: 'domestic-domain' },
  { host: 'www.apple.com', permitted: true, proxied: false, dnsRole: 'domestic', behavior: 'apple-direct' },
  { host: 'chatgpt.com', permitted: true, proxied: true, dnsRole: 'remote', behavior: 'ai-service' },
  { host: 'www.google.cn', permitted: true, proxied: true, dnsRole: 'remote', behavior: 'specific-before-cn' },
  { host: 'managed-unmatched.example', permitted: true, proxied: true, dnsRole: 'remote', behavior: 'fallback-proxy' },
  { host: 'doubleclick.net', permitted: false, proxied: false, behavior: 'ad-reject' },
];
const updateHost = 'managed-refresh.example';
const allowedHosts = new Set([nodeHost, updateHost, ...cases.map(item => item.host)]);

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
async function freePort() {
  const server = net.createServer(); const port = await listen(server);
  await new Promise(resolve => server.close(resolve)); return port;
}
function track(server, sockets) {
  server.on('connection', socket => {
    sockets.add(socket); socket.on('error', () => {});
    socket.once('close', () => sockets.delete(socket));
  });
  return server;
}

function dnsQuestion(host) {
  return Buffer.concat([
    Buffer.from([0x12, 0x34, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]),
    ...host.split('.').map(label => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])),
    Buffer.from([0, 0, 1, 0, 1]),
  ]);
}
async function dnsFixture(role, evidence, sockets) {
  const server = track(net.createServer(socket => {
    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2 && buffer.length >= 2 + buffer.readUInt16BE(0)) {
        const size = buffer.readUInt16BE(0), query = buffer.subarray(2, size + 2);
        buffer = buffer.subarray(size + 2);
        if (query.length < 17 || query.readUInt16BE(4) !== 1) return socket.destroy();
        let offset = 12; const labels = [];
        while (offset < query.length && query[offset]) {
          const size = query[offset];
          if (size > 63 || offset + size >= query.length) return socket.destroy();
          labels.push(query.subarray(offset + 1, offset + size + 1).toString('ascii').toLowerCase()); offset += size + 1;
        }
        if (offset + 5 > query.length) return socket.destroy();
        const host = labels.join('.'), type = query.readUInt16BE(offset + 1);
        // Unknown names receive NXDOMAIN; no fallback to public DNS is provided.
        const known = allowedHosts.has(host);
        evidence.push({ role, host, type, answered: known && type === 1 });
        const header = Buffer.alloc(12); query.copy(header, 0, 0, 2);
        header.writeUInt16BE(known ? 0x8180 : 0x8183, 2); header.writeUInt16BE(1, 4);
        header.writeUInt16BE(known && type === 1 ? 1 : 0, 6);
        const address = role === 'remote' ? [198, 51, 100, 23] : [127, 0, 0, 1];
        const answer = known && type === 1 ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 1, 0, 4, ...address]) : Buffer.alloc(0);
        const result = Buffer.concat([header, query.subarray(12, offset + 5), answer]);
        const length = Buffer.alloc(2); length.writeUInt16BE(result.length); socket.write(Buffer.concat([length, result]));
      }
    });
  }), sockets);
  return { server, port: await listen(server) };
}

async function socksFixture(targetPort, remoteDnsPort, evidence, sockets) {
  const server = track(net.createServer(socket => {
    let buffer = Buffer.alloc(0), state = 'greeting';
    socket.setTimeout(5000, () => socket.destroy());
    const parse = chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (state === 'greeting') {
        if (buffer.length < 2 || buffer.length < 2 + buffer[1]) return;
        if (buffer[0] !== 5 || !buffer.subarray(2, 2 + buffer[1]).includes(0)) return socket.destroy();
        buffer = buffer.subarray(2 + buffer[1]); socket.write(Buffer.from([5, 0])); state = 'connect';
      }
      if (state !== 'connect' || buffer.length < 5) return;
      const type = buffer[3], size = type === 1 ? 10 : type === 4 ? 22 : type === 3 ? 7 + buffer[4] : 0;
      if (!size || buffer.length < size) return;
      const host = type === 1 ? [...buffer.subarray(4, 8)].join('.') : type === 3 ? buffer.subarray(5, 5 + buffer[4]).toString('ascii') : '';
      const port = buffer.readUInt16BE(size - 2);
      const permitted = [targetPort, remoteDnsPort].includes(port) && (host === '127.0.0.1' || host === publicFixtureAddress || allowedHosts.has(host));
      if (!permitted || buffer[0] !== 5 || buffer[1] !== 1) return socket.end(Buffer.from([5, 2, 0, 1, 127, 0, 0, 1, 0, 0]));
      const tail = buffer.subarray(size); state = 'connected';
      // Only the allowlisted documentation IP/fixture names map to this loopback service.
      const upstream = net.createConnection({ host: '127.0.0.1', port }); sockets.add(upstream);
      upstream.on('error', () => socket.destroy()); upstream.once('close', () => { sockets.delete(upstream); socket.destroy(); });
      socket.once('close', () => upstream.destroy());
      upstream.once('connect', () => {
        evidence.push({ host, port, kind: port === targetPort ? 'http' : 'remote-dns' });
        socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0])); socket.removeListener('data', parse);
        if (tail.length) upstream.write(tail); socket.pipe(upstream); upstream.pipe(socket);
      });
    };
    socket.on('data', parse);
  }), sockets);
  return { server, port: await listen(server) };
}

function httpRequest(proxyPort, host, targetPort) {
  return new Promise(resolve => {
    const request = http.request({ hostname: '127.0.0.1', port: proxyPort, path: `http://${host}:${targetPort}/workflow-http`, headers: { Host: `${host}:${targetPort}`, Connection: 'close' }, agent: false }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', error => resolve({ error: error.code || error.message }));
    });
    request.setTimeout(5000, () => request.destroy(new Error('Local workflow HTTP timed out')));
    request.on('error', error => resolve({ error: error.code || error.message })); request.end();
  });
}
function socksRequest(proxyPort, host, targetPort) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: proxyPort });
    let buffer = Buffer.alloc(0), state = 'greeting', done = false;
    const finish = result => { if (done) return; done = true; socket.destroy(); resolve(result); };
    socket.setTimeout(5000, () => finish({ error: 'Local workflow SOCKS timed out' }));
    socket.on('error', error => finish({ error: error.code || error.message }));
    socket.once('connect', () => socket.write(Buffer.from([5, 1, 0])));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (state === 'greeting' && buffer.length >= 2) {
        if (buffer[0] !== 5 || buffer[1] !== 0) return finish({ error: 'SOCKS authentication rejected' });
        buffer = buffer.subarray(2); const name = Buffer.from(host);
        socket.write(Buffer.concat([Buffer.from([5, 1, 0, 3, name.length]), name, Buffer.from([targetPort >> 8, targetPort & 255])])); state = 'connect';
      }
      if (state === 'connect' && buffer.length >= 5) {
        if (buffer[1] !== 0) return finish({ error: `SOCKS connect rejected (${buffer[1]})` });
        const size = buffer[3] === 1 ? 10 : buffer[3] === 4 ? 22 : buffer[3] === 3 ? 7 + buffer[4] : 0;
        if (!size || buffer.length < size) return;
        buffer = buffer.subarray(size); state = 'http';
        socket.write(`GET /workflow-socks HTTP/1.1\r\nHost: ${host}:${targetPort}\r\nConnection: close\r\n\r\n`);
      }
    });
    socket.once('end', () => finish(state === 'http' ? { body: buffer.toString('utf8') } : { error: 'SOCKS closed before request' }));
    socket.once('close', () => { if (!done) finish({ error: 'SOCKS connection closed' }); });
  });
}
function queryDns(port, host) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let buffer = Buffer.alloc(0); socket.once('error', reject);
    socket.setTimeout(5000, () => socket.destroy(new Error('Local workflow DNS timed out')));
    const query = dnsQuestion(host), length = Buffer.alloc(2); length.writeUInt16BE(query.length);
    socket.once('connect', () => socket.write(Buffer.concat([length, query])));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= 2 && buffer.length >= 2 + buffer.readUInt16BE(0)) { socket.destroy(); resolve(); }
    });
  });
}
async function portReady(child, port) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.startupError) throw new Error('Native workflow process exited before listener readiness');
    const ready = await new Promise(resolve => {
      const socket = net.createConnection({ host: '127.0.0.1', port }); const done = value => { socket.destroy(); resolve(value); };
      socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(100, () => done(false));
    });
    if (ready) return; await pause(25);
  }
  throw new Error('Native workflow listener readiness timed out');
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000); timer.unref(); await closed; clearTimeout(timer);
}

async function controller(port, secret, method, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method, headers: { Authorization: `Bearer ${secret}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000),
  });
  assert.ok(response.ok, `Native managed controller ${method} ${route}: ${response.status}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}

async function until(predicate, message) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) { if (await predicate()) return; await pause(30); }
  throw new Error(message);
}

function nativeNode(client, name, port) {
  return client === 'mihomo' ? { name, type: 'socks5', server: nodeHost, port, udp: false }
    : { tag: name, type: 'socks', server: nodeHost, server_port: port, version: '5' };
}

export async function runManagedProfileVerification({ root, binaries, onProgress = () => {} }) {
  await assertManagedPaths(root, ['.cache/managed-workflow']);
  const catalog = await loadCatalog(root);
  await mkdir(path.join(root, '.cache/managed-workflow'), { recursive: true });
  const directory = await mkdtemp(path.join(root, '.cache/managed-workflow/run-'));
  const sockets = new Set(), dnsQuestions = [], upstreamConnections = [], targetEvidence = [], downloads = [], resultCases = [], profiles = [], updates = [], publicTunChecks = [];
  const token = randomUUID();
  const target = track(http.createServer((request, response) => {
    targetEvidence.push({ host: request.headers.host, path: request.url });
    response.writeHead(200, { 'Content-Type': 'text/plain', Connection: 'close' }); response.end(token);
  }), sockets);
  const targetPort = await listen(target), dns = {}, sourceState = { rejectUpdate: false, subscription: 'JP-A' };
  let upstream, resourceServer;
  try {
    for (const role of ['bootstrap', 'domestic', 'remote', 'local']) dns[role] = await dnsFixture(role, dnsQuestions, sockets);
    upstream = await socksFixture(targetPort, dns.remote.port, upstreamConnections, sockets);
    const resources = new Map();
    for (const client of ['mihomo', 'singBox']) for (const set of catalog.rulesets) {
      const output = renderRuleset(client, set);
      resources.set(`/clients/${client}/${output.path}`, { client, id: set.id, content: output.content });
    }
    resourceServer = track(http.createServer((request, response) => {
      if (request.url === '/subscription.yaml') {
        downloads.push({ kind: 'subscription', name: sourceState.subscription });
        response.setHeader('Content-Type', 'application/yaml');
        return response.end(stringifyYaml({ proxies: [nativeNode('mihomo', sourceState.subscription, upstream.port)] }));
      }
      const item = resources.get(request.url);
      if (!item) { response.writeHead(404); return response.end(); }
      const updated = sourceState.rejectUpdate && item.id === 'adblock';
      downloads.push({ kind: 'rule', client: item.client, id: item.id, updated });
      let content = item.content;
      if (updated) {
        if (item.client === 'mihomo') { const object = parseYaml(content); object.payload.push(`DOMAIN,${updateHost}`); content = stringifyYaml(object); }
        else { const object = JSON.parse(content); object.rules.push({ domain: [updateHost] }); content = JSON.stringify(object); }
      }
      response.setHeader('Content-Type', item.client === 'mihomo' ? 'application/yaml' : 'application/json'); response.end(content);
    }), sockets);
    const resourcePort = await listen(resourceServer), baseUrl = `http://127.0.0.1:${resourcePort}`;
    for (const client of ['mihomo', 'singBox']) {
      sourceState.rejectUpdate = false;
      // Validate the unmodified public VPN/TUN profile with the fixed kernel's
      // check-only command. Never start that profile on the host.
      const publicProfile = renderManagedProfile(client, { rulesets: catalog.rulesets });
      const publicObject = client === 'mihomo' ? parseYaml(publicProfile.content) : JSON.parse(publicProfile.content);
      assert.ok(client === 'mihomo' ? publicObject.tun?.enable : publicObject.inbounds.some(inbound => inbound.type === 'tun'));
      const publicCheckDirectory = path.join(directory, `${client}-public-syntax`); await mkdir(publicCheckDirectory);
      const publicFile = path.join(publicCheckDirectory, client === 'mihomo' ? 'default.yaml' : 'default.json');
      await writeFile(publicFile, publicProfile.content);
      await execute(binaries[client], client === 'mihomo' ? ['-t', '-f', publicFile, '-d', publicCheckDirectory] : ['check', '-c', publicFile], { cwd: publicCheckDirectory });
      publicTunChecks.push({ client, status: 'passed', mode: 'syntax-only; public TUN profile never started', snapshot: path.relative(root, publicFile), sha256: sha256(publicProfile.content) });
      const mixedPort = await freePort(), dnsPort = client === 'mihomo' ? await freePort() : null;
      const controlPort = client === 'mihomo' ? await freePort() : null, secret = randomUUID();
      const model = managedModel(client, { rulesets: catalog.rulesets, baseUrl });
      const rendered = renderManagedProfile(client, {
        rulesets: catalog.rulesets, baseUrl, captureTraffic: false,
        nodes: [nativeNode(client, 'HK-A', upstream.port), ...(client === 'singBox' ? [nativeNode(client, 'JP-A', upstream.port)] : [])],
        ...(client === 'mihomo' ? { subscriptions: [{ name: 'Managed', url: `${baseUrl}/subscription.yaml` }] } : {}),
        listenerPorts: { mixed: mixedPort, ...(dnsPort ? { dns: dnsPort } : {}) },
        dnsUpstreams: Object.fromEntries(Object.entries(dns).map(([role, item]) => [role, `tcp://127.0.0.1:${item.port}`])),
      });
      const config = client === 'mihomo' ? parseYaml(rendered.content) : JSON.parse(rendered.content);
      assert.ok(client === 'mihomo' ? !config.tun?.enable : config.inbounds.every(inbound => inbound.type !== 'tun'));
      const ruleProviders = client === 'mihomo' ? Object.values(config['rule-providers']) : config.route.rule_set;
      assert.equal(ruleProviders.length, model.rules.length);
      assert.ok(ruleProviders.every(provider => (provider.interval ?? provider.update_interval) === (client === 'mihomo' ? 86400 : '1d')));
      assert.ok(ruleProviders.every(provider => provider.url.startsWith(baseUrl)));
      // Accelerate only the native timer under test. All provider URLs, source
      // rule payloads, group membership, DNS and routing come from the public
      // managed renderer. The default profile remains a one-day updater.
      if (client === 'singBox') config.route.rule_set.find(rule => rule.tag === 'adblock').update_interval = '1s';
      for (const group of client === 'mihomo' ? config['proxy-groups'] : config.outbounds) {
        if (['url-test', 'urltest'].includes(group.type)) group.url = `http://127.0.0.1:${targetPort}/health`;
      }
      const runtimeDirectory = path.join(directory, client); await mkdir(runtimeDirectory);
      const output = path.join(runtimeDirectory, client === 'mihomo' ? 'default.yaml' : 'default.json');
      const content = client === 'mihomo' ? stringifyYaml(config) : JSON.stringify(config, null, 2) + '\n';
      await writeFile(output, content);
      profiles.push({ client, sourceProfileSha256: sha256(rendered.content), checkedSnapshot: path.relative(root, output), runtimeProfileSha256: sha256(content), remoteProviders: model.rules.length, defaultUpdateSeconds: 86400, captureTraffic: false, fixtureOverrides: ['captureTraffic: false (no TUN)', 'health check URL', ...(client === 'singBox' ? ['adblock native update interval: 1s'] : [])] });
      await execute(binaries[client], client === 'mihomo' ? ['-t', '-f', output, '-d', runtimeDirectory] : ['check', '-c', output], { cwd: runtimeDirectory });
      onProgress(`Managed App profile: ${client} actual HTTP rule providers, native nodes, DNS and HTTP/SOCKS routing`);
      const marker = `netatlas-mihomo-running-${randomUUID()}`, markerPath = path.join(runtimeDirectory, marker);
      const args = client === 'mihomo'
        ? ['-f', output, '-d', runtimeDirectory, '-ext-ctl', `127.0.0.1:${controlPort}`, '-secret', secret, '-post-up', `printf %s ${marker} > ${marker}.pending && mv ${marker}.pending ${marker}`]
        : ['run', '-c', output];
      const child = spawn(binaries[client], args, { cwd: runtimeDirectory, stdio: ['ignore', 'pipe', 'pipe'] });
      let log = '';
      child.on('error', error => { child.startupError = error.message; });
      for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { log = (log + bytes).slice(-200000); });
      const dnsStart = dnsQuestions.length;
      try {
        if (client === 'mihomo') await waitForMihomoRunning({ child, markerPath });
        await portReady(child, mixedPort);
        await until(() => model.rules.every(rule => downloads.some(item => item.client === client && item.id === rule.id)), `${client}: missing actual remote rule download`);
        if (client === 'mihomo') {
          await until(async () => (await controller(controlPort, secret, 'GET', '/proxies/节点选择')).all.includes('JP-A'), 'Native subscription was not available');
          const hk = await controller(controlPort, secret, 'GET', '/proxies/香港节点');
          const jp = await controller(controlPort, secret, 'GET', '/proxies/日本节点');
          assert.ok(hk.all.includes('HK-A') && !hk.all.includes('JP-A'), 'Native Hong Kong filter mixed regions');
          assert.ok(jp.all.includes('JP-A') && !jp.all.includes('HK-A'), 'Native Japan filter mixed regions');
        }
        for (const [protocol, request] of [['http', httpRequest], ['socks5', socksRequest]]) for (const item of cases) {
          const before = upstreamConnections.length, dnsBefore = dnsQuestions.length;
          if (client === 'mihomo' && item.dnsRole) await queryDns(dnsPort, item.host);
          const result = await request(mixedPort, item.host, targetPort);
          assert.equal(Boolean(result.body?.includes(token)), item.permitted, `${client} ${protocol} ${item.behavior}: ${JSON.stringify(result)}`);
          // Health probes have an IP literal destination; target-domain SOCKS
          // evidence distinguishes routed traffic from automatic URL tests.
          const routed = upstreamConnections.slice(before).filter(connection => connection.kind === 'http' && connection.host !== '127.0.0.1');
          assert.equal(routed.length, item.proxied ? 1 : 0, `${client}: incorrect actual SOCKS path for ${item.host}`);
          if (item.dnsRole) assert.ok(dnsQuestions.slice(dnsStart).some(question => question.host === item.host && question.role === item.dnsRole), `${client}: wrong native DNS role for ${item.host}`);
          if (!item.permitted) assert.equal(dnsQuestions.slice(dnsBefore).filter(question => question.host === item.host).length, 0, `${client}: rejected ad leaked DNS`);
          resultCases.push({ client, protocol, ...item, status: 'passed' });
        }
        assert.ok(dnsQuestions.slice(dnsStart).some(question => question.host === nodeHost && question.role === 'bootstrap'), `${client}: missing native node bootstrap DNS`);
        assert.ok(!dnsQuestions.slice(dnsStart).some(question => question.host === nodeHost && question.role !== 'bootstrap'), `${client}: node resolution used policy DNS`);
        const initial = await httpRequest(mixedPort, updateHost, targetPort); assert.ok(initial.body?.includes(token));
        sourceState.rejectUpdate = true;
        if (client === 'mihomo') await controller(controlPort, secret, 'PUT', '/providers/rules/adblock');
        await until(() => downloads.some(item => item.client === client && item.id === 'adblock' && item.updated), `${client}: native rule updater did not fetch changed remote payload`);
        await until(async () => !(await httpRequest(mixedPort, updateHost, targetPort)).body?.includes(token), `${client}: refreshed provider did not change routing`);
        const updatedSocks = await socksRequest(mixedPort, updateHost, targetPort); assert.ok(!updatedSocks.body?.includes(token));
        updates.push({ client, kind: 'rule', id: 'adblock', host: updateHost, before: 'proxy', after: 'reject', update: client === 'mihomo' ? 'native controller refresh' : 'native periodic timer', actualHttpFetch: true, realHttpAndSocks: true });
        if (client === 'mihomo') {
          sourceState.subscription = 'JP-B';
          await controller(controlPort, secret, 'PUT', '/providers/proxies/Managed');
          await until(async () => {
            const group = await controller(controlPort, secret, 'GET', '/proxies/节点选择');
            return group.all.includes('JP-B') && !group.all.includes('JP-A');
          }, 'Native subscription refresh did not replace nodes');
          await controller(controlPort, secret, 'PUT', '/proxies/节点选择', { name: 'JP-B' });
          assert.ok((await httpRequest(mixedPort, 'managed-unmatched.example', targetPort)).body?.includes(token));
          updates.push({ client, kind: 'subscription', before: 'JP-A', after: 'JP-B', actualHttpFetch: true, realRequest: true });
        }
      } catch (error) {
        error.message += `\nManaged evidence: ${JSON.stringify({ client, downloads, dnsQuestions: dnsQuestions.slice(dnsStart), upstreamConnections })}\nKernel:\n${log.replaceAll(secret, '[redacted]').slice(-15000)}`;
        throw error;
      } finally { await stop(child); await writeFile(path.join(runtimeDirectory, 'kernel.log'), log.replaceAll(secret, '[redacted]')); }
    }
    const report = { status: 'passed', directory: path.relative(root, directory), publicTunChecks, profiles, cases: resultCases, updates, downloads, dnsQuestions, upstreamConnections, targetRequests: targetEvidence.length, targets: 'public TUN profiles syntax checked only; captureTraffic:false runtime uses loopback HTTP rule/subscription resources, DNS, target HTTP and SOCKS only; no GUI or system proxy changes', unavailableNativeCli: ['stash'] };
    await writeFile(path.join(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of [target, upstream?.server, resourceServer, ...Object.values(dns).map(item => item.server)].filter(Boolean)) await new Promise(resolve => server.close(resolve));
  }
}
