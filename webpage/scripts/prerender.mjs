// Turns the client build into finished static pages: /en/index.html and /tr/index.html with real content and
// their own head tags, a 404 page, robots.txt, sitemap.xml and the _headers file for Cloudflare.
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const client = `${root}client/`;
const { render, renderFeatures, renderPricing, messages, SITE_URL, CHECKED, CONTACT_EMAIL, formatDate, FEATURES_CHECKED, FEATURES_PAGE, PRICING_PAGE, PRICING_CHECKED, renderVs, renderGuide, GUIDE, VS, COMPETITORS, PACKS, guideFaq, PLAY_URL, REPO_URL, TESTFLIGHT_URL } = await import(
  `${root}server/entry-server.js`
);
const privacy = JSON.parse(await readFile(fileURLToPath(new URL('../src/data/privacy.json', import.meta.url)), 'utf8'));
const terms = JSON.parse(await readFile(fileURLToPath(new URL('../src/data/terms.json', import.meta.url)), 'utf8'));

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
    operatingSystem: 'iOS, iPadOS, macOS, Android',
    url: pageUrl(lang),
    inLanguage: lang,
    isAccessibleForFree: true,
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    sameAs: ['https://github.com/sonsuzdongu/qutai'],
    image: `${SITE_URL}/icon-512.png`,
    downloadUrl: PLAY_URL,
    installUrl: PLAY_URL,
    softwareHelp: `${SITE_URL}/${lang}/support/`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [t['hero.chip1'], t['hero.chip2'], t['hero.chip3'], t['hero.chip4'], `${t['browser.languages.title']}: ${t['browser.languages.body'].split('. ')[0]}`].join(', '),
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

