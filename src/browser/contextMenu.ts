/** What was long-pressed on the page. */
export type ContextTarget = { href: string; linkText: string; src: string; alt: string };

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Detects long presses on links and images and reports them to the app, which shows its own
 * menu. Moving the finger cancels it, so scrolling never opens the menu. iOS's built-in
 * callout is turned off for links and images; the click that follows a long press is swallowed.
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

  var timer = null, startX = 0, startY = 0, fired = false;
  document.addEventListener('touchstart', function (e) {
    clearTimeout(timer);
    fired = false;
    if (e.touches.length !== 1) return;
    var target = describe(e.target);
    if (!target) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    timer = setTimeout(function () {
      fired = true;
      target.__qutaiContextMenu = true;
      window.ReactNativeWebView.postMessage(JSON.stringify(target));
    }, ${LONG_PRESS_MS});
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (t && (Math.abs(t.clientX - startX) > ${MOVE_TOLERANCE_PX} || Math.abs(t.clientY - startY) > ${MOVE_TOLERANCE_PX})) clearTimeout(timer);
  }, { capture: true, passive: true });

  document.addEventListener('touchend', function (e) {
    clearTimeout(timer);
    if (fired) { e.preventDefault(); fired = false; }
  }, { capture: true });

  // Android reports long presses as contextmenu; the app's menu replaces the default one.
  document.addEventListener('contextmenu', function (e) {
    if (describe(e.target)) e.preventDefault();
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
    msg = JSON.parse(data);
  } catch {
    return null;
  }
  if (!msg || msg.__qutaiContextMenu !== true) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
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
