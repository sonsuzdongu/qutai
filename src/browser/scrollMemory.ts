/**
 * A tab remembers how far its page was scrolled, so a tab woken from sleep (its WebView was freed) comes back at the
 * same place on the same page. The page reports its position once scrolling has stopped; memory only, never saved.
 * Not in incognito tabs (they never sleep).
 */

/** Main frame only; one message about half a second after scrolling stops. */
export const SCROLL_MEMORY_SCRIPT = `
if (window.top === window && !window.__qutaiScrollMemory) (function () {
  window.__qutaiScrollMemory = true;
  var timer = null;
  window.addEventListener('scroll', function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ __qutaiScroll: Math.round(window.scrollY || 0) })); } catch (e) {}
    }, 500);
  }, { passive: true });
})();
true;`;

/** The scroll position from a page message, or null when the message is something else. */
export function parseScrollMessage(data: string): number | null {
  if (!data.startsWith('{"__qutaiScroll":')) return null;
  try {
    const y = (JSON.parse(data) as { __qutaiScroll?: unknown }).__qutaiScroll;
    return typeof y === 'number' && Number.isFinite(y) && y >= 0 ? y : null;
  } catch {
    return null;
  }
}

/** Scrolls the page back, once its content is long enough (late content gets two more tries). */
export function restoreScrollScript(y: number): string {
  const top = Math.max(0, Math.round(y));
  return `(function () {
  var y = ${top}, tries = 0;
  function go() {
    if (document.documentElement.scrollHeight - window.innerHeight >= y || tries >= 2) { window.scrollTo(0, y); return; }
    tries++; setTimeout(go, 400);
  }
  go();
})();
true;`;
}