// The app's privacy policy and terms of use: /en/privacy-policy/, /tr/privacy-policy/, /en/terms/ and /tr/terms/,
// static, no script. The text is the app's own (src/data/privacy.json and terms.json, copied by `npm run legal`);
// "• " lines become a list.
const policyUrl = (lang) => `${SITE_URL}/${lang}/privacy-policy/`;
const termsUrl = (lang) => `${SITE_URL}/${lang}/terms/`;
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
const LEGAL_PAGES = [
  { data: privacy, dir: 'privacy-policy', url: policyUrl, key: 'policy' },
  { data: terms, dir: 'terms', url: termsUrl, key: 'terms' },
];
for (const { data, dir, url, key } of LEGAL_PAGES) for (const lang of LANGS) {
  const t = messages[lang];
  const doc = data[lang];
  const other = lang === 'en' ? 'tr' : 'en';
  const page = `<!doctype html>
<html lang="${lang}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(t[`${key}.metaTitle`])}</title>
    <meta name="description" content="${esc(t[`${key}.metaDescription`])}" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#f2e7cf" />
    <link rel="canonical" href="${url(lang)}" />
    <link rel="alternate" hreflang="en" href="${url('en')}" />
    <link rel="alternate" hreflang="tr" href="${url('tr')}" />
    <link rel="alternate" hreflang="x-default" href="${url('en')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    ${css}
  </head>
  <body>
    <header class="policy-top">
      <a class="brand" href="/${lang}/" aria-label="${esc(t['nav.home'])}"><img src="/img/q-64.webp" width="32" height="32" alt="" /><span>Qutai</span></a>
      <a class="policy-lang" href="/${other}/${dir}/" hreflang="${other}" lang="${other}">${esc(t['lang.other'])}</a>
    </header>
    <main id="main" class="section policy">
      <article>
        <h1>${esc(doc.title)}</h1>
        <p class="policy-meta">${esc(t['policy.updated'])}: <time datetime="${data.updated}">${esc(formatDate(data.updated, lang))}</time></p>
        <p class="policy-note">${esc(t[`${key}.note`])}</p>
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
  await mkdir(`${client}${lang}/${dir}`, { recursive: true });
  await writeFile(`${client}${lang}/${dir}/index.html`, page);
}

// Deleting an account: /en/delete-account/ and /tr/delete-account/, static, no script. Google Play asks for this page in
// the Play Console (account deletion without the app); the text is in src/i18n/{en,tr}.ts (`deletion.*`).
const deletionUrl = (lang) => `${SITE_URL}/${lang}/delete-account/`;
const DELETION_SECTIONS = ['inApp', 'byEmail', 'deleted', 'kept', 'noAccount'];
for (const lang of LANGS) {
  const t = messages[lang];
  const other = lang === 'en' ? 'tr' : 'en';
  const mail = `<a href="mailto:${esc(CONTACT_EMAIL)}?subject=${encodeURIComponent(lang === 'tr' ? 'Qutai hesabımı silin' : 'Delete my Qutai account')}">${esc(CONTACT_EMAIL)}</a>`;
  const sections = DELETION_SECTIONS.map((key) => {
    const body = policyBody(t[`deletion.${key}.body`]).replaceAll(esc('{email}'), mail);
    return `        <section>\n          <h2>${esc(t[`deletion.${key}.heading`])}</h2>\n          ${body}\n        </section>`;
  }).join('\n');
  const page = `<!doctype html>
<html lang="${lang}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(t['deletion.metaTitle'])}</title>
    <meta name="description" content="${esc(t['deletion.metaDescription'])}" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#f2e7cf" />
    <link rel="canonical" href="${deletionUrl(lang)}" />
    <link rel="alternate" hreflang="en" href="${deletionUrl('en')}" />
    <link rel="alternate" hreflang="tr" href="${deletionUrl('tr')}" />
    <link rel="alternate" hreflang="x-default" href="${deletionUrl('en')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    ${css}
  </head>
  <body>
    <header class="policy-top">
      <a class="brand" href="/${lang}/" aria-label="${esc(t['nav.home'])}"><img src="/img/q-64.webp" width="32" height="32" alt="" /><span>Qutai</span></a>
      <a class="policy-lang" href="/${other}/delete-account/" hreflang="${other}" lang="${other}">${esc(t['lang.other'])}</a>
    </header>
    <main id="main" class="section policy">
      <article>
        <h1>${esc(t['deletion.title'])}</h1>
        <p class="policy-intro">${esc(t['deletion.intro'])}</p>
${sections}
        <p class="policy-meta"><a href="/${lang}/privacy-policy/">${esc(t['footer.appPrivacy'])}</a></p>
      </article>
      <p class="policy-home"><a href="/${lang}/">${esc(t['deletion.home'])}</a></p>
    </main>
  </body>
</html>
`;
  await mkdir(`${client}${lang}/delete-account`, { recursive: true });
  await writeFile(`${client}${lang}/delete-account/index.html`, page);
}

// Support: /en/support/ and /tr/support/, static, no script. The App Store asks for a Support URL; the text is in
// src/i18n/{en,tr}.ts (`support.*`), the answers checked against docs/design/.
const supportUrl = (lang) => `${SITE_URL}/${lang}/support/`;
const SUPPORT_FAQ = ['signIn', 'credits', 'missing', 'ownKey', 'report', 'delete', 'privacy', 'openSource'];
for (const lang of LANGS) {
  const t = messages[lang];
  const other = lang === 'en' ? 'tr' : 'en';
  const mail = `<a href="mailto:${esc(CONTACT_EMAIL)}?subject=${encodeURIComponent(lang === 'tr' ? 'Qutai destek' : 'Qutai support')}">${esc(CONTACT_EMAIL)}</a>`;
  const fill = (html) =>
    html
      .replaceAll(esc('{email}'), mail)
      .replaceAll(esc('{deleteLink}'), `<a href="/${lang}/delete-account/">${esc(t['support.deleteLink'])}</a>`)
      .replaceAll(esc('{privacyLink}'), `<a href="/${lang}/privacy-policy/">${esc(t['footer.appPrivacy'])}</a>`);
  const section = (key) =>
    `        <section>\n          <h2>${esc(t[`support.${key}.heading`])}</h2>\n          ${fill(policyBody(t[`support.${key}.body`]))}\n        </section>`;
  const faq = SUPPORT_FAQ.map(
    (key) => `          <h3>${esc(t[`support.${key}.q`])}</h3>\n          ${fill(policyBody(t[`support.${key}.a`]))}`,
  ).join('\n');
  const page = `<!doctype html>
<html lang="${lang}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(t['support.metaTitle'])}</title>
    <meta name="description" content="${esc(t['support.metaDescription'])}" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#f2e7cf" />
    <link rel="canonical" href="${supportUrl(lang)}" />
    <link rel="alternate" hreflang="en" href="${supportUrl('en')}" />
    <link rel="alternate" hreflang="tr" href="${supportUrl('tr')}" />
    <link rel="alternate" hreflang="x-default" href="${supportUrl('en')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    ${css}
  </head>
  <body>
    <header class="policy-top">
      <a class="brand" href="/${lang}/" aria-label="${esc(t['nav.home'])}"><img src="/img/q-64.webp" width="32" height="32" alt="" /><span>Qutai</span></a>
      <a class="policy-lang" href="/${other}/support/" hreflang="${other}" lang="${other}">${esc(t['lang.other'])}</a>
    </header>
    <main id="main" class="section policy">
      <article>
        <h1>${esc(t['support.title'])}</h1>
        <p class="policy-intro">${esc(t['support.intro'])}</p>
${section('contact')}
${section('include')}
        <section>
          <h2>${esc(t['support.faq.heading'])}</h2>
${faq}
        </section>
      </article>
      <p class="policy-home"><a href="/${lang}/">${esc(t['support.home'])}</a></p>
    </main>
  </body>
</html>
`;
  await mkdir(`${client}${lang}/support`, { recursive: true });
  await writeFile(`${client}${lang}/support/index.html`, page);
}

// Every feature: /en/features/ and /tr/features/, static, no script (src/components/FeaturesPage.tsx, the content in
// src/data/features.ts).
const featuresUrl = (lang) => `${SITE_URL}/${lang}/features/`;
for (const lang of LANGS) {
  const other = lang === 'en' ? 'tr' : 'en';
  const title = FEATURES_PAGE.metaTitle[lang];
  const description = FEATURES_PAGE.metaDescription[lang];
  const og = `${SITE_URL}/og-${lang}.png`;
  const page = `<!doctype html>
<html lang="${lang}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#f2e7cf" />
    <link rel="canonical" href="${featuresUrl(lang)}" />
    <link rel="alternate" hreflang="en" href="${featuresUrl('en')}" />
    <link rel="alternate" hreflang="tr" href="${featuresUrl('tr')}" />
    <link rel="alternate" hreflang="x-default" href="${featuresUrl('en')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Qutai" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${featuresUrl(lang)}" />
    <meta property="og:locale" content="${LOCALE[lang]}" />
    <meta property="og:locale:alternate" content="${LOCALE[other]}" />
    <meta property="og:image" content="${og}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${og}" />
    ${css}
  </head>
  <body>
    <div id="root">${renderFeatures(lang)}</div>
  </body>
</html>
`;
  await mkdir(`${client}${lang}/features`, { recursive: true });
  await writeFile(`${client}${lang}/features/index.html`, page);
}

const ldJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
/** The pricing page's structured data: the app, free, with the credit packs as further offers. */
const pricingLd = (lang) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Qutai',
  applicationCategory: 'BrowserApplication',
  operatingSystem: 'iOS, iPadOS, macOS, Android',
  url: `${SITE_URL}/${lang}/pricing/`,
  inLanguage: lang,
  offers: [
    { '@type': 'Offer', name: PRICING_PAGE.metaTitle[lang].split(' · ')[0], price: '0', priceCurrency: 'USD' },
    ...PACKS.map((p) => ({
      '@type': 'Offer',
      name: lang === 'tr' ? `${p.credits} Qutai Kredisi` : `${p.credits} Qutai Credits`,
      price: String(p.usd),
      priceCurrency: 'USD',
    })),
  ],
});

/** A static page with the shared head (canonical, hreflang, Open Graph, optional JSON-LD) around a rendered body. */
async function writePage({ path, lang, title, description, body, ld }) {
  const other = lang === 'en' ? 'tr' : 'en';
  const url = (l) => `${SITE_URL}/${l}/${path}`;
  const og = `${SITE_URL}/og-${lang}.png`;
  const page = `<!doctype html>
<html lang="${lang}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#f2e7cf" />
    <link rel="canonical" href="${url(lang)}" />
    <link rel="alternate" hreflang="en" href="${url('en')}" />
    <link rel="alternate" hreflang="tr" href="${url('tr')}" />
    <link rel="alternate" hreflang="x-default" href="${url('en')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Qutai" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url(lang)}" />
    <meta property="og:locale" content="${LOCALE[lang]}" />
    <meta property="og:locale:alternate" content="${LOCALE[other]}" />
    <meta property="og:image" content="${og}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${og}" />
    ${ld ? `<script type="application/ld+json">${ldJson(ld)}</script>\n    ` : ''}${css}
  </head>
  <body>
    <div id="root">${body}</div>
  </body>
