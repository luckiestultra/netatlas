import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import vm from 'node:vm';
import { assertManagedPaths } from './managed-paths.mjs';
import { createPrivateProfile } from './private-profile.mjs';
import { bundleResourceParser } from './resource-parser-bundle.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
async function freePort() {
  const server = net.createServer(), port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitPort(child, port) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null || child.startupError) throw new Error('Integrity fixture kernel exited before readiness');
    const ready = await new Promise(resolve => {
      const socket = net.connect(port, '127.0.0.1'), done = value => { socket.destroy(); resolve(value); };
      socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(100, () => done(false));
    });
    if (ready) return;
    await pause(20);
  }
  throw new Error('Integrity fixture listener readiness timed out');
}
async function stop(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000); timer.unref(); await exited; clearTimeout(timer);
}
function request(proxyPort, targetPort) {
  return new Promise(resolve => {
    const query = http.get({ host: '127.0.0.1', port: proxyPort, path: `http://127.0.0.1:${targetPort}/integrity`, headers: { Host: `127.0.0.1:${targetPort}` }, agent: false }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
      response.on('error', error => resolve({ error: error.code || error.message }));
    });
    query.once('error', error => resolve({ error: error.code || error.message }));
    query.setTimeout(4000, () => query.destroy(new Error('Integrity fixture request timed out')));
  });
}

