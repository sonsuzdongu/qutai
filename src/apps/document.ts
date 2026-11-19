import type { Insets, ThemeInfo } from './bridge';
import { CONTRACT_VERSION, type AppPackage } from './manifest';

/**
 * The app's document (docs/mini-apps.md › How the document is built, The network block, Errors and diagnostics):
 * one HTML document with Qutai's Content Security Policy first, the lockdown and the `qutai` helper library, the base
 * stylesheet, then the app's own markup with its CSS and JavaScript files put inline; the line map back to the files;
 * which navigations the runner allows; and the messages the document sends besides bridge calls. Pure code.
 */

export const APP_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; " +
  "font-src data:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; " +
  "manifest-src 'none'; form-action 'none'; base-uri 'none'";

/** The WebKit content rule list that blocks every network load of an app's WebView on iOS (layer 2). */
export const IOS_OFFLINE_RULE_LIST_ID = 'qutaiapps-offline-v1';
export const IOS_OFFLINE_RULES = JSON.stringify(
  ['^https?://', '^wss?://', '^ftp://'].map((filter) => ({ trigger: { 'url-filter': filter }, action: { type: 'block' } })),
);


/**
 * The frame guard (docs/mini-apps.md › Phase 2): runs at document start in **every** frame of an app's WebView (iOS: a
 * WKUserScript for all frames through injectedJavaScriptBeforeContentLoaded; Android: the patched module's appSandbox,
 * WebViewCompat.addDocumentStartJavaScript). It deletes WebRTC from the frame's window before any of the app's code
 * can reach it, including through `window[0]` of an about:blank frame, which the main frame's lockdown can't intercept.
 * The lockdown then puts its own stubs back in the main frame (with the clear "not available" error).
 */
export const APP_FRAME_GUARD = `(function () {
  var names = ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate',
    'RTCRtpTransceiver', 'RTCRtpSender', 'RTCRtpReceiver', 'RTCDtlsTransport', 'RTCIceTransport', 'RTCSctpTransport',
    'RTCCertificate', 'RTCDTMFSender', 'RTCPeerConnectionIceEvent', 'RTCDataChannelEvent', 'RTCTrackEvent', 'RTCError',
    'RTCErrorEvent', 'RTCStatsReport', 'RTCEncodedAudioFrame', 'RTCEncodedVideoFrame', 'RTCRtpScriptTransform'];
  for (var i = 0; i < names.length; i++) {
    try { delete window[names[i]]; } catch (e) {}
    try { if (window[names[i]]) Object.defineProperty(window, names[i], { value: undefined, configurable: true }); } catch (e) {}
  }
})();
true;`;

/**
 * The app's own origin: a host under the reserved `.invalid` top-level domain, which never resolves (RFC 6761), one per
 * app. Not an opaque `about:blank` origin, because WebKit then reports every error of the app's own scripts as
 * "Script error." with no line, which leaves the fix loop blind. Nothing is ever loaded from it.
 */
export function appBaseUrl(appId: string): string {
  return `https://${appId.replace(/[^a-z0-9-]/g, '')}.apps.qutai.invalid/`;
}

/** The only address an app's WebView may be on: its own document (fragment links inside it included). */
export function appNavigationAllowed(url: string, base: string): boolean {
  if (url === '' || url === 'about:blank') return true;
  if (url === base) return true;
  return url.startsWith(`${base}#`) && !/\s/.test(url);
}

/** What the runner puts in the document so `qutai.ready` needs no round trip. */
export type BootInfo = {
  id: string;
  name: string;
  version: number;
  language: string;
  uiLanguage: string;
  platform: string;
  permissions: string[];
  theme: ThemeInfo;
  insets: Insets;
};