</html>
`;
  await mkdir(`${client}${lang}/${path}`, { recursive: true });
  await writeFile(`${client}${lang}/${path}index.html`, page);
}

// The guide (/<lang>/agentic-browser/) and the Qutai vs <competitor> pages (/<lang>/vs/<id>/), written for search and
// AI answers (WEB-17); static, no script. The guide carries FAQPage structured data.
const fillName = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const VS_PATHS = COMPETITORS.map((c) => `vs/${c.id}/`);
for (const lang of LANGS) {
  await writePage({
    path: 'agentic-browser/',
    lang,
    title: GUIDE.metaTitle[lang],
    description: GUIDE.metaDescription[lang],
    body: renderGuide(lang),
    ld: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: guideFaq(lang).map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  });
  for (const c of COMPETITORS) {
    await writePage({
      path: `vs/${c.id}/`,
      lang,
      title: `${fillName(VS.metaTitle[lang], { name: c.name })} · Qutai`,
      description: fillName(VS.metaDescription[lang], { name: c.name }),
      body: renderVs(lang, c.id),
    });
  }
}

// /llms.txt: a short plain-text map of the site for AI assistants and their crawlers (llmstxt.org), in English.
{
  const en = messages.en;
  const list = (items) => items.map(([name, url, note]) => `- [${name}](${url})${note ? `: ${note}` : ''}`).join('\n');
  await writeFile(
    `${client}llms.txt`,
    `# Qutai

