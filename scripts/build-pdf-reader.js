#!/usr/bin/env node
/**
 * Writes src/pdf/pdfjs.generated.json from the installed pdfjs-dist (Mozilla PDF.js, Apache-2.0): the legacy build's
 * main and worker modules as text, and the two image decoders scanned PDFs need (JBIG2, JPEG 2000) as base64. The
 * app puts them into the hidden page that reads PDFs (src/pdf/readerHtml.ts), so nothing is loaded from the network.
 *
 * Run by `postinstall`, so the file always matches the installed version; it is not committed (.gitignore).
 * The legacy build is used because the modern one is only tested on current Chrome and Firefox; the legacy one
 * also supports Safari 18+ (WKWebView on iOS 18+) and Chrome 125+.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'node_modules', 'pdfjs-dist');
const out = path.join(root, 'src', 'pdf', 'pdfjs.generated.json');

if (!fs.existsSync(dist)) {
  console.warn('build-pdf-reader: pdfjs-dist is not installed; PDF reading will be unavailable.');
  process.exit(0);
}

const read = (file) => fs.readFileSync(path.join(dist, file));
const { version } = JSON.parse(read('package.json'));
// A few hundred non-ASCII characters (in strings, regular expressions and comments) would make Hermes keep each
// module as UTF-16, twice the size; as \uXXXX escapes they mean the same in every one of those places.
const ascii = (text) => text.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const main = ascii(read('legacy/build/pdf.min.mjs').toString('utf8'));
const worker = ascii(read('legacy/build/pdf.worker.min.mjs').toString('utf8'));
const wasm = {
  'jbig2.wasm': read('wasm/jbig2.wasm').toString('base64'),
  'openjpeg.wasm': read('wasm/openjpeg.wasm').toString('base64'),
};

// The sources go into a <script> element; this sequence would end it early.
for (const [name, text] of [['main', main], ['worker', worker]]) {
  if (/<\/script/i.test(text)) throw new Error(`build-pdf-reader: the ${name} module contains "</script"`);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ version, main, worker, wasm }));
const size = (fs.statSync(out).size / 1e6).toFixed(2);
console.log(`build-pdf-reader: PDF.js ${version} written to src/pdf/pdfjs.generated.json (${size} MB)`);