/** CSS variables for the theme and safe areas, as `name: value;` pairs (also set by the helper on events). */
export function themeVariables(theme: ThemeInfo, insets: Insets): string {
  const c = theme.colors;
  return [
    `--qutai-bg: ${c.bg}`,
    `--qutai-surface: ${c.surface}`,
    `--qutai-sunken: ${c.sunken}`,
    `--qutai-text: ${c.text}`,
    `--qutai-text-secondary: ${c.textSecondary}`,
    `--qutai-tint: ${c.tint}`,
    `--qutai-on-tint: ${c.onTint}`,
    `--qutai-danger: ${c.danger}`,
    `--qutai-separator: ${c.separator}`,
    `--qutai-border: ${c.border}`,
    `--qutai-font-scale: ${theme.fontScale}`,
    `--qutai-safe-top: ${insets.top}px`,
    `--qutai-safe-right: ${insets.right}px`,
    `--qutai-safe-bottom: ${insets.bottom}px`,
    `--qutai-safe-left: ${insets.left}px`,
    `color-scheme: ${theme.dark ? 'dark' : 'light'}`,
  ].join('; ');
}

export const BASE_CSS = `*, *::before, *::after { box-sizing: border-box; }
html { font-size: calc(16px * var(--qutai-font-scale, 1)); -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
html, body { margin: 0; padding: 0; background: var(--qutai-bg); color: var(--qutai-text); }
body { font-family: -apple-system, system-ui, Roboto, "Segoe UI", sans-serif; font-size: 1rem; line-height: 1.45;
  padding: 0 var(--qutai-safe-right) var(--qutai-safe-bottom) var(--qutai-safe-left); -webkit-tap-highlight-color: transparent; }
button, input, select, textarea { font: inherit; color: inherit; }
button, [role="button"], input, select { min-height: 44px; }
input, textarea, select { background: var(--qutai-surface); border: 1px solid var(--qutai-border); border-radius: 10px; padding: 0.5rem 0.75rem; }
button { background: var(--qutai-tint); color: var(--qutai-on-tint); border: 0; border-radius: 10px; padding: 0.5rem 1rem; }
:focus-visible { outline: 3px solid var(--qutai-tint); outline-offset: 2px; }
[hidden] { display: none !important; }`;

/**
 * The first script: the lockdown (network, windows, frames, forms, links), diagnostics (errors, console, blocked
 * things) and the `qutai` helper library of contract 1. Runs before any of the app's code.
 */
