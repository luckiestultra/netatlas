import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { createPrivateProfile } from './private-profile.mjs';
import { loadCatalog } from './build.mjs';
import { assertManagedPaths } from './managed-paths.mjs';
import { waitForMihomoRunning } from './native.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const nodeHost = 'chat.openai.com';
const publicFixtureAddress = '198.51.100.23';
const cases = [
  { host: '127.0.0.1', permitted: true, proxied: false, dnsRole: null, behavior: 'lan-ip' },
  { host: 'workflow.home.arpa', permitted: true, proxied: false, dnsRole: 'local', behavior: 'lan-name' },
  { host: 'www.baidu.com', permitted: true, proxied: false, dnsRole: 'domestic', behavior: 'domestic-service' },
  { host: 'www.meituan.com', permitted: true, proxied: false, dnsRole: 'domestic', behavior: 'expanded-cn-domain' },
  { host: 'chatgpt.com', permitted: true, proxied: true, dnsRole: 'remote', behavior: 'service-proxy' },
  { host: 'www.google.cn', permitted: true, proxied: true, dnsRole: 'remote', behavior: 'specific-service-before-cn' },
  { host: 'workflow-unmatched.example', permitted: true, proxied: true, dnsRole: 'remote', behavior: 'final-proxy' },
  { host: 'doubleclick.net', permitted: false, proxied: false, dnsRole: null, behavior: 'advertising-reject' },
];
const allowedHosts = new Set([nodeHost, ...cases.map(item => item.host)]);

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

