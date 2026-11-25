// Site icons for the new tab page (src/browser/siteIcons.ts, UI-72): which of a page's icon links is fetched, which
// addresses and bytes are accepted, when a stored icon is fetched again, and the file names it is kept under.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ICON_FRESH_MS,
  ICON_MAX_BYTES,
  ICON_RETRY_MS,
  iconCandidates,
  iconFileName,
  iconFormat,
  needsIconFetch,
  parseIconFileName,
  parseIconLinks,
  siteIconKey,
  type IconLink,
} from '../../src/browser/siteIcons.ts';

const link = (href: string, rel = 'icon', sizes = '', type = ''): IconLink => ({ href, rel, sizes, type });

test('the link nearest 128 px comes first, then /favicon.ico on the same origin', () => {
  const links = [
    link('/favicon-16.png', 'icon', '16x16'),
    link('/favicon-32.png', 'icon', '32x32'),
    link('/apple.png', 'apple-touch-icon'),
    link('/big.png', 'icon', '512x512'),
  ];
  assert.deepEqual(iconCandidates('https://www.example.com/a/b?c=1', links), [
    'https://www.example.com/apple.png',
    'https://www.example.com/big.png',
    'https://www.example.com/favicon-32.png',
    'https://www.example.com/favicon.ico',
  ]);
});

test('an apple-touch-icon without sizes counts as 180, an icon without sizes as 32', () => {
  const out = iconCandidates('https://example.com/', [link('/plain.ico', 'shortcut icon'), link('/touch.png', 'apple-touch-icon-precomposed')]);
  assert.deepEqual(out, ['https://example.com/touch.png', 'https://example.com/plain.ico', 'https://example.com/favicon.ico']);
});

test('the largest of several sizes is used', () => {
  const out = iconCandidates('https://example.com/', [link('/a.ico', 'icon', '16x16 32x32 128x128'), link('/b.png', 'icon', '48x48')]);
  assert.equal(out[0], 'https://example.com/a.ico');
});

test('SVG, http, other schemes and non-icon links are skipped; duplicates once; at most three plus the fallback', () => {
  const out = iconCandidates('https://example.com/', [
    link('/logo.svg', 'icon', 'any'),
    link('/mask.png', 'icon', '', 'image/svg+xml'),
    link('http://example.com/plain.png', 'icon', '64x64'),
    link('data:image/png;base64,AAAA', 'icon', '64x64'),
    link('javascript:alert(1)', 'icon', '64x64'),
    link('/style.css', 'stylesheet'),
    link('/favicon.ico', 'icon'),
    link('https://cdn.example.net/1.png', 'icon', '96x96'),
    link('https://cdn.example.net/1.png', 'icon', '96x96'),
    link('/2.png', 'icon', '64x64'),
    link('/3.png', 'icon', '48x48'),
    link('/4.png', 'icon', '24x24'),
  ]);
  assert.deepEqual(out, [
    'https://cdn.example.net/1.png',
    'https://example.com/2.png',
    'https://example.com/3.png',
    'https://example.com/favicon.ico',
  ]);
});

test('http pages and other schemes get no icon', () => {
  assert.deepEqual(iconCandidates('http://example.com/', [link('https://example.com/a.png')]), []);
  assert.equal(siteIconKey('http://example.com/'), null);
  assert.equal(siteIconKey('about:blank'), null);
  assert.equal(siteIconKey('https://www.Example.com/x'), 'example.com');
});

test("the page's answer is checked as untrusted data", () => {
  assert.deepEqual(parseIconLinks(null), []);
  assert.deepEqual(parseIconLinks({ href: '/a.png' }), []);
  const parsed = parseIconLinks([null, 1, { href: 5, rel: 'icon' }, { href: '/a.png', rel: 'ICON', sizes: 7 }, ...Array(30).fill({ href: '/b', rel: 'icon' })]);
  // Only the first 20 entries are looked at.
  assert.equal(parsed.length, 17);
  assert.deepEqual(parsed[0], { href: '/a.png', rel: 'icon', sizes: '', type: '' });
});

function png(width: number, height: number, length = 64): Uint8Array {
  const b = new Uint8Array(length);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function ico(sides: number[]): Uint8Array {
  const b = new Uint8Array(6 + 16 * sides.length + 8);
  b.set([0, 0, 1, 0, sides.length, 0]);
  sides.forEach((side, i) => {
    b[6 + 16 * i] = side % 256;
    b[7 + 16 * i] = side % 256;
  });
  return b;
}

test('icons are recognised by their bytes, within the size limits', () => {
  assert.equal(iconFormat(png(180, 180)), 'png');
  assert.equal(iconFormat(png(1024, 1024)), 'png');
  assert.equal(iconFormat(png(2048, 2048)), null);
  assert.equal(iconFormat(png(64, 64, ICON_MAX_BYTES + 1)), null);
  assert.equal(iconFormat(ico([16, 32, 256])), 'ico');
  assert.equal(iconFormat(ico([])), null);
  assert.equal(iconFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(iconFormat(new TextEncoder().encode('<!doctype html><html><body>Not found</body></html>')), null);
});

test('an icon is fetched again after 7 days, a site without one after a day', () => {
  const now = 1_800_000_000_000;
  assert.equal(needsIconFetch(undefined, now), true);
  assert.equal(needsIconFetch({ at: now - ICON_FRESH_MS + 1, file: 'a~1.png' }, now), false);
  assert.equal(needsIconFetch({ at: now - ICON_FRESH_MS, file: 'a~1.png' }, now), true);
  assert.equal(needsIconFetch({ at: now - ICON_RETRY_MS + 1, file: null }, now), false);
  assert.equal(needsIconFetch({ at: now - ICON_RETRY_MS, file: null }, now), true);
  // A clock set back never keeps an icon forever.
  assert.equal(needsIconFetch({ at: now + 60_000, file: 'a~1.png' }, now), true);
});

test('file names round-trip and nothing else is taken for an icon', () => {
  assert.equal(iconFileName('example.com', 123, 'png'), 'example.com~123.png');
  assert.equal(iconFileName('Localhost:8080', 5, 'none'), 'localhost_8080~5.none');
  assert.deepEqual(parseIconFileName('example.com~123.png'), { key: 'example.com', at: 123, ext: 'png' });
  assert.deepEqual(parseIconFileName('xn--bcher-kva.example~9.ico'), { key: 'xn--bcher-kva.example', at: 9, ext: 'ico' });
  assert.equal(parseIconFileName('example.com~123.svg'), null);
  assert.equal(parseIconFileName('../x~1.png'), null);
  assert.equal(parseIconFileName('notes.txt'), null);
});