> Qutai is an open-source agentic AI browser for Android and iPhone (also iPad and Macs with Apple silicon). Its assistant gets to know you, fills in forms, shops, books and researches for you, right in your tabs, and asks before anything that matters. It works with your own AI key (Anthropic, OpenAI, Google Gemini, OpenRouter or a self-hosted OpenAI-compatible server such as Ollama) or with Qutai Credits bought in the app.

Key facts:
- Platforms: Android (Google Play); iPhone, iPad and Mac with Apple silicon (App Store beta through TestFlight).
- Price: the app is free. With your own AI key Qutai charges nothing. Qutai Credits: 100 credits for $1, 550 for $5, 1,200 for $10; credits never expire.
- Privacy: tabs, history, bookmarks, chats and the assistant's memory stay on the phone; with your own key, requests go straight from the phone to the provider; with Qutai Credits they pass through Qutai's server, which does not store or log them.
- Control: every step is shown and can be stopped; it asks before payments and other important actions; it never types passwords, card numbers or one-time codes; per-site permissions; a log of what was sent to the AI.
- Licence: Apache-2.0. Source: ${REPO_URL}
- Languages: the app's whole interface is in ten languages: English, Turkish (Türkçe), German (Deutsch), Spanish (Español), Portuguese, Brazil (Português (Brasil)), French (Français), Japanese (日本語), Korean (한국어), Russian (Русский) and Indonesian (Bahasa Indonesia). It follows the device's language by default and can be changed in the app (on iPhone and iPad it is the app's own language setting); the assistant answers in the language you write in. The privacy policy and terms are in all ten. This website is in English and Turkish (/tr/).

## Pages

${list([
  ['Home', `${SITE_URL}/en/`, en['meta.appDescription']],
  ['Features', `${SITE_URL}/en/features/`, 'everything Qutai does, with example requests and limits'],
  ['Pricing', `${SITE_URL}/en/pricing/`, 'own key free; Qutai Credits packs'],
  ['What is an agentic browser?', `${SITE_URL}/en/agentic-browser/`, 'questions and answers about agentic and AI browsers on phones'],
  ['Support', `${SITE_URL}/en/support/`],
  ['Privacy policy', `${SITE_URL}/en/privacy-policy/`],
])}

## Comparisons with other mobile AI browsers

${list(COMPETITORS.map((c) => [fillName(VS.title.en, { name: c.name }), `${SITE_URL}/en/vs/${c.id}/`]))}

## Get it

${list([
  ['Google Play', PLAY_URL],
  ['iPhone, iPad and Mac beta (TestFlight)', TESTFLIGHT_URL],
  ['Source code on GitHub', REPO_URL],
])}
`,
  );
}

// Pricing: /en/pricing/ and /tr/pricing/, static, no script (src/components/PricingPage.tsx, the content in
// src/data/pricing.ts).
const pricingUrl = (lang) => `${SITE_URL}/${lang}/pricing/`;
for (const lang of LANGS) {
  const other = lang === 'en' ? 'tr' : 'en';
  const title = PRICING_PAGE.metaTitle[lang];
  const description = PRICING_PAGE.metaDescription[lang];
  const og = `${SITE_URL}/og-${lang}.png`;
  const page = `<!doctype html>
<html lang="${lang}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#f2e7cf" />
    <link rel="canonical" href="${pricingUrl(lang)}" />
    <link rel="alternate" hreflang="en" href="${pricingUrl('en')}" />
    <link rel="alternate" hreflang="tr" href="${pricingUrl('tr')}" />
    <link rel="alternate" hreflang="x-default" href="${pricingUrl('en')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Qutai" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${pricingUrl(lang)}" />
    <meta property="og:locale" content="${LOCALE[lang]}" />
    <meta property="og:locale:alternate" content="${LOCALE[other]}" />
    <meta property="og:image" content="${og}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${og}" />
    <script type="application/ld+json">${ldJson(pricingLd(lang))}</script>
    ${css}
  </head>
  <body>
    <div id="root">${renderPricing(lang)}</div>
  </body>
</html>
`;
  await mkdir(`${client}${lang}/pricing`, { recursive: true });
  await writeFile(`${client}${lang}/pricing/index.html`, page);
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
const termsAlternates = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${termsUrl(l)}" />`)
  .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${termsUrl('en')}" />`)
  .join('\n');
