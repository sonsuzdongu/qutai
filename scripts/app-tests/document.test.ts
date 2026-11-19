// The app's document and isolation rules that can be asserted in code (src/apps/document.ts, docs/mini-apps.md ›
// The runtime): the policy string and its place, which navigations are refused, files put inline, what is left out,
// the line map, the helper library's syntax and lockdown, and the messages the document may send.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  APP_CSP,
  appBaseUrl,
  appNavigationAllowed,
  buildAppDocument,
  formatDiagnostics,
  IOS_OFFLINE_RULES,
  parseAppMessage,
  type BootInfo,
} from '../../src/apps/document.ts';
import type { AppManifest, AppPackage } from '../../src/apps/manifest.ts';
import { notesFiles } from './notesApp.mjs';

const BOOT: BootInfo = {
  id: 'app-abcdefghij12',
  name: 'Notes </script><script>alert(1)</script>',
  version: 3,
  language: 'tr',
  uiLanguage: 'tr',
  platform: 'ios',
  permissions: [],
  theme: {
    dark: true,
    colors: { bg: '#000000', surface: '#111111', sunken: '#222222', text: '#ffffff', textSecondary: '#aaaaaa', tint: '#1565c0', onTint: '#ffffff', danger: '#ff8a80', separator: '#333333', border: '#444444' },
    fontScale: 1.5,
  },
  insets: { top: 0, right: 0, bottom: 34, left: 0 },
};

function pkg(files: Record<string, string>): AppPackage {
  return { manifest: { entry: 'index.html', language: 'tr' } as AppManifest, files };
}

test('the policy: nothing loads from anywhere, no eval, no frames, forms or workers', () => {
  const directives = Object.fromEntries(APP_CSP.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(' ')]));
  assert.equal(directives['default-src'], "'none'");
  assert.equal(directives['connect-src'], "'none'");
  assert.equal(directives['script-src'], "'unsafe-inline'");
  assert.ok(!APP_CSP.includes('unsafe-eval'));
  for (const d of ['frame-src', 'child-src', 'worker-src', 'object-src', 'form-action', 'base-uri', 'manifest-src']) assert.equal(directives[d], "'none'", d);
  for (const d of ['img-src', 'media-src', 'font-src']) assert.ok(!/https?:|\*/.test(directives[d]), d);
  assert.ok(!/https?:|\*|wss?:/.test(APP_CSP));
});

test('the policy is the first thing in the document, before any app byte', () => {
  const { html } = buildAppDocument(pkg({ 'index.html': '<head><meta http-equiv="Content-Security-Policy" content="default-src *"></head><body>x</body>' }), BOOT);
  const csp = html.indexOf('Content-Security-Policy');
  assert.ok(csp > 0 && csp < html.indexOf('<script'));
  assert.equal(html.indexOf(APP_CSP), html.indexOf('content="') + 'content="'.length);
  // The app's own policy meta is left out (a second policy could only add limits, but it is noise).
  assert.equal(html.split('Content-Security-Policy').length, 2);
});

const BASE = 'https://app-abcdefghij12.apps.qutai.invalid/';
const NAV_CASES: [string, boolean][] = [
  ['about:blank', true],
  ['', true],
  [BASE, true],
  [`${BASE}#top`, true],
  [`${BASE}?x=1`, false],
  [`${BASE}app.js`, false],
  ['https://app-zzzzzzzzzzzz.apps.qutai.invalid/', false],
  ['https://app-abcdefghij12.apps.qutai.invalid.evil.example/', false],
  ['about:blank?x=1', false],
  ['about:srcdoc', false],
  ['https://evil.example/?d=secret', false],
  ['http://localhost:8793/', false],
  ['javascript:alert(1)', false],
  ['data:text/html,<script>1</script>', false],
  ['file:///etc/passwd', false],
  ['tel:+905551112233', false],
  ['intent://scan/#Intent;scheme=zxing;end', false],
  ['qutai://app/app-abcdefghij12', false],
  ['blob:null/1234', false],
];
for (const [url, ok] of NAV_CASES) test(`navigation ${ok ? 'allowed' : 'refused'}: ${url || '(empty)'}`, () => assert.equal(appNavigationAllowed(url, BASE), ok));

test('each app has its own origin under .invalid', () => {
  assert.equal(appBaseUrl('app-abcdefghij12'), BASE);
  assert.notEqual(appBaseUrl('app-abcdefghij12'), appBaseUrl('app-zzzzzzzzzzzz'));
  assert.equal(appBaseUrl('app-a/../b'), 'https://app-a..b.apps.qutai.invalid/'.replace('..', ''));
});

test('iOS offline rule list blocks every network scheme', () => {
  const rules = JSON.parse(IOS_OFFLINE_RULES) as { trigger: { 'url-filter': string }; action: { type: string } }[];
  const filters = rules.map((r) => new RegExp(r.trigger['url-filter']));
  for (const url of ['https://a.example/x', 'http://10.0.2.2:8000', 'wss://a.example', 'ws://a', 'ftp://a']) assert.ok(filters.some((f) => f.test(url)), url);
  assert.ok(rules.every((r) => r.action.type === 'block'));
  assert.ok(!filters.some((f) => f.test('about:blank') || f.test('data:image/png;base64,AA')));
});

