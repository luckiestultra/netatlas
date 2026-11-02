// SPDX-License-Identifier: MIT
// Runs only the local generated converter. Public downloaded JS stays input text.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');

export function replayOriginalResource(code, content, link) {
  const context = vm.createContext({ input: JSON.stringify({ type: 'rewrite', content, link }) }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(`
    globalThis.$resource=JSON.parse(input); delete globalThis.input;
    globalThis.completed=[]; globalThis.deniedCalls=0; globalThis.$parser={};
    globalThis.$done=value=>{completed.push(value);return value;};
    const denied=()=>{deniedCalls++;throw new Error('Forbidden parser capability');};
    globalThis.fetch=denied; globalThis.$task={fetch:denied};
    globalThis.$httpClient={get:denied,post:denied}; globalThis.$prefs={valueForKey:denied,setValueForKey:denied};
    globalThis.$persistentStore={read:denied,write:denied}; globalThis.$notify=denied;
    globalThis.console={log:denied}; globalThis.URL=undefined; globalThis.URLSearchParams=undefined;
    globalThis.Buffer=undefined; globalThis.atob=undefined; globalThis.TextDecoder=undefined; globalThis.Intl=undefined;
  `, context, { timeout: 1000 });
  const value = vm.runInContext(code, context, { timeout: 5000 });
  assert.equal(context.completed.length, 1, 'Generated converter must complete once');
  assert.equal(value, context.completed[0], 'Generated converter must evaluate to its completion');
  assert.equal(context.deniedCalls, 0, 'Converter must not invoke I/O or source scripts');
  assert.equal(typeof value.content, 'string', 'Original resource did not convert');
  const rows = value.content.split(/\r?\n/).map(row => row.trim()).filter(row => row && !row.startsWith('#'));
  const rewriteRows = rows.filter(row => /\surl(?:-and-header)?\s/.test(row)).length;
  const filterRows = rows.filter(row => /^(?:host(?:-suffix|-keyword|-wildcard)?|ip-cidr|ip6-cidr|geoip|ip-asn|user-agent|final),/.test(row)).length;
  const hostRows = rows.filter(row => /^hostname\s*=/.test(row));
  const hostnames = hostRows.flatMap(row => row.slice(row.indexOf('=') + 1).split(',').map(item => item.trim()));
  assert.ok(hostnames.every(Boolean), 'Empty hostname in generated output');
  assert.equal(rows.length, rewriteRows + filterRows + hostRows.length, 'Unexpected non-native output');
  return { rewriteRows, filterRows, hostnames: new Set(hostnames).size, outputSha256: sha(value.content), doneCalls: 1, forbiddenApiCalls: 0 };
}

async function publicInput(url) {
  const source = new URL(url);
  assert.ok(source.protocol === 'https:' && source.hostname === 'raw.githubusercontent.com' && !source.username && !source.password && !source.search && !source.hash, 'Only registered public raw GitHub inputs are allowed');
  const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'NetAtlas-public-parser-regression' } });
  assert.equal(response.status, 200, 'Public source HTTP failure');
  assert.equal(new URL(response.url).hostname, 'raw.githubusercontent.com', 'Unexpected source redirect');
  const reader = response.body.getReader(), chunks = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.length;
    if (length > 2097152) { await reader.cancel(); throw new Error('Public fixture exceeds rewrite input limit'); }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks, length);
}

export async function checkPublicParserUpstreams() {
  const registry = JSON.parse(await readFile(resolve(root, 'metadata/resource-parser-upstreams.json'), 'utf8'));
  assert.equal(registry.version, 1);
  const code = await readFile(resolve(root, 'clients/quantumultX/scripts/resource-parser.js'), 'utf8');
  const results = [];
  for (const entry of registry.cases) {
    const bytes = await publicInput(entry.url);
    assert.equal(sha(bytes), entry.sha256, 'Upstream snapshot changed; review and update the regression registry');
    const converted = replayOriginalResource(code, new TextDecoder('utf-8', { fatal: true }).decode(bytes), entry.url);
    for (const key of ['rewriteRows', 'filterRows', 'hostnames']) assert.equal(converted[key], entry[key], 'Original-input conversion contract changed');
    results.push({ id: entry.id, inputSha256: sha(bytes), inputBytes: bytes.length, ...converted });
  }
  return { status: 'pass', mode: 'original URLs and complete unmodified sources', artifactSha256: sha(code), resources: results, sourceBusinessScriptsExecuted: false, nativeAppTested: false };
}

function isMain() {
  try { return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; }
  catch { return false; }
}
if (isMain()) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 0 || args.length === 2 && args[0] === '--report', 'Usage: node tools/check-resource-parser-upstreams.mjs [--report OUTPUT.json]');
    const report = await checkPublicParserUpstreams();
    if (args.length) await writeFile(resolve(args[1]), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    // Never print fetched resource content, script-generated values or URL queries.
    process.stderr.write('Public parser regression failed: ' + (error?.code === 'EEXIST' ? 'report already exists' : 'source/build/contract check failed') + '\n');
    process.exitCode = 1;
  }
}
