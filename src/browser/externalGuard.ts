import type { Tab } from './Tab';

/** Long enough for a tapped link to go through a redirect or two before it reaches the app link. */
const GESTURE_WINDOW_MS = 3000;

const lastTouch = new WeakMap<Tab, number>();
const declined = new WeakMap<Tab, Set<string>>();

export function noteUserGesture(tab: Tab, now = Date.now()) {
  lastTouch.set(tab, now);
}

/**
 * Whether a page may ask to open another app: only right after the user touched it (or, on iOS,
 * tapped a link), and never again for a link they already declined in this tab. Pages that
 * redirect to an app on load (store pages, "open in app" banners) are ignored.
 */
export function mayOfferExternal(tab: Tab, url: string, clicked: boolean, now = Date.now()): boolean {
  if (declined.get(tab)?.has(url)) return false;
  const touched = lastTouch.get(tab);
  if (!clicked && (touched === undefined || now - touched > GESTURE_WINDOW_MS)) return false;
  // One tap allows one prompt, so a redirect chain can't ask twice.
  lastTouch.delete(tab);
  return true;
}

export function declineExternal(tab: Tab, url: string) {
  const urls = declined.get(tab) ?? new Set<string>();
  urls.add(url);
  declined.set(tab, urls);
}
