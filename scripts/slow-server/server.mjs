#!/usr/bin/env node
// A small local web server that answers slowly, for testing how the browser behaves on a bad connection (20 Nov 2026:
// "nothing happens after tapping a result", "the slow page lands in the tab I opened meanwhile"). No dependencies.
//
// Usage: node scripts/slow-server/server.mjs [port]   (default 8823; listens on all interfaces so a phone on the same
//   network or an Android emulator via `adb reverse tcp:8823 tcp:8823` can reach it; the iOS simulator uses localhost)
//
//   /                                 a results page ("search results") whose links use the routes below
//   /slow?first=5&trickle=3&kb=40     waits `first` s before the first byte, then sends `kb` KB of page over `trickle` s
//   /redirect?first=2&to=/slow?first=3  waits `first` s, then answers 302 to `to` (a local path only)
//   /hang                             never answers (the connection stays open until the client gives up)
//   /form                             a page with a POST form to /submitted (for the "send the form again?" warning)
//   /submitted                        the form's result (POST), also slow with ?first=
//   /popup                            a page that tries window.open on load (no touch) and on a button
//   /new-window                       a link with target=_blank to a slow page
// Every page shows its own address and the time it was served, so a screenshot says which load landed where.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const html = (title, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${title}</title><style>body{font:16px -apple-system,system-ui,sans-serif;margin:16px;line-height:1.5}` +
  `a{display:block;padding:10px 0;font-size:18px}.when{color:#777;font-size:13px}</style></head><body>${body}</body></html>`;

const wait = (seconds) => new Promise((r) => setTimeout(r, Math.max(0, seconds) * 1000));

function num(params, key, fallback) {
  const v = Number(params.get(key));
  return Number.isFinite(v) && params.has(key) ? v : fallback;
}

/** Local paths only, so the server can't be used to bounce somewhere else. */
function localTarget(to) {
  return typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') ? to : '/';
}

const INDEX = html(
  'Slow results',
  `<h1>Slow results</h1>
<p class="when">served ${'${when}'}</p>
<a id="r5" href="/slow?first=5&label=five">Result: first byte after 5 s</a>
<a id="r10" href="/slow?first=10&trickle=4&label=ten">Result: 10 s, then a 4 s body</a>
<a id="r30" href="/slow?first=30&label=thirty">Result: 30 s ("very slow")</a>
<a id="redir" href="/redirect?first=3&to=${encodeURIComponent('/slow?first=4&label=redirected')}">Result: redirect after 3 s, then 4 s</a>
<a id="hang" href="/hang">Result: never answers</a>
<a id="form" href="/form">A form (POST)</a>
<a id="popup" href="/popup">A page that opens a pop-up</a>
<a id="blank" href="/new-window">A link that opens a new window</a>`,
);

export function createSlowServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const p = url.searchParams;
    const when = new Date().toISOString().slice(11, 23);
    res.on('error', () => {});
    try {
      if (url.pathname === '/') {
        await wait(num(p, 'first', 0));
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(INDEX.replace('${when}', when));
      }
      if (url.pathname === '/slow' || url.pathname === '/submitted') {
        const label = (p.get('label') ?? url.pathname.slice(1)).replace(/[^\w -]/g, '');
        await wait(num(p, 'first', 3));
        if (res.destroyed) return;
        const kb = num(p, 'kb', 24);
        const trickle = num(p, 'trickle', 0);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        const head = html(`Slow page ${label}`, '').replace('</body></html>', '');
        res.write(
          head +
            `<h1 id="label">Slow page: ${label}</h1><p class="when">asked ${when}, ` +
            `first byte after ${num(p, 'first', 3)} s</p><p id="method">${req.method}</p>`,
        );
        const chunks = Math.max(1, Math.round(kb / 4));
        for (let i = 0; i < chunks; i++) {
          if (trickle > 0) await wait(trickle / chunks);
          if (res.destroyed) return;
          res.write(`<p>${'Filler text so the page has a body. '.repeat(100)}</p>`);
        }
        return res.end(`<p id="done">done ${new Date().toISOString().slice(11, 23)}</p></body></html>`);
      }
      if (url.pathname === '/redirect') {
        await wait(num(p, 'first', 2));
        if (res.destroyed) return;
        res.writeHead(302, { location: localTarget(p.get('to')), 'cache-control': 'no-store' });
        return res.end();
      }
      if (url.pathname === '/hang') {
        // Never answers; the socket closes when the client gives up.
        req.socket.setTimeout(0);
        return;
      }
      if (url.pathname === '/form') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(
          html(
            'Form',
            `<h1>Form</h1><form method="post" action="/submitted?first=${num(p, 'first', 2)}&label=posted">` +
              `<input name="q" value="hello"><button id="send">Send</button></form>`,
          ),
        );
      }
      if (url.pathname === '/popup') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(
          html(
            'Pop-up',
            `<h1>Pop-up page</h1><p>This page tried to open a window on load.</p>` +
              `<button id="open" onclick="window.open('/slow?first=2&label=popup-tap')">Open a window (tap)</button>` +
              `<script>setTimeout(function(){window.open('/slow?first=1&label=popup-auto')},300)</script>`,
          ),
        );
      }
      if (url.pathname === '/new-window') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(
          html('New window', `<a id="target" target="_blank" href="/slow?first=6&label=new-window">Open in a new window (6 s)</a>`),
        );
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    } catch {
      res.destroy();
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] ?? 8823);
  createSlowServer().listen(port, () => console.log(`slow server on http://localhost:${port}/`));
}
