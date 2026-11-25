/**
 * Page zoom (UI-84 in docs/design/27-interface.md): the whole page (layout, text and images) scales and lays out again,
 * as in Safari's View › Zoom In. Done with the page's viewport (viewportZoomScript): the page lays out at the view's width
 * divided by the zoom and WebKit scales it up to fill the view, sharp. (WKWebView.pageZoom was tried first: on iOS it
 * scales the content without narrowing the layout, so pages ran off to the right and text stayed small.)
 *
 * Two parts multiply: the device's base zoom (a Mac draws an iPad app at about 77%, so pages there start at the size
 * Safari and Chrome on the same Mac show them) and the user's zoom level for the site (⌘+ / ⌘− / ⌘0, Safari's steps,
 * remembered per site like Safari). 100% means "as Safari shows it". The Settings text size works on top of both.
 * Pure: tested with node:test (scripts/layout-tests/pageZoom.test.ts).
 */

/** Safari's zoom steps, in percent of the normal size. */
export const ZOOM_LEVELS = [50, 75, 85, 100, 115, 125, 150, 175, 200, 250, 300] as const;

/** The normal size: what ⌘0 goes back to; not stored. */
export const DEFAULT_ZOOM_LEVEL = 100;

export const MIN_ZOOM_LEVEL = ZOOM_LEVELS[0];
export const MAX_ZOOM_LEVEL = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/**
 * On a Mac, an iPad app's points are drawn at 77% of a Mac point (macOS scales "Designed for iPad" apps), so a page
 * at zoom 1 is 23% smaller than in Safari or Chrome. 1 / 0.77, rounded: pages start at Safari's size.
 */
export const MAC_IPAD_SCALE = 0.77;
export const MAC_BASE_PAGE_ZOOM = Math.round((1 / MAC_IPAD_SCALE) * 1000) / 1000;

export type ZoomDevice = 'mac' | 'tablet' | 'phone' | 'android';

/** The page zoom that shows pages at their normal size on this device: only a Mac needs one. */
export function baseZoomFor(device: ZoomDevice): number {
  return device === 'mac' ? MAC_BASE_PAGE_ZOOM : 1;
}

/** A stored or reported level as one of the steps (the nearest), or null when it isn't a number. */
export function normalizeZoomLevel(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  let best: number = ZOOM_LEVELS[0];
  for (const level of ZOOM_LEVELS) if (Math.abs(level - n) < Math.abs(best - n)) best = level;
  return best;
}

/** The next step in (larger) or out (smaller) from `level`; the same level at either end. */
export function stepZoom(level: number, direction: 'in' | 'out'): number {
  if (direction === 'in') return ZOOM_LEVELS.find((l) => l > level) ?? MAX_ZOOM_LEVEL;
  for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) if (ZOOM_LEVELS[i] < level) return ZOOM_LEVELS[i];
  return MIN_ZOOM_LEVEL;
}

/**
 * On a Mac the page menu's "Text size" is "Zoom" (owner, 26 Nov 2026): it shows and changes the site's zoom level, the
 * same one ⌘+ / ⌘− / ⌘0 change, and the Settings text size is not applied there (one control, one value per site).
 */
export function zoomReplacesTextSize(device: ZoomDevice): boolean {
  return device === 'mac';
}

/** The text size that goes into the page zoom (textSizeByPageZoom): none where Zoom replaces it. */
export function pageZoomTextSize(device: ZoomDevice, textSize: number): number {
  return zoomReplacesTextSize(device) || !textSizeByPageZoom(device) ? 100 : textSize;
}

/**
 * Whether the Settings text size is applied as page zoom: on a Mac and an iPad, WebKit browses as a desktop and
 * ignores -webkit-text-size-adjust (the iPhone's text size path), so the text size scales the whole page there, as
 * Safari's text size does on an iPad. iPhone keeps text-size-adjust (text only); Android its WebView's textZoom.
 */
export function textSizeByPageZoom(device: ZoomDevice): boolean {
  return device === 'mac' || device === 'tablet';
}

/**
 * What the page is zoomed by: the device's base zoom times the site's level (times the Settings text size where that
 * is page zoom, textSizeByPageZoom), to three decimals.
 */
export function webViewPageZoom(level: number, base: number, textSize = 100): number {
  return Math.round(base * (level / 100) * (textSize / 100) * 1000) / 1000;
}

/** The width a page lays out at: the view's width (points) divided by the zoom, never under 320 CSS px. */
export function viewportWidthFor(viewWidth: number, zoom: number): number {
  return Math.max(320, Math.round(viewWidth / (zoom > 0 ? zoom : 1)));
}

/**
 * The zoom levels the user chose, by site (siteKey: host without "www."). Only levels other than 100% are kept, so
 * ⌘0 forgets the site. Pure; persisted by browser/siteZoom.ts.
 */
export class SiteZoomLevels {
  private levels = new Map<string, number>();

  constructor(entries?: Iterable<[string, number]>) {
    if (entries) for (const [site, level] of entries) this.set(site, level);
  }

  /** Reads a saved object ({ "example.com": 125 }); anything unreadable is left out. */
  static fromJson(value: unknown): SiteZoomLevels {
    const out = new SiteZoomLevels();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [site, level] of Object.entries(value as Record<string, unknown>)) {
        const n = normalizeZoomLevel(level);
        if (site && n !== null) out.set(site, n);
      }
    }
    return out;
  }

  get(site: string | null): number {
    return (site && this.levels.get(site)) || DEFAULT_ZOOM_LEVEL;
  }

  /** True when something changed. */
  set(site: string, level: number): boolean {
    const n = normalizeZoomLevel(level) ?? DEFAULT_ZOOM_LEVEL;
    const before = this.get(site);
    if (n === DEFAULT_ZOOM_LEVEL) this.levels.delete(site);
    else this.levels.set(site, n);
    return before !== n;
  }

  get size(): number {
    return this.levels.size;
  }

  toJson(): Record<string, number> {
    return Object.fromEntries([...this.levels.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
}