test('package files are put inline; anything from elsewhere is left out and noted', () => {
  const built = buildAppDocument(
    pkg({
      'index.html':
        '<!doctype html><html><head><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="https://cdn.example/x.css">' +
        '<script src="https://cdn.example/lib.js"></script><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example">' +
        '<link rel="dns-prefetch" href="//evil.example"></head><body class="b"><p>Hi</p><script src="./app.js"></script><script>inline()</script></body></html>',
      'style.css': 'p { color: red } </style><script>x</script>',
      'app.js': 'const s = "</script><script>evil()</script>";',
    }),
    BOOT,
  );
  assert.ok(built.html.includes('p { color: red } <\\/style>'));
  assert.ok(built.html.includes('const s = "<\\/script><script>evil()<\\/script>";'));
  assert.ok(built.html.includes('<script>inline()</script>'));
  assert.ok(built.html.includes('<body class="b">'));
  for (const gone of ['cdn.example', 'evil.example', '<base', 'refresh']) assert.ok(!built.html.includes(gone), gone);
  assert.equal(built.notes.length, 5);
});

test('the boot data cannot end the helper script', () => {
  const { html } = buildAppDocument(pkg({ 'index.html': '<body></body>' }), BOOT);
  const firstScript = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));
  assert.ok(!firstScript.includes('</script'), 'a name with </script> stays inside the string');
  assert.ok(firstScript.includes('\\u003c/script>'));
});

test('the line map points errors at the file and line', () => {
  const files = notesFiles();
  const built = buildAppDocument(pkg(files), BOOT);
  const lines = built.html.split('\n');
  const target = 'async function render() {';
  const docLine = lines.findIndex((l) => l === target) + 1;
  const fileLine = files['app.js'].split('\n').findIndex((l) => l === target) + 1;
  assert.deepEqual(built.mapLine(docLine), { file: 'app.js', line: fileLine });
  const h1 = lines.findIndex((l) => l.includes('<h1 id="heading">')) + 1;
  assert.deepEqual(built.mapLine(h1), { file: 'index.html', line: files['index.html'].split('\n').findIndex((l) => l.includes('<h1 id="heading">')) + 1 });
  assert.equal(built.mapLine(5)?.file, 'qutai.js');
});

test('a body without tags is still a body', () => {
  const { html } = buildAppDocument(pkg({ 'index.html': '<h1>Hi</h1><script src="app.js"></script>', 'app.js': 'go()' }), BOOT);
  assert.ok(/<body><h1>Hi<\/h1><script>\ngo\(\)\n<\/script>/.test(html));
});

test('theme, text size and safe areas are in the document from the start', () => {
  const { html } = buildAppDocument(pkg({ 'index.html': '' }), BOOT);
  assert.ok(html.includes('--qutai-bg: #000000'));
  assert.ok(html.includes('--qutai-font-scale: 1.5'));
  assert.ok(html.includes('--qutai-safe-bottom: 34px'));
  assert.ok(html.includes('data-qutai-theme="dark"'));
  assert.ok(html.includes('lang="tr"'));
});

/** Runs the helper script in a small stand-in for a page, enough to see what it locks down and what it sends. */
function runHelper() {
  const { html } = buildAppDocument(pkg({ 'index.html': '' }), BOOT);
  const code = html.slice(html.indexOf('<script>\n') + 9, html.indexOf('\n</script>'));
  const sent: Record<string, unknown>[] = [];
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const target = { addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] ??= []).push(fn) };
  const style = { setProperty() {} };
  const window: Record<string, unknown> = {
    ...target,
    ReactNativeWebView: { postMessage: (s: string) => sent.push(JSON.parse(s)) },
    fetch: () => 'real fetch',
    XMLHttpRequest: function real() {},
    WebSocket: function real() {},
    RTCPeerConnection: function real() {},
    open: () => 'a window',
    HTMLIFrameElement: function () {},
  };
  (window.HTMLIFrameElement as { prototype: object }).prototype = {};
  const context = vm.createContext({
    window,
    document: { ...target, documentElement: { style, setAttribute() {} } },
    navigator: {},
    Navigator: function () {},
    console: { log() {}, info() {}, warn() {}, error() {} },
    MutationObserver: function () {
      return { observe() {} };
    },
    crypto: { getRandomValues: (b: Uint8Array) => b.fill(9) },
    Promise,
    Object,
    JSON,
    Array,
    String,
    Uint8Array,
    Error,
    TypeError,
    setTimeout,
  });
  vm.runInContext(`with (window) {} ; (function(){ var self = window; ${code.replace(/^\(function \(\) \{/, '(function () { var fetch;')}\n})()`, context);
  return { window, sent, listeners };
}