function helperScript(boot: BootInfo): string {
  // < escaped so nothing in a name can end the script element.
  const data = JSON.stringify(boot).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `(function () {
'use strict';
var BOOT = ${data};
var RN = window.ReactNativeWebView;
var post = RN && RN.postMessage ? RN.postMessage.bind(RN) : function () {};
function send(o) { o.qutai = 1; try { post(JSON.stringify(o)); } catch (e) {} }
function cut(s) { s = String(s); return s.length > 300 ? s.slice(0, 300) + '\\u2026' : s; }
var diags = 0;
function diag(kind, message, extra) {
  if (++diags > 200) return;
  var d = { kind: kind, message: cut(message) };
  if (extra) for (var k in extra) d[k] = extra[k];
  send({ diag: d });
}
function define(obj, name, value) {
  try { Object.defineProperty(obj, name, { value: value, writable: false, configurable: false }); } catch (e) {}
}
var OFF = 'The network is off in Qutai apps.';
define(window, 'fetch', function () { diag('blocked', 'fetch: ' + OFF); return Promise.reject(new TypeError(OFF)); });
['XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection',
 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate', 'Worker', 'SharedWorker'].forEach(function (n) {
  define(window, n, function () { diag('blocked', n + ': ' + OFF); throw new TypeError(n + ' is not available in Qutai apps.'); });
});
try { define(Navigator.prototype, 'sendBeacon', function () { return false; }); } catch (e) {}
try { define(navigator, 'sendBeacon', function () { return false; }); } catch (e) {}
define(window, 'open', function () { diag('blocked', 'window.open: apps cannot open windows.'); return null; });
// Web storage, cookies and the browser's own powerful APIs: apps keep data with qutai.storage / qutai.db and reach the
// phone only through the bridge (the app's origin is its own, so these would otherwise exist).
function refuse(what, instead) {
  return function () { diag('blocked', what + ' is not available in Qutai apps.' + (instead ? ' Use ' + instead + '.' : '')); throw new TypeError(what + ' is not available in Qutai apps.' + (instead ? ' Use ' + instead + '.' : '')); };
}
[['localStorage', 'qutai.storage'], ['sessionStorage', 'qutai.storage'], ['indexedDB', 'qutai.db'], ['caches', 'qutai.storage']].forEach(function (p) {
  try { Object.defineProperty(window, p[0], { get: refuse(p[0], p[1]), configurable: false }); } catch (e) {}
});
try { Object.defineProperty(Document.prototype, 'cookie', { get: function () { return ''; }, set: function () { diag('blocked', 'document.cookie is not available in Qutai apps.'); }, configurable: false }); } catch (e) {}
['clipboard', 'share', 'canShare', 'credentials', 'serviceWorker', 'mediaDevices', 'geolocation', 'bluetooth', 'usb', 'hid', 'serial', 'xr', 'wakeLock', 'storage', 'locks'].forEach(function (n) {
  try { Object.defineProperty(Navigator.prototype, n, { get: function () { return undefined; }, configurable: false }); } catch (e) {}
  try { Object.defineProperty(navigator, n, { get: function () { return undefined; }, configurable: false }); } catch (e) {}
});
['Notification', 'PaymentRequest', 'BroadcastChannel', 'SharedWorker', 'PushManager'].forEach(function (n) {
  define(window, n, function () { diag('blocked', n + ' is not available in Qutai apps.'); throw new TypeError(n + ' is not available in Qutai apps.'); });
});
['HTMLIFrameElement', 'HTMLFrameElement', 'HTMLObjectElement', 'HTMLEmbedElement'].forEach(function (n) {
  var P = window[n] && window[n].prototype;
  if (!P) return;
  ['contentWindow', 'contentDocument'].forEach(function (p) {
    try { Object.defineProperty(P, p, { get: function () { return null; }, configurable: false }); } catch (e) {}
  });
});
function scrub(node) {
  if (!node || node.nodeType !== 1) return;
  if (/^(IFRAME|FRAME|OBJECT|EMBED|PORTAL)$/.test(node.tagName)) {
    diag('blocked', '<' + node.tagName.toLowerCase() + '> elements are not allowed in Qutai apps.');
    node.remove();
    return;
  }
  if (node.querySelectorAll) Array.prototype.forEach.call(node.querySelectorAll('iframe,frame,object,embed,portal'), scrub);
}
new MutationObserver(function (records) {
  records.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes, scrub); });
}).observe(document, { childList: true, subtree: true });
document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  var href = a.getAttribute('href') || '';
  if (href.charAt(0) === '#' || /^javascript:/i.test(href)) return;
  e.preventDefault();
  diag('blocked', 'Links are off in Qutai apps: ' + href);
}, true);
window.addEventListener('error', function (e) {
  if (e.target && e.target !== window && e.target.tagName) return;
  var msg = e.message || 'Error';
  var named = e.error && e.error.name && msg.indexOf(e.error.name) !== 0 ? e.error.name + ': ' : '';
  diag('error', named + msg, {
    line: e.lineno || 0, col: e.colno || 0, stack: e.error && e.error.stack ? cut(e.error.stack) : undefined });
}, true);
window.addEventListener('unhandledrejection', function (e) {
  var r = e.reason;
  var text = (r && r.code ? r.code + ' ' : '') + (r && r.message ? r.message : String(r));
  diag('error', 'Unhandled promise rejection: ' + text, {
    stack: r && r.stack ? cut(r.stack) : undefined,
    // A rejection with a value that is not an error (a record, a string) could be the app's data: its shape only.
    shape: 'Unhandled promise rejection: ' + (r instanceof Error || (r && r.message) ? text : shapeOf(r)) });
});
document.addEventListener('securitypolicyviolation', function (e) {
  diag('blocked', 'Blocked by the app policy (' + e.violatedDirective + '): ' + (e.blockedURI || 'inline'));
});
// What a console argument is without its value (types and lengths), for the report sent to the AI: the app's data
// stays on the phone. An error keeps its name and message.
function shapeOf(v) {
  if (v === null) return 'null';
  var t = typeof v;
  if (t === 'undefined') return 'undefined';
  if (t === 'string') return '<string ' + v.length + '>';
  if (t === 'number' || t === 'boolean' || t === 'bigint' || t === 'symbol') return '<' + t + '>';
  if (t === 'function') return '<function>';
  if (v instanceof Error) return v.name + ': ' + v.message;
  if (Array.isArray(v)) return '<array ' + v.length + '>';
  try { return '<object, ' + Object.keys(v).length + ' keys>'; } catch (e) { return '<object>'; }
}
function fmt(v) {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.name + ': ' + v.message;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
['log', 'info', 'warn', 'error'].forEach(function (level) {
  var original = console[level];
  console[level] = function () {
    diag('console', Array.prototype.map.call(arguments, fmt).join(' '), {
      level: level, shape: Array.prototype.map.call(arguments, shapeOf).join(' ') });
    if (original) return original.apply(console, arguments);
  };
});

var nextId = 1;
var pending = {};
function call(name, args) {
  return new Promise(function (resolve, reject) {
    var id = nextId++;
    pending[id] = { resolve: resolve, reject: reject, name: name };
    send({ id: id, call: String(name), args: args || {} });
  });
}
var listeners = {};
function emit(event, data) {
  if (event === 'theme') { api.theme = data; root(); }
  if (event === 'insets') { boot.insets = data; root(); }
  (listeners[event] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { setTimeout(function () { throw e; }); } });
}
define(window, '__qutaiReceive', function (msg) {
  if (!msg) return;
  if (msg.ping !== undefined) return send({ pong: msg.ping });
  if (msg.event) return emit(msg.event, msg.data);
  var p = pending[msg.id];
  if (!p) return;
  delete pending[msg.id];
  if (msg.ok) return p.resolve(msg.value);
  var err = new Error(msg.error && msg.error.message || 'Error');
  err.code = msg.error && msg.error.code || 'E_INTERNAL';
  diag('bridge', p.name + ': ' + err.code + ' ' + err.message);
  p.reject(err);
});
var boot = { insets: BOOT.insets };
var VARS = ['bg', 'surface', 'sunken', 'text', 'textSecondary', 'tint', 'onTint', 'danger', 'separator', 'border'];
function root() {
  var s = document.documentElement.style;
  var c = api.theme.colors;
  VARS.forEach(function (k) { s.setProperty('--qutai-' + k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }), c[k]); });
  s.setProperty('--qutai-font-scale', String(api.theme.fontScale));
  ['top', 'right', 'bottom', 'left'].forEach(function (k) { s.setProperty('--qutai-safe-' + k, (boot.insets[k] || 0) + 'px'); });
  s.setProperty('color-scheme', api.theme.dark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-qutai-theme', api.theme.dark ? 'dark' : 'light');
}
function freeze(o) { return Object.freeze(o); }
function db(collection) {
  var c = String(collection);
  return freeze({
    add: function (doc) { return call('docs.add', { collection: c, doc: doc }); },
    get: function (id) { return call('docs.get', { collection: c, id: id }); },
    put: function (id, doc) { return call('docs.put', { collection: c, id: id, doc: doc }); },
    update: function (id, patch) { return call('docs.update', { collection: c, id: id, patch: patch }); },
    'delete': function (id) { return call('docs.delete', { collection: c, id: id }); },
    remove: function (id) { return call('docs.delete', { collection: c, id: id }); },
    query: function (q) { return call('docs.query', Object.assign({}, q || {}, { collection: c })); },
    all: function (q) { return call('docs.query', Object.assign({}, q || {}, { collection: c })).then(function (r) { return r.docs; }); },
    count: function (q) { return call('docs.count', Object.assign({}, q || {}, { collection: c })); },
    clear: function () { return call('docs.clear', { collection: c }); }
  });
}
function opts(o, key) { if (typeof o === 'string') { var x = {}; x[key] = o; return x; } return o || {}; }
var api = {
  version: '1.0',
  contract: ${CONTRACT_VERSION},
  info: freeze({ id: BOOT.id, name: BOOT.name, version: BOOT.version, permissions: BOOT.permissions, platform: BOOT.platform }),
  language: BOOT.language,
  uiLanguage: BOOT.uiLanguage,
  theme: BOOT.theme,
  call: call,
  on: function (event, fn) { (listeners[event] = listeners[event] || []).push(fn); return function () { api.off(event, fn); }; },
  off: function (event, fn) { listeners[event] = (listeners[event] || []).filter(function (f) { return f !== fn; }); },
  id: function () {
    var b = new Uint8Array(12); crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return (x % 36).toString(36); }).join('');
  },
  escape: function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  },
  t: function (map) {
    if (!map || typeof map !== 'object') return String(map == null ? '' : map);
    var l = api.language || 'en';
    if (map[l] != null) return map[l];
    if (map[l.split('-')[0]] != null) return map[l.split('-')[0]];
    if (map.en != null) return map.en;
    for (var k in map) return map[k];
    return '';
  },
  db: db,
  collections: function () { return call('docs.collections'); },
  storage: freeze({
    get: function (key) { return call('storage.get', { key: key }); },
    set: function (key, value) { return call('storage.set', { key: key, value: value }); },
    remove: function (key) { return call('storage.remove', { key: key }); },
    keys: function (prefix) { return call('storage.keys', { prefix: prefix }); },
    getMany: function (keys) { return call('storage.getMany', { keys: keys }); },
    setMany: function (entries) { return call('storage.setMany', { entries: entries }); },
    usage: function () { return call('storage.usage'); },
    batch: function (ops) { return call('storage.batch', { ops: ops }); }
  }),
  ui: freeze({
    toast: function (o) { return call('ui.toast', opts(o, 'text')); },
    alert: function (o) { return call('ui.alert', opts(o, 'title')); },
    confirm: function (o) { return call('ui.confirm', opts(o, 'title')); },
    prompt: function (o) { return call('ui.prompt', opts(o, 'title')); },
    haptic: function (kind) { return call('ui.haptic', { kind: kind || 'selection' }); },
    setTitle: function (title) { return call('ui.setTitle', { title: title || '' }); },
    setBackHandler: function (enabled) { return call('ui.setBackHandler', { enabled: enabled !== false }); },
    theme: function () { return call('ui.theme'); },
    insets: function () { return call('ui.insets'); }
  }),
  clipboard: freeze({
    write: function (text) { return call('clipboard.write', { text: String(text) }); },
    read: function () { return call('clipboard.read'); }
  }),
  app: freeze({
    info: function () { return call('app.info'); },
    permissions: function () { return call('app.permissions'); },
    requestPermission: function (p) { return call('app.requestPermission', { permission: p }); },
    close: function () { return call('app.close'); }
  })
};
api.ready = Promise.resolve(api);
root();
define(window, 'qutai', api);
send({ ready: true });
})();`;
}

