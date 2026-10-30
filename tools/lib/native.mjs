import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { renderProfile } from './profiles.mjs';
import { orderedRulesets } from './policies.mjs';
import { normalizeRuleset } from './rules.mjs';
import { renderRuleset } from './exporters.mjs';

const execute = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const executableNames = { mihomo: 'mihomo', singBox: 'sing-box' };
const officialRepositories = { mihomo: 'MetaCubeX/mihomo', singBox: 'SagerNet/sing-box' };
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function artifactFor(registry, id, platform = `${process.platform}-${process.arch}`) {
  if (registry.version !== 1 || !Array.isArray(registry.tools)) throw new Error('Invalid native tool registry');
  const tool = registry.tools.find(item => item.id === id);
  if (!tool || !Object.hasOwn(executableNames, id)) throw new Error(`Unknown native tool: ${id}`);
  if (tool.repo !== officialRepositories[id] || !/^\d+\.\d+\.\d+$/.test(tool.version)) throw new Error('Native tools require a pinned official release');
  const asset = tool.assets?.[platform];
  if (!asset || !['darwin-arm64', 'linux-x64'].includes(platform)) throw new Error(`Unsupported native platform: ${platform}`);
  if (!/^[a-zA-Z0-9._-]+$/.test(asset.file) || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid native artifact filename or SHA-256');
  return { id, version: tool.version, platform, ...asset, url: `https://github.com/${tool.repo}/releases/download/v${tool.version}/${asset.file}` };
}

export function verifyArtifact(bytes, expected) {
  const actual = sha256(bytes);
  if (!/^[a-f0-9]{64}$/.test(expected) || actual !== expected) throw new Error(`Native artifact SHA-256 mismatch: expected ${expected}, got ${actual}`);
  return actual;
}

export function decodeToolArchive(bytes, artifact) {
  const expanded = gunzipSync(bytes, { maxOutputLength: 256 * 1024 * 1024 });
  if (artifact.kind === 'gzip') return expanded;
  if (artifact.kind !== 'tar' || typeof artifact.member !== 'string'
    || artifact.member.startsWith('/') || artifact.member.split('/').some(part => !part || part === '..' || part === '.')) {
    throw new Error('Invalid native archive kind or member path');
  }
  let result;
  for (let offset = 0; offset + 512 <= expanded.length;) {
    const header = expanded.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const text = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const name = [text(345, 155), text(0, 100)].filter(Boolean).join('/');
    const rawSize = text(124, 12).trim();
    if (!/^[0-7]+$/.test(rawSize)) throw new Error('Invalid TAR member size');
    const size = Number.parseInt(rawSize, 8);
    const end = offset + 512 + size;
    if (!Number.isSafeInteger(size) || end > expanded.length) throw new Error('Truncated TAR member');
    if (name === artifact.member) {
      if (![0, 48].includes(header[156])) throw new Error('Native TAR member must be a regular file');
      if (result) throw new Error('Duplicate native TAR member');
      result = Buffer.from(expanded.subarray(offset + 512, end));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!result?.length) throw new Error(`Missing native executable member: ${artifact.member}`);
  return result;
}

async function fileExists(file) {
  try { await access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function fetchArtifact(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': 'netatlas-native-check' } });
  if (!response.ok) throw new Error(`Native download HTTP ${response.status}: ${url}`);
  const chunks = [];
  let count = 0;
  for await (const chunk of response.body) {
    count += chunk.length;
    if (count > 100 * 1024 * 1024) throw new Error('Native artifact exceeds 100 MiB');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function installNativeTools({ root, platform = `${process.platform}-${process.arch}`, fetchBytes = fetchArtifact, onProgress = () => {} }) {
  const registry = JSON.parse(await readFile(path.join(root, 'metadata/native-tools.json'), 'utf8'));
  const binaries = {};
  const artifacts = [];
  await mkdir(path.join(root, '.cache/bin'), { recursive: true });
  for (const id of ['mihomo', 'singBox']) {
    const artifact = artifactFor(registry, id, platform);
    const directory = path.join(root, '.cache/native-tools', platform);
    await mkdir(directory, { recursive: true });
    const archivePath = path.join(directory, artifact.file);
    onProgress(`Verify ${id} ${artifact.version} (${platform})`);
    const archive = await fileExists(archivePath) ? await readFile(archivePath) : await fetchBytes(artifact.url);
    verifyArtifact(archive, artifact.sha256);
    if (!await fileExists(archivePath)) await writeFile(archivePath, archive);
    const executable = decodeToolArchive(archive, artifact);
    const executableSha256 = sha256(executable);
    const binary = path.join(root, '.cache/bin', executableNames[id]);
    const current = await fileExists(binary) ? await readFile(binary) : null;
    if (!current || sha256(current) !== executableSha256) {
      const staged = path.join(directory, `${executableNames[id]}.verified-${randomUUID()}`);
      await writeFile(staged, executable, { mode: 0o755 });
      if (current) await rename(binary, path.join(directory, `${executableNames[id]}.previous-${randomUUID()}`));
      await rename(staged, binary);
    }
    await chmod(binary, 0o755);
    binaries[id] = binary;
    artifacts.push({ id, version: artifact.version, platform, archiveSha256: artifact.sha256, executableSha256 });
  }
  return { binaries, artifacts };
}

async function run(binary, args, cwd) {
  try {
    const result = await execute(binary, args, { cwd, timeout: 30_000, maxBuffer: 1_000_000, encoding: 'utf8' });
    return `${result.stdout}${result.stderr}`.trim();
  } catch (error) {
    throw new Error(`Native command failed: ${path.basename(binary)} ${args.join(' ')}\n${error.stdout || ''}${error.stderr || error.message}`, { cause: error });
  }
}

async function catalog(root) {
  const folder = path.join(root, 'src/rules');
  const files = (await readdir(folder, { recursive: true })).filter(file => file.endsWith('.json')).sort();
  return orderedRulesets(await Promise.all(files.map(async file => normalizeRuleset(JSON.parse(await readFile(path.join(folder, file), 'utf8'))))));
}

async function cacheDirectory(root, prefix) {
  const base = path.join(root, '.cache/native-check');
  await mkdir(base, { recursive: true });
  return mkdtemp(path.join(base, prefix));
}

export async function checkNativeProfiles({ root, binaries, onProgress = () => {} }) {
  const directory = await cacheDirectory(root, 'catalog-');
  const rulesets = await catalog(root);
  const results = [];
  for (const id of ['mihomo', 'singBox']) {
    const profile = renderProfile(id, { rulesets });
    const published = path.join(root, 'clients', id, profile.path);
    const fallback = path.join(directory, `${id}.${profile.format === 'json' ? 'json' : 'yaml'}`);
    const profilePath = await fileExists(published) ? published : fallback;
    if (profilePath === fallback) await writeFile(fallback, profile.content);
    const profileBytes = await readFile(profilePath);
    const snapshot = path.join(directory, `${id}-checked.${profile.format === 'json' ? 'json' : 'yaml'}`);
    await writeFile(snapshot, profileBytes);
    onProgress(`Native check: ${id} full catalog profile`);
    const args = id === 'mihomo' ? ['-t', '-f', snapshot, '-d', directory] : ['check', '-c', snapshot];
    const output = await run(binaries[id], args, directory);
    await writeFile(path.join(directory, `${id}-check.log`), `${output}\n`);
    results.push({ client: id, status: 'passed', profile: path.relative(root, profilePath), checkedSnapshot: path.relative(root, snapshot), profileSha256: sha256(profileBytes), catalogRulesets: rulesets.length });
  }
  const compiled = [];
  for (const ruleset of rulesets) {
    const output = renderRuleset('singBox', ruleset);
    const published = path.join(root, 'clients/singBox', output.path);
    const generated = path.join(directory, `${ruleset.id}.json`);
    const input = await fileExists(published) ? published : generated;
    if (input === generated) await writeFile(generated, output.content);
    const inputBytes = await readFile(input);
    await writeFile(generated, inputBytes);
    const binary = path.join(directory, `${ruleset.id}.srs`);
    await run(binaries.singBox, ['rule-set', 'compile', generated, '-o', binary], directory);
    const bytes = await readFile(binary);
    assert.ok(bytes.length > 3, `Empty SRS: ${ruleset.id}`);
    compiled.push({ id: ruleset.id, status: 'passed', input: path.relative(root, input), checkedSnapshot: path.relative(root, generated), inputSha256: sha256(inputBytes), bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { profiles: results, compiled, directory: path.relative(root, directory), unavailableNativeCli: ['quantumultX', 'surge', 'loon', 'shadowrocket', 'egern', 'stash'] };
}

async function listen(server, host = '127.0.0.1') {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, host, resolve); });
  return server.address().port;
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function localDns() {
  const server = dgram.createSocket('udp4');
  server.on('message', (query, sender) => {
    if (query.length < 17 || query.readUInt16BE(4) !== 1) return;
    let offset = 12;
    while (offset < query.length && query[offset]) {
      if (query[offset] > 63 || offset + query[offset] >= query.length) return;
      offset += query[offset] + 1;
    }
    if (offset + 5 > query.length) return;
    const qtype = query.readUInt16BE(offset + 1);
    const header = Buffer.alloc(12);
    query.copy(header, 0, 0, 2);
    header.writeUInt16BE(0x8180, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(qtype === 1 ? 1 : 0, 6);
    const answer = qtype === 1 ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, 127, 0, 0, 1]) : Buffer.alloc(0);
    server.send(Buffer.concat([header, query.subarray(12, offset + 5), answer]), sender.port, sender.address);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.bind(0, '127.0.0.1', resolve); });
  return { server, port: server.address().port };
}

async function localSocksUpstream(targetPort) {
  const sockets = new Set();
  const hosts = new Set(['127.0.0.1', 'allowed.netatlas.test', 'blocked.netatlas.test', 'fallback.netatlas.test', 'doubleclick.net', 'sub.doubleclick.net', 'baddoubleclick.net', 'doubleclick.net.invalid']);
  let requests = 0;
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    socket.setTimeout(5_000, () => socket.destroy());
    let buffer = Buffer.alloc(0);
    let state = 'greeting';
    const parse = bytes => {
      buffer = Buffer.concat([buffer, bytes]);
      if (state === 'greeting') {
        if (buffer.length < 2 || buffer.length < 2 + buffer[1]) return;
        if (buffer[0] !== 5 || !buffer.subarray(2, 2 + buffer[1]).includes(0)) return socket.end(Buffer.from([5, 255]));
        buffer = buffer.subarray(2 + buffer[1]);
        socket.write(Buffer.from([5, 0]));
        state = 'connect';
      }
      if (state !== 'connect' || buffer.length < 4) return;
      const type = buffer[3];
      const length = type === 1 ? 10 : type === 4 ? 22 : type === 3 && buffer.length >= 5 ? 7 + buffer[4] : 0;
      if (!length || buffer.length < length) return;
      const host = type === 1 ? [...buffer.subarray(4, 8)].join('.') : type === 3 ? buffer.subarray(5, 5 + buffer[4]).toString('utf8') : '';
      if (buffer[0] !== 5 || buffer[1] !== 1 || !hosts.has(host) || buffer.readUInt16BE(length - 2) !== targetPort) {
        return socket.end(Buffer.from([5, 2, 0, 1, 127, 0, 0, 1, 0, 0]));
      }
      state = 'connecting';
      buffer = buffer.subarray(length);
      const upstream = net.createConnection({ host: '127.0.0.1', port: targetPort });
      sockets.add(upstream);
      upstream.once('close', () => { sockets.delete(upstream); socket.destroy(); });
      upstream.on('error', () => socket.destroy());
      socket.once('close', () => upstream.destroy());
      upstream.once('connect', () => {
        requests++;
        socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]));
        socket.removeListener('data', parse);
        if (buffer.length) upstream.write(buffer);
        socket.pipe(upstream);
        upstream.pipe(socket);
      });
    };
    socket.on('data', parse);
  });
  const port = await listen(server);
  return {
    port,
    requests: () => requests,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

function httpThroughProxy(proxyPort, host, targetPort) {
  return new Promise(resolve => {
    const request = http.request({ hostname: '127.0.0.1', port: proxyPort, method: 'GET', path: `http://${host}:${targetPort}/native-http`, headers: { Host: `${host}:${targetPort}`, Connection: 'close' }, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), status: response.statusCode }));
      response.on('error', error => resolve({ error: error.code || error.message }));
    });
    request.setTimeout(5_000, () => request.destroy(new Error('Local proxy request timed out')));
    request.on('error', error => resolve({ error: error.code || error.message }));
    request.end();
  });
}

