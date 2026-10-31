import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import { watch } from 'node:fs';
import { access, chmod, lstat, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { renderProfile } from './profiles.mjs';
import { orderedRulesets, profileRulesetsFor } from './policies.mjs';
import { matchesEntry, normalizeRuleset } from './rules.mjs';
import { renderRuleset } from './exporters.mjs';
import { renderAntiAd } from './anti-ad.mjs';
import { assertManagedPaths } from './managed-paths.mjs';

const execute = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const executableNames = { mihomo: 'mihomo', singBox: 'sing-box' };
const officialRepositories = { mihomo: 'MetaCubeX/mihomo', singBox: 'SagerNet/sing-box' };
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const fixtureHosts = new Set([
  '127.0.0.1', 'allowed.netatlas.test', 'blocked.netatlas.test', 'fallback.netatlas.test',
  'doubleclick.net', 'sub.doubleclick.net', 'baddoubleclick.net', 'doubleclick.net.invalid',
  'tv.apple.com', 'cdn.tv.apple.com', 'hls.itunes.apple.com', 'sub.hls.itunes.apple.com',
  'copilot-proxy.githubusercontent.com', 'sub.copilot-proxy.githubusercontent.com',
  'registry.npmjs.org', 'www.apple.com', 'api.github.com',
]);

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
  await assertManagedPaths(root, ['metadata/native-tools.json', '.cache/bin', '.cache/native-tools']);
  const registry = JSON.parse(await readFile(path.join(root, 'metadata/native-tools.json'), 'utf8'));
  const binaries = {};
  const artifacts = [];
  // Preflight both tools before any download or mutation. A second-tool symlink
  // must not allow a first-tool install to change the cache before rejection.
  const pending = ['mihomo', 'singBox'].map(id => artifactFor(registry, id, platform));
  await assertManagedPaths(root, pending.flatMap(artifact => [
    path.join('.cache/native-tools', platform, artifact.file),
    path.join('.cache/bin', executableNames[artifact.id]),
  ]));
  await mkdir(path.join(root, '.cache/bin'), { recursive: true });
  for (const artifact of pending) {
    const id = artifact.id;
    const directory = path.join(root, '.cache/native-tools', platform);
    await mkdir(directory, { recursive: true });
    const archivePath = path.join(directory, artifact.file);
    onProgress(`Verify ${id} ${artifact.version} (${platform})`);
    const archive = await fileExists(archivePath) ? await readFile(archivePath) : await fetchBytes(artifact.url);
    verifyArtifact(archive, artifact.sha256);
    await assertManagedPaths(root, [archivePath]);
    if (!await fileExists(archivePath)) await writeFile(archivePath, archive, { flag: 'wx' });
    const executable = decodeToolArchive(archive, artifact);
    const executableSha256 = sha256(executable);
    const binary = path.join(root, '.cache/bin', executableNames[id]);
    await assertManagedPaths(root, [binary]);
    const current = await fileExists(binary) ? await readFile(binary) : null;
    if (!current || sha256(current) !== executableSha256) {
      const staged = path.join(directory, `${executableNames[id]}.verified-${randomUUID()}`);
      await assertManagedPaths(root, [staged, binary]);
      await writeFile(staged, executable, { mode: 0o755, flag: 'wx' });
      if (current) await rename(binary, path.join(directory, `${executableNames[id]}.previous-${randomUUID()}`));
      await rename(staged, binary);
    }
    await assertManagedPaths(root, [binary]);
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
  await assertManagedPaths(root, [base]);
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
    if (!profileBytes.equals(Buffer.from(profile.content))) throw new Error(`Generated ${id} profile is stale; run npm run build before native verification`);
    const snapshot = path.join(directory, `${id}-checked.${profile.format === 'json' ? 'json' : 'yaml'}`);
    await writeFile(snapshot, profileBytes);
    onProgress(`Native check: ${id} full catalog profile`);
    const args = id === 'mihomo' ? ['-t', '-f', snapshot, '-d', directory] : ['check', '-c', snapshot];
    const output = await run(binaries[id], args, directory);
    await writeFile(path.join(directory, `${id}-check.log`), `${output}\n`);
    results.push({ client: id, status: 'passed', profile: path.relative(root, profilePath), checkedSnapshot: path.relative(root, snapshot), profileSha256: sha256(profileBytes), catalogRulesets: rulesets.length, embeddedRulesets: profileRulesetsFor(rulesets).length });
  }
  const compiled = [];
  for (const ruleset of rulesets) {
    const output = renderRuleset('singBox', ruleset);
    const published = path.join(root, 'clients/singBox', output.path);
    const generated = path.join(directory, `${ruleset.id}.json`);
    const input = await fileExists(published) ? published : generated;
    if (input === generated) await writeFile(generated, output.content);
    const inputBytes = await readFile(input);
    if (!inputBytes.equals(Buffer.from(output.content))) throw new Error(`Generated singBox ruleset ${ruleset.id} is stale; run npm run build before native verification`);
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

async function localDns(extraHosts = []) {
  const allowedHosts = new Set([...fixtureHosts, ...extraHosts]);
  const questions = [];
  const server = dgram.createSocket('udp4');
  server.on('message', (query, sender) => {
    if (query.length < 17 || query.readUInt16BE(4) !== 1) return;
    let offset = 12;
    const labels = [];
    while (offset < query.length && query[offset]) {
      if (query[offset] > 63 || offset + query[offset] >= query.length) return;
      labels.push(query.subarray(offset + 1, offset + 1 + query[offset]).toString('ascii').toLowerCase());
      offset += query[offset] + 1;
    }
    if (offset + 5 > query.length) return;
    const qtype = query.readUInt16BE(offset + 1);
    const host = labels.join('.');
    const answerKnownHost = qtype === 1 && allowedHosts.has(host);
    questions.push({ host, type: qtype, answered: answerKnownHost });
    const header = Buffer.alloc(12);
    query.copy(header, 0, 0, 2);
    header.writeUInt16BE(0x8180, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(answerKnownHost ? 1 : 0, 6);
    const answer = answerKnownHost ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, 127, 0, 0, 1]) : Buffer.alloc(0);
    server.send(Buffer.concat([header, query.subarray(12, offset + 5), answer]), sender.port, sender.address);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.bind(0, '127.0.0.1', resolve); });
  return { server, port: server.address().port, questions };
}

async function localSocksUpstream(targetPort) {
  const sockets = new Set();
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
      if (buffer[0] !== 5 || buffer[1] !== 1 || !fixtureHosts.has(host) || buffer.readUInt16BE(length - 2) !== targetPort) {
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

// A listening mixed port does not imply that Mihomo's asynchronous file-rule
// provider has loaded. Query the documented read-only collection API until the
// actual pinned entry count is present; requests before this gate can all fail
// with 502, falsely resembling successful REJECT tests.
// https://wiki.metacubex.one/en/api/#providersrules
export async function waitForMihomoRuleProvider({ controllerPort, secret, expectedCount, child, timeoutMs = 8_000 }) {
  if (!Number.isInteger(controllerPort) || controllerPort < 1 || controllerPort > 65535
    || typeof secret !== 'string' || !secret || /[\r\n]/.test(secret)
    || !Number.isInteger(expectedCount) || expectedCount < 1 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Invalid local rule provider readiness parameters');
  }
  const started = Date.now();
  const deadline = started + timeoutMs;
  const observations = [];
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null || child.startupError)) throw new Error('Native process exited before its rule provider was ready');
    let response;
    try {
      response = await fetch(`http://127.0.0.1:${controllerPort}/providers/rules`, {
        method: 'GET', headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
      });
    } catch (error) {
      // Transport refusal is an observable API-startup state, not a passing
      // provider result. Other API, JSON and schema failures below fail fast.
      observations.push({ elapsedMs: Date.now() - started, transport: error.name });
      await pause(Math.max(0, Math.min(25, deadline - Date.now())));
      continue;
    }
    if (!response.ok) throw new Error(`Local rule provider API returned HTTP ${response.status}`);
    let body;
    try { body = await response.json(); } catch { throw new Error('Local rule provider API returned invalid JSON'); }
    const provider = body?.providers?.['netatlas-anti-ad'];
    if (!provider || !Number.isInteger(provider.ruleCount) || provider.ruleCount < 0) throw new Error('Local rule provider API schema is missing netatlas-anti-ad');
    if (provider.vehicleType !== 'File' || provider.behavior !== 'Classical' || provider.format !== 'YamlRule') throw new Error('Local rule provider must remain File/Classical/YamlRule');
    observations.push({ elapsedMs: Date.now() - started, ruleCount: provider.ruleCount, updatedAt: provider.updatedAt });
    if (provider.ruleCount === expectedCount) {
      return { status: 'passed', endpoint: '/providers/rules', expectedCount, provider, observations };
    }
    if (provider.ruleCount !== 0) throw new Error(`Local rule provider count mismatch: expected ${expectedCount}, got ${provider.ruleCount}`);
    await pause(Math.max(0, Math.min(25, deadline - Date.now())));
  }
  throw new Error(`Local rule provider was not ready with ${expectedCount} rules before its deadline; observed ${JSON.stringify(observations)}`);
}