/** A part of the document and where it came from (null: Qutai's own). */
type Chunk = { text: string; file: string | null; line: number };

export type BuiltDocument = {
  html: string;
  /** Things in the app's files the builder left out (a script or stylesheet from elsewhere, <base>, <meta refresh>). */
  notes: string[];
  /** Document line (1-based) → file and line. */
  mapLine: (line: number) => { file: string; line: number } | null;
};

function lineAt(text: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

const TAG = /<script\b([^>]*)>\s*<\/script\s*>|<link\b[^>]*>|<meta\b[^>]*>|<base\b[^>]*>/gi;

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
}

/** The entry file's markup with package scripts and stylesheets put inline, and everything else that loads removed. */
function inlineFiles(pkg: AppPackage, fragment: string, start: number, source: string, chunks: Chunk[], notes: string[]) {
  const entry = pkg.manifest.entry;
  let last = 0;
  TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  const plain = (end: number) => {
    if (end > last) chunks.push({ text: fragment.slice(last, end), file: entry, line: lineAt(source, start + last) });
  };
  while ((m = TAG.exec(fragment))) {
    const tag = m[0];
    const lower = tag.toLowerCase();
    if (lower.startsWith('<script')) {
      const src = attr(m[1], 'src');
      if (src === null) continue; // an inline script, kept as written
      plain(m.index);
      const name = src.replace(/^\.\//, '');
      if (name.endsWith('.js') && typeof pkg.files[name] === 'string') {
        chunks.push({ text: '<script>\n', file: null, line: 0 });
        chunks.push({ text: pkg.files[name].replace(/<\/script/gi, '<\\/script'), file: name, line: 1 });
        chunks.push({ text: '\n</script>', file: null, line: 0 });
      } else notes.push(`left out <script src="${src}">: apps can only use their own .js files`);
    } else if (lower.startsWith('<link')) {
      plain(m.index);
      const href = (attr(tag, 'href') ?? '').replace(/^\.\//, '');
      const rel = (attr(tag, 'rel') ?? '').toLowerCase();
      if (rel === 'stylesheet' && href.endsWith('.css') && typeof pkg.files[href] === 'string') {
        chunks.push({ text: '<style>\n', file: null, line: 0 });
        chunks.push({ text: pkg.files[href].replace(/<\/style/gi, '<\\/style'), file: href, line: 1 });
        chunks.push({ text: '\n</style>', file: null, line: 0 });
      } else notes.push(`left out <link ${rel ? `rel="${rel}" ` : ''}href="${href}">`);
    } else {
      plain(m.index);
      // Qutai sets the charset, viewport and policy itself; refresh, base and other http-equiv go.
      if (lower.startsWith('<base') || /http-equiv/i.test(tag)) notes.push(`left out ${tag.slice(0, 80)}`);
    }
    last = m.index + tag.length;
  }
  plain(fragment.length);
}

/** One document for the app's current version, with the boot information of this moment. */
export function buildAppDocument(pkg: AppPackage, boot: BootInfo): BuiltDocument {
  const source = pkg.files[pkg.manifest.entry] ?? '';
  const notes: string[] = [];
  const chunks: Chunk[] = [];
  const lang = boot.language.replace(/[^A-Za-z0-9-]/g, '');
  chunks.push({
    text:
      `<!doctype html>\n<html lang="${lang}" data-qutai-theme="${boot.theme.dark ? 'dark' : 'light'}" style="${themeVariables(boot.theme, boot.insets)}">\n<head>\n` +
      `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${APP_CSP}">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="referrer" content="no-referrer">\n<meta http-equiv="x-dns-prefetch-control" content="off">\n` +
      `<script>\n${helperScript(boot)}\n</script>\n<style>\n${BASE_CSS}\n</style>\n`,
    file: null,
    line: 0,
  });
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(source);
  if (head) inlineFiles(pkg, head[1], head.index + head[0].indexOf(head[1]), source, chunks, notes);
  chunks.push({ text: '\n</head>\n', file: null, line: 0 });
  const body = /<body\b([^>]*)>([\s\S]*?)(<\/body\s*>|$)/i.exec(source);
  let bodyText: string;
  let bodyStart: number;
  let bodyAttrs = '';
  if (body) {
    bodyAttrs = body[1];
    bodyText = body[2];
    bodyStart = body.index + body[0].indexOf(body[2], body[0].indexOf('>'));
  } else {
    // No <body>: everything after the head (or the whole file) is the body.
    bodyStart = head ? head.index + head[0].length : 0;
    bodyText = source.slice(bodyStart).replace(/<\/?html\b[^>]*>|<!doctype[^>]*>/gi, '');
  }
  chunks.push({ text: `<body${bodyAttrs}>`, file: null, line: 0 });
  inlineFiles(pkg, bodyText, bodyStart, source, chunks, notes);
  chunks.push({ text: '\n</body>\n</html>\n', file: null, line: 0 });

  const starts: { doc: number; chunk: Chunk; lines: number }[] = [];
  let docLine = 1;
  for (const chunk of chunks) {
    const lines = chunk.text.split('\n').length - 1;
    starts.push({ doc: docLine, chunk, lines });
    docLine += lines;
  }
  return {
    html: chunks.map((c) => c.text).join(''),
    notes,
    mapLine: (line: number) => {
      for (let i = starts.length - 1; i >= 0; i--) {
        const s = starts[i];
        if (s.doc <= line && line <= s.doc + s.lines) {
          if (!s.chunk.file) return { file: 'qutai.js', line: line - s.doc + 1 };
          return { file: s.chunk.file, line: s.chunk.line + (line - s.doc) };
        }
      }
      return null;
    },
  };
}

// ---------- Messages from the document besides bridge calls ----------

export type Diagnostic = {
  kind: 'error' | 'console' | 'blocked' | 'bridge';
  level?: string;
  message: string;
  /** "app.js:37" when known. */
  where?: string;
  /**
   * The message without values, for what goes to the AI ("Ask Qutai to fix this"): console arguments as their types
   * and lengths, a non-error rejection as its shape. Absent where the message is already only an error's text.
   */
  shape?: string;
  /** An error's stack, its frames mapped to the app's files ("app.js:37"), at most a few lines. */
  stack?: string;
  at: number;
};

export type AppMessage = { type: 'diag'; diag: Diagnostic } | { type: 'pong'; n: number } | { type: 'ready' };

/** Diagnostics, pongs and the ready signal; null for anything else (bridge calls are parsed by parseBridgeRequest). */
export function parseAppMessage(raw: string, mapLine: BuiltDocument['mapLine'], now: number): AppMessage | null {
  if (raw.length > 8192) return null;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || m.qutai !== 1) return null;
  if (m.ready === true) return { type: 'ready' };
  if (typeof m.pong === 'number') return { type: 'pong', n: m.pong };
  const d = m.diag as Record<string, unknown> | undefined;
  if (!d || typeof d !== 'object') return null;
  const kind = d.kind === 'error' || d.kind === 'console' || d.kind === 'blocked' || d.kind === 'bridge' ? d.kind : null;
  if (!kind || typeof d.message !== 'string') return null;
  let where: string | undefined;
  if (typeof d.line === 'number' && d.line > 0) {
    const mapped = mapLine(d.line);
    if (mapped) where = `${mapped.file}:${mapped.line}`;
  }
  const stack = typeof d.stack === 'string' ? mapStack(d.stack, mapLine) : '';
  return {
    type: 'diag',
    diag: {
      kind,
      ...(typeof d.level === 'string' ? { level: d.level.slice(0, 10) } : {}),
      message: d.message.slice(0, 301),
      ...(typeof d.shape === 'string' ? { shape: d.shape.slice(0, 301) } : {}),
      ...(where ? { where } : {}),
      ...(stack ? { stack } : {}),
      at: now,
    },
  };
}

/** The most stack lines a report carries. */
export const MAX_STACK_LINES = 6;

/**
 * A stack with each frame's document address turned into the app's file and line ("at save (app.js:37)") and Qutai's
 * own frames left out, at most MAX_STACK_LINES lines of 160 characters.
 */
export function mapStack(stack: string, mapLine: BuiltDocument['mapLine']): string {
  return stack
    .slice(0, 2000)
    .split('\n')
    .map((line) =>
      line.replace(/(?:https?:\/\/[^\s)]*?|about:[^\s)]*?|)?:(\d+):\d+/g, (all: string, n: string) => {
        const mapped = mapLine(Number(n));
        return mapped ? `${mapped.file}:${mapped.line}` : all;
      }),
    )
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('qutai.js:'))
    .slice(0, MAX_STACK_LINES)
    .map((line) => (line.length > 160 ? `${line.slice(0, 160)}…` : line))
    .join('\n');
}

