#!/usr/bin/env node
// Local test page for pull to refresh and the long-press menu while scrolling (src/browser/pullToRefresh.ts,
// src/browser/contextMenu.ts). Nothing leaves the machine.
//
// Usage: node scripts/page-tests/touch.mjs [port]   (default 8814; 127.0.0.1 only; the Android emulator reaches it as
//        http://10.0.2.2:8814 after `adb reverse tcp:8814 tcp:8814` as http://localhost:8814, the iOS simulator as
//        http://localhost:8814)
//   /         a chat list built with column-reverse (newest at the bottom), an ordinary inner scroll area, an area
//             with overscroll-behavior none, and long-pressable links and images inside and outside the scrollers.
//             The "Loads" counter goes up on every load, so a refresh is visible; a long press shows the app's menu.
//   /contain  the same page with overscroll-behavior-y: contain on the root: pulling never refreshes.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

let loads = 0;

const IMG =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#4a7"/><text x="10" y="35" fill="#fff">image</text></svg>');

export function touchPage(contain) {
  const messages = Array.from(
    { length: 60 },
    (_, i) => `<div class="msg">Message ${i + 1} <a href="/m${i + 1}">link ${i + 1}</a></div>`,
  ).join('');
  const rows = Array.from({ length: 40 }, (_, i) => `<p>Row ${i + 1} <a href="/r${i + 1}">row link</a></p>`).join('');
  return `<!doctype html><html${contain ? ' style="overscroll-behavior-y: contain"' : ''}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Touch tests</title>
<style>
body { font: 16px/1.4 system-ui, sans-serif; margin: 12px; }
.box { height: 180px; border: 2px solid #888; margin: 8px 0; overflow-y: auto; }
#chat { display: flex; flex-direction: column-reverse; border-color: #c55; }
#plain { border-color: #55c; }
#none { overscroll-behavior-y: none; border-color: #5a5; }
.msg { padding: 6px; border-bottom: 1px solid #ddd; }
</style></head><body>
<h3>Loads: <span id="loads">${loads}</span>${contain ? ' (root contain)' : ''}</h3>
<p><a href="/top">A link at the top</a> <img id="topimg" src="${IMG}" alt="top image"></p>
<p>Chat (column-reverse, newest at the bottom; drag down to read older):</p>
<div id="chat" class="box">${messages}</div>
<p>overscroll-behavior-y: none:</p>
<div id="none" class="box">${rows}</div>
<p>Plain scroll area:</p>
<div id="plain" class="box">${rows}</div>
${Array.from({ length: 30 }, (_, i) => `<p>Page text ${i + 1} <a href="/p${i + 1}">page link</a> <img src="${IMG}" alt="image ${i + 1}"></p>`).join('')}
<script>
  window.__chatTop = function () { return document.getElementById('chat').scrollTop; };
</script>
</body></html>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] ?? 8814);
  createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/favicon.ico') return res.writeHead(404).end();
    loads++;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(touchPage(path === '/contain'));
  }).listen(port, '127.0.0.1', () => console.log(`Touch test page on http://127.0.0.1:${port}/`));
}
