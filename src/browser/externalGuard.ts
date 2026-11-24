import type { Tab } from './Tab';

/** Long enough for a tapped link to go through a redirect or two before it reaches the app link. */
const GESTURE_WINDOW_MS = 3000;

/**
 * A tab opened from another app (a link tapped there, Qutai the default browser) counts as the user's own tap for its
 * first load and that load's redirects, like Chrome: a link that redirects to Google Play opens Play. The chain ends
 * when the first page has loaded, or after this long at most.
 */
const LAUNCH_CHAIN_MS = 15000;

const lastTouch = new WeakMap<Tab, number>();
const launched = new WeakMap<Tab, number>();
const declined = new WeakMap<Tab, Set<string>>();

export function noteUserGesture(tab: Tab, now = Date.now()) {
  lastTouch.set(tab, now);
}

/** This tab was just opened from another app; its first load and its redirects count as the user's tap. */
export function noteOpenedFromApp(tab: Tab, now = Date.now()) {
  launched.set(tab, now);
}

/** The tab's first page has loaded (or the chain was used): later redirects follow the usual rule. */
export function endLaunchChain(tab: Tab) {
  launched.delete(tab);
}

function inLaunchChain(tab: Tab, now: number): boolean {
  const at = launched.get(tab);
  return at !== undefined && now - at <= LAUNCH_CHAIN_MS;
}

/** The user touched this tab's page a moment ago (nothing is used up, unlike `mayOfferExternal`). */
export function touchedRecently(tab: Tab, now = Date.now()): boolean {
  const touched = lastTouch.get(tab);
  return touched !== undefined && now - touched <= GESTURE_WINDOW_MS;
}

/**
 * Whether a page may hand off to another app: only right after the user touched it (or, on iOS,
 * tapped a link), or in the first load of a tab opened from another app, and never again for a
 * link they already declined in this tab. Pages that redirect to an app on load (store pages,
 * "open in app" banners) are otherwise ignored. True means the user started it.
 */
export function mayOfferExternal(tab: Tab, url: string, clicked: boolean, now = Date.now()): boolean {
  if (declined.get(tab)?.has(url)) return false;
  const touched = lastTouch.get(tab);
  const tapped = clicked || (touched !== undefined && now - touched <= GESTURE_WINDOW_MS);
  if (!tapped && !inLaunchChain(tab, now)) return false;
  // One tap (or one opening from another app) allows one hand-off, so a redirect chain can't ask twice.
  lastTouch.delete(tab);
  launched.delete(tab);
  return true;
}

export function declineExternal(tab: Tab, url: string) {
  const urls = declined.get(tab) ?? new Set<string>();
  urls.add(url);
  declined.set(tab, urls);
}
