/**
 * Page commands for the assistant's try_hide tool, added to the page script's commands (browser/pageScript.ts) by
 * the installer (browser/agentScript.ts), once per document. Plain ES5 in a string, like the page script.
 *
 * - hideFind(): boxes that take room on the page but show nothing (no text, image, video or canvas of their own
 *   size) or hold an ad frame, with a suggested selector each: what an empty gap left by blocked ads looks like.
 * - hideMeasure(selectors): for each selector, whether the page can parse it, how many elements it matches and what
 *   share of the page's area (boxes with text only) and of its visible text they cover; nothing changes on the page.
 * - hideTry(selectors): measures, then hides the parseable ones with a stylesheet of its own (replacing an earlier
 *   try) and reports the page height before and after.
 * - hideUndo(): removes the tried stylesheet.
 */
export const HIDE_PROBE_SCRIPT = String.raw`
(function () {
  var agent = __qutaiAgent;
  if (!agent || agent.hideTry) return;
  var AD_WORDS = /(^|[^a-z])(ad|ads|adv|advert|advertisement|banner|sponsor|sponsored|reklam|dfp|gpt|adsense|adslot|ad-slot|ad_slot)([^a-z]|$)/i;
  var GENERATED = /^(css|sc|jsx|emotion|styled)-|[a-z]+-[a-z0-9]{5,}$|^_[a-z0-9]{5,}$|\d{3,}/i;

  function pageSize() {
    var doc = document.documentElement;
    var body = document.body;
    var w = Math.max(doc ? doc.scrollWidth : 0, body ? body.scrollWidth : 0, window.innerWidth || 0);
    var h = Math.max(doc ? doc.scrollHeight : 0, body ? body.scrollHeight : 0, window.innerHeight || 0);
    return { w: w, h: h };
  }
  function shown(el) {
    if (!el.getClientRects().length) return false;
    var style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }
  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  }
  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
  // A selector for an element that is likely to survive the next page load: a readable id, readable classes, an
  // ad attribute, else the same with its parent's.
  function selectorFor(el) {
    var parts = [];
    var node = el;
    for (var depth = 0; node && node.nodeType === 1 && depth < 3; depth++) {
      var tag = node.tagName.toLowerCase();
      if (tag === 'body' || tag === 'html') break;
      if (node.id && !GENERATED.test(node.id)) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }
      var classes = [];
      for (var i = 0; i < node.classList.length && classes.length < 2; i++) {
        var c = node.classList[i];
        if (!GENERATED.test(c)) classes.push('.' + cssEscape(c));
      }
      if (classes.length) { parts.unshift(tag + classes.join('')); break; }
      var attrs = ['data-ad', 'data-ad-slot', 'data-adunit', 'data-google-query-id', 'data-zone', 'data-slot', 'aria-label', 'role'];
      var attr = null;
      for (var j = 0; j < attrs.length; j++) {
        var v = node.getAttribute(attrs[j]);
        if (v !== null && v.length < 60) { attr = '[' + attrs[j] + (v ? '="' + v.replace(/"/g, '\\"') + '"' : '') + ']'; break; }
      }
      if (attr) { parts.unshift(tag + attr); break; }
      parts.unshift(tag);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }
  function hasContent(el) {
    if ((el.innerText || '').replace(/\s+/g, '').length > 2) return true;
    var media = el.querySelectorAll('img, video, canvas, svg, picture, input, button, select, textarea');
    for (var i = 0; i < media.length; i++) {
      var r = media[i].getBoundingClientRect();
      if (r.width > 24 && r.height > 24) return true;
    }
    return false;
  }
  function adHint(el) {
    var s = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '');
    var attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) if (/^data-(ad|google|zone|slot)/i.test(attrs[i].name)) return true;
    return AD_WORDS.test(s.replace(/([a-z])([A-Z])/g, '$1-$2'));
  }
  function hideFind() {
    var vw = window.innerWidth || 360;
    var out = [];
    var seen = [];
    var all = document.body ? document.body.querySelectorAll('div, section, aside, ins, iframe, span, li, figure') : [];
    for (var i = 0; i < all.length && out.length < 15; i++) {
      var el = all[i];
      var r = el.getBoundingClientRect();
      if (r.height < 30 || r.width < vw * 0.3) continue;
      if (!shown(el)) continue;
      var frame = el.tagName === 'IFRAME' || el.tagName === 'INS';
      var ad = adHint(el);
      if (!frame && hasContent(el)) continue;
      if (!frame && !ad && r.height < 60) continue;
      // Only the outermost box of a nested empty stack.
      var inside = false;
      for (var k = 0; k < seen.length; k++) if (seen[k].contains(el)) { inside = true; break; }
      if (inside) continue;
      seen.push(el);
      var box = rectOf(el);
      out.push({
        selector: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        width: Math.round(box.w),
        height: Math.round(box.h),
        top: Math.round(box.y),
        adLike: ad || frame,
        frameSrc: el.tagName === 'IFRAME' ? String(el.src || '').slice(0, 120) : undefined
      });
    }
    return { page: pageSize(), boxes: out };
  }
  function measure(selectors) {
    var size = pageSize();
    var pageArea = Math.max(1, size.w * size.h);
    var bodyText = document.body ? (document.body.innerText || '').replace(/\s+/g, '').length : 0;
    var results = [];
    for (var i = 0; i < selectors.length; i++) {
      var sel = String(selectors[i]);
      var list;
      try { list = document.querySelectorAll(sel); } catch (e) {
        results.push({ selector: sel, invalid: true, count: 0, visible: 0, area: 0, text: 0 });
        continue;
      }
      var top = [];
      for (var j = 0; j < list.length; j++) {
        var nested = false;
        for (var k = 0; k < top.length; k++) if (top[k].contains(list[j])) { nested = true; break; }
        if (!nested) top.push(list[j]);
      }
      var area = 0, text = 0, visible = 0;
      for (var m = 0; m < top.length; m++) {
        if (!shown(top[m])) continue;
        visible++;
        var r = top[m].getBoundingClientRect();
        var chars = (top[m].innerText || '').replace(/\s+/g, '').length;
        text += chars;
        // Only boxes with text in them count: an empty box (the gap an ad leaves) takes nothing from the page.
        if (chars > 2) area += Math.max(0, Math.min(r.width, size.w)) * Math.max(0, r.height);
      }
      results.push({
        selector: sel,
        count: list.length,
        visible: visible,
        area: Math.min(1, area / pageArea),
        text: bodyText ? Math.min(1, text / bodyText) : 0
      });
    }
    return results;
  }
  function hideMeasure(selectors) {
    return { page: pageSize(), results: measure(selectors || []) };
  }
  function tryStyle() {
    var el = document.getElementById('__qutai-hide-try');
    if (!el) {
      el = document.createElement('style');
      el.id = '__qutai-hide-try';
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }
  // The content's own height (the page size is at least the window, so a short page would not show the change).
  function contentHeight() {
    return document.body ? Math.round(document.body.getBoundingClientRect().height) : 0;
  }
  function hideTry(selectors) {
    // An earlier try is shown again first, so it neither hides these matches nor the page height before.
    tryStyle().textContent = '';
    var before = contentHeight();
    var results = measure(selectors || []);
    var css = '';
    for (var i = 0; i < results.length; i++) {
      if (!results[i].invalid) css += results[i].selector + '{display:none!important}\n';
    }
    tryStyle().textContent = css;
    return { heightBefore: before, heightAfter: contentHeight(), results: results };
  }
  function hideUndo() {
    var el = document.getElementById('__qutai-hide-try');
    var had = !!(el && el.textContent);
    if (el) el.parentNode.removeChild(el);
    return { removed: had };
  }
  agent.hideFind = hideFind;
  agent.hideMeasure = hideMeasure;
  agent.hideTry = hideTry;
  agent.hideUndo = hideUndo;
})();
`;
