/**
 * Whether a WebView "load start" begins a real page load, so the loading line above the address bar shows until the
 * matching load end. Pure (tested in scripts/assistant-tests/loadState.test.ts).
 *
 * The two platforms report starts that never get an end (18 Nov 2026: the line stayed up for good and Stop didn't
 * clear it):
 * - Android: react-native-webview sends its load start from doUpdateVisitedHistory, which also runs for a page's own
 *   history.pushState / replaceState (client-side routing on react.dev, a Wikipedia redirect page correcting its
 *   address). No load end follows those. Its event says whether the WebView is actually loading (progress below
 *   100): a same-document update says false.
 * - iOS: the start is sent when the navigation is decided, before anything loads, so it can't say; a jump to a
 *   #fragment of the page on screen is a same-document navigation WebKit never "finishes".
 * Other ends (Tab.ts): the WebView's progress reaching 100 % (a soft navigation that loads with no load end), Stop,
 * a navigation that became a download, the web process ending, and on iOS a cancelled or interrupted navigation
 * that leaves the WebView idle (patched react-native-webview).
 */
export function startsLoading({
  url,
  currentUrl,
  os,
  nativeLoading,
}: {
  url: string | undefined;
  currentUrl: string;
  os: string;
  /** The event's own `loading` (Android: false for a same-document history update). */
  nativeLoading: boolean | undefined;
}): boolean {
  if (os === 'android') return nativeLoading !== false;
  if (!url) return true;
  const hash = url.indexOf('#');
  if (hash === -1) return true;
  const page = (u: string) => (u.indexOf('#') === -1 ? u : u.slice(0, u.indexOf('#')));
  return url.slice(0, hash) !== page(currentUrl);
}
