/**
 * Android pull to refresh (BROW rules in docs/design): the page says, for each touch, whether a downward drag from
 * that point would refresh it the way Chrome decides it, and the patched WebView (RNCWebViewPull.java) switches the
 * app's refresh layout off for that touch otherwise.
 *
 * The answer goes through the WebView's own message bridge, which reaches Java on the UI thread at once; the refresh
 * layout decides on the drag a few move events later. Going through React Native's state instead arrived after the
 * layout had decided, so the previous touch's answer was used (refresh while scrolling a chat's older messages).
 * While a touch waits for its answer the layout stays off: a busy page loses a pull, never a scroll.
 *
 * iOS has the WebView's own pullToRefreshEnabled: it only pulls when the page's own scroll view is dragged at its
 * top, and WebKit's inner scroll areas take the drag themselves, so none of this is needed there.
 */

/**
 * The rule, as page JavaScript (also run by the tests): can a finger-down drag starting on `target` refresh?
 * No when the page or the pinch-zoomed view is scrolled, when a scroll area under the finger can still move its
 * content down (reversed chat lists and flipped areas included), when the drag stops at an area or root that sets
 * overscroll-behavior-y contain/none, or when touch-action under the finger rules out vertical panning.
 */
export const PULL_RULE = `function qutaiCanPull(target, win) {
  var doc = win.document, root = doc.documentElement;
  var page = doc.scrollingElement || root;
  if ((win.scrollY || 0) > 0 || (page && page.scrollTop > 0)) return false;
  if (win.visualViewport && win.visualViewport.offsetTop > 0.5) return false;
  var chain = [];
  for (var el = target; el && el.nodeType === 1; el = el.parentElement || (el.parentNode && el.parentNode.host)) chain.push(el);
  var styles = [], flipped = [], flip = false;
  for (var i = chain.length - 1; i >= 0; i--) {
    var s = win.getComputedStyle(chain[i]);
    styles[i] = s;
    var m = /^matrix(3d)?\\((.*)\\)$/.exec(s.transform || '');
    if (m) {
      var v = m[2].split(',');
      if (parseFloat(v[m[1] ? 5 : 3]) < 0) flip = !flip;
    }
    flipped[i] = flip;
  }
  for (i = 0; i < chain.length; i++) {
    var e = chain[i];
    s = styles[i];
    var ta = s.touchAction || 'auto';
    if (ta !== 'auto' && ta !== 'manipulation' && !/pan-(y|up|down)/.test(ta)) return false;
    if (e === root || e === page) continue;
    var max = e.scrollHeight - e.clientHeight;
    if (!/(auto|scroll|overlay)/.test(s.overflowY) || max < 1) continue;
    var top = e.scrollTop;
    var fromStart = top < 0 || (top === 0 && /column-reverse/.test(s.flexDirection)) ? top + max : top;
    var canMove = flipped[i] ? fromStart < max - 1 : fromStart > 1;
    if (canMove) return false;
    if (/contain|none/.test(s.overscrollBehaviorY || '')) return false;
  }
  return !/contain|none/.test(win.getComputedStyle(root).overscrollBehaviorY || '');
}`;

/**
 * Reports to the native side (main frame only, Android). Messages start with {"__qutaiPull":true so the WebView
 * can pick them out without parsing every message; they never reach React Native.
 */
export const PULL_STATE_SCRIPT = `(function () {
  if (window.top !== window || window.__qutaiPull) return;
  window.__qutaiPull = true;
  ${PULL_RULE}
  function send(fields) {
    try { window.ReactNativeWebView.postMessage('{"__qutaiPull":true,' + fields + '}'); } catch (e) {}
  }
  var took = false;
  document.addEventListener('touchstart', function (e) {
    took = false;
    var ok = false;
    try { ok = e.touches.length === 1 && qutaiCanPull(e.target, window); } catch (err) {}
    send('"touch":true,"atTop":' + ok);
  }, { passive: true, capture: true });
  // A page that handles the drag itself (a map, a slider, a drawing) cancels its touchmove; this listener runs
  // after the page's own ones.
  window.addEventListener('touchmove', function (e) {
    if (!took && e.defaultPrevented) { took = true; send('"took":true'); }
  }, { passive: true });
  send('"ready":true');
})(); true;`;
