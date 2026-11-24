/**
 * Plain-text documents (a JSON answer, a .txt or .csv file) have no style of their own. In dark theme the browser draws
 * their text in the dark scheme's light colour while the page stays on the web view's white background, so the text
 * was white on white (UI-69). For those documents only, the page gets the scheme's own background and text colours
 * (`Canvas` / `CanvasText`), which follow Qutai's theme like any page's `prefers-color-scheme`.
 */

/** Content types shown as plain text by the web view. */
const PLAIN_TEXT = /^(text\/plain|text\/csv|application\/json|application\/[\w.+-]+\+json|application\/x-ndjson)$/i;

/** Whether a document with this content type is one the browser shows as plain text. */
export function isPlainTextType(type: string | null | undefined): boolean {
  return !!type && PLAIN_TEXT.test(type.split(';')[0].trim());
}

export const PLAIN_TEXT_THEME_SCRIPT = `(function () {
  if (window.top !== window || window.__qutaiPlainText) return;
  window.__qutaiPlainText = true;
  if (!${PLAIN_TEXT}.test(String(document.contentType || '').split(';')[0].trim())) return;
  var style = document.createElement('style');
  style.textContent = ':root { color-scheme: light dark; background: Canvas; color: CanvasText; }';
  (document.head || document.documentElement).appendChild(style);
})(); true;`;
