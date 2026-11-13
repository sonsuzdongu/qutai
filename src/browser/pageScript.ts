/**
 * JavaScript injected into the web page. It must stay plain ES5-compatible
 * source in a string: Hermes compiles functions to bytecode, so we cannot use
 * Function.prototype.toString() to ship code into the WebView.
 *
 * Exposes window.__alpaiAgent with: readPage, click, type, select, scroll, scrollTo.
 * Elements are addressed by numeric refs assigned during readPage.
 */
export const PAGE_SCRIPT = String.raw`
(function () {
  if (window.__alpaiAgent) return;

  var MAX_CHARS = 20000;
  var INTERACTIVE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
    '[role=button]', '[role=link]', '[role=checkbox]', '[role=radio]', '[role=tab]',
    '[role=menuitem]', '[role=option]', '[role=switch]', '[role=combobox]', '[role=textbox]',
    '[contenteditable=""]', '[contenteditable=true]', '[onclick]', '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, svg: 1, CANVAS: 1, HEAD: 1, META: 1, LINK: 1 };

  var nextRef = 1;
  var refToEl = new Map();
  var elToRef = new WeakMap();

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function getRef(el) {
    var r = elToRef.get(el);
    if (r && refToEl.get(r) === el) return r;
    r = nextRef++;
    elToRef.set(el, r);
    refToEl.set(r, el);
    return r;
  }

  function getEl(ref) {
    var el = refToEl.get(Number(ref));
    if (!el || !el.isConnected) {
      throw new Error('Element ref=' + ref + ' not found (page changed?). Call read_page again.');
    }
    return el;
  }

  function hasBox(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function labelOf(el) {
    var t = el.getAttribute('aria-label') || '';
    if (!t) {
      var lb = el.getAttribute('aria-labelledby');
      if (lb) {
        var parts = lb.split(/\s+/).map(function (id) {
          var n = document.getElementById(id); return n ? n.innerText : '';
        });
        t = parts.join(' ');
      }
    }
    var tag = el.tagName;
    if (!t && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) {
      if (el.id) {
        try {
          var l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
          if (l) t = l.innerText;
        } catch (e) {}
      }
      if (!t && el.closest('label')) t = el.closest('label').innerText;
      if (!t) t = el.getAttribute('placeholder') || el.getAttribute('name') || '';
    }
    if (!t && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') t = el.innerText || '';
    if (!t && tag === 'INPUT' && (el.type === 'submit' || el.type === 'button')) t = el.value;
    if (!t) t = el.getAttribute('title') || el.getAttribute('alt') || '';
    if (!t && el.querySelector) {
      var img = el.querySelector('img[alt],[aria-label]');
      if (img) t = img.getAttribute('alt') || img.getAttribute('aria-label') || '';
    }
    return clean(t).slice(0, 80);
  }

  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var kind = el.getAttribute('role') || tag;
    if (tag === 'input') kind = 'input:' + (el.type || 'text').toLowerCase();
    var parts = ['[ref=' + getRef(el) + ']', kind];
    var label = labelOf(el);
    if (label) parts.push('"' + label.replace(/"/g, "'") + '"');

    if (tag === 'input' || tag === 'textarea') {
      var type = (el.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') parts.push(el.checked ? '(checked)' : '(unchecked)');
      else if (type === 'password') { if (el.value) parts.push('(filled)'); }
      else if (el.value) parts.push('value="' + clean(el.value).slice(0, 60) + '"');
    } else if (tag === 'select') {
      var opts = [];
      for (var i = 0; i < el.options.length && i < 25; i++) opts.push(clean(el.options[i].text));
      parts.push('selected="' + clean(el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '') + '"');
      parts.push('options=[' + opts.join(' | ') + (el.options.length > 25 ? ' | ...' : '') + ']');
    } else if (tag === 'a') {
      var href = el.getAttribute('href') || '';
      if (href && href.indexOf('javascript:') !== 0) parts.push('href=' + href.slice(0, 100));
    }
    var expanded = el.getAttribute('aria-expanded');
    if (expanded) parts.push('(expanded=' + expanded + ')');
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') parts.push('(disabled)');
    return parts.join(' ');
  }

  function readPage(offset) {
    offset = Math.max(0, Number(offset) || 0);
    var lines = [];
    var lineIndex = 0;
    var cur = '';
    var total = 0;
    var truncated = false;

    function flush() {
      var t = clean(cur);
      cur = '';
      if (t) push(t);
    }
    function push(line) {
      if (truncated) return;
      if (lineIndex++ < offset) return;
      if (total + line.length > MAX_CHARS) {
        truncated = true;
        // A single oversized line is cut instead of stalling pagination forever.
        if (lines.length === 0) lines.push(line.slice(0, MAX_CHARS));
        else lineIndex--;
        return;
      }
      total += line.length + 1;
      lines.push(line);
    }

    function walkChildren(node) {
      var c = node.firstChild;
      while (c && !truncated) { walk(c); c = c.nextSibling; }
      if (node.shadowRoot) walkChildren(node.shadowRoot);
    }

    function walk(node) {
      if (truncated) return;
      if (node.nodeType === 3) { cur += ' ' + node.textContent; return; }
      if (node.nodeType === 11) { walkChildren(node); return; }
      if (node.nodeType !== 1) return;
      var el = node;
      var tag = el.tagName;
      if (SKIP[tag]) return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      var st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') return;

      if (tag === 'IFRAME') {
        try {
          var doc = el.contentDocument;
          if (doc && doc.body) { flush(); walk(doc.body); flush(); }
        } catch (e) {}
        return;
      }

      var isBlock = st.display.indexOf('inline') !== 0 && st.display !== 'contents';

      if (/^H[1-6]$/.test(tag)) {
        flush();
        var h = clean(el.innerText);
        if (h) push(new Array(Number(tag[1]) + 1).join('#') + ' ' + h);
        if (!el.querySelector(INTERACTIVE)) return;
      }

      if (tag !== 'BODY' && tag !== 'HTML' && el.matches(INTERACTIVE)) {
        if (hasBox(el) || tag === 'INPUT' || tag === 'SELECT') {
          flush();
          push(describe(el));
        }
        if (!el.querySelector(INTERACTIVE)) return;
        walkChildren(el);
        return;
      }

      if (isBlock) flush();
      walkChildren(el);
      if (isBlock) flush();
    }

    walk(document.body || document.documentElement);
    flush();

    var se = document.scrollingElement || document.documentElement;
    return {
      url: location.href,
      title: document.title,
      scroll: {
        y: Math.round(se.scrollTop),
        viewportHeight: window.innerHeight,
        pageHeight: se.scrollHeight
      },
      truncated: truncated,
      nextOffset: truncated ? lineIndex : null,
      content: lines.join('\n')
    };
  }

  function fireMouse(el) {
    var r = el.getBoundingClientRect();
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mouseup', opts));
  }

  function click(ref) {
    var el = getEl(ref);
    el.scrollIntoView({ block: 'center', inline: 'center' });
    var desc = describe(el);
    fireMouse(el);
    if (typeof el.focus === 'function') el.focus();
    el.click();
    return 'Clicked ' + desc;
  }

  function type(ref, text, clear, submit) {
    var el = getEl(ref);
    el.scrollIntoView({ block: 'center' });
    el.focus();
    if (el.isContentEditable) {
      if (clear) document.execCommand('selectAll', false);
      document.execCommand('insertText', false, text);
    } else {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      var next = clear ? text : (el.value || '') + text;
      // Use the native setter so frameworks like React notice the change.
      if (desc && desc.set) desc.set.call(el, next); else el.value = next;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (submit) {
      var kopts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      var down = new KeyboardEvent('keydown', kopts);
      var notCancelled = el.dispatchEvent(down);
      el.dispatchEvent(new KeyboardEvent('keypress', kopts));
      el.dispatchEvent(new KeyboardEvent('keyup', kopts));
      if (notCancelled && el.form) {
        if (typeof el.form.requestSubmit === 'function') el.form.requestSubmit();
        else el.form.submit();
      }
    }
    return 'Typed into ' + describe(el) + (submit ? ' and submitted' : '');
  }

  function select(ref, value) {
    var el = getEl(ref);
    if (el.tagName !== 'SELECT') throw new Error('ref=' + ref + ' is not a <select>. Use click instead.');
    var wanted = clean(value).toLowerCase();
    for (var i = 0; i < el.options.length; i++) {
      var o = el.options[i];
      if (o.value === value || clean(o.text).toLowerCase() === wanted) {
        el.selectedIndex = i;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return 'Selected "' + clean(o.text) + '"';
      }
    }
    throw new Error('Option "' + value + '" not found.');
  }

  function scroll(direction, amount) {
    var dy = window.innerHeight * 0.8 * (amount || 1);
    if (direction === 'up') dy = -dy;
    if (direction === 'top') window.scrollTo(0, 0);
    else if (direction === 'bottom') window.scrollTo(0, (document.scrollingElement || document.documentElement).scrollHeight);
    else window.scrollBy(0, dy);
    var se = document.scrollingElement || document.documentElement;
    return 'Scrolled. y=' + Math.round(se.scrollTop) + ' / pageHeight=' + se.scrollHeight;
  }

  function scrollTo(ref) {
    var el = getEl(ref);
    el.scrollIntoView({ block: 'center' });
    return 'Scrolled to ' + describe(el);
  }

  window.__alpaiAgent = {
    readPage: readPage,
    click: click,
    type: type,
    select: select,
    scroll: scroll,
    scrollTo: scrollTo
  };
})();
`;
