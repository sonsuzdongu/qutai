// Turns the miniatures in art-src/ (any PNG, JPEG or WebP, named as in ART.md) into the sizes the page uses:
// src/art/<name>-<width>.webp. Run `npm run art` after adding or replacing a painting; commit src/art/.
import { readdir, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const NAMES = ['hero', 'compare', 'checkout', 'booking', 'research', 'memory'];
const WIDTHS = [640, 960, 1280, 1920];

await mkdir(here('../src/art'), { recursive: true });
const files = await readdir(here('../art-src')).catch(() => []);
let done = 0;
for (const file of files) {
  const name = file.replace(/\.(png|jpe?g|webp)$/i, '');
  if (name === file || !NAMES.includes(name)) {
    if (!file.startsWith('.')) console.warn(`skipped ${file}: expected one of ${NAMES.join(', ')} (.png, .jpg or .webp)`);
    continue;
  }
  const meta = await sharp(here(`../art-src/${file}`)).metadata();
  const full = Math.min(meta.width ?? WIDTHS[0], WIDTHS[WIDTHS.length - 1]);
  // The standard widths below the original, plus the original itself (up to 1920) for sharp retina screens.
  const widths = [...new Set([...WIDTHS.filter((w) => w < full), full])];
  for (const old of (await readdir(here('../src/art'))).filter((f) => f.startsWith(`${name}-`))) {
    await rm(here(`../src/art/${old}`));
  }
  for (const w of widths) {
    await sharp(here(`../art-src/${file}`))
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(here(`../src/art/${name}-${w}.webp`));
  }
  done++;
  console.log(`${name}: ${meta.width}×${meta.height}`);
}
console.log(done ? `${done} miniature(s) written to src/art/` : 'No miniatures in art-src/ yet (see ART.md).');