function socksThroughProxy(proxyPort, host, targetPort) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: proxyPort });
    let state = 'greeting';
    let buffer = Buffer.alloc(0);
    let finished = false;
    const finish = result => { if (finished) return; finished = true; socket.destroy(); resolve(result); };
    socket.setTimeout(5_000, () => finish({ error: 'Local SOCKS request timed out' }));
    socket.once('error', error => finish({ error: error.code || error.message }));
    socket.once('connect', () => socket.write(Buffer.from([5, 1, 0])));
    socket.on('data', bytes => {
      buffer = Buffer.concat([buffer, bytes]);
      if (state === 'greeting' && buffer.length >= 2) {
        if (buffer[0] !== 5 || buffer[1] !== 0) return finish({ error: 'SOCKS greeting rejected' });
        buffer = buffer.subarray(2);
        const name = Buffer.from(host);
        socket.write(Buffer.concat([Buffer.from([5, 1, 0, 3, name.length]), name, Buffer.from([targetPort >> 8, targetPort & 255])]));
        state = 'connect';
      }
      if (state === 'connect' && buffer.length >= 4) {
        if (buffer[1] !== 0) return finish({ error: `SOCKS connection rejected (${buffer[1]})` });
        const length = buffer[3] === 1 ? 10 : buffer[3] === 4 ? 22 : buffer[3] === 3 && buffer.length >= 5 ? 7 + buffer[4] : 0;
        if (!length || buffer.length < length) return;
        buffer = buffer.subarray(length);
        state = 'http';
        socket.write(`GET /native-socks HTTP/1.1\r\nHost: ${host}:${targetPort}\r\nConnection: close\r\n\r\n`);
      }
    });
    socket.once('end', () => finish(state === 'http' ? { body: buffer.toString('utf8') } : { error: 'SOCKS connection closed' }));
    socket.once('close', () => { if (!finished) finish({ error: 'SOCKS connection closed' }); });
  });
}

