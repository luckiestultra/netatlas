import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { promisify } from 'node:util';
import { stringify } from 'yaml';
import { createPrivateProfile } from './private-profile.mjs';
import { waitForMihomoRunning } from './native.mjs';
import { assertManagedPaths } from './managed-paths.mjs';

const execute = promisify(execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const password = 'synthetic-subscription-tls-password';
const alpn = 'netatlas-fixture/1';
const vlessUuid = '7c9a3d20-44b0-493e-90d2-9b219674d04c';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
async function freePort() {
  const server = net.createServer(), port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function stop(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
  timer.unref(); await exited; clearTimeout(timer);
}
async function waitPort(child, port) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null || child.startupError) throw new Error('TLS fixture kernel exited before readiness');
    const ready = await new Promise(resolve => {
      const socket = net.connect(port, '127.0.0.1');
      const done = value => { socket.destroy(); resolve(value); };
      socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(100, () => done(false));
    });
    if (ready) return;
    await pause(20);
  }
  throw new Error('TLS fixture listener readiness timed out');
}
function request(port) {
  return new Promise(resolve => {
    // A routing regression can reach only the closed loopback discard port.
    const query = http.get({ host: '127.0.0.1', port, path: 'http://127.0.0.1:9/tls', headers: { Host: '127.0.0.1:9' }, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
      response.on('error', error => resolve({ error: error.code || error.message }));
    });
    query.once('error', error => resolve({ error: error.code || error.message }));
    query.setTimeout(4000, () => query.destroy(new Error('TLS fixture request timed out')));
  });
}

