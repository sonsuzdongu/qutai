#!/usr/bin/env node
// Local test pages for the assistant's typing and clicking (src/browser/pageScript.ts) against the input patterns
// that real sites use for comments, posts and checkouts: a YouTube-like contenteditable comment box whose Post button
// only enables after real input, inputs inside shadow DOM, a React-controlled textarea, a rich editor that inserts
// text itself from `beforeinput`, buttons that act on pointer or touch events instead of click, a keyup-enabled form,
// and a checkout with a total. Nothing leaves the machine except React, loaded from cdnjs for the React fixture.
//
// Usage: node --experimental-transform-types --import ./scripts/credits-tests/loader.mjs scripts/page-tests/serve.mjs [port]   (default 8811; 127.0.0.1 only)
//   The flag lets POST /decide judge the page's press facts with the app's own rule (src/agent/outwardApproval.ts).
//   http://localhost:8811/            the page with the working copy's page script; runs every case and shows a table
//   http://localhost:8811/?script=head the same with the page script of the last commit (to compare before a fix)
//   http://localhost:8811/guards      secret fields, payment buttons and destructive or account presses (guards.html)
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
  return script.includes('`') ? "throw new Error('The page script contains a backtick: it ends PAGE_SCRIPT early.');" : script;
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
  if (url.pathname === '/guards' || url.pathname.startsWith('/guards/')) {
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