async function waitForPort(child, port) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.startupError) throw new Error(`Native process exited before its local port opened: ${child.startupError || child.exitCode}`);
    const ready = await new Promise(resolve => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(100);
      const finish = result => { socket.destroy(); resolve(result); };
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.once('timeout', () => finish(false));
    });
    if (ready) return;
    await pause(50);
  }
  throw new Error('Native proxy readiness timed out');
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('close', resolve)), pause(2_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await new Promise(resolve => child.once('close', resolve));
  }
}

export async function testLocalRouting({ root, binaries, onProgress = () => {} }) {
  const directory = await cacheDirectory(root, 'routing-');
  const token = `netatlas-local-${randomUUID()}`;
  let targetRequests = 0;
  const target = http.createServer((request, response) => {
    targetRequests++;
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(token), Connection: 'close' });
    response.end(token);
  });
  const targetPort = await listen(target);
  let dns;
  let upstream;
  const rulesets = [
    { version: 1, id: 'lan', category: 'network', entries: [{ type: 'domain', value: 'allowed.netatlas.test' }] },
    { version: 1, id: 'adblock', category: 'privacy', entries: [{ type: 'domain', value: 'blocked.netatlas.test' }, { type: 'domain-suffix', value: 'doubleclick.net' }] },
  ];
  const cases = [];
  try {
    dns = await localDns();
    upstream = await localSocksUpstream(targetPort);
    for (const id of ['mihomo', 'singBox']) {
      for (const selection of ['REJECT', 'DIRECT', 'FixtureProxy']) {
        const proxyPort = await freePort();
        const source = renderProfile(id, { rulesets });
        const config = id === 'mihomo' ? parseYaml(source.content) : JSON.parse(source.content);
        if (id === 'mihomo') {
          config['mixed-port'] = proxyPort;
          config.dns = { enable: true, ipv6: false, 'enhanced-mode': 'redir-host', nameserver: [`udp://127.0.0.1:${dns.port}`], 'default-nameserver': [`127.0.0.1:${dns.port}`] };
          if (selection === 'FixtureProxy') config.proxies = [{ name: 'FixtureProxy', type: 'socks5', server: '127.0.0.1', port: upstream.port, udp: false }];
          config['proxy-groups'].find(group => group.name === 'Proxy').proxies = [selection, ...['REJECT', 'DIRECT'].filter(item => item !== selection)];
        } else {
          config.inbounds[0].listen_port = proxyPort;
          config.dns = { servers: [{ type: 'udp', tag: 'fixture-dns', server: '127.0.0.1', server_port: dns.port }], final: 'fixture-dns' };
          config.route.default_domain_resolver = 'fixture-dns';
          const proxy = config.outbounds.find(outbound => outbound.tag === 'Proxy');
          if (selection === 'FixtureProxy') {
            config.outbounds.push({ type: 'socks', tag: 'FixtureProxy', server: '127.0.0.1', server_port: upstream.port, version: '5' });
            proxy.outbounds.push('FixtureProxy');
          }
          proxy.default = selection;
        }
        const configPath = path.join(directory, `${id}-${selection}.${id === 'mihomo' ? 'yaml' : 'json'}`);
        await writeFile(configPath, id === 'mihomo' ? stringifyYaml(config) : `${JSON.stringify(config, null, 2)}\n`);
        const args = id === 'mihomo' ? ['-f', configPath, '-d', directory] : ['run', '-c', configPath];
        onProgress(`Local routing: ${id}, Proxy=${selection}, HTTP + SOCKS5`);
        const child = spawn(binaries[id], args, { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
        let log = '';
        child.on('error', error => { child.startupError = error.message; });
        child.stdout.on('data', bytes => { log = (log + bytes).slice(-200_000); });
        child.stderr.on('data', bytes => { log = (log + bytes).slice(-200_000); });
        try {
          await waitForPort(child, proxyPort);
          const targets = selection === 'REJECT'
            ? [['allowed.netatlas.test', true, 'explicit-direct'], ['blocked.netatlas.test', false, 'explicit-reject'], ['fallback.netatlas.test', false, 'fallback-reject']]
            : selection === 'DIRECT' ? [['fallback.netatlas.test', true, 'fallback-direct']]
              : [['allowed.netatlas.test', true, 'explicit-direct'], ['blocked.netatlas.test', false, 'explicit-reject'],
                ['doubleclick.net', false, 'suffix-root-reject'], ['sub.doubleclick.net', false, 'suffix-child-reject'],
                ['baddoubleclick.net', true, 'suffix-similar-fallback'], ['doubleclick.net.invalid', true, 'suffix-tail-fallback'],
                ['fallback.netatlas.test', true, 'fallback-proxy']];
          for (const [protocol, request] of [['http', httpThroughProxy], ['socks5', socksThroughProxy]]) {
            for (const [host, permitted, behavior] of targets) {
              const before = targetRequests;
              const upstreamBefore = upstream.requests();
              const result = await request(proxyPort, host, targetPort);
              const reached = Boolean(result.body?.includes(token));
              assert.equal(reached, permitted, `${id} ${protocol} ${behavior}: ${JSON.stringify(result)}`);
              assert.equal(targetRequests - before, permitted ? 1 : 0, `${id} ${protocol} ${behavior}: unexpected target request`);
              const usesUpstream = selection === 'FixtureProxy' && permitted && behavior !== 'explicit-direct';
              assert.equal(upstream.requests() - upstreamBefore, usesUpstream ? 1 : 0, `${id} ${protocol} ${behavior}: unexpected SOCKS upstream connection`);
              cases.push({ client: id, protocol, behavior, status: 'passed' });
            }
          }
        } finally {
          await stop(child);
          await writeFile(path.join(directory, `${id}-${selection}.log`), log);
        }
      }
    }
  } finally {
    if (upstream) await upstream.close();
    target.closeAllConnections();
    await new Promise(resolve => target.close(resolve));
    if (dns) await new Promise(resolve => dns.server.close(resolve));
  }
  return { status: 'passed', cases, targetRequests, upstreamRequests: upstream.requests(), targets: 'loopback HTTP, SOCKS5 and DNS only; system proxy unchanged', directory: path.relative(root, directory) };
}

export async function runNativeVerification({ root, onProgress = () => {} }) {
  const startedAt = new Date().toISOString();
  const installed = await installNativeTools({ root, onProgress });
  const checks = await checkNativeProfiles({ root, binaries: installed.binaries, onProgress });
  const routing = await testLocalRouting({ root, binaries: installed.binaries, onProgress });
  const report = { status: 'passed', startedAt, completedAt: new Date().toISOString(), artifacts: installed.artifacts, checks, routing };
  await writeFile(path.join(root, '.cache/native-check/latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
