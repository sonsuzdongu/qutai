// Turns the client build into finished static pages: /en/index.html and /tr/index.html with real content and
// their own head tags, a 404 page, robots.txt, sitemap.xml and the _headers file for Cloudflare.
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const client = `${root}client/`;
const { render, messages, SITE_URL, CHECKED, formatDate } = await import(`${root}server/entry-server.js`);
const privacy = JSON.parse(await readFile(fileURLToPath(new URL('../src/data/privacy.json', import.meta.url)), 'utf8'));

if (SITE_URL.endsWith('.example')) {
  console.warn(`\n⚠  SITE_URL is still the placeholder ${SITE_URL}: set it in src/lib/site.ts before deploying.\n`);
}

const template = await readFile(`${client}index.html`, 'utf8');
const css = template.match(/<link rel="stylesheet"[^>]*>/)?.[0] ?? '';
const manifest = JSON.parse(await readFile(`${client}.vite/manifest.json`, 'utf8'));
const LANGS = ['en', 'tr'];
const LOCALE = { en: 'en_US', tr: 'tr_TR' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pageUrl = (lang) => `${SITE_URL}/${lang}/`;

function head(lang) {
  const t = messages[lang];
  const other = lang === 'en' ? 'tr' : 'en';
  const og = `${SITE_URL}/og-${lang}.png`;
  const langChunk = manifest[`src/i18n/${lang}.ts`]?.file;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Qutai',
    description: t['meta.appDescription'],
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'iOS, Android',
    url: pageUrl(lang),
    inLanguage: lang,
    isAccessibleForFree: true,
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    sameAs: ['https://github.com/sonsuzdongu/qutai'],
    image: `${SITE_URL}/icon-512.png`,
  };
  return [
    `<title>${esc(t['meta.title'])}</title>`,
    `<meta name="description" content="${esc(t['meta.description'])}" />`,
    `<meta name="color-scheme" content="light" />`,
    `<meta name="theme-color" content="#f2e7cf" />`,
    `<link rel="canonical" href="${pageUrl(lang)}" />`,
    `<link rel="alternate" hreflang="en" href="${pageUrl('en')}" />`,
    `<link rel="alternate" hreflang="tr" href="${pageUrl('tr')}" />`,
    `<link rel="alternate" hreflang="x-default" href="${pageUrl('en')}" />`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />`,
    `<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
    langChunk ? `<link rel="modulepreload" href="/${langChunk}" />` : '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Qutai" />`,
    `<meta property="og:title" content="${esc(t['meta.title'])}" />`,
    `<meta property="og:description" content="${esc(t['meta.description'])}" />`,
    `<meta property="og:url" content="${pageUrl(lang)}" />`,
    `<meta property="og:locale" content="${LOCALE[lang]}" />`,
    `<meta property="og:locale:alternate" content="${LOCALE[other]}" />`,
    `<meta property="og:image" content="${og}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(t['meta.ogAlt'])}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(t['meta.title'])}" />`,
    `<meta name="twitter:description" content="${esc(t['meta.description'])}" />`,
    `<meta name="twitter:image" content="${og}" />`,
    `<meta name="twitter:image:alt" content="${esc(t['meta.ogAlt'])}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ');
}

/** The hero painting (the page's largest element) is preloaded from the head, so it starts before the CSS. */
function heroPreload(body) {
  const img = body.match(/<img [^>]*fetchPriority="high"[^>]*>/i)?.[0];
  const srcset = img?.match(/srcSet="([^"]+)"/i)?.[1];
  const sizes = img?.match(/sizes="([^"]+)"/i)?.[1];
  return srcset
    ? `<link rel="preload" as="image" imagesrcset="${srcset}" imagesizes="${sizes ?? '100vw'}" fetchpriority="high" />\n    `
    : '';
}

for (const lang of LANGS) {
  const body = render(lang);
  const html = template
    .replace('<html lang="en">', `<html lang="${lang}" dir="ltr">`)
    .replace('<!--head-->', heroPreload(body) + head(lang))
    .replace('<!--app-->', body);
  await mkdir(`${client}${lang}`, { recursive: true });
  await writeFile(`${client}${lang}/index.html`, html);
}

// The app's privacy policy: /en/privacy-policy/ and /tr/privacy-policy/, static, no script. The text is the app's own
// (src/data/privacy.json, copied by `npm run legal`); "• " lines become a list.
const policyUrl = (lang) => `${SITE_URL}/${lang}/privacy-policy/`;
function policyBody(text) {
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('• ')) list.push(line.slice(2));
    else {
      flush();
      if (line.trim()) out.push(`<p>${esc(line)}</p>`);
    }
  }
  flush();
  return out.join('\n          ');
}
for (const lang of LANGS) {
  const t = messages[lang];
  const doc = privacy[lang];
  const other = lang === 'en' ? 'tr' : 'en';
  const page = `<!doctype html>
<html lang="${lang}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(t['policy.metaTitle'])}</title>
    <meta name="description" content="${esc(t['policy.metaDescription'])}" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#f2e7cf" />
    <link rel="canonical" href="${policyUrl(lang)}" />
    <link rel="alternate" hreflang="en" href="${policyUrl('en')}" />
    <link rel="alternate" hreflang="tr" href="${policyUrl('tr')}" />
    <link rel="alternate" hreflang="x-default" href="${policyUrl('en')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    ${css}
  </head>
  <body>
    <header class="policy-top">
      <a class="brand" href="/${lang}/" aria-label="${esc(t['nav.home'])}"><img src="/img/q-64.webp" width="32" height="32" alt="" /><span>Qutai</span></a>
      <a class="policy-lang" href="/${other}/privacy-policy/" hreflang="${other}" lang="${other}">${esc(t['lang.other'])}</a>
    </header>
    <main id="main" class="section policy">
      <article>
        <h1>${esc(doc.title)}</h1>
        <p class="policy-meta">${esc(t['policy.updated'])}: <time datetime="${privacy.updated}">${esc(formatDate(privacy.updated, lang))}</time></p>
        <p class="policy-note">${esc(t['policy.note'])}</p>
        <p class="policy-intro">${esc(doc.intro)}</p>
${doc.sections
  .map((sec) => `        <section>\n          <h2>${esc(sec.heading)}</h2>\n          ${policyBody(sec.body)}\n        </section>`)
  .join('\n')}
      </article>
      <p class="policy-home"><a href="/${lang}/">${esc(t['policy.home'])}</a></p>
    </main>
  </body>
</html>
`;
  await mkdir(`${client}${lang}/privacy-policy`, { recursive: true });
  await writeFile(`${client}${lang}/privacy-policy/index.html`, page);
}

// The bare root is answered by the Worker (language redirect); no static file may shadow it.
await rm(`${client}index.html`);

// 404: static, both languages, no script.
await writeFile(
  `${client}404.html`,
  `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${esc(messages.en['notFound.title'])} · Qutai</title>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    ${css}
  </head>
  <body>
    <main class="section notfound">
      <h1>${esc(messages.en['notFound.title'])}</h1>
      <p>${esc(messages.en['notFound.body'])} <a href="/en/">${esc(messages.en['notFound.home'])}</a></p>
      <p lang="tr">${esc(messages.tr['notFound.body'])} <a href="/tr/" hreflang="tr">${esc(messages.tr['notFound.home'])}</a></p>
    </main>
  </body>
</html>
`,
);

await writeFile(`${client}robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

const alternates = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l)}" />`)
  .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl('en')}" />`)
  .join('\n');
const policyAlternates = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${policyUrl(l)}" />`)
  .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${policyUrl('en')}" />`)
  .join('\n');
await writeFile(
  `${client}sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map((l) => `  <url>\n    <loc>${pageUrl(l)}</loc>\n    <lastmod>${CHECKED}</lastmod>\n${alternates}\n  </url>`).join('\n')}
${LANGS.map((l) => `  <url>\n    <loc>${policyUrl(l)}</loc>\n    <lastmod>${privacy.updated}</lastmod>\n${policyAlternates}\n  </url>`).join('\n')}
</urlset>
`,
);

// Static responses only (the Worker sets its own headers on the redirect). The CSP allows nothing but this
// origin, which is how "no third-party requests" is enforced rather than just promised.
await writeFile(
  `${client}_headers`,
  `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
  X-Frame-Options: DENY

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
);

await rm(`${client}.vite`, { recursive: true });
console.log(`Prerendered ${LANGS.map((l) => `/${l}/, /${l}/privacy-policy/`).join(', ')}, 404.html, robots.txt, sitemap.xml, _headers`);