function nativeNode(client, name, port) {
  return client === 'mihomo' ? { name, type: 'socks5', server: nodeHost, port, udp: false }
    : { tag: name, type: 'socks', server: nodeHost, server_port: port, version: '5' };
}
function routingRules(client, text) { return client === 'mihomo' ? parseYaml(text).rules : JSON.parse(text).route.rules; }
async function controller(port, secret, method, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { Authorization: `Bearer ${secret}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Local workflow controller ${method} ${route} returned ${response.status}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
async function providerMembers(port, secret, expected, removed = []) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const state = await controller(port, secret, 'GET', '/proxies/Proxy');
    if (expected.every(name => state.all?.includes(name)) && removed.every(name => !state.all?.includes(name))) return state.all;
    await pause(25);
  }
  throw new Error('Native subscription membership did not reflect its actual source update');
}

export async function testPrivateProfileWorkflow({ root, binaries, onProgress = () => {} }) {
  await assertManagedPaths(root, ['private', '.cache/profile-workflow']);
  const catalog = await loadCatalog(root), canonicalSourcesSha256 = sha256(JSON.stringify(catalog.sources));
  await mkdir(path.join(root, 'private'), { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(root, 'private', 'workflow-'));
  const sockets = new Set(), dnsQuestions = [], upstreamConnections = [], targetEvidence = [], subscriptionRequests = [], resultCases = [], generatedProfiles = [], subscriptions = [];
  const token = randomUUID();
  const target = track(http.createServer((request, response) => {
    targetEvidence.push({ host: request.headers.host, path: request.url });
    response.writeHead(200, { 'Content-Type': 'text/plain', Connection: 'close' }); response.end(token);
  }), sockets);
  const targetPort = await listen(target), dns = {}; let upstream, subscriptionServer;
  const sourceState = { mihomo: 'Workflow-A', singBox: 'Workflow-A' };
  try {
    for (const role of ['bootstrap', 'domestic', 'remote', 'local']) dns[role] = await dnsFixture(role, dnsQuestions, sockets);
    upstream = await socksFixture(targetPort, dns.remote.port, upstreamConnections, sockets);
    subscriptionServer = track(http.createServer((request, response) => {
      const client = request.url === '/mihomo.yaml' ? 'mihomo' : request.url === '/sing-box.json' ? 'singBox' : null;
      if (!client) { response.writeHead(404); return response.end(); }
      subscriptionRequests.push({ client, name: sourceState[client], method: request.method });
      const nodes = sourceState[client] ? [nativeNode(client, sourceState[client], upstream.port)] : [];
      response.writeHead(200, { 'Content-Type': client === 'mihomo' ? 'application/yaml' : 'application/json', Connection: 'close' });
      response.end(client === 'mihomo' ? stringifyYaml({ proxies: nodes }) : JSON.stringify({ outbounds: nodes }));
    }), sockets);
    const subscriptionPort = await listen(subscriptionServer);
    for (const client of ['mihomo', 'singBox']) {
      const mixedPort = await freePort(), dnsPort = client === 'mihomo' ? await freePort() : null;
      const inputFile = path.join(directory, client + '-input.json'), outputFile = path.join(directory, client + (client === 'mihomo' ? '.yaml' : '.json'));
      const input = {
        version: 1, nodes: [], subscriptions: [{ name: 'Workflow', url: `http://127.0.0.1:${subscriptionPort}/${client === 'mihomo' ? 'mihomo.yaml' : 'sing-box.json'}`, interval: 3600 }],
        listenerPorts: { mixed: mixedPort, ...(dnsPort ? { dns: dnsPort } : {}) },
        dnsUpstreams: Object.fromEntries(Object.entries(dns).map(([role, item]) => [role, `tcp://127.0.0.1:${item.port}`])),
      };
      await writeFile(inputFile, JSON.stringify(input), { flag: 'wx', mode: 0o600 });
      onProgress(`Private workflow: ${client} subscription -> private profile -> native node/DNS/routing`);
      await createPrivateProfile({ root, client, inputFile, outputFile });
      const profileBytes = await readFile(outputFile), publicProfile = await readFile(path.join(root, 'clients', client, 'profiles', client === 'mihomo' ? 'standalone.yaml' : 'standalone.json'), 'utf8');
      const rules = routingRules(client, profileBytes.toString('utf8'));
      assert.deepEqual(rules, routingRules(client, publicProfile), `${client}: advanced private workflow must retain every published standalone routing rule`);
      const initialSnapshot = path.join(directory, client + '-checked-initial' + (client === 'mihomo' ? '.yaml' : '.json'));
      await writeFile(initialSnapshot, profileBytes, { flag: 'wx', mode: 0o600 });
      generatedProfiles.push({ client, input: path.relative(root, inputFile), output: path.relative(root, outputFile), checkedSnapshot: path.relative(root, initialSnapshot), profileSha256: sha256(profileBytes), routingRulesSha256: sha256(JSON.stringify(rules)), publishedRulesMatch: true, rules: rules.length });
      const processDirectory = path.join(directory, client + '-runtime'); await mkdir(processDirectory, { mode: 0o700 });
      const controlPort = client === 'mihomo' ? await freePort() : null, secret = randomUUID();
      const marker = 'netatlas-mihomo-running-' + randomUUID(), markerPath = path.join(processDirectory, marker);
      const args = client === 'mihomo' ? ['-f', outputFile, '-d', processDirectory, '-ext-ctl', `127.0.0.1:${controlPort}`, '-secret', secret, '-post-up', `printf %s ${marker} > ${marker}.pending && mv ${marker}.pending ${marker}`] : ['run', '-c', outputFile];
      const child = spawn(binaries[client], args, { cwd: processDirectory, stdio: ['ignore', 'pipe', 'pipe'] }); let log = '';
      child.on('error', error => { child.startupError = error.message; }); child.stdout.on('data', bytes => { log = (log + bytes).slice(-200000); }); child.stderr.on('data', bytes => { log = (log + bytes).slice(-200000); });
      const startDns = dnsQuestions.length;
      try {
        if (client === 'mihomo') await waitForMihomoRunning({ child, markerPath });
        await portReady(child, mixedPort);
        if (client === 'mihomo') {
          const all = await providerMembers(controlPort, secret, ['Workflow-A']);
          await controller(controlPort, secret, 'PUT', '/proxies/Proxy', { name: 'Workflow-A' });
          subscriptions.push({ client, stage: 'initial', nativeMembers: all.filter(name => /^Workflow-/.test(name)) });
        } else assert.equal(JSON.parse(profileBytes).outbounds.find(outbound => outbound.tag === 'Proxy').default, 'Workflow-A');
        for (const [protocol, request] of [['http', httpRequest], ['socks5', socksRequest]]) {
          for (const item of cases) {
            const beforeTarget = targetEvidence.length, beforeProxy = upstreamConnections.filter(item => item.kind === 'http').length, beforeDns = dnsQuestions.length;
            // Explicit proxies send target domains to their remote server; app DNS
            // uses the actual Mihomo DNS listener, not a stand-in decoder.
            if (client === 'mihomo' && item.dnsRole) await queryDns(dnsPort, item.host);
            const result = await request(mixedPort, item.host, targetPort);
            assert.equal(Boolean(result.body?.includes(token)), item.permitted, `${client} ${protocol} ${item.behavior}: ${JSON.stringify(result)}`);
            assert.equal(targetEvidence.length - beforeTarget, item.permitted ? 1 : 0, `${client}: unexpected loopback target requests`);
            assert.equal(upstreamConnections.filter(item => item.kind === 'http').length - beforeProxy, item.proxied ? 1 : 0, `${client}: wrong actual SOCKS path for ${item.host}`);
            if (item.dnsRole) assert.ok(dnsQuestions.slice(startDns).some(question => question.host === item.host && question.role === item.dnsRole), `${client}: missing actual ${item.dnsRole} DNS for ${item.host}`);
            if (!item.permitted) assert.equal(dnsQuestions.slice(beforeDns).filter(question => question.host === item.host).length, 0, `${client}: rejected advertisement leaked to upstream DNS`);
            resultCases.push({ client, protocol, ...item, status: 'passed' });
          }
        }
        assert.ok(dnsQuestions.slice(startDns).some(question => question.host === nodeHost && question.role === 'bootstrap'), `${client}: node hostname did not use bootstrap`);
        assert.ok(!dnsQuestions.slice(startDns).some(question => question.host === nodeHost && question.role !== 'bootstrap'), `${client}: node bootstrap recursed into policy DNS`);
        if (client === 'mihomo') {
          sourceState.mihomo = 'Workflow-B';
          await controller(controlPort, secret, 'PUT', '/providers/proxies/Workflow');
          const members = await providerMembers(controlPort, secret, ['Workflow-B'], ['Workflow-A']);
          await controller(controlPort, secret, 'PUT', '/proxies/Proxy', { name: 'Workflow-B' });
          const result = await httpRequest(mixedPort, 'workflow-unmatched.example', targetPort);
          assert.ok(result.body?.includes(token), 'Updated native provider node did not carry a real request');
          subscriptions.push({ client, stage: 'refresh', nativeMembers: members.filter(name => /^Workflow-/.test(name)), removed: 'Workflow-A', selected: 'Workflow-B', realRequest: 'passed' });
        }
      } catch (error) {
        error.message += `\nPrivate workflow evidence: ${JSON.stringify({ client, dnsQuestions: dnsQuestions.slice(startDns), subscriptionRequests, targetRequests: targetEvidence.length, upstreamConnections })}\nKernel log:\n${log.replaceAll(secret, '[redacted]').slice(-10000)}`; throw error;
      } finally { await stop(child); await writeFile(path.join(processDirectory, 'kernel.log'), log.replaceAll(secret, '[redacted]')); }
      assert.ok((await readFile(outputFile)).equals(profileBytes), `${client}: the verified native input changed while its process was running`);
      if (client === 'singBox') {
        sourceState.singBox = 'Workflow-B';
        await createPrivateProfile({ root, client, inputFile, outputFile });
        const refreshedBytes = await readFile(outputFile);
        const refreshedSnapshot = path.join(directory, 'singBox-checked-refresh.json');
        await writeFile(refreshedSnapshot, refreshedBytes, { flag: 'wx', mode: 0o600 });
        const updated = JSON.parse(refreshedBytes);
        assert.equal(updated.outbounds.find(outbound => outbound.tag === 'Proxy').default, 'Workflow-B');
        assert.ok(!updated.outbounds.some(outbound => outbound.tag === 'Workflow-A'));
        const refreshed = spawn(binaries[client], ['run', '-c', outputFile], { cwd: processDirectory, stdio: ['ignore', 'pipe', 'pipe'] }); let refreshLog = '';
        refreshed.on('error', error => { refreshed.startupError = error.message; });
        refreshed.stdout.on('data', bytes => { refreshLog = (refreshLog + bytes).slice(-200000); });
        refreshed.stderr.on('data', bytes => { refreshLog = (refreshLog + bytes).slice(-200000); });
        try {
          await portReady(refreshed, mixedPort);
          const beforeProxy = upstreamConnections.filter(item => item.kind === 'http').length;
          const response = await httpRequest(mixedPort, 'workflow-unmatched.example', targetPort);
          assert.ok(response.body?.includes(token), 'Updated materialized sing-box node did not carry a real request');
          assert.equal(upstreamConnections.filter(item => item.kind === 'http').length - beforeProxy, 1);
          subscriptions.push({ client, stage: 'refresh', nativeMembers: ['Workflow-B'], removed: 'Workflow-A', selected: 'Workflow-B', materializedFromActualHTTP: true, realRequest: 'passed', profileSha256: sha256(refreshedBytes), checkedSnapshot: path.relative(root, refreshedSnapshot) });
        } catch (error) { error.message += `\nRefreshed sing-box kernel:\n${refreshLog.slice(-10000)}`; throw error; }
        finally { await stop(refreshed); await writeFile(path.join(processDirectory, 'kernel-refresh.log'), refreshLog); }
        const lastGood = await readFile(outputFile); sourceState.singBox = null;
        await assert.rejects(() => createPrivateProfile({ root, client, inputFile, outputFile }), /subscription|node/i);
        assert.ok((await readFile(outputFile)).equals(lastGood), 'An empty fetched subscription replaced the last good private profile');
        subscriptions.push({ client, stage: 'empty-source', materializedFromActualHTTP: true, preservedLastGoodProfile: true });
      }
    }
    assert.ok(subscriptionRequests.filter(item => item.client === 'mihomo').length >= 2, 'Mihomo did not fetch its native provider and refresh');
    assert.ok(subscriptionRequests.filter(item => item.client === 'singBox').length >= 2, 'Local sing-box importer did not fetch both subscription versions');
    assert.equal(sha256(JSON.stringify((await loadCatalog(root)).sources)), canonicalSourcesSha256, 'Canonical inputs changed during the workflow verification');
    const report = {
      status: 'passed', canonicalSourcesSha256, catalogRuleSets: catalog.rulesets.length, generatedProfiles, cases: resultCases, subscriptions, subscriptionRequests, dnsQuestions,
      upstreamConnections, targetRequests: targetEvidence.length, targetEvidence,
      targets: 'actual local profile input/output, loopback-only subscription/DNS/HTTP/SOCKS; documentation IPs map only inside an allowlisted SOCKS fixture; no app configuration or system proxy changes',
      directory: path.relative(root, directory), report: path.relative(root, path.join(directory, 'verification.json')),
    };
    await writeFile(path.join(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return report;
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of [target, upstream?.server, subscriptionServer, ...Object.values(dns).map(item => item.server)].filter(Boolean)) await new Promise(resolve => server.close(resolve));
  }
}
