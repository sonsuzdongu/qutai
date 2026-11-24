#!/usr/bin/env node
// Local test pages for the address bar at the bottom (src/components/BarLayout.tsx): how a page's own bottom navigation
// stays above it. Nothing leaves the machine.
//
// Usage: node scripts/page-tests/bars.mjs [port]   (default 8815; 127.0.0.1 only; the Android emulator reaches it as
//        http://10.0.2.2:8815, the iOS simulator as http://localhost:8815)
//   /fixed      a long page with a `position: fixed; bottom: 0` navigation bar (Instagram, YouTube)
//   /vh         an app shell `height: 100vh` with its navigation at the shell's bottom
//   /dvh        the same with `100dvh`
//   /inner      the shell sized once from window.innerHeight on load (never updated)
// Every page shows innerHeight, visualViewport.height, clientHeight and how many resize events arrived, and a
// red line at the window's real bottom, so a band between the navigation and that line is visible.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const STYLE = `
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.4 system-ui, sans-serif; background: #fff; }
nav { background: #222; color: #fff; height: 56px; display: flex; align-items: center; justify-content: space-around; }
#info { position: fixed; top: 40%; left: 8px; right: 8px; background: #ffd; border: 1px solid #aa8; padding: 6px; font: 13px monospace; z-index: 5; }
#edge { position: fixed; left: 0; right: 0; bottom: 0; height: 3px; background: red; z-index: 6; }
.rows p { margin: 0; padding: 10px 12px; border-bottom: 1px solid #eee; }
.shell { display: flex; flex-direction: column; }
.shell main { flex: 1; overflow-y: auto; }
`;

const rows = Array.from({ length: 80 }, (_, i) => `<p>Row ${i + 1}</p>`).join('');

const INFO_SCRIPT = `<script>
  var resizes = 0;
  function show() {
    var vv = window.visualViewport;
    document.getElementById('info').textContent =
      location.pathname + '  innerHeight ' + innerHeight + '  vv ' + (vv ? Math.round(vv.height) : '-') +
      '  clientHeight ' + document.documentElement.clientHeight + '  resizes ' + resizes +
      '  scrollY ' + Math.round(scrollY);
  }
  addEventListener('resize', function () { resizes++; show(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', show);
  addEventListener('scroll', show, { passive: true });
  show();
</script>`;

function page(kind) {
  const nav = '<nav><span>Home</span><span>Search</span><span>Reels</span><span>Profile</span></nav>';
  let body;
  if (kind === 'fixed') {
    body = `<div class="rows">${rows}</div><div style="height:56px"></div>
<div style="position:fixed;left:0;right:0;bottom:0">${nav}</div>`;
  } else if (kind === 'inner') {
    body = `<div class="shell" id="shell"><main class="rows">${rows}</main>${nav}</div>
<script>document.getElementById('shell').style.height = innerHeight + 'px';</script>`;
  } else {
    body = `<div class="shell" style="height:100${kind}"><main class="rows">${rows}</main>${nav}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Bars ${kind}</title><style>${STYLE}</style></head>
<body>${body}<div id="info"></div><div id="edge"></div>${INFO_SCRIPT}</body></html>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] ?? 8815);
  createServer((req, res) => {
    const kind = (req.url ?? '/').split('?')[0].slice(1) || 'fixed';
    if (!['fixed', 'vh', 'dvh', 'inner'].includes(kind)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(page(kind));
  }).listen(port, '127.0.0.1', () => console.log(`Bar test pages on http://127.0.0.1:${port}/`));
}
