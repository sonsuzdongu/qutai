/** Longest selection handed to the assistant; longer selections are cut. */
export const MAX_SELECTION_CHARS = 4000;

/**
 * Reports the page's text selection to the app (debounced, and an empty string once it is
 * cleared), so the app can offer "Ask ALPAI" for the selected text.
 */
export const SELECTION_SCRIPT = `(function () {
  if (window.__alpaiSelection) return;
  window.__alpaiSelection = true;
  var timer = null, last = '';
  document.addEventListener('selectionchange', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? String(sel).trim().slice(0, ${MAX_SELECTION_CHARS}) : '';
      if (text === last) return;
      last = text;
      window.ReactNativeWebView.postMessage(JSON.stringify({ __alpaiSelection: true, text: text }));
    }, 300);
  });
})(); true;`;

/** Returns the selected text from a selection message (possibly ""), or null for other messages. */
export function parseSelection(data: string): string | null {
  let msg: { __alpaiSelection?: unknown; text?: unknown };
  try {
    msg = JSON.parse(data);
  } catch {
    return null;
  }
  if (!msg || msg.__alpaiSelection !== true || typeof msg.text !== 'string') return null;
  return msg.text.trim().slice(0, MAX_SELECTION_CHARS);
}

/** Wraps selected page text as a quote for a chat message. */
export function quoteSelection(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}
