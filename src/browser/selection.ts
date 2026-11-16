import { cutText, wellFormedJsonText } from '../utils/wellFormed';

/** Longest selection handed to the assistant; longer selections are cut. */
export const MAX_SELECTION_CHARS = 4000;

/**
 * Reports the page's text selection to the app (debounced, and an empty string once it is
 * cleared), so the app can offer "Ask Qutai" for the selected text.
 */
export const SELECTION_SCRIPT = `(function () {
  if (window.__qutaiSelection) return;
  window.__qutaiSelection = true;
  var timer = null, last = '';
  document.addEventListener('selectionchange', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? String(sel).trim() : '';
      // Cut on a code point boundary: half an emoji at the end would make the provider refuse the conversation.
      if (text.length > ${MAX_SELECTION_CHARS}) {
        var hi = text.charCodeAt(${MAX_SELECTION_CHARS - 1});
        text = text.slice(0, hi >= 0xd800 && hi <= 0xdbff ? ${MAX_SELECTION_CHARS - 1} : ${MAX_SELECTION_CHARS});
      }
      if (text === last) return;
      last = text;
      window.ReactNativeWebView.postMessage(JSON.stringify({ __qutaiSelection: true, text: text }));
    }, 300);
  });
})(); true;`;

/** Returns the selected text from a selection message (possibly ""), or null for other messages. */
export function parseSelection(data: string): string | null {
  let msg: { __qutaiSelection?: unknown; text?: unknown };
  try {
    msg = JSON.parse(wellFormedJsonText(data));
  } catch {
    return null;
  }
  if (!msg || msg.__qutaiSelection !== true || typeof msg.text !== 'string') return null;
  return cutText(msg.text.trim(), MAX_SELECTION_CHARS);
}

/** Wraps selected page text as a quote for a chat message. */
export function quoteSelection(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}