// Minimal fixture-only WebSocket/VLESS responder: authenticate the synthetic
// UUID and return an HTTP response inside a real server WebSocket frame.
function websocketVless(socket, evidence) {
  let buffer = Buffer.alloc(0), payload = Buffer.alloc(0), upgraded = false;
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!upgraded) {
      const boundary = buffer.indexOf('\r\n\r\n');
      if (boundary < 0) return;
      const header = buffer.subarray(0, boundary).toString();
      const key = /^sec-websocket-key:\s*(.+)$/im.exec(header)?.[1].trim();
      if (!key || !header.startsWith('GET /secured ') || !/^host:\s*localhost(?::\d+)?$/im.test(header)) return socket.destroy();
      const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
      upgraded = true; buffer = buffer.subarray(boundary + 4);
    }
    while (buffer.length >= 2) {
      let size = buffer[1] & 127, offset = 2;
      if (size === 127) return socket.destroy();
      if (size === 126) { if (buffer.length < 4) return; size = buffer.readUInt16BE(2); offset = 4; }
      if (!(buffer[1] & 128)) return socket.destroy();
      if (buffer.length < offset + 4 + size) return;
      const mask = buffer.subarray(offset, offset + 4), frame = Buffer.from(buffer.subarray(offset + 4, offset + 4 + size));
      for (let index = 0; index < frame.length; index++) frame[index] ^= mask[index % 4];
      buffer = buffer.subarray(offset + 4 + size); payload = Buffer.concat([payload, frame]);
      if (payload.length > 16384) return socket.destroy();
      if (payload.length < 18) continue;
      evidence.authenticated = payload[0] === 0 && payload.subarray(1, 17).equals(Buffer.from(vlessUuid.replaceAll('-', ''), 'hex'));
      if (!evidence.authenticated) return socket.destroy();
      const text = payload.toString(), start = text.indexOf('GET ');
      if (start >= 0 && text.slice(start).includes('\r\n\r\n')) {
        evidence.http = true;
        const body = 'WS-TLS-OK';
        const response = Buffer.concat([Buffer.from([0, 0]), Buffer.from(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`)]);
        assert.ok(response.length < 126);
        socket.end(Buffer.concat([Buffer.from([0x82, response.length]), response]));
        return;
      }
    }
  });
}

// Explicit opt-in regression: two fixed native engines, synthetic TLS trust only,
// loopback subscription / proxy / requested destination, no TUN or system proxy.
export async function testSubscriptionTlsWorkflow({ root, binaries }) {
  await assertManagedPaths(root, ['.cache/native-check']);
  const cache = path.join(root, '.cache/native-check'); await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(path.join(cache, 'subscription-tls-'));
  const fixtureRoot = path.join(directory, 'catalog');
  for (const name of ['metadata', 'src/rules', 'private']) await mkdir(path.join(fixtureRoot, name), { recursive: true, mode: 0o700 });
  await writeFile(path.join(fixtureRoot, 'metadata/upstreams.json'), JSON.stringify({ version: 1, rulesets: [], repositories: [] }));
  const keyFile = path.join(directory, 'key.pem'), certFile = path.join(directory, 'cert.pem');
  await execute('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost']);
  const key = await readFile(keyFile), cert = await readFile(certFile), certText = cert.toString();
  const certPin = digest(new X509Certificate(cert).raw), auth = createHash('sha224').update(password).digest('hex');
  const sockets = new Set(), servers = [], observations = [], cases = [], sources = new Map();
  const track = server => {
    servers.push(server);
    server.on('connection', socket => { sockets.add(socket); socket.on('error', () => {}); socket.once('close', () => sockets.delete(socket)); });
    return server;
  };
  const endpoint = async kind => {
    const server = track(tls.createServer({ key, cert, ...(kind === 'trojan' ? { ALPNProtocols: [alpn] } : kind === 'vless-ws' ? { ALPNProtocols: ['http/1.1'] } : {}) }, socket => {
      const evidence = { kind, alpn: socket.alpnProtocol, servername: socket.servername, authenticated: false, http: false };
      observations.push(evidence);
      if (kind === 'trojan' && socket.alpnProtocol !== alpn) return socket.destroy();
      if (kind === 'vless-ws') return websocketVless(socket, evidence);
      let buffer = Buffer.alloc(0), connected = false;
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        if (kind === 'http' && !connected && buffer.includes('\r\n\r\n')) {
          evidence.authenticated = buffer.toString().startsWith('CONNECT ');
          connected = true; buffer = Buffer.alloc(0); socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
        } else if (kind === 'trojan') {
          if (buffer.length < 58) return;
          evidence.authenticated = buffer.subarray(0, 58).toString() === auth + '\r\n';
          if (!evidence.authenticated) return socket.destroy();
        }
        const text = buffer.toString(), start = text.indexOf('GET ');
        if (evidence.authenticated && start >= 0 && text.slice(start).includes('\r\n\r\n')) {
          evidence.http = true;
          const body = kind === 'http' ? 'PIN-OK' : 'ALPN-OK';
          socket.end(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`);
        }
      });
    }));
    server.on('tlsClientError', () => {});
    return listen(server);
  };
  async function run(client, label, config, port, member) {
    const runtime = path.join(directory, label); await mkdir(runtime, { recursive: true, mode: 0o700 });
    const file = path.join(runtime, client === 'mihomo' ? 'config.yaml' : 'config.json');
    const marker = 'netatlas-mihomo-running-' + randomUUID(), markerPath = path.join(runtime, marker), secret = randomUUID();
    const control = client === 'mihomo' ? await freePort() : null;
    if (control) { config['external-controller'] = `127.0.0.1:${control}`; config.secret = secret; }
    await writeFile(file, client === 'mihomo' ? stringify(config) : JSON.stringify(config), { mode: 0o600 });
    const args = client === 'mihomo' ? ['-f', file, '-d', runtime, '-post-up', `printf %s ${marker} > ${marker}.pending && mv ${marker}.pending ${marker}`] : ['run', '-c', file];
    const child = spawn(binaries[client], args, { cwd: runtime, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; child.on('error', error => { child.startupError = error.message; });
    child.stdout.on('data', chunk => { log = (log + chunk).slice(-100000); }); child.stderr.on('data', chunk => { log = (log + chunk).slice(-100000); });
    try {
      if (client === 'mihomo') {
        await waitForMihomoRunning({ child, markerPath });
        let loaded = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          if (child.exitCode !== null) throw new Error('Mihomo exited before TLS provider readiness');
          try {
            const response = await fetch(`http://127.0.0.1:${control}/proxies/Proxy`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(500) });
            if ((await response.json()).all?.includes(member)) { loaded = true; break; }
          } catch {}
          await pause(20);
        }
        assert.ok(loaded, 'native file provider did not load the real TLS node');
      }
      await waitPort(child, port);
      const before = observations.length, result = await request(port);
      await pause(20);
      return { result, observations: observations.slice(before), log: log.replaceAll(secret, '[redacted]') };
    } catch (error) { error.message += '\n' + log.replaceAll(secret, '[redacted]'); throw error; }
    finally { await stop(child); await writeFile(path.join(runtime, 'kernel.log'), log.replaceAll(secret, '[redacted]')); }
  }
  async function mihomo(node, label) {
    const port = await freePort(), runtime = path.join(directory, label); await mkdir(runtime, { mode: 0o700 });
    const source = path.join(runtime, 'source.yaml');
    await writeFile(source, stringify({ proxies: [node] }));
    // File providers load after the process-local custom CA pool is installed.
    const config = { 'mixed-port': port, 'allow-lan': false, 'bind-address': '127.0.0.1', mode: 'rule', dns: { enable: false }, tls: { 'custom-certifactes': [certText] }, proxies: [],
      'proxy-providers': { Fixture: { type: 'file', path: source } }, 'proxy-groups': [{ name: 'Proxy', type: 'select', use: ['Fixture'] }], rules: ['MATCH,Proxy'] };
    return run('mihomo', label, config, port, node.name);
  }
  try {
    const httpPort = await endpoint('http'), trojanPort = await endpoint('trojan');
    const subscription = track(http.createServer((query, response) => {
      const source = sources.get(query.url);
      response.writeHead(source ? 200 : 404, { 'Content-Type': 'application/json' }); response.end(source ?? '{}');
    }));
    const subscriptionPort = await listen(subscription);
    const pinned = { name: 'TLS-Node', type: 'http', server: '127.0.0.1', port: httpPort, tls: true, sni: 'localhost', fingerprint: '00'.repeat(32) };
    const negative = await mihomo(pinned, 'source-wrong-pin');
    assert.notEqual(negative.result.status, 200); assert.match(negative.log, /certificate fingerprints do not match/);
    assert.equal(negative.observations.filter(item => item.http).length, 0);
    cases.push({ id: 'source-wrong-pin', rejectedByCertificatePin: true });
    for (const [label, fingerprint] of [['source-matching-pin', certPin], ['source-without-pin', '']]) {
      const positive = await mihomo({ ...pinned, fingerprint }, label);
      assert.equal(positive.result.body, 'PIN-OK'); assert.ok(positive.observations.some(item => item.http));
      cases.push({ id: label, actualTlsHttp: 'passed' });
    }
    const inputFile = path.join(fixtureRoot, 'private/input.json'), outputFile = path.join(fixtureRoot, 'private/output.json');
    const mixed = await freePort();
    await writeFile(inputFile, JSON.stringify({ version: 1, subscriptions: [{ name: 'TLS', url: `http://127.0.0.1:${subscriptionPort}/nodes` }], listenerPorts: { mixed },
      dnsUpstreams: Object.fromEntries(['local', 'bootstrap', 'domestic', 'remote'].map(role => [role, 'tcp://127.0.0.1:9'])) }), { mode: 0o600 });
    const args = { root: fixtureRoot, client: 'singBox', inputFile, outputFile };
    const previous = 'last-known-good-profile\n'; await writeFile(outputFile, previous, { mode: 0o600 });
    sources.set('/nodes', JSON.stringify({ proxies: [pinned] }));
    await assert.rejects(() => createPrivateProfile(args), /certificate.*pin|fingerprint|native sing-box/i);
    assert.equal(await readFile(outputFile, 'utf8'), previous);
    assert.deepEqual((await readdir(path.dirname(outputFile))).sort(), ['input.json', 'output.json']);
    cases.push({ id: 'pin-import', rejectedBeforePublication: true, preservedLastGoodProfile: true });
    const trojan = { name: 'TLS-Node', type: 'trojan', server: '127.0.0.1', port: trojanPort, password, sni: 'localhost', alpn: [alpn] };
    const sourceAlpn = await mihomo(trojan, 'source-trojan-alpn');
    assert.equal(sourceAlpn.result.body, 'ALPN-OK'); assert.ok(sourceAlpn.observations.some(item => item.alpn === alpn && item.authenticated && item.http));
    cases.push({ id: 'source-trojan-alpn', negotiatedAlpn: alpn, actualTlsHttp: 'passed' });
    sources.set('/nodes', JSON.stringify({ proxies: [trojan] }));
    await createPrivateProfile(args);
    const publishedBytes = await readFile(outputFile), config = JSON.parse(publishedBytes);
    assert.deepEqual(config.outbounds.find(node => node.tag === 'TLS-Node').tls.alpn, [alpn]);
    // Trust is added only to the isolated runtime copy, never the generated file or OS.
    config.outbounds.find(node => node.tag === 'TLS-Node').tls.certificate = [certText];
    const imported = await run('singBox', 'imported-trojan-alpn', config, mixed);
    assert.equal(imported.result.body, 'ALPN-OK'); assert.ok(imported.observations.some(item => item.alpn === alpn && item.authenticated && item.http));
    cases.push({ id: 'imported-trojan-alpn', negotiatedAlpn: alpn, actualTlsHttp: 'passed' });
    const mutation = structuredClone(config); delete mutation.outbounds.find(node => node.tag === 'TLS-Node').tls.alpn;
    const missing = await run('singBox', 'negative-control-missing-alpn', mutation, mixed);
    assert.notEqual(missing.result.status, 200); assert.ok(missing.observations.some(item => item.alpn !== alpn)); assert.ok(missing.observations.every(item => !item.http));
    cases.push({ id: 'negative-control-missing-alpn', rejectedWithoutRequiredAlpn: true });
    assert.ok((await readFile(outputFile)).equals(publishedBytes));
    const websocketPort = await endpoint('vless-ws');
    const websocket = { name: 'TLS-Node', type: 'vless', server: '127.0.0.1', port: websocketPort, uuid: vlessUuid,
      tls: true, network: 'ws', sni: 'ignored.example.test', alpn: ['h2'], 'ws-opts': { path: '/secured', headers: { Host: 'localhost' } } };
    const sourceWs = await mihomo(websocket, 'source-vless-wss');
    assert.equal(sourceWs.result.body, 'WS-TLS-OK');
    assert.ok(sourceWs.observations.some(item => item.servername === 'localhost' && item.alpn === 'http/1.1' && item.authenticated && item.http));
    cases.push({ id: 'source-vless-wss', negotiatedAlpn: 'http/1.1', servername: 'localhost', actualTlsWebSocketHttp: 'passed' });
    sources.set('/nodes', JSON.stringify({ proxies: [websocket] }));
    await createPrivateProfile(args);
    const wsPublishedBytes = await readFile(outputFile), wsConfig = JSON.parse(wsPublishedBytes);
    wsConfig.outbounds.find(node => node.tag === 'TLS-Node').tls.certificate = [certText];
    const importedWs = await run('singBox', 'imported-vless-wss', wsConfig, mixed);
    assert.equal(importedWs.result.body, 'WS-TLS-OK');
    assert.ok(importedWs.observations.some(item => item.servername === 'localhost' && item.alpn === 'http/1.1' && item.authenticated && item.http));
    cases.push({ id: 'imported-vless-wss', negotiatedAlpn: 'http/1.1', servername: 'localhost', actualTlsWebSocketHttp: 'passed' });
    for (const field of ['server_name', 'alpn']) {
      const mutated = structuredClone(wsConfig), node = mutated.outbounds.find(node => node.tag === 'TLS-Node');
      node.tls[field] = field === 'server_name' ? '127.0.0.1' : ['h2'];
      const negativeWs = await run('singBox', 'negative-wss-' + field, mutated, mixed);
      assert.notEqual(negativeWs.result.status, 200);
      assert.ok(negativeWs.observations.every(item => !item.http));
      cases.push({ id: 'negative-wss-' + field, rejectedWrongTlsSetting: true });
    }
    assert.ok((await readFile(outputFile)).equals(wsPublishedBytes));
    const report = { status: 'passed', cases, certificateTrust: 'same synthetic certificate, per-process fixture configuration only', targets: 'loopback only; no TUN, system proxy, app configuration or system trust changes', directory, report: path.join(directory, 'verification.json') };
    await writeFile(report.report, JSON.stringify(report, null, 2));
    return report;
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of servers) await new Promise(resolve => server.close(resolve));
  }
}
