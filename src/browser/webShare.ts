/**
 * Web Share (`navigator.share`) for pages on Android, whose WebView doesn't have it (iOS's WKWebView has its own and
 * keeps it: the script defines nothing where the page already has one). A site's own Share button then opens the
 * system share sheet, as in Chrome.
 *
 * - Main frame only (frames keep no navigator.share), only during a user activation (the page script checks
 *   `navigator.userActivation`; the app also requires a touch on the page in the last few seconds), one share at a
 *   time, title, text and an http(s) address only (no files: `canShare` says no for them).
 * - Nothing leaves the phone by itself: the system share sheet opens and the user picks where it goes, or cancels.
 *
 * Plain ES5 in a string, like the page script; installed at document start (documentStartScript), before the page's
 * own scripts look for navigator.share.
 */

/** Longest title, text and address passed on (Chrome's own limit on the address is longer; enough for a share). */
export const SHARE_LIMITS = { title: 1000, text: 20000, url: 8192 };

export type ShareRequest = { id: string; title: string; text: string; url: string };

export function webShareScript(nonce: string): string {
  return String.raw`(function () {
  if (window.top !== window) return;
  var nav = window.navigator;
  if (!nav || 'share' in nav) return;
  var NONCE = ${JSON.stringify(nonce)};
  var DONE = '__qutaiShareDone_' + NONCE;
  if (DONE in window) return;
  var bridge = window.ReactNativeWebView;
  var post = bridge && bridge.postMessage;
  var stringify = JSON.stringify;
  var P = window.Promise;
  var DOMEx = window.DOMException;
  var pending = null;
  var next = 1;
  function error(name, message) {
    try { return new DOMEx(message, name); } catch (e) { var err = new Error(message); err.name = name; return err; }
  }
  // The share data as the spec reads it: strings, the address resolved against the page and only http(s).
  function read(data) {
    if (data === undefined || data === null) data = {};
    if (typeof data !== 'object') throw new TypeError('Invalid share data');
    if (data.files !== undefined && data.files !== null && data.files.length) return null;
    var title = data.title === undefined ? '' : String(data.title);
    var text = data.text === undefined ? '' : String(data.text);
    var url = '';
    if (data.url !== undefined) {
      var u;
      try { u = new URL(String(data.url), document.baseURI); } catch (e) { throw new TypeError('Invalid URL'); }
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new TypeError('Invalid URL');
      url = u.href;
    }
    if (!title && !text && !url) throw new TypeError('Nothing to share');
    return { title: title, text: text, url: url };
  }
  function share(data) {
    return new P(function (resolve, reject) {
      var d;
      try { d = read(data); } catch (e) { reject(e); return; }
      if (!d) { reject(error('NotAllowedError', 'Sharing files is not supported')); return; }
      var active = false;
      try { active = !!(nav.userActivation && nav.userActivation.isActive); } catch (e) {}
      if (!active) { reject(error('NotAllowedError', 'Must be handling a user gesture to perform a share request.')); return; }
      if (pending) { reject(error('InvalidStateError', 'An earlier share has not yet completed.')); return; }
      if (!post) { reject(error('AbortError', 'Share canceled')); return; }
      var id = String(next++);
      pending = { id: id, resolve: resolve, reject: reject };
      try {
        post.call(bridge, stringify({ __qutaiShare: NONCE, id: id, title: d.title, text: d.text, url: d.url }));
      } catch (e) {
        pending = null;
        reject(error('AbortError', 'Share canceled'));
      }
    });
  }
  function canShare(data) {
    try { return !!read(data); } catch (e) { return false; }
  }
  try {
    Object.defineProperty(window, DONE, {
      value: function (id, ok) {
        if (!pending || pending.id !== id) return;
        var p = pending;
        pending = null;
        if (ok === true) p.resolve(undefined);
        else p.reject(error('AbortError', 'Share canceled'));
      },
      writable: false, enumerable: false, configurable: false,
    });
    var proto = Object.getPrototypeOf(nav);
    Object.defineProperty(proto, 'share', { value: share, writable: true, enumerable: true, configurable: true });
    Object.defineProperty(proto, 'canShare', { value: canShare, writable: true, enumerable: true, configurable: true });
  } catch (e) {}
})();
`;
}

/** The page's share request, if `data` is one from this tab's script; null otherwise (also for anything malformed). */
export function parseShareMessage(data: string, nonce: string): ShareRequest | null {
  if (!data.startsWith('{"__qutaiShare"')) return null;
  let msg: unknown;
  try {
    msg = JSON.parse(data);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.__qutaiShare !== nonce || typeof m.id !== 'string' || !/^\d{1,9}$/.test(m.id)) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const title = str(m.title, SHARE_LIMITS.title).trim();
  const text = str(m.text, SHARE_LIMITS.text).trim();
  let url = '';
  if (typeof m.url === 'string' && m.url) {
    if (m.url.length > SHARE_LIMITS.url) return null;
    let parsed: URL;
    try {
      parsed = new URL(m.url);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    url = parsed.href;
  }
  if (!title && !text && !url) return null;
  return { id: m.id, title, text, url };
}

/** What the system share sheet gets: Android reads only the message, so the text and the address go there together. */
export function shareContent(req: ShareRequest): { title?: string; message: string } {
  const message = [req.text, req.url].filter(Boolean).join('\n') || req.title;
  return req.title ? { title: req.title, message } : { message };
}

/** The script that tells the page how its share ended (resolves or rejects its promise). */
export function shareDoneScript(nonce: string, id: string, ok: boolean): string {
  const fn = JSON.stringify(`__qutaiShareDone_${nonce}`);
  return `(function () { var f = window[${fn}]; if (typeof f === 'function') f(${JSON.stringify(id)}, ${ok}); })(); true;`;
}