await writeFile(
  `${client}sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map((l) => `  <url>\n    <loc>${pageUrl(l)}</loc>\n    <lastmod>${CHECKED}</lastmod>\n${alternates}\n  </url>`).join('\n')}
${LANGS.map((l) => `  <url>\n    <loc>${featuresUrl(l)}</loc>\n    <lastmod>${FEATURES_CHECKED}</lastmod>\n${LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${featuresUrl(x)}" />`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${featuresUrl('en')}" />\n  </url>`).join('\n')}
${LANGS.map((l) => `  <url>\n    <loc>${pricingUrl(l)}</loc>\n    <lastmod>${PRICING_CHECKED}</lastmod>\n${LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${pricingUrl(x)}" />`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${pricingUrl('en')}" />\n  </url>`).join('\n')}
${['agentic-browser/', ...VS_PATHS].flatMap((p) => LANGS.map((l) => `  <url>\n    <loc>${SITE_URL}/${l}/${p}</loc>\n    <lastmod>${CHECKED}</lastmod>\n${LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${SITE_URL}/${x}/${p}" />`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/en/${p}" />\n  </url>`)).join('\n')}
${LANGS.map((l) => `  <url>\n    <loc>${policyUrl(l)}</loc>\n    <lastmod>${privacy.updated}</lastmod>\n${policyAlternates}\n  </url>`).join('\n')}
${LANGS.map((l) => `  <url>\n    <loc>${termsUrl(l)}</loc>\n    <lastmod>${terms.updated}</lastmod>\n${termsAlternates}\n  </url>`).join('\n')}
${LANGS.map((l) => `  <url>\n    <loc>${deletionUrl(l)}</loc>\n${LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${deletionUrl(x)}" />`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${deletionUrl('en')}" />\n  </url>`).join('\n')}
${LANGS.map((l) => `  <url>\n    <loc>${supportUrl(l)}</loc>\n${LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${supportUrl(x)}" />`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${supportUrl('en')}" />\n  </url>`).join('\n')}
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
console.log(`Prerendered ${LANGS.map((l) => `/${l}/, /${l}/features/, /${l}/pricing/, /${l}/agentic-browser/, /${l}/vs/…/, /${l}/privacy-policy/, /${l}/terms/, /${l}/delete-account/, /${l}/support/`).join(', ')}, 404.html, robots.txt, llms.txt, sitemap.xml, _headers`);
