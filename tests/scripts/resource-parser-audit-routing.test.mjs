import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseResource } from '../../src/features/resource-parser/core.mjs';
import { bundleResourceParser } from '../../tools/lib/resource-parser-bundle.mjs';

const bundle = bundleResourceParser();

function runBundle(resource) {
  const completions = [];
  const forbidden = new Proxy({}, { get() { throw new Error('Unexpected host API'); } });
  const context = vm.createContext({
    $resource: resource, $done: value => { completions.push(value); return value; },
    $httpClient: forbidden, $task: forbidden, $prefs: forbidden,
    fetch: () => { throw new Error('Unexpected network request'); },
    URL: undefined, URLSearchParams: undefined, Buffer: undefined, atob: undefined,
    TextDecoder: undefined, console: undefined,
  });
  const result = vm.runInContext(bundle, context, { timeout: 3000 });
  assert.equal(completions.length, 1);
  assert.equal(result, completions[0]);
  return JSON.parse(JSON.stringify(result));
}

function expectContent(resource, content) {
  assert.deepEqual(parseResource(resource), { content });
  assert.deepEqual(runBundle(resource), { content });
}

function expectFailure(resource) {
  assert.throws(() => parseResource(resource), /directive/i);
  const result = runBundle(resource);
  assert.deepEqual(Object.keys(result), ['error']);
  assert.match(result.error, /directive/i);
  assert.doesNotMatch(result.error, /https:\/\/|private\.example|synthetic-secret/);
}

test('Surge includes and platform requirements reject the complete resource', () => {
  const validRule = '[Rule]\nDOMAIN,public.example,REJECT\n';
  for (const directive of [
    '#!include https://example.com/synthetic-secret.list',
    '#!REQUIREMENT SYSTEM==\'macOS\' DOMAIN,private.example,DIRECT',
    'DOMAIN,private.example,DIRECT #!MACOS-ONLY',
    'DOMAIN,private.example,DIRECT //!REQUIREMENT SYSTEM==\'macOS\'',
    'DOMAIN,private.example,DIRECT #!IOS-ONLY',
    'DOMAIN,private.example,DIRECT #!TVOS-ONLY',
  ]) expectFailure({ content: validRule + directive });

  for (const content of [
    '[MITM]\nhostname = * #!MACOS-ONLY',
    '#!system=mac\n[MITM]\nhostname = *',
    '#!requirement=CORE_VERSION>=20\n[MITM]\nhostname = *',
    '[URL Rewrite]\n^https://public.example/ https://destination.example/ 302\n#!include https://example.com/synthetic-secret.conf',
    '[URL Rewrite]\n^https://private.example/ https://destination.example/ 302 #!REQUIREMENT SYSTEM==\'macOS\'',
  ]) expectFailure({ content });
});

test('ordinary inline comments preserve URLs, regexes and quoted values', () => {
  for (const marker of ['#', ';', '//']) {
    expectContent({ content: '[Rule]\nDOMAIN,example.com,DIRECT ' + marker + ' comment' }, 'host,example.com,direct\n');
    expectContent({ content: '[URL Rewrite]\n^https://example.com/[#;] https://destination.example/path#fragment 302 ' + marker + ' comment' }, '^https://example.com/[#;] url 302 https://destination.example/path#fragment\n');
  }
  expectContent({
    type: 'filter',
    content: 'user-agent,"App // Agent",DIRECT',
  }, 'user-agent,"App // Agent",direct\n');
  expectContent({
    content: '#!name=ordinary metadata\n# ordinary #!include is only documentation\n[Script]\nname = type=http-request, pattern=^https://example.com/[#;], requires-body=false, script-path=https://example.com/script.js#fragment, tag="Quoted // #!system=mac", enable=true // comment',
    link: 'https://example.com/resource#script-compat=qx',
  }, '# NetAtlas: user declares referenced scripts QX compatible; script APIs are not translated.\n^https://example.com/[#;] url script-request-header https://example.com/script.js#fragment\n');
  const native = '^https://example.com/ url response-body abc response-body replacement // literal # content';
  expectContent({ type: 'rewrite', content: native }, native + '\n');
});

test('unanchored native and foreign rewrite patterns do not become node URIs', () => {
  for (const resource of [
    { content: 'https://example.com/ url reject' },
    { type: 123, content: 'https://example.com/ url reject' },
    { content: '[URL Rewrite]\nhttps://example.com/ https://destination.example/ 302' },
    { content: 'https://example.com/ 307 https://destination.example/' },
  ]) expectContent(resource, resource.content.includes('reject') ? 'https://example.com/ url reject\n' : 'https://example.com/ url ' + (resource.content.includes('307') ? '307' : '302') + ' https://destination.example/\n');
  expectContent({ content: 'http://example.com:80#HTTP' }, 'http=example.com:80, tag=HTTP\n');
  const mixed = { content: 'http://example.com:80#HTTP\nhttps://example.com/ url reject' };
  assert.throws(() => parseResource(mixed), /mixed resource/i);
  assert.deepEqual(Object.keys(runBundle(mixed)), ['error']);
});

test('an explicitly typed rewrite regex is never pre-parsed as YAML', () => {
  const content = '[hH]ttps://example.com/ url reject';
  expectContent({ type: 'rewrite', content }, content + '\n');
  expectContent({ content, link: 'https://example.com/resource#type=rewrite' }, content + '\n');
  expectContent({ type: 'rewrite', content: '[hH]ttps://example.com/ https://destination.example/ 302' }, '[hH]ttps://example.com/ url 302 https://destination.example/\n');
  const duplicate = { type: 'filter', content: '{"version":3,"rules":[{"domain":"a.example","domain":"b.example"}]}' };
  assert.throws(() => parseResource(duplicate));
  assert.deepEqual(Object.keys(runBundle(duplicate)), ['error']);
});
