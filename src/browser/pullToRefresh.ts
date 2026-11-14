/**
 * Android pull to refresh: the page reports whether a downward drag would scroll it or should
 * refresh it, i.e. the page is at its top and so is every scroll area under the finger. The app
 * enables the native refresh gesture only then, so it never steals normal scrolling.
 * (iOS has the WebView's own pullToRefreshEnabled.)
 */
export const PULL_STATE_SCRIPT = `(function () {
  if (window.__qutaiPull) return;
  window.__qutaiPull = true;
  var last = null;
  function scrolledAncestor(el) {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollTop > 0) return true;
    }
    return false;
  }
  function report(target) {
    var page = document.scrollingElement || document.documentElement;
    var atTop = (window.scrollY || page.scrollTop || 0) <= 0 && !scrolledAncestor(target);
    if (atTop === last) return;
    last = atTop;
    window.ReactNativeWebView.postMessage(JSON.stringify({ __qutaiPull: true, atTop: atTop }));
  }
  window.addEventListener('scroll', function () { report(null); }, { passive: true });
  document.addEventListener('touchstart', function (e) { report(e.target); }, { passive: true, capture: true });
  report(null);
})(); true;`;

/** Whether a page message says the page is at its top; null for other messages. */
export function parsePullState(data: string): boolean | null {
  if (!data.includes('__qutaiPull')) return null;
  try {
    const msg = JSON.parse(data) as { __qutaiPull?: unknown; atTop?: unknown };
    return msg.__qutaiPull === true && typeof msg.atTop === 'boolean' ? msg.atTop : null;
  } catch {
    return null;
  }
}
