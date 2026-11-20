/**
 * The address bar slides away while a page is scrolled down and comes back on a small scroll up (`UI` rules in
 * docs/design/27-interface.md). Pure (tested in scripts/navigation-tests/toolbar.test.ts).
 *
 * Where the scroll comes from: the page script below, not the WebView's onScroll. onScroll sends every scroll frame
 * across to JavaScript on both platforms; the page script listens inside the page (a passive listener doing a few
 * comparisons) and posts a message only when what the bar should do changes: a handful per page, not one per frame.
 * It sees the page's own scrolling (window); a page that scrolls an inner box (many web apps and maps) never reports
 * "down", so the bar simply stays, which is the safe side.
 */

/** What the page reports: scrolled down past the hide distance, scrolled up a little, at its top, or too short to scroll. */
export type PageScroll = 'down' | 'up' | 'top' | 'short';

/** Scrolled down at least this far (in one direction run) before the bar hides. */
export const HIDE_AFTER_PX = 48;
/** A scroll up of this much brings it back. */
export const SHOW_AFTER_PX = 8;
/** At or above this offset the page counts as at its top. */
export const TOP_PX = 8;
/** A page that can scroll less than this is short: the bar stays. */
export const SHORT_PX = 160;

/** Main frame only; posts {"__qutaiBar": state} when the state changes, and again on resize. */
export const TOOLBAR_SCROLL_SCRIPT = `
if (window.top === window && !window.__qutaiBarScroll) (function () {
  window.__qutaiBarScroll = true;
  var state = null, last = window.scrollY || 0, anchor = last, dir = 0;
  function send(next) {
    if (next === state) return;
    state = next;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ __qutaiBar: next })); } catch (e) {}
  }
  function scrollable() {
    var page = document.scrollingElement || document.documentElement;
    return page ? page.scrollHeight - window.innerHeight : 0;
  }
  function update() {
    var y = window.scrollY || 0;
    if (scrollable() < ${SHORT_PX}) { last = y; anchor = y; return send('short'); }
    if (y <= ${TOP_PX}) { last = y; anchor = y; dir = 0; return send('top'); }
    var d = y > last ? 1 : y < last ? -1 : 0;
    if (d !== 0 && d !== dir) { dir = d; anchor = last; }
    last = y;
    if (dir > 0 && y - anchor >= ${HIDE_AFTER_PX}) send('down');
    else if (dir < 0 && anchor - y >= ${SHOW_AFTER_PX}) send('up');
    else if (state === null || state === 'top' || state === 'short') send('up');
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();
true;`;

/** The page's scroll report from a message, or null when the message is something else. */
export function parseBarMessage(data: string): PageScroll | null {
  if (!data.startsWith('{"__qutaiBar":')) return null;
  try {
    const v = (JSON.parse(data) as { __qutaiBar?: unknown }).__qutaiBar;
    return v === 'down' || v === 'up' || v === 'top' || v === 'short' ? v : null;
  } catch {
    return null;
  }
}

/** Everything that keeps the bar on screen whatever the page reports. */
export type BarHolds = {
  /** Settings › "Keep the address bar visible". */
  alwaysVisible: boolean;
  /** A navigation is waiting or loading. */
  loading: boolean;
  editing: boolean;
  keyboard: boolean;
  findBar: boolean;
  /** The assistant panel, the working strip or a dialog. */
  panel: boolean;
  strip: boolean;
  dialog: boolean;
  /** The assistant is working (its marker and screenshots assume the page where it was). */
  assistantWorking: boolean;
  /** Text is selected on the page (the selection bar sits above the address bar). */
  selection: boolean;
  /** The new tab page, an error or crash screen: nothing to scroll. */
  noPage: boolean;
};

/** Whether the bar is hidden: only when the page was scrolled down and nothing holds it. */
export function barHidden(scroll: PageScroll | null, holds: BarHolds): boolean {
  if (scroll !== 'down') return false;
  return !Object.values(holds).some(Boolean);
}
