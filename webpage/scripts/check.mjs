// Checks the built site (run `npm run build` first) and the Worker's language choice. Exits 1 on any failure.
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pickLanguage } from '../worker/language.ts';
import { policyFromApp } from './make-legal.mjs';

const dist = fileURLToPath(new URL('../dist/client/', import.meta.url));
const privacy = JSON.parse(await readFile(new URL('../src/data/privacy.json', import.meta.url), 'utf8'));
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

// The app's privacy policy: a static page per language, and the same text the app has.
for (const lang of ['en', 'tr']) {
  const html = await readFile(`${dist}${lang}/privacy-policy/index.html`, 'utf8').catch(() => '');
  expect(html.includes(`<html lang="${lang}"`), `${lang}/privacy-policy: page with lang attribute`);
  expect(html.includes(`<h1>${privacy[lang].title}</h1>`), `${lang}/privacy-policy: title`);
  expect(html.includes(`rel="canonical" href="`) && html.includes('hreflang="x-default"'), `${lang}/privacy-policy: canonical and hreflang`);
  expect(!/<script\b/.test(html), `${lang}/privacy-policy: no script`);
  expect((html.match(/<h2>/g) ?? []).length === privacy[lang].sections.length, `${lang}/privacy-policy: every section`);
  const home = await readFile(`${dist}${lang}/index.html`, 'utf8');
  expect(home.includes(`href="/${lang}/privacy-policy/"`), `${lang}: footer links to the privacy policy page`);
}
expect(JSON.stringify(privacy) === JSON.stringify(await policyFromApp()), 'src/data/privacy.json differs from the app (src/legal/proDocuments.ts): run npm run legal');
expect((await readFile(`${dist}sitemap.xml`, 'utf8')).includes('/privacy-policy/'), 'sitemap lists the privacy policy');

// Deleting an account (Google Play's web deletion link): a static page per language, linked from the footer and the sitemap.
for (const lang of ['en', 'tr']) {
  const html = await readFile(`${dist}${lang}/delete-account/index.html`, 'utf8').catch(() => '');
  expect(html.includes(`<html lang="${lang}"`), `${lang}/delete-account: page with lang attribute`);
  expect(html.includes('<h1>') && html.includes('mailto:'), `${lang}/delete-account: title and the email way`);
  expect(!html.includes('{email}'), `${lang}/delete-account: the address is filled in`);
  expect((html.match(/<h2>/g) ?? []).length === 5, `${lang}/delete-account: every section`);
  expect(!/<script\b/.test(html), `${lang}/delete-account: no script`);
  const home = await readFile(`${dist}${lang}/index.html`, 'utf8');
  expect(home.includes(`href="/${lang}/delete-account/"`), `${lang}: footer links to the account deletion page`);
}
expect((await readFile(`${dist}sitemap.xml`, 'utf8')).includes('/delete-account/'), 'sitemap lists the account deletion page');

// Support (the App Store's Support URL): a static page per language, linked from the footer and the sitemap.
for (const lang of ['en', 'tr']) {
  const html = await readFile(`${dist}${lang}/support/index.html`, 'utf8').catch(() => '');
  expect(html.includes(`<html lang="${lang}"`), `${lang}/support: page with lang attribute`);
  expect(html.includes('<h1>') && html.includes('mailto:'), `${lang}/support: title and the email address`);
  expect(!/\{(email|deleteLink|privacyLink)\}/.test(html), `${lang}/support: the address and links are filled in`);
  expect((html.match(/<h2>/g) ?? []).length === 3 && (html.match(/<h3>/g) ?? []).length === 8, `${lang}/support: every section and question`);
  expect(html.includes(`href="/${lang}/delete-account/"`) && html.includes(`href="/${lang}/privacy-policy/"`), `${lang}/support: links to deletion and privacy`);
  expect(!/<script\b/.test(html), `${lang}/support: no script`);
  const home = await readFile(`${dist}${lang}/index.html`, 'utf8');
  expect(home.includes(`href="/${lang}/support/"`), `${lang}: footer links to the support page`);
}
expect((await readFile(`${dist}sitemap.xml`, 'utf8')).includes('/support/'), 'sitemap lists the support page');

// Every feature: a static page per language with every group, no script, nothing from another origin.
for (const lang of ['en', 'tr']) {
  const html = await readFile(`${dist}${lang}/features/index.html`, 'utf8').catch(() => '');
  expect(html.includes(`<html lang="${lang}"`), `${lang}/features: page with lang attribute`);
  expect(html.includes(`<link rel="canonical" href="`) && html.includes('hreflang="x-default"'), `${lang}/features: canonical and hreflang`);
  expect(!/<script\b/.test(html), `${lang}/features: no script`);
  expect(!/\sstyle="/.test(html), `${lang}/features: no inline style (the CSP forbids it)`);
  expect((html.match(/class="fgroup"/g) ?? []).length === 10, `${lang}/features: ten groups`);
  const loaded = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('#'));
  for (const url of loaded.filter((u) => /^(https?:)?\/\//.test(u) && !/rel="(?:canonical|alternate)"/.test(u))) {
    expect(!html.includes(`<link rel="stylesheet" href="${url}"`) && !html.includes(`src="${url}"`), `${lang}/features: loads ${url}`);
  }
  const home = await readFile(`${dist}${lang}/index.html`, 'utf8');
  expect(home.includes(`href="/${lang}/features/"`), `${lang}: home links to the features page`);
}
expect((await readFile(`${dist}sitemap.xml`, 'utf8')).includes('/features/'), 'sitemap lists the features page');

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
console.log(`✓ ${cases.length} language cases, both pages with their features, privacy policy, account deletion and support pages, no third-party loads`);
