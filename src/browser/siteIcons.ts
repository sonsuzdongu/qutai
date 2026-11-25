/**
 * Site icons for the new tab page (UI-18, UI-72 in docs/design/27-interface.md): the pure parts. Which of a page's
 * own icon links to fetch, which addresses and files are acceptable, and when a stored icon is old. The fetching and
 * the files are in storage/siteIcons.ts. Tests: scripts/storage-tests/siteIcons.test.ts.
 *
 * The icon comes only from the site the user is visiting (its <link rel="icon"> / apple-touch-icon, else
 * /favicon.ico on the same origin), never from an icon service, and only over https.
 */
import { hostOf } from '../i18n/format';
import { sniffImage } from '../chat/imageSniff';
import { safeHttpsUrl } from '../chat/optionCards';

/** A downloaded icon is refused above this many bytes (the download stops there). */
export const ICON_MAX_BYTES = 200_000;
/** Icons bigger than this on either side are refused (nothing on the new tab page needs more). */
export const ICON_MAX_SIDE = 1024;
/** A stored icon is fetched again on a visit after this long. */
export const ICON_FRESH_MS = 7 * 86_400_000;
/** A site with no usable icon is asked again on a visit after this long. */
export const ICON_RETRY_MS = 86_400_000;
/** At most this many of a page's links are tried (then /favicon.ico). */
const MAX_TRIES = 3;
/** The size the new tab page draws best from (52 pt tiles at 2–3x). */
const IDEAL_PX = 128;

export type IconLink = { href: string; rel: string; sizes: string; type: string };
export type IconFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'ico';

/** The page script's answer (pageScript.ts siteIcons), checked as untrusted data: at most 20 well-formed links. */
export function parseIconLinks(raw: unknown): IconLink[] {
  if (!Array.isArray(raw)) return [];
  const out: IconLink[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const { href, rel, sizes, type } = item as Record<string, unknown>;
    if (typeof href !== 'string' || typeof rel !== 'string') continue;
    out.push({
      href: href.slice(0, 2048),
      rel: rel.toLowerCase().slice(0, 100),
      sizes: typeof sizes === 'string' ? sizes.toLowerCase().slice(0, 100) : '',
      type: typeof type === 'string' ? type.toLowerCase().slice(0, 100) : '',
    });
  }
  return out;
}

/** The site an icon belongs to: the host without "www." of an https page, or null (http, other schemes). */
export function siteIconKey(pageUrl: string): string | null {
  if (!safeHttpsUrl(pageUrl)) return null;
  const host = hostOf(pageUrl).toLowerCase();
  return host || null;
}

/** The largest side a link's `sizes` names ("16x16 32x32" → 32), null for none or "any". */
function largestSize(sizes: string): number | null {
  let best: number | null = null;
  for (const part of sizes.split(/\s+/)) {
    const m = /^(\d{1,4})x(\d{1,4})$/.exec(part);
    if (m) best = Math.max(best ?? 0, Math.min(Number(m[1]), Number(m[2])));
  }
  return best;
}

function isIconRel(rel: string): 'touch' | 'icon' | null {
  const words = rel.split(/\s+/);
  if (words.includes('apple-touch-icon') || words.includes('apple-touch-icon-precomposed')) return 'touch';
  if (words.includes('icon')) return 'icon';
  return null;
}

/**
 * Addresses to try, best first: the page's own icon links (no SVG, which the app can't draw safely), the size
 * nearest 128 px first (an apple-touch-icon without sizes counts as 180, an icon without sizes as 32), then
 * /favicon.ico on the page's origin. Only https; duplicates once.
 */
export function iconCandidates(pageUrl: string, links: IconLink[]): string[] {
  if (!safeHttpsUrl(pageUrl)) return [];
  const scored: { url: string; score: number; order: number }[] = [];
  links.forEach((link, order) => {
    const kind = isIconRel(link.rel);
    if (!kind) return;
    if (link.type.includes('svg') || /\.svgz?(?:[?#]|$)/i.test(link.href)) return;
    let url: string;
    try {
      url = new URL(link.href, pageUrl).href;
    } catch {
      return;
    }
    if (!safeHttpsUrl(url)) return;
    const size = largestSize(link.sizes) ?? (kind === 'touch' ? 180 : 32);
    // Too small to look sharp counts a little worse than too big (which only scales down).
    const ratio = size / IDEAL_PX;
    const score = ratio < 1 ? Math.log2(1 / ratio) * 1.5 : Math.log2(ratio);
    scored.push({ url, score: score - (kind === 'touch' ? 0.01 : 0), order });
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  const out: string[] = [];
  for (const { url } of scored) if (!out.includes(url) && out.length < MAX_TRIES) out.push(url);
  const fallback = new URL('/favicon.ico', pageUrl).href;
  if (!out.includes(fallback)) out.push(fallback);
  return out;
}

/** An ICO file's header: reserved 0, type 1, 1–64 images, the directory complete; its largest side. */
function icoSize(b: Uint8Array): number | null {
  if (b.length < 22 || b[0] !== 0 || b[1] !== 0 || b[2] !== 1 || b[3] !== 0) return null;
  const count = b[4] | (b[5] << 8);
  if (count < 1 || count > 64 || b.length < 6 + 16 * count) return null;
  let side = 0;
  for (let i = 0; i < count; i++) side = Math.max(side, b[6 + 16 * i] || 256, b[7 + 16 * i] || 256);
  return side;
}

/**
 * What the bytes really are (never the server's Content-Type alone): PNG, JPEG, GIF, WebP or ICO, at most
 * ICON_MAX_BYTES and ICON_MAX_SIDE; null for anything else (SVG, HTML, an error page).
 */
export function iconFormat(bytes: Uint8Array): IconFormat | null {
  if (bytes.length > ICON_MAX_BYTES) return null;
  const ico = icoSize(bytes);
  if (ico !== null) return ico <= ICON_MAX_SIDE ? 'ico' : null;
  const info = sniffImage(bytes);
  if (!info || info.width > ICON_MAX_SIDE || info.height > ICON_MAX_SIDE) return null;
  return info.format;
}

/** What is stored for a site: when it was fetched and the icon's file, or no file when the site had none. */
export type IconEntry = { at: number; file: string | null };

/** Whether a visit should fetch the site's icon (none yet, an old one, or a failure retried after a day). */
export function needsIconFetch(entry: IconEntry | undefined, now = Date.now()): boolean {
  if (!entry) return true;
  const age = now - entry.at;
  if (age < 0) return true;
  return age >= (entry.file ? ICON_FRESH_MS : ICON_RETRY_MS);
}

/** A site key as part of a file name (letters, digits, dots and hyphens; anything else "_"). */
export function iconFileKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9.-]/g, '_').slice(0, 200);
}

/** The file an icon (or, with "none", a site without one) is kept in: key~time.ext, a new name for each fetch. */
export function iconFileName(key: string, at: number, ext: IconFormat | 'none'): string {
  return `${iconFileKey(key)}~${at}.${ext}`;
}

/** A stored file's site key and time, or null for a name this module didn't write. */
export function parseIconFileName(name: string): { key: string; at: number; ext: IconFormat | 'none' } | null {
  const m = /^([a-z0-9._-]{1,200})~(\d{1,15})\.(png|jpeg|gif|webp|ico|none)$/.exec(name);
  return m ? { key: m[1], at: Number(m[2]), ext: m[3] as IconFormat | 'none' } : null;
}
