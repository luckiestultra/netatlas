import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import vm from 'node:vm';
import { assertManagedPaths } from './managed-paths.mjs';
import { waitForMihomoRunning } from './native.mjs';
import { bundleResourceParser } from './resource-parser-bundle.mjs';

const password = 'synthetic-resource-parser-password';
const master = createHash('md5').update(password).digest();
const subkey = salt => Buffer.from(hkdfSync('sha1', master, salt, Buffer.from('ss-subkey'), 16));
function nextNonce(nonce) { for (let index = 0; index < nonce.length; index++) { nonce[index]++; if (nonce[index]) break; } }
function seal(key, nonce, bytes) {
  const cipher = createCipheriv('aes-128-gcm', key, nonce);
  const result = Buffer.concat([cipher.update(bytes), cipher.final(), cipher.getAuthTag()]); nextNonce(nonce); return result;
}
function open(key, nonce, bytes) {
  const cipher = createDecipheriv('aes-128-gcm', key, nonce); cipher.setAuthTag(bytes.subarray(-16));
  const result = Buffer.concat([cipher.update(bytes.subarray(0, -16)), cipher.final()]); nextNonce(nonce); return result;
}
function frame(bytes, opcode = 2) {
  if (bytes.length < 126) return Buffer.concat([Buffer.from([0x80 | opcode, bytes.length]), bytes]);
  const header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(bytes.length, 2);
  return Buffer.concat([header, bytes]);
}
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
async function freePort() {
  const server = net.createServer(), port = await listen(server); await new Promise(resolve => server.close(resolve)); return port;
}
async function stop(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000); timer.unref(); await exited; clearTimeout(timer);
}
function request(port) {
  return new Promise((resolve, reject) => {
    // A routing regression can reach only the loopback discard port.
    const query = http.get({ host: '127.0.0.1', port, path: 'http://127.0.0.1:9/proof', headers: { Host: '127.0.0.1:9' }, agent: false }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
      response.on('error', reject);
    });
    query.once('error', reject); query.setTimeout(4000, () => query.destroy(new Error('SS-over-WS fixture request timed out')));
  });
}

