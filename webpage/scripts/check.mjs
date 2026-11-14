// Checks the built site (run `npm run build` first) and the Worker's language choice. Exits 1 on any failure.
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pickLanguage } from '../worker/language.ts';

const dist = fileURLToPath(new URL('../dist/client/', import.meta.url));
const failures = [];
const expect = (ok, what) => {
  if (!ok) failures.push(what);
};

// Language at the edge.
const cases = [
  [null, 'tr', 'tr'],
  [null, 'tr-TR,en;q=0.8', 'tr'],
  [null, 'en-US', 'en'],
  [null, 'de', 'en'],
  [null, null, 'en'],
  [null, '', 'en'],
  [null, 'de,tr;q=0.5', 'tr'],
  [null, 'en,tr;q=0.9', 'en'],
  [null, 'tr;q=0,en', 'en'],
  [null, 'fr;q=0.9,tr-CY;q=0.95', 'tr'],
  ['lang=en', 'tr', 'en'],
  ['a=1; lang=tr', 'en-GB', 'tr'],
  ['lang=de', 'tr', 'tr'],
];
for (const [cookie, header, want] of cases) {
  const got = pickLanguage(cookie, header);
  expect(got === want, `pickLanguage(${JSON.stringify(cookie)}, ${JSON.stringify(header)}) = ${got}, want ${want}`);
}

// The prerendered pages.
for (const lang of ['en', 'tr']) {
  const html = await readFile(`${dist}${lang}/index.html`, 'utf8');
  const has = (s, what) => expect(html.includes(s), `${lang}: ${what}`);
  has(`<html lang="${lang}"`, 'lang attribute');
  has('<title>', 'title');
  has('<meta name="description"', 'meta description');
  has(`rel="canonical" href="`, 'canonical');
  for (const h of ['en', 'tr', 'x-default']) has(`hreflang="${h}"`, `hreflang ${h}`);
  has('property="og:image"', 'og:image');
  has('name="twitter:card"', 'twitter card');
  has('<h1 id="hero-title">', 'h1 rendered into the HTML');
  has('<table class="cmp">', 'comparison table rendered into the HTML');
  expect((html.match(/<th scope="row"/g) ?? []).length >= 12, `${lang}: comparison rows`);
  const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  try {
    const data = JSON.parse(ld?.[1] ?? '');
    expect(data['@type'] === 'SoftwareApplication' && !('aggregateRating' in data) && !('offers' in data), `${lang}: JSON-LD fields`);
  } catch {
    failures.push(`${lang}: JSON-LD does not parse`);
  }
  // Nothing the page loads may come from another origin (links the visitor clicks are fine).
  const loaded = [
    ...html.matchAll(/<(?:script|img|source|iframe)\b[^>]*\s(?:src|srcset)="([^"]+)"/g),
    ...html.matchAll(/<link\b(?=[^>]*rel="(?:stylesheet|modulepreload|preload|icon|apple-touch-icon|manifest)")[^>]*href="([^"]+)"/g),
  ].map((m) => m[1]);
  for (const url of loaded) expect(url.startsWith('/') && !url.startsWith('//'), `${lang}: loads ${url} from another origin`);
  expect(!/@import|url\(\s*["']?https?:/i.test(html), `${lang}: inline reference to another origin`);
}

const css = await readFile(new URL(`../dist/client/${(await readFile(`${dist}en/index.html`, 'utf8')).match(/href="\/(assets\/[^"]+\.css)"/)[1]}`, import.meta.url), 'utf8');
expect(!/url\(\s*["']?(https?:)?\/\//i.test(css), 'CSS loads something from another origin');

for (const f of ['robots.txt', 'sitemap.xml', '404.html', '_headers', 'og-en.png', 'og-tr.png', 'apple-touch-icon.png']) {
  await access(`${dist}${f}`).catch(() => failures.push(`missing ${f}`));
}
await access(`${dist}index.html`).then(
  () => failures.push('dist/client/index.html exists: it would shadow the language redirect'),
  () => {},
);

if (failures.length) {
  console.error(`✗ ${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${cases.length} language cases, both pages, no third-party loads`);
