/**
 * Serves the trap pages for trying them on a phone (docs/test-checklist.md, section 21): each case's first page at
 * /<case id>, its PDFs at /<case id>/pdf/<n>, an index at /. The addresses the traps point to are fictional and never
 * answer; that is the point.
 *
 *   node --no-warnings --experimental-transform-types --import ./scripts/injection-tests/loader.mjs scripts/injection-tests/serve.ts 8815
 */
import { createServer } from 'node:http';
import { CASES } from './cases';

const port = Number(process.argv[2] ?? 8815);

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const id = path.split('/')[1] ?? '';
  const c = CASES.find((x) => x.id === id);
  if (!c) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta name="viewport" content="width=device-width"><title>Trap pages</title><h1>Trap pages</h1><ul>${CASES.map(
        (x) => `<li><a href="/${x.id}">${x.id}</a>: ${x.vector}. Ask: <i>${x.user}</i></li>`,
      ).join('')}</ul>`,
    );
    return;
  }
  const page = c.pages[c.start] ?? c.search ?? '';
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(typeof page === 'string' ? page : page.body);
}).listen(port, '0.0.0.0', () => console.log(`Trap pages on http://localhost:${port}/`));