/**
 * What "Ask Qutai to fix this" sends (decided 19 Nov 2026): errors with their message, file and line and a short
 * stack; blocked attempts and bridge errors as they are; console warnings and errors only as their shape (types and
 * lengths, never values), so the app's data does not reach the AI. The user sees exactly this in the message box and
 * sends it themselves.
 */
export function formatFixReport(diags: Diagnostic[]): string {
  return diags
    .map((d) => {
      const label = d.kind === 'console' ? `console.${d.level ?? 'log'}` : d.kind;
      const text = d.kind === 'console' ? (d.shape ?? '<values left out>') : d.kind === 'error' && d.shape ? d.shape : d.message;
      const stack = d.kind === 'error' && d.stack ? `\n${d.stack.split('\n').map((l) => `    ${l}`).join('\n')}` : '';
      return `- ${label}${d.where ? ` (${d.where})` : ''}: ${text}${stack}`;
    })
    .join('\n');
}

/** Diagnostics as lines for the assistant and the Details line. */
export function formatDiagnostics(diags: Diagnostic[]): string {
  return diags
    .map((d) => {
      const label = d.kind === 'console' ? `console.${d.level ?? 'log'}` : d.kind;
      return `- ${label}${d.where ? ` (${d.where})` : ''}: ${d.message}`;
    })
    .join('\n');
}