export async function testSubscriptionIntegrityWorkflow({ root, binaries }) {
  await assertManagedPaths(root, ['.cache/native-check']);
  const parserBundle = bundleResourceParser();
  const cache = path.join(root, '.cache/native-check'); await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(path.join(cache, 'subscription-integrity-')), fixtureRoot = path.join(directory, 'catalog');
  for (const name of ['metadata', 'src/rules', 'private']) await mkdir(path.join(fixtureRoot, name), { recursive: true, mode: 0o700 });
  await writeFile(path.join(fixtureRoot, 'metadata/upstreams.json'), JSON.stringify({ version: 1, rulesets: [], repositories: [] }));
  const sockets = new Set(), servers = [], cases = [], tunnels = [], sources = new Map();
  const track = server => {
    servers.push(server); server.on('connection', socket => { sockets.add(socket); socket.on('error', () => {}); socket.once('close', () => sockets.delete(socket)); }); return server;
  };
  async function kernel(label, config, port, exercise) {
    const runtime = path.join(directory, label); await mkdir(runtime, { mode: 0o700 });
    const file = path.join(runtime, 'config.json'); await writeFile(file, JSON.stringify(config), { mode: 0o600 });
    const child = spawn(binaries.singBox, ['run', '-c', file], { cwd: runtime, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; child.on('error', error => { child.startupError = error.message; });
    child.stdout.on('data', chunk => { log = (log + chunk).slice(-100000); }); child.stderr.on('data', chunk => { log = (log + chunk).slice(-100000); });
    try { await waitPort(child, port); return await exercise(); }
    catch (error) { error.message += '\n' + log; throw error; }
    finally { await stop(child); await writeFile(path.join(runtime, 'kernel.log'), log); }
  }
  async function tunnel(label, allowedPort) {
    const server = track(http.createServer((query, response) => { response.writeHead(405); response.end(); }));
    server.on('connect', (query, socket, head) => {
      if (query.url !== `127.0.0.1:${allowedPort}`) return socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      const upstream = net.connect(allowedPort, '127.0.0.1'); sockets.add(upstream);
      upstream.on('error', () => socket.destroy()); upstream.once('close', () => { sockets.delete(upstream); socket.destroy(); }); socket.once('close', () => upstream.destroy());
      upstream.once('connect', () => { tunnels.push(label); socket.write('HTTP/1.1 200 Connection established\r\n\r\n'); if (head.length) upstream.write(head); socket.pipe(upstream); upstream.pipe(socket); });
    });
    return listen(server);
  }
  try {
    let targetRequests = 0;
    const target = track(http.createServer((query, response) => { targetRequests++; response.end('INTEGRITY-OK'); })), targetPort = await listen(target);
    const subscription = track(http.createServer((query, response) => { const source = sources.get(query.url); response.writeHead(source ? 200 : 404); response.end(source ?? ''); })), subscriptionPort = await listen(subscription);
    const inputFile = path.join(fixtureRoot, 'private/input.json'), outputFile = path.join(fixtureRoot, 'private/output.json'), mixed = await freePort();
    const baseInput = { version: 1, subscriptions: [{ name: 'Native', url: `http://127.0.0.1:${subscriptionPort}/nodes` }], listenerPorts: { mixed },
      dnsUpstreams: Object.fromEntries(['local', 'bootstrap', 'domestic', 'remote'].map(role => [role, 'tcp://127.0.0.1:9'])) };
    const generate = async options => {
      await writeFile(inputFile, JSON.stringify({ ...baseInput, ...options }), { mode: 0o600 });
      await createPrivateProfile({ root: fixtureRoot, client: 'singBox', inputFile, outputFile });
      return JSON.parse(await readFile(outputFile, 'utf8'));
    };
    function qxParserClient(content, nativeClient) {
      let calls = 0, callback;
      // This VM is the published parser contract only; it has no network or storage globals.
      const context = vm.createContext({ $resource: { type: 'server', content }, $done: result => { calls++; callback = result; return result; } });
      const result = vm.runInContext(parserBundle, context, { timeout: 3000 });
      assert.equal(calls, 1); assert.equal(result, callback);
      assert.deepEqual(Object.keys(result), ['content']);
      const lines = result.content.trim().split('\n'); assert.equal(lines.length, 1);
      const parts = lines[0].split(',').map(part => part.trim()), address = /^shadowsocks=(127\.0\.0\.1):(\d+)$/.exec(parts.shift());
      assert.ok(address, 'parser fixture must remain on its loopback SS endpoint');
      const fields = Object.fromEntries(parts.map(part => { const at = part.indexOf('='); return [part.slice(0, at).trim(), part.slice(at + 1).trim()]; }));
      assert.equal(fields.tag, 'SS');
      const config = structuredClone(nativeClient), outbound = config.outbounds.find(node => node.tag === fields.tag);
      assert.ok(outbound);
      // Use the actual parser output, retaining the original fixture routing and listener.
      Object.assign(outbound, { server: address[1], server_port: Number(address[2]), method: fields.method, password: fields.password });
      return config;
    }
    const ssPort = await freePort(), password = 'synthetic%2Fpassword', method = 'aes-128-gcm';
    const ssServer = { inbounds: [{ type: 'shadowsocks', listen: '127.0.0.1', listen_port: ssPort, method, password }], outbounds: [{ type: 'direct', tag: 'direct' }], route: { final: 'direct' } };
    await kernel('ss-server', ssServer, ssPort, async () => {
      let ssClient;
      for (const format of ['userinfo', 'legacy']) {
        sources.set('/nodes', format === 'userinfo' ? `ss://${Buffer.from(`${method}:${password}`).toString('base64url')}@127.0.0.1:${ssPort}#SS`
          : `ss://${Buffer.from(`${method}:${password}@127.0.0.1:${ssPort}`).toString('base64')}#SS`);
        ssClient = await generate();
        assert.equal(ssClient.outbounds.find(node => node.tag === 'SS').password, password);
        const result = await kernel('ss-' + format, ssClient, mixed, () => request(mixed, targetPort));
        assert.equal(result.body, 'INTEGRITY-OK'); cases.push({ id: 'ss-' + format, nativeAuthenticatedHttp: 'passed' });
        const response = await fetch(baseInput.subscriptions[0].url, { signal: AbortSignal.timeout(2000) });
        assert.equal(response.status, 200);
        ssClient = qxParserClient(await response.text(), ssClient);
        const parsed = ssClient.outbounds.find(node => node.tag === 'SS');
        assert.equal(parsed.server, '127.0.0.1'); assert.equal(parsed.server_port, ssPort); assert.equal(parsed.method, method); assert.equal(parsed.password, password);
        const parsedResult = await kernel('qx-parser-ss-' + format, ssClient, mixed, () => request(mixed, targetPort));
        assert.equal(parsedResult.status, 200); assert.equal(parsedResult.body, 'INTEGRITY-OK');
        cases.push({ id: 'qx-parser-ss-' + format, finalBundle: true, identityCompletion: true, nativeAuthenticatedHttp: 'passed' });
      }
      // Reproduce the old legacy converter's second percent decode on the parser's real output.
      const mutated = structuredClone(ssClient); mutated.outbounds.find(node => node.tag === 'SS').password = decodeURIComponent(password);
      const before = targetRequests, wrong = await kernel('negative-control-ss-password', mutated, mixed, () => request(mixed, targetPort));
      assert.notEqual(wrong.status, 200); assert.equal(targetRequests, before);
      cases.push({ id: 'negative-control-ss-password', incorrectPasswordRejected: true, oldPercentDecodeRejected: true });
      const innerPort = await tunnel('Inner', targetPort), outerPort = await tunnel('Outer', innerPort);
      const outer = { type: 'http', tag: 'Outer', server: '127.0.0.1', server_port: outerPort };
      const inner = { type: 'http', tag: 'Inner', server: '127.0.0.1', server_port: innerPort, detour: 'Carrier' };
      const outbounds = [outer, { type: 'selector', tag: 'Carrier', outbounds: ['Outer'], default: 'Outer' }, inner];
      const original = { inbounds: [{ type: 'mixed', listen: '127.0.0.1', listen_port: mixed }], outbounds, route: { final: 'Inner' } };
      let start = tunnels.length;
      const raw = await kernel('original-native-chain', original, mixed, () => request(mixed, targetPort));
      assert.equal(raw.body, 'INTEGRITY-OK'); assert.deepEqual(tunnels.slice(start).sort(), ['Inner', 'Outer']);
      cases.push({ id: 'original-native-chain', bothProxyHops: true, actualHttp: 'passed' });
      sources.set('/nodes', JSON.stringify({ outbounds: [{ ...inner, detour: 'Outer' }] }));
      const combined = await generate({ nodes: [outer], selectedProxy: 'Inner' });
      start = tunnels.length;
      const valid = await kernel('combined-real-node-detour', combined, mixed, () => request(mixed, targetPort));
      assert.equal(valid.body, 'INTEGRITY-OK'); assert.deepEqual(tunnels.slice(start).sort(), ['Inner', 'Outer']);
      cases.push({ id: 'combined-real-node-detour', crossInputDependencyPreserved: true, actualHttp: 'passed' });
      const previous = await readFile(outputFile), filesBefore = (await readdir(path.dirname(outputFile))).sort();
      sources.set('/nodes', JSON.stringify({ outbounds }));
      await writeFile(inputFile, JSON.stringify({ ...baseInput, selectedProxy: 'Inner' }), { mode: 0o600 });
      await assert.rejects(() => createPrivateProfile({ root: fixtureRoot, client: 'singBox', inputFile, outputFile }), /outbound dependency/i);
      assert.ok((await readFile(outputFile)).equals(previous)); assert.deepEqual((await readdir(path.dirname(outputFile))).sort(), filesBefore);
      cases.push({ id: 'discarded-carrier-import', rejectedBeforePublication: true, preservedLastGoodProfile: true });
      const retained = await kernel('preserved-good-profile', JSON.parse(previous), mixed, () => request(mixed, targetPort));
      assert.equal(retained.body, 'INTEGRITY-OK'); cases.push({ id: 'preserved-good-profile', actualHttpAfterRejectedRefresh: 'passed' });
      const broken = structuredClone(original); broken.outbounds = broken.outbounds.filter(node => node.tag !== 'Carrier');
      await assert.rejects(() => kernel('negative-control-dropped-carrier', broken, mixed, () => request(mixed, targetPort)), /dependency\[Carrier\] not found/);
      cases.push({ id: 'negative-control-dropped-carrier', nativeStartupRejected: true });
    });
    const report = { status: 'passed', cases, parserBundleSha256: createHash('sha256').update(parserBundle).digest('hex'), nativeQx: 'not-run', targets: 'synthetic loopback subscriptions, final QX parser bundle in VM, native Shadowsocks and two HTTP proxy hops; no app or system setting changes', directory, report: path.join(directory, 'verification.json') };
    await writeFile(report.report, JSON.stringify(report, null, 2)); return report;
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of servers) await new Promise(resolve => server.close(resolve));
  }
}
