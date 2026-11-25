// A PDF's base64 goes into the reader page's injected scripts as it is (src/pdf/reader.ts pieceScripts): the whole
// string is checked first, not only its start, so nothing after the first characters can end the script's string.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PdfReadError, pieceScripts } from '../../src/pdf/reader.ts';

const B64 = Buffer.from('%PDF-1.7 ' + 'x'.repeat(3000)).toString('base64');

test('base64 is split into pieces that join back to the whole', () => {
  const scripts = pieceScripts('"d1"', B64);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0], `window.__qutaiPdf.piece("d1","${B64}");true;`);
  const big = 'A'.repeat(2_500_000);
  const parts = pieceScripts('"d2"', big).map((s) => /"d2","([^"]*)"/.exec(s)![1]);
  assert.equal(parts.length, 3);
  assert.equal(parts.join(''), big);
});

test('anything that is not base64, anywhere in the string, is refused before a script is built', () => {
  for (const bad of [`${B64}");alert(1);//`, `${B64.slice(0, 100)}\\${B64.slice(100)}`, `${B64}\n`, `${'A'.repeat(2_000_000)}"`]) {
    assert.throws(() => pieceScripts('"d3"', bad), (e: unknown) => e instanceof PdfReadError && e.reason === 'invalid');
  }
  assert.deepEqual(pieceScripts('"d4"', ''), []);
});
