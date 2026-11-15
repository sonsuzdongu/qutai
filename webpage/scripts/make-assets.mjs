// Builds the site's images from the app's brand assets (../assets). Run with `npm run assets` after the logo
// changes; the results are committed in public/ so a deploy does not depend on image tooling.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const brand = (f) => here(`../../assets/${f}`);
const out = (f) => here(`../public/${f}`);

await mkdir(out('img'), { recursive: true });

// The Q mark: small for the header and the phone mock, large for the hero.
await sharp(brand('logo.png')).resize(64, 64).webp({ quality: 90 }).toFile(out('img/q-64.webp'));
await sharp(brand('splash-icon.png')).resize(640, 640).webp({ quality: 80 }).toFile(out('img/q-640.webp'));
await sharp(brand('splash-icon.png')).resize(640, 640).avif({ quality: 55 }).toFile(out('img/q-640.avif'));

// Favicons and touch icons. icon.png is the app icon on white, which iOS and Android expect.
await sharp(brand('logo.png')).resize(32, 32).png().toFile(out('favicon-32.png'));
await sharp(brand('favicon.png')).png().toFile(out('favicon-48.png'));
await sharp(brand('icon.png')).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
await sharp(brand('icon.png')).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(brand('icon.png')).resize(512, 512).png().toFile(out('icon-512.png'));

// Social preview images (1200×630), one per language. Keep the headline in step with meta.title and
// footer.tagline in src/i18n.
const og = {
  en: ['Agentic Browser', 'Open source · iPhone and Android · in development'],
  tr: ['Agentic Browser', 'Açık kaynak · iPhone ve Android · geliştirme aşamasında'],
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const [lang, [headline, small]] of Object.entries(og)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#061634"/><stop offset="0.6" stop-color="#08214f"/><stop offset="1" stop-color="#0b3a86"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.7">
      <stop offset="0" stop-color="#1f7ae0" stop-opacity="0.7"/><stop offset="1" stop-color="#1f7ae0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.2" cy="1" r="0.6">
      <stop offset="0" stop-color="#19b4dc" stop-opacity="0.45"/><stop offset="1" stop-color="#19b4dc" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#ffffff">
    <text x="80" y="150" font-size="44" font-weight="700" letter-spacing="1">Qutai</text>
    <text x="80" y="370" font-size="76" font-weight="700" letter-spacing="-1.5">${esc(headline)}</text>
    <text x="80" y="520" font-size="30" fill="#bfe3f7">${esc(small)}</text>
  </g>
</svg>`;
  const logo = await sharp(brand('splash-icon.png')).resize(300, 300).png().toBuffer();
  await sharp(Buffer.from(svg))
    .composite([{ input: logo, left: 840, top: 60 }])
    .png({ compressionLevel: 9 })
    .toFile(out(`og-${lang}.png`));
}

await writeFile(
  out('site.webmanifest'),
  JSON.stringify(
    {
      name: 'Qutai',
      short_name: 'Qutai',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#f2e7cf',
      background_color: '#f2e7cf',
      display: 'browser',
    },
    null,
    2,
  ) + '\n',
);
console.log('Assets written to public/');