// The pinned CLI executes -post-up only after hub.Parse has completed:
// loadProvider -> runtime.GC -> tunnel.OnRunning -> return -> post-up.
// Provider ruleCount alone is observable before that transition. Its shell
// output is captured/discarded by ExecShell, so use a private atomic file marker.
// https://github.com/MetaCubeX/mihomo/blob/v1.19.33/main.go
// https://github.com/MetaCubeX/mihomo/blob/v1.19.33/hub/executor/executor.go
// https://github.com/MetaCubeX/mihomo/blob/v1.19.33/common/cmd/cmd.go
export function waitForMihomoRunning({ child, markerPath, timeoutMs = 8_000 }) {
  return new Promise((resolve, reject) => {
    const marker = typeof markerPath === 'string' ? path.basename(markerPath) : '';
    if (!/^netatlas-mihomo-running-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(marker)
      || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return reject(new Error('Invalid local post-up marker'));
    const started = Date.now();
    let settled = false;
    let watcher;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      watcher?.close();
      child.removeListener('exit', exited);
      child.removeListener('error', failed);
      if (error) reject(error);
      else resolve({ status: 'passed', signal: 'mihomo-cli-post-up', phase: 'after-hub-parse-and-tunnel-running', elapsedMs: Date.now() - started });
    };
    const exited = () => finish(new Error('Native process exited before its post-up running signal'));
    const failed = (error) => finish(new Error('Native process startup failed before its post-up running signal', { cause: error }));
    const inspect = async () => {
      try {
        const stat = await lstat(markerPath);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Local post-up marker is invalid');
        if (await readFile(markerPath, 'utf8') !== marker) throw new Error('Local post-up marker content is invalid');
        finish();
      } catch (error) {
        if (error.code !== 'ENOENT') finish(error);
      }
    };
    child.once('exit', exited);
    child.once('error', failed);
    if (child.exitCode !== null || child.signalCode !== null || child.startupError) return exited();
    timer = setTimeout(() => finish(new Error('Local post-up running signal timed out')), timeoutMs);
    try { watcher = watch(path.dirname(markerPath), (_event, file) => { if (file === null || file?.toString() === marker) void inspect(); }); }
    catch (error) { return finish(error); }
    watcher.once('error', finish);
    // Cover a post-up that completed between spawn and watcher registration.
    void inspect();
  });
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
  const currentCatalog = await catalog(root);
  const serviceRulesets = ['apple', 'apple-tvplus', 'github', 'github-copilot', 'npmjs'].map(id => {
    const ruleset = currentCatalog.find(item => item.id === id);
    assert.ok(ruleset, `Missing canonical service ruleset for native parent/child routing: ${id}`);
    return ruleset;
  });
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
  const rulesets = orderedRulesets([
    { version: 1, id: 'lan', category: 'network', entries: [{ type: 'domain', value: 'allowed.netatlas.test' }] },
    { version: 1, id: 'adblock', category: 'privacy', entries: [{ type: 'domain', value: 'blocked.netatlas.test' }, { type: 'domain-suffix', value: 'doubleclick.net' }] },
    ...serviceRulesets,
  ]);
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
          for (const name of ['apple', 'github']) config['proxy-groups'].find(group => group.name === name).proxies = ['DIRECT', 'Proxy'];
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
          for (const tag of ['apple', 'github']) config.outbounds.find(outbound => outbound.tag === tag).default = 'DIRECT';
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
            ? [['allowed.netatlas.test', true, 'explicit-direct', false], ['blocked.netatlas.test', false, 'explicit-reject', false], ['fallback.netatlas.test', false, 'fallback-reject', false]]
            : selection === 'DIRECT' ? [['fallback.netatlas.test', true, 'fallback-direct', false]]
              : [['allowed.netatlas.test', true, 'explicit-direct', false], ['blocked.netatlas.test', false, 'explicit-reject', false],
                ['doubleclick.net', false, 'suffix-root-reject', false], ['sub.doubleclick.net', false, 'suffix-child-reject', false],
                ['baddoubleclick.net', true, 'suffix-similar-fallback', true], ['doubleclick.net.invalid', true, 'suffix-tail-fallback', true],
                ['fallback.netatlas.test', true, 'fallback-proxy', true],
                ['tv.apple.com', true, 'apple-tv-domain-proxy', true], ['cdn.tv.apple.com', true, 'apple-tv-child-proxy', true],
                ['hls.itunes.apple.com', true, 'apple-tv-exact-proxy', true],
                ['copilot-proxy.githubusercontent.com', true, 'copilot-exact-proxy', true],
                ['registry.npmjs.org', true, 'npm-service-proxy', true],
                ['www.apple.com', true, 'apple-parent-direct', false], ['api.github.com', true, 'github-parent-direct', false],
                ['sub.hls.itunes.apple.com', true, 'apple-tv-exact-child-parent', false],
                ['sub.copilot-proxy.githubusercontent.com', true, 'copilot-exact-child-parent', false]];
          for (const [protocol, request] of [['http', httpThroughProxy], ['socks5', socksThroughProxy]]) {
            for (const [host, permitted, behavior, usesUpstream] of targets) {
              const before = targetRequests;
              const upstreamBefore = upstream.requests();
              const result = await request(proxyPort, host, targetPort);
              const reached = Boolean(result.body?.includes(token));
              assert.equal(reached, permitted, `${id} ${protocol} ${behavior}: ${JSON.stringify(result)}`);
              assert.equal(targetRequests - before, permitted ? 1 : 0, `${id} ${protocol} ${behavior}: unexpected target request`);
              assert.equal(upstream.requests() - upstreamBefore, usesUpstream ? 1 : 0, `${id} ${protocol} ${behavior}: unexpected SOCKS upstream connection`);
              cases.push({ client: id, protocol, host, behavior, viaUpstream: usesUpstream, status: 'passed' });
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
  return { status: 'passed', cases, targetRequests, upstreamRequests: upstream.requests(), serviceRulesets: serviceRulesets.map(set => ({ id: set.id, entries: set.entries.length, sourceSha256: sha256(`${JSON.stringify(set, null, 2)}\n`) })), targets: 'loopback HTTP, SOCKS5 and allowlisted DNS only; system proxy unchanged', directory: path.relative(root, directory) };
}

export async function prepareAntiAdNativeInputs({ root }) {
  const sourcePath = 'src/rules/privacy/anti-ad.json';
  await assertManagedPaths(root, [sourcePath, 'metadata/upstreams.json']);
  if (!await fileExists(path.join(root, sourcePath)) || !await fileExists(path.join(root, 'metadata/upstreams.json'))) {
    throw new Error('Missing optional anti-ad source; run npm run sync and npm run build before native verification');
  }
  const sourceBytes = await readFile(path.join(root, sourcePath));
  const registry = JSON.parse(await readFile(path.join(root, 'metadata/upstreams.json'), 'utf8'));
  const record = registry.rulesets?.find(item => item.id === 'anti-ad');
  if (!record || record.outputSha256 !== sha256(sourceBytes)) throw new Error('Optional anti-ad source checksum mismatch; run npm run sync and npm run build');
  const ruleset = normalizeRuleset(JSON.parse(sourceBytes));
  if (ruleset.id !== 'anti-ad' || ruleset.category !== 'privacy' || record.entryCount !== ruleset.entries.length) {
    throw new Error('Optional anti-ad source metadata mismatch; run npm run sync and npm run build');
  }
  const selected = ruleset.entries.find(entry => {
    if (entry.type !== 'domain-suffix' || entry.value.length > 180 || entry.value.split('.')[0].length > 40) return false;
    const nonmatches = [`netatlas-boundary-${entry.value}`, `${entry.value}.invalid`];
    return nonmatches.every(host => !ruleset.entries.some(candidate => matchesEntry(candidate, { host })));
  });
  if (!selected) throw new Error('Optional anti-ad has no domain-suffix fixture with unblocked boundary controls');
  const targets = [
    { host: selected.value, permitted: false, behavior: 'optional-suffix-root-reject' },
    { host: `probe.${selected.value}`, permitted: false, behavior: 'optional-suffix-child-reject' },
    { host: `netatlas-boundary-${selected.value}`, permitted: true, behavior: 'optional-suffix-similar-direct' },
    { host: `${selected.value}.invalid`, permitted: true, behavior: 'optional-suffix-tail-direct' },
  ];
  const pending = [];
  for (const client of ['mihomo', 'singBox']) {
    const generated = renderRuleset(client, ruleset);
    const artifact = path.join('clients', client, generated.path);
    const manifestPath = path.join('clients', client, 'manifest.json');
    await assertManagedPaths(root, [artifact, manifestPath]);
    if (!await fileExists(path.join(root, artifact)) || !await fileExists(path.join(root, manifestPath))) {
      throw new Error(`Published anti-ad ${client} artifact is missing; run npm run sync and npm run build`);
    }
    const bytes = await readFile(path.join(root, artifact));
    if (!bytes.equals(Buffer.from(generated.content))) throw new Error(`Published anti-ad ${client} rules are stale; run npm run build`);
    const manifest = JSON.parse(await readFile(path.join(root, manifestPath), 'utf8'));
    const fragment = renderAntiAd(client, { baseUrl: manifest.baseUrl })[0];
    if (!fragment) throw new Error(`Published anti-ad ${client} installer requires a public base URL; run npm run build`);
    const fragmentPath = path.join('clients', client, fragment.path);
    await assertManagedPaths(root, [fragmentPath]);
    if (!await fileExists(path.join(root, fragmentPath))) throw new Error(`Published anti-ad ${client} fragment is missing; run npm run build`);
    const fragmentBytes = await readFile(path.join(root, fragmentPath));
    if (!fragmentBytes.equals(Buffer.from(fragment.content))) throw new Error(`Published anti-ad ${client} installer is stale; run npm run build`);
    pending.push({ client, artifact, bytes, fragmentPath, fragmentBytes });
  }
  const directory = await cacheDirectory(root, 'optional-rulesets-');
  const inputs = [];
  for (const item of pending) {
    const providerPath = path.join(directory, `${item.client}-anti-ad.${item.client === 'mihomo' ? 'yaml' : 'json'}`);
    await writeFile(providerPath, item.bytes, { flag: 'wx' });
    const profile = renderProfile(item.client, { rulesets: [] });
    const config = item.client === 'mihomo' ? parseYaml(profile.content) : JSON.parse(profile.content);
    const fragment = item.client === 'mihomo' ? parseYaml(item.fragmentBytes.toString('utf8')) : JSON.parse(item.fragmentBytes);
    if (item.client === 'mihomo') {
      const remote = fragment['rule-providers']['netatlas-anti-ad'];
      assert.equal(remote.type, 'http');
      assert.equal(remote.behavior, 'classical');
      assert.equal(remote.format, 'yaml');
      assert.deepEqual(fragment.rules, ['RULE-SET,netatlas-anti-ad,REJECT']);
      const { url, interval, proxy, ...provider } = remote;
      config['rule-providers'] = { 'netatlas-anti-ad': { ...provider, type: 'file', path: providerPath } };
      config.rules = [...fragment.rules, ...config.rules];
      config['proxy-groups'].find(group => group.name === 'Proxy').proxies = ['DIRECT', 'REJECT'];
    } else {
      const remote = fragment.route.rule_set[0];
      assert.equal(remote.type, 'remote');
      assert.equal(remote.format, 'source');
      assert.deepEqual(fragment.route.rules, [{ rule_set: ['netatlas-anti-ad'], action: 'reject' }]);
      const { url, http_client, update_interval, ...provider } = remote;
      config.route.rule_set = [{ ...provider, type: 'local', path: providerPath }];
      config.route.rules = [...fragment.route.rules, ...config.route.rules];
      config.outbounds.find(outbound => outbound.tag === 'Proxy').default = 'DIRECT';
    }
    inputs.push({ client: item.client, artifact: item.artifact, artifactSha256: sha256(item.bytes), fragment: item.fragmentPath, fragmentSha256: sha256(item.fragmentBytes), checkedSnapshot: path.relative(root, providerPath), providerPath, config });
  }
  const upstream = registry.repositories?.find(item => item.id === record.source?.repository);
  return {
    directory, selectedDomain: selected.value, targets, inputs,
    source: { path: sourcePath, sha256: sha256(sourceBytes), entries: ruleset.entries.length, repository: record.source?.repository ?? null, revision: upstream?.revision ?? null, files: record.files ?? [] },
  };
}

export async function testOptionalRulesets({ root, binaries, onProgress = () => {} }) {
  // All source and published artifacts must be current before any process starts.
  const plan = await prepareAntiAdNativeInputs({ root });
  const token = `netatlas-optional-${randomUUID()}`;
  const targetEvidence = [];
  const target = http.createServer((request, response) => {
    targetEvidence.push({ host: request.headers.host, method: request.method, path: request.url });
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(token), Connection: 'close' });
    response.end(token);
  });
  const targetPort = await listen(target);
  const cases = [];
  const nativeChecks = [];
  let dns;
  try {
    dns = await localDns(plan.targets.map(item => item.host));
    for (const input of plan.inputs) {
      const { client: id, config } = input;
      const proxyPort = await freePort();
      let controller;
      if (id === 'mihomo') {
        // Only the temporary verification config gets a loopback controller.
        // The nonce is not included in the report or any published profile.
        controller = { port: await freePort(), secret: randomUUID() };
        config['external-controller'] = `127.0.0.1:${controller.port}`;
        config.secret = controller.secret;
        config['mixed-port'] = proxyPort;
        config.dns = { enable: true, ipv6: false, 'enhanced-mode': 'redir-host', nameserver: [`udp://127.0.0.1:${dns.port}`], 'default-nameserver': [`127.0.0.1:${dns.port}`] };
      } else {
        config.inbounds[0].listen_port = proxyPort;
        config.dns = { servers: [{ type: 'udp', tag: 'fixture-dns', server: '127.0.0.1', server_port: dns.port }], final: 'fixture-dns' };
        config.route.default_domain_resolver = 'fixture-dns';
      }
      const configPath = path.join(plan.directory, `${id}-optional.${id === 'mihomo' ? 'yaml' : 'json'}`);
      const configBytes = id === 'mihomo' ? stringifyYaml(config) : `${JSON.stringify(config, null, 2)}\n`;
      await writeFile(configPath, configBytes, { flag: 'wx' });
      const checkArgs = id === 'mihomo' ? ['-t', '-f', configPath, '-d', plan.directory] : ['check', '-c', configPath];
      onProgress(`Native check: ${id} optional anti-ad file provider (${plan.source.entries} entries)`);
      const checkOutput = await run(binaries[id], checkArgs, plan.directory);
      await writeFile(path.join(plan.directory, `${id}-check.log`), `${checkOutput}\n`);
      const nativeCheck = { client: id, status: 'passed', config: path.relative(root, configPath), configSha256: sha256(configBytes) };
      nativeChecks.push(nativeCheck);
      const args = id === 'mihomo' ? ['-f', configPath, '-d', plan.directory] : ['run', '-c', configPath];
      let markerPath;
      if (id === 'mihomo') {
        const marker = 'netatlas-mihomo-running-' + randomUUID();
        markerPath = path.join(plan.directory, marker);
        await assertManagedPaths(root, [markerPath, markerPath + '.pending']);
        // All shell tokens below contain only this generated safe alphabet.
        // Atomic rename prevents the observer from reading a partially written marker.
        args.push('-post-up', `printf %s ${marker} > ${marker}.pending && mv ${marker}.pending ${marker}`);
      }
      const child = spawn(binaries[id], args, { cwd: plan.directory, stdio: ['ignore', 'pipe', 'pipe'] });
      let log = '';
      child.on('error', error => { child.startupError = error.message; });
      child.stdout.on('data', bytes => { log = (log + bytes).slice(-200_000); });
      child.stderr.on('data', bytes => { log = (log + bytes).slice(-200_000); });
      try {
        if (id === 'mihomo') {
          const [, startup] = await Promise.all([waitForPort(child, proxyPort), waitForMihomoRunning({ child, markerPath })]);
          nativeCheck.startupReadiness = startup;
        } else await waitForPort(child, proxyPort);
        if (id === 'mihomo') nativeCheck.providerReadiness = await waitForMihomoRuleProvider({ controllerPort: controller.port, secret: controller.secret, expectedCount: plan.source.entries, child });
        onProgress(`Local optional anti-ad routing: ${id}, HTTP + SOCKS5`);
        for (const [protocol, request] of [['http', httpThroughProxy], ['socks5', socksThroughProxy]]) {
          for (const item of plan.targets) {
            const before = targetEvidence.length;
            const result = await request(proxyPort, item.host, targetPort);
            const reached = Boolean(result.body?.includes(token));
            const requests = targetEvidence.length - before;
            assert.equal(reached, item.permitted, `${id} ${protocol} ${item.behavior}: ${JSON.stringify(result)}`);
            assert.equal(requests, item.permitted ? 1 : 0, `${id} ${protocol} ${item.behavior}: unexpected loopback target request`);
            cases.push({ client: id, protocol, ...item, status: 'passed', targetRequests: requests, result });
          }
        }
      } catch (error) {
        // Keep actionable loopback evidence in failed CI output too; no config,
        // controller secret or response token is included in diagnostics.
        const evidence = { client: id, selectedDomain: plan.selectedDomain, startupReadiness: nativeCheck.startupReadiness, providerReadiness: nativeCheck.providerReadiness, dnsQuestions: dns.questions, targetEvidence };
        const safeLog = controller?.secret ? log.replaceAll(controller.secret, '[redacted]') : log;
        error.message += `\nLocal fixture evidence: ${JSON.stringify(evidence)}\nKernel log tail:\n${safeLog.slice(-8000)}`;
        throw error;
      } finally {
        await stop(child);
        await writeFile(path.join(plan.directory, `${id}-routing.log`), log);
      }
    }
  } finally {
    target.closeAllConnections();
    await new Promise(resolve => target.close(resolve));
    if (dns) await new Promise(resolve => dns.server.close(resolve));
  }
  return {
    id: 'anti-ad', status: 'passed', selectedDomain: plan.selectedDomain, source: plan.source,
    inputs: plan.inputs.map(({ config, providerPath, ...item }) => item), nativeChecks, cases,
    targetRequests: targetEvidence.length, targetEvidence, dnsQuestions: dns.questions,
    targets: 'loopback-only HTTP fixture and allowlisted UDP DNS; local file providers; no external HTTP/DNS or system proxy changes',
    directory: path.relative(root, plan.directory),
  };
}

export async function writeNativeReport({ root, report }) {
  const destination = path.join(root, '.cache/native-check/latest.json');
  await assertManagedPaths(root, [destination]);
  await mkdir(path.dirname(destination), { recursive: true });
  const staged = path.join(path.dirname(destination), `.latest-${randomUUID()}.json`);
  await assertManagedPaths(root, [destination, staged]);
  await writeFile(staged, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await rename(staged, destination);
}

export async function runNativeVerification({ root, onProgress = () => {} }) {
  await assertManagedPaths(root, ['metadata/native-tools.json', '.cache/bin', '.cache/native-tools', '.cache/native-check/latest.json']);
  const startedAt = new Date().toISOString();
  const installed = await installNativeTools({ root, onProgress });
  const checks = await checkNativeProfiles({ root, binaries: installed.binaries, onProgress });
  const routing = await testLocalRouting({ root, binaries: installed.binaries, onProgress });
  const optionalRulesets = await testOptionalRulesets({ root, binaries: installed.binaries, onProgress });
  const report = { status: 'passed', startedAt, completedAt: new Date().toISOString(), artifacts: installed.artifacts, checks, routing, optionalRulesets };
  await writeNativeReport({ root, report });
  return report;
}
