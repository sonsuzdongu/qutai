#!/usr/bin/env node
// Local test pages for user styles and the cookie list (docs/page-customisation.md). Nothing leaves the machine.
//
// Usage: node scripts/page-tests/customise.mjs [port]   (default 8812; 127.0.0.1 only; the Android emulator reaches it
//        as http://10.0.2.2:8812, the iOS simulator as http://localhost:8812)
//   /style    injection timing and SPA moves: the page's own late stylesheet colours links blue; the first line says
//             what colour a link had while the page was still being parsed (a user style "a { color: red }" applied at
//             document start shows red there: no flash). Buttons move with pushState / replaceState / hash changes.
//   /cookies  sets an HttpOnly session cookie, a persistent one and (from the page) a script cookie, and shows what
//             page JavaScript can see (document.cookie never has the HttpOnly one).
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8812);

const STYLE_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Style timing</title>
<style>body { font: 17px/1.5 -apple-system, system-ui, sans-serif; margin: 16px; } button { font-size: 16px; margin: 4px 4px 4px 0; }</style>
</head><body>
<p id="first">At first paint: …</p>
<p><a id="probe" href="#x">A link the page colours blue</a></p>
<script>
  // Runs while the page is still being parsed, before the late stylesheet below has loaded.
  document.getElementById('first').textContent = 'At first paint: ' + getComputedStyle(document.getElementById('probe')).color;
</script>
<link rel="stylesheet" href="/slow.css">
<p id="now">Now: …</p>
<p>Address: <code id="where"></code></p>
<p>
  <button onclick="history.pushState({}, '', '/style/a'); show()">pushState /style/a</button>
  <button onclick="history.replaceState({}, '', '/style/b?x=1'); show()">replaceState /style/b?x=1</button>
  <button onclick="location.hash = 'h' + Date.now(); show()">hash</button>
  <button onclick="history.back()">back</button>
</p>
<p style="color: green">Inline green text (style attribute).</p>
<script>
  function show() {
    document.getElementById('where').textContent = location.pathname + location.search + location.hash;
    setTimeout(function () {
      document.getElementById('now').textContent = 'Now: ' + getComputedStyle(document.getElementById('probe')).color;
    }, 50);
  }
  window.addEventListener('popstate', show);
  window.addEventListener('load', show);
  show();
</script>
</body></html>`;

const COOKIE_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cookie test</title>
<style>body { font: 17px/1.5 -apple-system, system-ui, sans-serif; margin: 16px; } code { word-break: break-all; }</style>
</head><body>
<h1>Cookie test</h1>
<p>The server set <b>qt_session</b> (HttpOnly) and <b>qt_pref</b> (one day). This page sets <b>qt_script</b>.</p>
<p>Page JavaScript sees: <code id="seen"></code></p>
<p><a href="/cookies">Reload</a> · <a href="/cookies/sub">A page under /cookies/sub</a></p>
<script>
  document.cookie = 'qt_script=from-js; path=/; max-age=3600; samesite=lax';
  document.getElementById('seen').textContent = document.cookie || '(none)';
</script>
</body></html>`;

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const html = (body, headers = {}) =>
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers }).end(body);
  if (url.pathname === '/slow.css') {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' }).end('a { color: rgb(0, 0, 255); }');
    }, 1500);
    return;
  }
  if (url.pathname === '/style' || url.pathname.startsWith('/style/')) return html(STYLE_PAGE);
  if (url.pathname === '/cookies' || url.pathname.startsWith('/cookies/')) {
    const token = Math.random().toString(36).slice(2);
    return html(COOKIE_PAGE, {
      'set-cookie': [
        `qt_session=${token}; Path=/; HttpOnly; SameSite=Lax`,
        'qt_pref=dark; Path=/; Max-Age=86400; SameSite=Lax',
      ],
    });
  }
  if (url.pathname === '/') {
    return html('<!doctype html><meta name="viewport" content="width=device-width"><p><a href="/style">Style timing</a></p><p><a href="/cookies">Cookies</a></p>');
  }
  res.writeHead(404).end();
}).listen(port, '127.0.0.1', () => console.log(`Customisation test pages on http://localhost:${port}/`));
