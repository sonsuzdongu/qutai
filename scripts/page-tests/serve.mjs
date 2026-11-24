#!/usr/bin/env node
// Local test pages for the assistant's typing and clicking (src/browser/pageScript.ts) against the input patterns
// that real sites use for comments, posts and checkouts: a YouTube-like contenteditable comment box whose Post button
// only enables after real input, inputs inside shadow DOM, a React-controlled textarea, a rich editor that inserts
// text itself from `beforeinput`, buttons that act on pointer or touch events instead of click, a keyup-enabled form,
// and a checkout with a total. Nothing leaves the machine except React, loaded from cdnjs for the React fixture.
//
// Usage: node --experimental-transform-types --import ./scripts/test-support/loader.mjs scripts/page-tests/serve.mjs [port]   (default 8811; 127.0.0.1 only)
//   The flag lets POST /decide judge the page's press facts with the app's own rule (src/agent/outwardApproval.ts).
//   http://localhost:8811/            the page with the working copy's page script; runs every case and shows a table
//   http://localhost:8811/?script=head the same with the page script of the last commit (to compare before a fix)
//   http://localhost:8811/guards      secret fields, payment buttons and destructive or account presses (guards.html)
//   http://localhost:8811/popup       pop-up windows that post back to window.opener and close themselves (popup.html)
//   http://localhost:8811/app-breakout the apps break-out test as an app document (frame routes: window.__results)
// The results are also in window.__pageTestResults (an array of { name, ok, detail }).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const port = Number(process.argv[2] ?? 8811);

function pageScript(fromHead) {
  const source = fromHead
    ? execFileSync('git', ['show', 'HEAD:src/browser/pageScript.ts'], { cwd: root, encoding: 'utf8' })
    : readFileSync(join(root, 'src', 'browser', 'pageScript.ts'), 'utf8');
  const start = source.indexOf('export const PAGE_SCRIPT = String.raw`');
  const body = source.slice(start + 'export const PAGE_SCRIPT = String.raw`'.length);
  const script = body.slice(0, body.indexOf('\n`;'));
  // A backtick would end the template literal in the app: the page shows the failure instead of passing here.
  if (script.includes('`')) return "throw new Error('The page script contains a backtick: it ends PAGE_SCRIPT early.');";
  // The app installs it under a secret name (src/browser/agentScript.ts); the test pages find it as window.__qutaiAgent.
  return `(function () {\nvar __qutaiAgent = {};\n${script}\nwindow.__qutaiAgent = __qutaiAgent;\n})();`;
}

const rule = await import('../../src/agent/outwardApproval.ts').catch(() => null);
const pressRule = await import('../../src/agent/pressContext.ts').catch(() => null);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname === '/decide' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (!rule) {
        res.writeHead(501).end('Run the server with --experimental-transform-types');
        return;
      }
      const { press, enter, text } = JSON.parse(body);
      const answer = press
        ? { field: rule.contentToApprove(press)?.ref ?? null }
        : { field: enter && rule.isPublicText(enter, text) ? enter.ref : null };
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer));
    });
    return;
  }
  if (url.pathname === '/agent.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(pageScript(url.searchParams.get('script') === 'head'));
    return;
  }
  if (url.pathname === '/app-breakout') {
    // The apps break-out test (scripts/app-tests/breakoutApp.mjs) as Qutai builds its document, in a desktop browser:
    // Chromium has no frame guard injected into frames (like Android), so it shows whether the main frame's guard
    // alone keeps every frame route closed. qutai.* bridge calls get no answer here; their cases wait or fail.
    Promise.all([import('../../src/apps/document.ts'), import('../app-tests/breakoutApp.mjs')]).then(([doc, app]) => {
      const pkg = { manifest: { entry: 'index.html', language: 'en' }, files: app.breakoutFiles() };
      const boot = {
        id: 'app-breakout0001', name: 'Break-out', version: 1, language: 'en', uiLanguage: 'en', platform: 'android', permissions: [],
        theme: { dark: false, colors: { bg: '#fff', surface: '#fff', sunken: '#eee', text: '#000', textSecondary: '#555', tint: '#1565c0', onTint: '#fff', danger: '#c62828', separator: '#ddd', border: '#ccc' }, fontScale: 1 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      };
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(doc.buildAppDocument(pkg, boot).html);
    }, (e) => res.writeHead(500).end(String(e)));
    return;
  }
  if (url.pathname === '/classify' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (!pressRule) {
        res.writeHead(501).end('Run the server with --experimental-transform-types');
        return;
      }
      const facts = JSON.parse(body);
      const pay = pressRule.payPress(facts);
      const change = pressRule.changePress(facts);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ pay: pay.pay, change: change.change }));
    });
    return;
  }
  if (url.pathname === '/popup') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(readFileSync(join(here, 'popup.html'), 'utf8'));
    return;
  }
  if (/^\/guards?(\/|$)/.test(url.pathname)) {
    const html = readFileSync(join(here, 'guards.html'), 'utf8').replace(
      '__AGENT_SRC__',
      `/agent.js?script=${url.searchParams.get('script') === 'head' ? 'head' : 'work'}`,
    );
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = readFileSync(join(here, 'hard-inputs.html'), 'utf8').replace(
      '__AGENT_SRC__',
      `/agent.js?script=${url.searchParams.get('script') === 'head' ? 'head' : 'work'}`,
    );
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }
  res.writeHead(404).end();
}).listen(port, '127.0.0.1', () => console.log(`Page tests on http://localhost:${port}/`));
