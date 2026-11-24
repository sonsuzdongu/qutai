import { cutText, wellFormedJsonText } from '../utils/wellFormed';

/** What was long-pressed on the page. */
export type ContextTarget = { href: string; linkText: string; src: string; alt: string };

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;
/** A touch this soon after the page scrolled is stopping a fling, not pressing what is under it. */
const FLING_MS = 150;

/**
 * Detects long presses on links and images and reports them to the app, which shows its own menu. iOS's built-in
 * callout is turned off for links and images; the click that follows a long press is swallowed.
 *
 * Scrolling never opens the menu: the press ends when the finger moves, when the touch is cancelled (Android hands
 * a drag to the scroller or to pull to refresh, and the page then gets touchcancel and no more touchmove), when
 * anything on the page scrolls, and a touch that stops a fling never starts one. Android's own long press
 * (contextmenu, which already ignores scrolls) opens the menu at once if it comes before the timer; the menu opens
 * once per press either way.
 */
export const CONTEXT_MENU_SCRIPT = `(function () {
  if (window.__qutaiContextMenu) return;
  window.__qutaiContextMenu = true;

  var style = document.createElement('style');
  style.textContent = 'a, img { -webkit-touch-callout: none; }';
  (document.head || document.documentElement).appendChild(style);

  function describe(el) {
    if (!el || !el.closest) return null;
    var link = el.closest('a[href]');
    var img = el.closest('img');
    var src = img ? (img.currentSrc || img.src || '') : '';
    if (src.indexOf('data:') === 0 && src.length > 200000) src = '';
    if (!link && !src) return null;
    return {
      href: link ? link.href : '',
      linkText: link ? (link.innerText || '').trim().slice(0, 200) : '',
      src: src,
      alt: img ? (img.alt || '').slice(0, 200) : ''
    };
  }

  var timer = null, pending = null, startX = 0, startY = 0, fired = false, lastScroll = 0;
  function cancel() { clearTimeout(timer); timer = null; pending = null; }
  function open() {
    var target = pending;
    cancel();
    if (!target || fired) return;
    fired = true;
    target.__qutaiContextMenu = true;
    window.ReactNativeWebView.postMessage(JSON.stringify(target));
  }

  document.addEventListener('touchstart', function (e) {
    cancel();
    fired = false;
    if (e.touches.length !== 1) return;
    if (Date.now() - lastScroll < ${FLING_MS}) return;
    var target = describe(e.target);
    if (!target) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pending = target;
    timer = setTimeout(open, ${LONG_PRESS_MS});
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (t && (Math.abs(t.clientX - startX) > ${MOVE_TOLERANCE_PX} || Math.abs(t.clientY - startY) > ${MOVE_TOLERANCE_PX})) cancel();
  }, { capture: true, passive: true });

  // Scroll events don't bubble: the capture phase on document sees inner scroll areas too.
  document.addEventListener('scroll', function () { lastScroll = Date.now(); cancel(); }, { capture: true, passive: true });
  document.addEventListener('touchcancel', cancel, { capture: true, passive: true });
  document.addEventListener('pointercancel', cancel, { capture: true, passive: true });

  document.addEventListener('touchend', function (e) {
    cancel();
    if (fired) { e.preventDefault(); fired = false; }
  }, { capture: true });

  // Android reports long presses as contextmenu; the app's menu replaces the default one.
  document.addEventListener('contextmenu', function (e) {
    if (!describe(e.target)) return;
    e.preventDefault();
    if (pending) open();
  }, true);
})(); true;`;

const isWeb = (url: string) => /^https?:\/\//i.test(url);

/**
 * Validates a long-press message. Pages can post anything, so only well-formed targets with
 * web links or web/data images are accepted.
 */
export function parseContextTarget(data: string): ContextTarget | null {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(wellFormedJsonText(data));
  } catch {
    return null;
  }
  if (!msg || msg.__qutaiContextMenu !== true) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? cutText(v, max) : '');
  const href = str(msg.href, 4000);
  const src = str(msg.src, 200000);
  const target = {
    href: isWeb(href) ? href : '',
    linkText: str(msg.linkText, 200),
    src: isWeb(src) || /^data:image\//i.test(src) ? src : '',
    alt: str(msg.alt, 200),
  };
  return target.href || target.src ? target : null;
}

/** A link that most likely leads to a PDF: its path ends in .pdf, or its text says PDF. */
export function looksLikePdfLink(href: string, linkText = ''): boolean {
  if (!isWeb(href)) return false;
  let path = '';
  try {
    path = decodeURIComponent(new URL(href).pathname);
  } catch {
    path = href.split(/[?#]/)[0];
  }
  return /\.pdf$/i.test(path) || /\bpdf\b/i.test(linkText);
}