// Minimal synthetic SS AEAD endpoint: decrypt the real native request and return
// an encrypted HTTP response. It never dials the requested destination.
function acceptWebsocket(query, socket, head, observation) {
  observation.upgrades.push({ path: query.url, host: query.headers.host });
  const accept = createHash('sha1').update(query.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  let websocket = Buffer.alloc(0), encrypted = Buffer.alloc(0), plain = Buffer.alloc(0), key, length, replied = false;
  const nonce = Buffer.alloc(12);
  function receiveEncrypted(bytes) {
    encrypted = Buffer.concat([encrypted, bytes]);
    if (!key) { if (encrypted.length < 16) return; key = subkey(encrypted.subarray(0, 16)); encrypted = encrypted.subarray(16); }
    while (true) {
      if (length === undefined) {
        if (encrypted.length < 18) return;
        length = open(key, nonce, encrypted.subarray(0, 18)).readUInt16BE(); encrypted = encrypted.subarray(18);
        assert.ok(length <= 0x3fff, 'SS AEAD payload limit');
      }
      if (encrypted.length < length + 16) return;
      plain = Buffer.concat([plain, open(key, nonce, encrypted.subarray(0, length + 16))]); encrypted = encrypted.subarray(length + 16); length = undefined;
      if (replied || plain.length < 7) continue;
      assert.equal(plain[0], 1, 'explicit IPv4 destination'); assert.deepEqual([...plain.subarray(1, 5)], [127, 0, 0, 1]); assert.equal(plain.readUInt16BE(5), 9);
      const requestText = plain.subarray(7).toString(); if (!requestText.includes('\r\n\r\n')) continue;
      assert.match(requestText, /^GET \/proof HTTP\/1\.1\r\n/); observation.decryptedRequest = requestText;
      const body = 'NATIVE_WS_OK_' + observation.id;
      const response = Buffer.from(`HTTP/1.1 200 OK\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
      const salt = randomBytes(16), responseKey = subkey(salt), responseNonce = Buffer.alloc(12), responseLength = Buffer.alloc(2); responseLength.writeUInt16BE(response.length);
      socket.write(frame(Buffer.concat([salt, seal(responseKey, responseNonce, responseLength), seal(responseKey, responseNonce, response)]))); replied = true;
    }
  }
  function receive(bytes) {
    try {
      websocket = Buffer.concat([websocket, bytes]); assert.ok(websocket.length <= 1024 * 1024, 'bounded fixture frame buffer');
      while (websocket.length >= 2) {
        const opcode = websocket[0] & 15, masked = Boolean(websocket[1] & 128); let size = websocket[1] & 127, offset = 2;
        if (size === 126) { if (websocket.length < 4) return; size = websocket.readUInt16BE(2); offset = 4; }
        else assert.notEqual(size, 127, 'fixture does not accept 64-bit frame lengths');
        const maskOffset = offset; if (masked) offset += 4; if (websocket.length < offset + size) return;
        const payload = Buffer.from(websocket.subarray(offset, offset + size));
        if (masked) for (let index = 0; index < size; index++) payload[index] ^= websocket[maskOffset + index % 4];
        websocket = websocket.subarray(offset + size);
        if (opcode === 8) { socket.end(frame(payload, 8)); return; }
        if (opcode === 9) { socket.write(frame(payload, 10)); continue; }
        if (opcode === 0 || opcode === 2) receiveEncrypted(payload);
      }
    } catch (error) { observation.serverError = error.message; socket.destroy(); }
  }
  socket.on('data', receive); if (head.length) receive(head);
}

// Explicit opt-in: native Mihomo, synthetic auth, loopback sockets/destination,
// and no TUN, system proxy, private subscriptions or Quantumult X execution.
export async function testResourceParserPlugins({ root, binaries }) {
  await assertManagedPaths(root, ['.cache/native-check']);
  const cache = path.join(root, '.cache/native-check'); await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(path.join(cache, 'resource-parser-plugins-'));
  const sockets = new Set(), server = http.createServer(), cases = [], bundle = bundleResourceParser(); let current;
  server.on('connection', socket => { sockets.add(socket); socket.on('error', () => {}); socket.once('close', () => sockets.delete(socket)); });
  server.on('upgrade', (query, socket, head) => { if (current) acceptWebsocket(query, socket, head, current); else socket.destroy(); });
  const fixtures = [
    { id: 'literal-semicolon-tls', options: { host: 'front.example', path: '/ws;tls' }, host: 'front.example' },
    { id: 'literal-semicolon-equals', options: { tls: false, host: 'front.example', path: '/ws;version=2' }, host: 'front.example' },
    { id: 'source-default-host', options: { tls: false, path: '/ws' }, host: 'bing.com' },
  ];
  try {
    const websocketPort = await listen(server);
    for (const fixture of fixtures) {
      const runtime = path.join(directory, fixture.id); await mkdir(runtime, { mode: 0o700 });
      const port = await freePort(), marker = 'netatlas-mihomo-running-' + randomUUID();
      const node = { name: 'SS', type: 'ss', server: '127.0.0.1', port: websocketPort, cipher: 'aes-128-gcm', password, plugin: 'v2ray-plugin', 'plugin-opts': { mode: 'websocket', mux: false, ...fixture.options } };
      const context = vm.createContext({ $resource: { type: 'server', content: JSON.stringify({ proxies: [node] }) } });
      vm.runInContext('var $done = function(result) {return result}', context);
      const converted = vm.runInContext(bundle, context, { timeout: 3000 });
      assert.deepEqual(Object.keys(converted), ['content']); assert.match(converted.content, /obfs=ws,/);
      assert.ok(converted.content.includes('obfs-host=' + fixture.host + ',')); assert.ok(converted.content.includes('obfs-uri=' + fixture.options.path + ','));
      const config = { 'mixed-port': port, 'bind-address': '127.0.0.1', 'allow-lan': false, mode: 'rule', dns: { enable: false }, tun: { enable: false }, proxies: [node], rules: ['MATCH,SS'] };
      const file = path.join(runtime, 'config.json'); await writeFile(file, JSON.stringify(config, null, 2), { mode: 0o600 });
      const child = spawn(binaries.mihomo, ['-d', runtime, '-f', file, '-post-up', `printf %s ${marker} > ${marker}.pending && mv ${marker}.pending ${marker}`], { cwd: runtime, stdio: ['ignore', 'pipe', 'pipe'] });
      let log = ''; child.on('error', error => { child.startupError = error.message; });
      child.stdout.on('data', chunk => { log = (log + chunk).slice(-100000); }); child.stderr.on('data', chunk => { log = (log + chunk).slice(-100000); });
      current = { id: fixture.id, upgrades: [] };
      try {
        await waitForMihomoRunning({ child, markerPath: path.join(runtime, marker) });
        const result = await request(port);
        assert.equal(current.serverError, undefined); assert.equal(result.status, 200); assert.equal(result.body, 'NATIVE_WS_OK_' + fixture.id);
        assert.deepEqual(current.upgrades, [{ path: fixture.options.path, host: fixture.host }]); assert.ok(current.decryptedRequest);
        cases.push({ ...current, converted: converted.content, result, status: 'passed' });
      } catch (error) { error.message += '\n' + log; throw error; }
      finally { await stop(child); await writeFile(path.join(runtime, 'kernel.log'), log); for (const socket of sockets) socket.destroy(); current = undefined; }
    }
    const report = { status: 'passed', cases, bundleSha256: createHash('sha256').update(bundle).digest('hex'), directory, report: path.join(directory, 'verification.json'), targets: 'loopback only; native SS AEAD over WS; no TUN/system proxy/QX changes', nativeQx: 'not-run' };
    await writeFile(report.report, JSON.stringify(report, null, 2)); return report;
  } finally { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }
}
