#!/usr/bin/env node
// Local test pages for the assistant's typing and clicking (src/browser/pageScript.ts) against the input patterns
// that real sites use for comments, posts and checkouts: a YouTube-like contenteditable comment box whose Post button
// only enables after real input, inputs inside shadow DOM, a React-controlled textarea, a rich editor that inserts
// text itself from `beforeinput`, buttons that act on pointer or touch events instead of click, a keyup-enabled form,
// and a checkout with a total. Nothing leaves the machine except React, loaded from cdnjs for the React fixture.
//
// Usage: node scripts/page-tests/serve.mjs [port]   (default 8811; 127.0.0.1 only)
//   http://localhost:8811/            the page with the working copy's page script; runs every case and shows a table
//   http://localhost:8811/?script=head the same with the page script of the last commit (to compare before a fix)
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
  return body.slice(0, body.indexOf('\n`;'));
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname === '/agent.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(pageScript(url.searchParams.get('script') === 'head'));
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