test('the helper parses, locks the network and windows down, and exposes qutai', () => {
  const { html } = buildAppDocument(pkg({ 'index.html': '' }), BOOT);
  const code = html.slice(html.indexOf('<script>\n') + 9, html.indexOf('\n</script>'));
  assert.doesNotThrow(() => new vm.Script(code));
  const { window, sent } = runHelper();
  assert.throws(() => new (window.WebSocket as new () => unknown)(), /not available/);
  assert.throws(() => new (window.RTCPeerConnection as new () => unknown)(), /not available/);
  assert.throws(() => new (window.XMLHttpRequest as new () => unknown)(), /not available/);
  assert.equal((window.open as () => unknown)(), null);
  assert.ok(sent.some((m) => m.ready === true));
  assert.ok(sent.some((m) => (m.diag as { kind?: string })?.kind === 'blocked'));
  const q = window.qutai as { t: (m: object) => string; escape: (s: string) => string; contract: number };
  assert.equal(q.contract, 1);
  assert.equal(q.t({ en: 'Notes', tr: 'Notlar' }), 'Notlar');
  assert.equal(q.escape('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  // The app can't replace the bridge's receiver or the stubs.
  assert.throws(() => ((window as Record<string, unknown>).__qutaiReceive = null), /read only/);
  assert.throws(() => ((window as Record<string, unknown>).fetch = () => 'mine'), /read only/);
  assert.throws(() => ((window as Record<string, unknown>).qutai = {}), /read only/);
  assert.equal(typeof window.__qutaiReceive, 'function');
});

test('the helper sends calls in the wire format and resolves and rejects answers', async () => {
  const { window, sent } = runHelper();
  const q = window.qutai as { storage: { get(k: string): Promise<unknown> }; db(c: string): { add(d: object): Promise<unknown> } };
  const receive = window.__qutaiReceive as (m: object) => void;
  const p1 = q.storage.get('k');
  const p2 = q.db('notes').add({ title: 'x' });
  const calls = sent.filter((m) => m.call);
  assert.deepEqual(calls.map((c) => [c.qutai, c.call, c.args]), [
    [1, 'storage.get', { key: 'k' }],
    [1, 'docs.add', { collection: 'notes', doc: { title: 'x' } }],
  ]);
  receive({ id: calls[0].id, ok: true, value: 42 });
  receive({ id: calls[1].id, ok: false, error: { code: 'E_QUOTA', message: 'full' } });
  assert.equal(await p1, 42);
  await assert.rejects(p2, (e: { code?: string }) => e.code === 'E_QUOTA');
  receive({ ping: 7 });
  assert.ok(sent.some((m) => m.pong === 7));
});

test('messages besides calls: diagnostics with mapped lines, pongs, ready; anything else dropped', () => {
  const map = (line: number) => (line === 10 ? { file: 'app.js', line: 3 } : null);
  assert.deepEqual(parseAppMessage('{"qutai":1,"diag":{"kind":"error","message":"ReferenceError: rendr is not defined","line":10}}', map, 5), {
    type: 'diag',
    diag: { kind: 'error', message: 'ReferenceError: rendr is not defined', where: 'app.js:3', at: 5 },
  });
  assert.deepEqual(parseAppMessage('{"qutai":1,"pong":3}', map, 0), { type: 'pong', n: 3 });
  assert.deepEqual(parseAppMessage('{"qutai":1,"ready":true}', map, 0), { type: 'ready' });
  for (const raw of ['{"diag":{"kind":"error","message":"x"}}', '{"qutai":1,"diag":{"kind":"root","message":"x"}}', 'x', `{"qutai":1,"diag":{"kind":"error","message":"${'x'.repeat(9000)}"}}`])
    assert.equal(parseAppMessage(raw, map, 0), null);
  assert.equal(
    formatDiagnostics([{ kind: 'console', level: 'warn', message: 'hm', at: 0 }, { kind: 'error', message: 'E', where: 'app.js:3', at: 0 }]),
    '- console.warn: hm\n- error (app.js:3): E',
  );
});

test('the break-out test app is a valid package; its outside loads are left out of the document', async () => {
  const { breakoutFiles } = await import('./breakoutApp.mjs');
  const { checkFiles } = await import('../../src/apps/manifest.ts');
  const files = breakoutFiles(8793);
  assert.deepEqual(checkFiles(files, 'index.html'), []);
  const built = buildAppDocument(pkg(files), BOOT);
  assert.equal(built.notes.length, 3);
  const head = built.html.slice(0, built.html.indexOf('</head>'));
  assert.ok(!/<script src=|<link /.test(head));
  assert.doesNotThrow(() => new vm.Script(files['app.js']));
});

test('an uncaught error is reported once with its name, message and line', () => {
  const { sent, listeners } = runHelper();
  const err = new ReferenceError("Can't find variable: rendr");
  listeners.error[0]({ target: undefined, message: "ReferenceError: Can't find variable: rendr", lineno: 210, colno: 1, error: err });
  listeners.error[0]({ target: undefined, message: 'boom', lineno: 3, colno: 1, error: new TypeError('boom') });
  const errors = sent.map((m) => m.diag as { kind?: string; message?: string; line?: number }).filter((d) => d?.kind === 'error');
  assert.equal(errors[0].message, "ReferenceError: Can't find variable: rendr");
  assert.equal(errors[0].line, 210);
  assert.equal(errors[1].message, 'TypeError: boom');
});
