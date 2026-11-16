/**
 * JavaScript injected into the web page. It must stay plain ES5-compatible
 * source in a string: Hermes compiles functions to bytecode, so we cannot use
 * Function.prototype.toString() to ship code into the WebView.
 *
 * Exposes window.__qutaiAgent with: readPage, readSource, click, type, select, scroll, scrollTo, and the
 * snapshot, read-aloud, reader mode, find in page and capture helpers listed at the end.
 * Elements are addressed by numeric refs assigned during readPage.
 */
export const PAGE_SCRIPT = String.raw`
(function () {
  if (window.__qutaiAgent) return;

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

  // Text for the model must be well-formed UTF-16 (src/utils/wellFormed.ts, which this page can't import): a lone
  // half of a surrogate pair becomes U+FFFD, and a cut never splits a pair (an emoji in a product title at the cut
  // made the provider refuse the whole conversation). Plain regexes without the u flag: old WebViews too.
  var PAIR_OR_LONE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;
  function wf(s) {
    s = String(s == null ? '' : s);
    return /[\uD800-\uDFFF]/.test(s) ? s.replace(PAIR_OR_LONE, function (m) { return m.length === 2 ? m : '\uFFFD'; }) : s;
  }
  // The index moved back off the middle of a surrogate pair.
  function pairBoundary(s, at) {
    var hi = s.charCodeAt(at - 1), lo = s.charCodeAt(at);
    return at > 0 && at < s.length && hi >= 0xD800 && hi <= 0xDBFF && lo >= 0xDC00 && lo <= 0xDFFF ? at - 1 : at;
  }
  function cut(s, n) {
    s = String(s == null ? '' : s);
    return s.length <= n ? s : s.slice(0, pairBoundary(s, n));
  }
  // Control characters (NUL and the like) carry nothing the model can read: dropped.
  function clean(s) {
    return wf(String(s == null ? '' : s).replace(/[\u0000-\u0008\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim());
  }

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
    // The element's own document: fields in same-origin frames have their labels there.
    var doc = el.ownerDocument || document;
    var t = el.getAttribute('aria-label') || '';
    if (!t) {
      var lb = el.getAttribute('aria-labelledby');
      if (lb) {
        var parts = lb.split(/\s+/).map(function (id) {
          var n = doc.getElementById(id); return n ? n.innerText : '';
        });
        t = parts.join(' ');
      }
    }
    var tag = el.tagName;
    if (!t && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) {
      if (el.id) {
        try {
          var l = doc.querySelector('label[for="' + CSS.escape(el.id) + '"]');
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
    return cut(clean(t), 80);
  }

  // ---------- Form state (required, constraints, validation errors) ----------

  // Fields the agent typed into or selected, and forms with a submit attempt: like browsers, an empty required
  // field is only an error after one of those (or the user's own interaction, :user-invalid).
  var touched = new WeakSet();
  var attempted = new WeakSet();
  document.addEventListener('invalid', function (e) {
    var t = e.target;
    if (t && t.nodeType === 1) { touched.add(t); if (t.form) attempted.add(t.form); }
  }, true);
  document.addEventListener('submit', function (e) { if (e.target) attempted.add(e.target); }, true);

  var FIELDS = 'input:not([type=hidden]),select,textarea';
  var ERROR_CLASS = /(^|[\s_-])(errors?|invalid|danger)([\s_-]|$)/i;

  function classOf(el) { return el.getAttribute('class') || ''; }

  function rendered(el) {
    return el.getClientRects().length > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  }

  function textOfIds(ids, errorOnly) {
    if (!ids) return '';
    var out = [];
    ids.split(/\s+/).forEach(function (id) {
      var n = id && document.getElementById(id);
      if (!n || !rendered(n)) return;
      if (errorOnly && !(n.getAttribute('role') === 'alert' || n.getAttribute('aria-live') === 'assertive' ||
        ERROR_CLASS.test(classOf(n)))) return;
      var t = clean(n.innerText);
      if (t) out.push(t);
    });
    return out.join(' ');
  }

  // A visible error message next to the field (role=alert or an error-like class), within the field's own wrapper.
  function errorTextNear(el) {
    var scope = el.parentElement;
    for (var depth = 0; scope && depth < 3; depth++, scope = scope.parentElement) {
      if (scope === document.body || scope.tagName === 'FORM') break;
      var fields = scope.querySelectorAll(FIELDS);
      var others = 0;
      for (var i = 0; i < fields.length; i++) {
        if (fields[i] !== el && !(el.name && fields[i].name === el.name)) others++;
      }
      if (others > 0) break;
      var cands = scope.querySelectorAll('[role=alert],[aria-live=assertive],[class]');
      for (var j = 0; j < cands.length; j++) {
        var c = cands[j];
        if (c.contains(el) || c.querySelector(FIELDS)) continue;
        if (!(c.getAttribute('role') === 'alert' || c.getAttribute('aria-live') === 'assertive' ||
          ERROR_CLASS.test(classOf(c)))) continue;
        var t = clean(c.innerText);
        if (t && t.length <= 200 && rendered(c)) return t;
      }
    }
    return '';
  }

  function userInvalid(el) {
    try { return el.matches(':user-invalid'); } catch (e) { return false; }
  }

  // Null when the field shows no error; otherwise the reason (may be empty).
  function fieldError(el) {
    if (el.disabled || (el.type || '').toLowerCase() === 'hidden') return null;
    var aria = el.getAttribute('aria-invalid');
    var native = !!(el.willValidate && el.validity && !el.validity.valid &&
      (touched.has(el) || (el.form && attempted.has(el.form)) || userInvalid(el)));
    var flagged = aria === 'true' || native;
    var near = '';
    if (aria !== 'false') {
      if (!flagged) flagged = ERROR_CLASS.test(classOf(el));
      near = errorTextNear(el);
      if (near) flagged = true;
    }
    if (!flagged) return null;
    var reason = textOfIds(el.getAttribute('aria-errormessage'), false) ||
      textOfIds(el.getAttribute('aria-describedby'), true) || near ||
      (el.validity && !el.validity.valid ? el.validationMessage : '');
    return cut(clean(reason), 120);
  }

  var SIZE_HINT = /(\d+([.,]\d+)?\s*(kb|mb|gb|bytes?|px|pixels?|piksel)\b|\d+\s*[x×]\s*\d+)/i;

  // What a file input's help text says about allowed sizes or dimensions (the label is shown already).
  function fileHint(el) {
    var label = labelOf(el);
    if (SIZE_HINT.test(label)) return '';
    var texts = [textOfIds(el.getAttribute('aria-describedby'), false)];
    if (el.parentElement) texts.push(cut(clean(el.parentElement.innerText), 300));
    for (var i = 0; i < texts.length; i++) {
      var m = SIZE_HINT.exec(texts[i] || '');
      if (!m) continue;
      var start = Math.max(0, texts[i].lastIndexOf('.', m.index) + 1);
      var hint = cut(clean(texts[i].slice(start, m.index + m[0].length + 30).split(/[.;]\s/)[0]), 80);
      if (hint && label.indexOf(hint) < 0) return hint;
    }
    return '';
  }

  // Compact form state for a field; empty for elements that are not form fields.
  function formNotes(el, tag) {
    var notes = [];
    var isField = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (!isField && !el.hasAttribute('aria-invalid') && !el.hasAttribute('aria-required')) return notes;
    if (el.required || el.getAttribute('aria-required') === 'true') notes.push('(required)');
    if (isField && tag !== 'select') {
      var type = (el.type || '').toLowerCase();
      var min = el.getAttribute('minlength');
      var max = Number(el.getAttribute('maxlength')) > 0 ? el.getAttribute('maxlength') : '';
      if ((min || max) && /^(text|search|url|tel|email|password|)$/.test(tag === 'textarea' ? '' : type)) {
        notes.push('(length ' + String(el.value || '').length + (min ? ', min ' + min : '') + (max ? ', max ' + max : '') + ')');
      }
      var pattern = el.getAttribute('pattern');
      if (pattern) {
        notes.push('pattern=/' + cut(pattern, 60) + '/');
        if (el.title) notes.push('format="' + cut(clean(el.title), 60).replace(/"/g, "'") + '"');
      }
      ['min', 'max', 'step'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && tag === 'input') notes.push(a + '=' + cut(v, 30));
      });
      if (type === 'file') {
        if (el.accept) notes.push('accept="' + cut(el.accept, 80) + '"');
        if (el.multiple) notes.push('multiple');
        var hint = fileHint(el);
        if (hint) notes.push('hint="' + hint.replace(/"/g, "'") + '"');
      }
      var mode = el.getAttribute('inputmode');
      if (mode) notes.push('inputmode=' + cut(mode, 20));
    }
    var ac = clean(el.getAttribute('autocomplete')).toLowerCase();
    if (isField && ac && ac !== 'on' && ac !== 'off') notes.push('autocomplete=' + cut(ac, 40));
    var err = fieldError(el);
    if (err !== null) notes.push(err ? '(invalid: "' + err.replace(/"/g, "'") + '")' : '(invalid)');
    return notes;
  }

  // Invalid fields in a part of the page (a form, or the whole document), one line each: ref, label, reason.
  function formErrorsIn(root, limit) {
    var out = [];
    var seen = {};
    var els = root.querySelectorAll(FIELDS + ',[aria-invalid=true]');
    for (var i = 0; i < els.length && out.length < limit; i++) {
      var el = els[i];
      if (el.name && (el.type === 'radio' || el.type === 'checkbox')) {
        if (seen[el.name]) continue;
      }
      if (!rendered(el) && el.type !== 'checkbox' && el.type !== 'radio') continue;
      var err = fieldError(el);
      if (err === null) continue;
      if (el.name) seen[el.name] = 1;
      var label = labelOf(el);
      out.push('ref=' + getRef(el) + (label ? ' "' + label.replace(/"/g, "'") + '"' : '') + ': ' + (err || 'invalid'));
    }
    return out;
  }

  // The part of the page a field or button belongs to: its form, or the nearest wrapper holding fields.
  function formScope(el) {
    if (el.form) return el.form;
    var f = el.closest('form');
    if (f) return f;
    var scope = el.parentElement;
    for (var depth = 0; scope && depth < 6 && scope !== document.body; depth++, scope = scope.parentElement) {
      if (scope.querySelector(FIELDS)) return scope;
    }
    return null;
  }

  function isSubmitter(el) {
    var tag = el.tagName;
    if (tag === 'BUTTON') return (el.type || 'submit') !== 'reset';
    if (tag === 'INPUT') return /^(submit|image|button)$/.test(el.type);
    return el.getAttribute('role') === 'button';
  }

  // Errors to report after an action: on the field itself (type, select), or on its form after a submit.
  function formReport(ref, submitted) {
    var el = refToEl.get(Number(ref));
    if (!el || !el.isConnected) return [];
    if (!submitted) {
      var err = fieldError(el);
      return err === null ? [] : ['ref=' + ref + ': ' + (err || 'invalid')];
    }
    if (!isSubmitter(el) && !el.matches(FIELDS)) return [];
    var scope = formScope(el);
    return scope ? formErrorsIn(scope, 8) : [];
  }

  // Checkboxes and radios: whether they were already ticked when the page loaded (the checked attribute) or when
  // first read, so the model can tell a pre-ticked add-on or consent from one the agent ticked.
  var firstChecked = new WeakMap();
  var toggled = new WeakSet();
  var CHECK_ROLES = /^(checkbox|radio|switch|menuitemcheckbox|menuitemradio)$/;

  function checkState(el, checked, markup) {
    if (!firstChecked.has(el)) firstChecked.set(el, checked);
    var preset = markup || firstChecked.get(el) === true;
    if (checked) return preset && !toggled.has(el) ? '(checked, pre-ticked)' : '(checked)';
    return preset ? '(unchecked, was pre-ticked)' : '(unchecked)';
  }

  function checkTarget(el) {
    var t = el.tagName === 'LABEL' && el.control ? el.control : el;
    var type = (t.type || '').toLowerCase();
    return (t.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio')) || CHECK_ROLES.test(t.getAttribute('role') || '') ? t : null;
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
      if (type === 'checkbox' || type === 'radio') parts.push(checkState(el, el.checked, el.defaultChecked));
      else if (type === 'password') { if (el.value) parts.push('(filled)'); }
      else if (el.value) parts.push('value="' + cut(clean(el.value), 60) + '"');
      parts = parts.concat(formNotes(el, tag));
    } else if (tag === 'select') {
      var opts = [];
      for (var i = 0; i < el.options.length && i < 25; i++) opts.push(clean(el.options[i].text));
      parts.push('selected="' + clean(el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '') + '"');
      parts.push('options=[' + opts.join(' | ') + (el.options.length > 25 ? ' | ...' : '') + ']');
      parts = parts.concat(formNotes(el, tag));
    } else if (tag === 'a') {
      var href = el.getAttribute('href') || '';
      if (href && href.indexOf('javascript:') !== 0) parts.push('href=' + cut(href, 100));
    } else {
      if (CHECK_ROLES.test(el.getAttribute('role') || '')) {
        var ariaChecked = el.getAttribute('aria-checked');
        parts.push(ariaChecked === 'mixed' ? '(mixed)' : checkState(el, ariaChecked === 'true', false));
      }
      parts = parts.concat(formNotes(el, tag));
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
        if (lines.length === 0) lines.push(cut(line, MAX_CHARS));
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
      if (st.display === 'none' || st.visibility === 'hidden') {
        // A hidden file field behind a styled button is still where a file goes (upload_image).
        if (tag === 'INPUT' && (el.type || '').toLowerCase() === 'file') { flush(); push(describe(el) + ' (hidden)'); }
        return;
      }

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

      if (tag !== 'BODY' && tag !== 'HTML' && (el.matches(INTERACTIVE) || (tag === 'LABEL' && isFileInput(el.control)))) {
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
      title: wf(document.title),
      scroll: {
        y: Math.round(se.scrollTop),
        viewportHeight: window.innerHeight,
        pageHeight: se.scrollHeight
      },
      truncated: truncated,
      nextOffset: truncated ? lineIndex : null,
      content: lines.join('\n'),
      // Invalid fields anywhere on the page, so the model sees them without scanning the text.
      formErrors: document.body ? formErrorsIn(document.body, 8) : []
    };
  }

  // The HTML source as it is now in the DOM (scripts may have changed it since it loaded),
  // or the outerHTML of the elements matching a CSS selector. Paged by characters.
  function readSource(offset, selector) {
    offset = Math.max(0, Number(offset) || 0);
    var source;
    var matches = null;
    if (selector) {
      var els = document.querySelectorAll(String(selector));
      matches = els.length;
      var parts = [];
      for (var i = 0; i < els.length; i++) parts.push(els[i].outerHTML);
      source = parts.join('\n\n');
    } else {
      var dt = document.doctype;
      var doctype = '';
      if (dt) {
        doctype = '<!DOCTYPE ' + dt.name +
          (dt.publicId ? ' PUBLIC "' + dt.publicId + '"' : '') +
          (dt.systemId ? (dt.publicId ? ' ' : ' SYSTEM ') + '"' + dt.systemId + '"' : '') + '>\n';
      }
      source = doctype + document.documentElement.outerHTML;
    }
    offset = pairBoundary(source, Math.min(offset, source.length));
    var end = pairBoundary(source, Math.min(source.length, offset + MAX_CHARS));
    return {
      url: location.href,
      title: wf(document.title),
      total: source.length,
      matches: matches,
      offset: offset,
      truncated: end < source.length,
      nextOffset: end < source.length ? end : null,
      content: wf(source.slice(offset, end))
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
    var box = checkTarget(el);
    if (box) checkState(box, box.tagName === 'INPUT' ? box.checked : box.getAttribute('aria-checked') === 'true', !!box.defaultChecked);
    fireMouse(el);
    if (typeof el.focus === 'function') el.focus();
    el.click();
    if (box) toggled.add(box);
    return 'Clicked ' + desc;
  }

  // Clicks whatever is at a point given as fractions of the visible area (from a screenshot),
  // for things without a ref such as maps and canvases.
  function clickAt(fx, fy) {
    var vv = window.visualViewport;
    var w = vv ? vv.width : window.innerWidth;
    var h = vv ? vv.height : window.innerHeight;
    var x = (vv ? vv.offsetLeft : 0) + Math.min(Math.max(Number(fx), 0), 1) * w;
    var y = (vv ? vv.offsetTop : 0) + Math.min(Math.max(Number(fy), 0), 1) * h;
    var el = document.elementFromPoint(x, y);
    if (!el) throw new Error('Nothing at that point.');
    var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    var target = el.closest ? el.closest('a, button, input, select, textarea, [role], [onclick]') || el : el;
    if (typeof target.focus === 'function') target.focus();
    return 'Clicked ' + describe(target) + ' at (' + Math.round(x) + ', ' + Math.round(y) + ')';
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
    touched.add(el);
    if (submit) {
      if (el.form) attempted.add(el.form);
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
        touched.add(el);
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

  // The absolute address of a link (or of the link inside or around the element), for download_file.
  function linkHref(ref) {
    var el = getEl(ref);
    var a = el.closest('a[href],area[href]') || (el.querySelector && el.querySelector('a[href]'));
    var href = a ? a.href : '';
    if (!href || /^javascript:/i.test(href)) {
      throw new Error('ref=' + ref + ' is not a link with an address. Pass the file address as url instead.');
    }
    return href;
  }

  function scrollTo(ref) {
    var el = getEl(ref);
    el.scrollIntoView({ block: 'center' });
    return 'Scrolled to ' + describe(el);
  }

  // ---------- Page snapshot (for PDF export) ----------

  var MAX_IMAGE_BYTES = 4e6;
  var MAX_INLINE_BYTES = 25e6;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); })
    ]);
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // The PDF is rendered by a separate WebView without this page's cookies, so images are
  // fetched here (with cookies when same-origin) and embedded as data URLs.
  function fetchAsDataUrl(src, maxBytes, timeoutMs) {
    maxBytes = maxBytes || MAX_IMAGE_BYTES;
    var sameOrigin = new URL(src, location.href).origin === location.origin;
    var request = fetch(src, { credentials: sameOrigin ? 'include' : 'omit', mode: 'cors' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.blob();
      })
      .then(function (blob) {
        if (blob.size > maxBytes) throw new Error('too large');
        return blobToDataUrl(blob);
      });
    return withTimeout(request, timeoutMs || 8000);
  }

  function imageSource(img) {
    // Lazy-loading scripts often keep the real URL in a data attribute until the image scrolls into view.
    var lazy = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
    if (img.naturalWidth === 0 && lazy) return new URL(lazy, location.href).href;
    return img.currentSrc || img.src || '';
  }

  function snapshotHtml() {
    var root = document.documentElement;
    var clone = root.cloneNode(true);

    // Form state lives in properties, not attributes, so it is copied over explicitly.
    var fields = root.querySelectorAll('input, textarea, select');
    var clonedFields = clone.querySelectorAll('input, textarea, select');
    for (var i = 0; i < fields.length && i < clonedFields.length; i++) {
      var f = fields[i];
      var c = clonedFields[i];
      if (f.type === 'password') { c.removeAttribute('value'); continue; }
      if (f.tagName === 'TEXTAREA') c.textContent = f.value;
      else if (f.tagName === 'SELECT') {
        for (var o = 0; o < c.options.length; o++) c.options[o].toggleAttribute('selected', o === f.selectedIndex);
      } else if (f.type === 'checkbox' || f.type === 'radio') c.toggleAttribute('checked', f.checked);
      else c.setAttribute('value', f.value);
    }

    // Canvas content (charts etc.) is not part of the DOM; replace it with an image when allowed.
    var canvases = root.querySelectorAll('canvas');
    var clonedCanvases = clone.querySelectorAll('canvas');
    for (var k = 0; k < canvases.length && k < clonedCanvases.length; k++) {
      try {
        var img = document.createElement('img');
        img.src = canvases[k].toDataURL('image/png');
        img.style.cssText = 'width:' + canvases[k].clientWidth + 'px;max-width:100%';
        clonedCanvases[k].replaceWith(img);
      } catch (e) {}
    }

    // Inline readable stylesheets, which also covers CSS behind a login.
    var sheets = root.querySelectorAll('link[rel~="stylesheet"], style');
    var clonedSheets = clone.querySelectorAll('link[rel~="stylesheet"], style');
    var css = '';
    for (var s = 0; s < sheets.length && s < clonedSheets.length; s++) {
      var sheet = sheets[s].sheet;
      if (!sheet) continue;
      try {
        var rules = sheet.cssRules;
        var text = '';
        for (var r = 0; r < rules.length; r++) text += rules[r].cssText + '\n';
        css += text;
        clonedSheets[s].remove();
      } catch (e) {
        // Cross-origin stylesheet: keep the <link>; it loads by absolute URL.
      }
    }

    var remove = clone.querySelectorAll('script, noscript, iframe, object, embed, link[rel="preload"], link[rel="modulepreload"], link[rel="prefetch"]');
    for (var x = 0; x < remove.length; x++) remove[x].remove();

    var head = clone.querySelector('head');
    if (!head) { head = document.createElement('head'); clone.insertBefore(head, clone.firstChild); }
    var base = document.createElement('base');
    base.setAttribute('href', location.href);
    head.insertBefore(base, head.firstChild);
    var meta = document.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.insertBefore(meta, head.firstChild);
    var style = document.createElement('style');
    style.textContent = css +
      '\n@page { margin: 12mm; }' +
      '\nhtml, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      '\nimg { max-width: 100%; }';
    head.appendChild(style);

    var images = root.querySelectorAll('img');
    var clonedImages = clone.querySelectorAll('img');
    var jobs = [];
    var cache = {};
    for (var m = 0; m < images.length && m < clonedImages.length; m++) {
      var src = imageSource(images[m]);
      var target = clonedImages[m];
      target.removeAttribute('srcset');
      target.removeAttribute('loading');
      target.removeAttribute('sizes');
      if (!src || src.indexOf('data:') === 0) continue;
      target.setAttribute('src', src);
      jobs.push({ src: src, target: target });
    }
    var pictureSources = clone.querySelectorAll('picture source');
    for (var p = 0; p < pictureSources.length; p++) pictureSources[p].remove();

    var inlinedBytes = 0;
    var inlined = 0;
    var failed = 0;
    var index = 0;
    function worker() {
      if (index >= jobs.length) return Promise.resolve();
      var job = jobs[index++];
      if (inlinedBytes > MAX_INLINE_BYTES) { failed++; return worker(); }
      if (!cache[job.src]) cache[job.src] = fetchAsDataUrl(job.src);
      return cache[job.src].then(function (dataUrl) {
        job.target.setAttribute('src', dataUrl);
        inlinedBytes += dataUrl.length;
        inlined++;
      }, function () {
        // Left as an absolute URL; public images still load in the PDF renderer.
        failed++;
      }).then(worker);
    }
    var workers = [];
    for (var w = 0; w < 4; w++) workers.push(worker());

    return Promise.all(workers).then(function () {
      return {
        title: document.title,
        url: location.href,
        images: jobs.length,
        inlined: inlined,
        failed: failed,
        html: '<!DOCTYPE html>\n' + clone.outerHTML
      };
    });
  }

  // Fetches one image as a data URL with this page's cookies (for saving long-pressed images).
  function imageData(src) {
    return fetchAsDataUrl(src, 25e6);
  }

  // Fetches a file to download, with this page's cookies; larger files are left to a direct download.
  function fileData(src) {
    return fetchAsDataUrl(src, 25e6, 55000);
  }

  // ---------- blob: downloads ----------
  // The app can't fetch a blob: address natively, so the page hands the bytes over in base64 slices (the early
  // script BLOB_KEEP_SCRIPT keeps blobs readable for a while after the page revokes their address).
  var blobCache = {};

  function blobFor(url) {
    if (blobCache[url]) return Promise.resolve(blobCache[url]);
    var kept = window.__qutaiBlobs && window.__qutaiBlobs[url];
    var found = kept ? Promise.resolve(kept) : fetch(url).then(function (res) { return res.blob(); });
    return found.then(function (blob) { blobCache[url] = blob; return blob; });
  }

  // Size, type and the name the link's download attribute gave (if any).
  function blobInfo(url) {
    return blobFor(url).then(function (blob) {
      var names = window.__qutaiDlNames || {};
      return { size: blob.size, type: blob.type || '', name: names[url] || '' };
    });
  }

  function blobChunk(url, offset, length) {
    return blobFor(url).then(function (blob) {
      return blobToDataUrl(blob.slice(offset, offset + length)).then(function (dataUrl) {
        return String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
      });
    });
  }

  // The name a link's download attribute gave this address (data: links), or ''.
  function downloadName(url) {
    var names = window.__qutaiDlNames || {};
    return names[url] || '';
  }

  function blobRelease(url) {
    delete blobCache[url];
    return true;
  }

  // ---------- Readable text (for reading aloud) ----------

  var NOT_CONTENT = 'nav, header, footer, aside, form, button, script, style, noscript, svg, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [aria-hidden="true"], ' +
    '[class*="cookie"], [id*="cookie"], [class*="advert"], [class*="share"]';

  function readableText(maxChars) {
    maxChars = Number(maxChars) || 20000;
    var candidates = document.querySelectorAll('article, main, [role="main"]');
    var root = null;
    var best = 0;
    for (var i = 0; i < candidates.length; i++) {
      var len = (candidates[i].innerText || '').length;
      if (len > best) { best = len; root = candidates[i]; }
    }
    if (!root || best < 200) root = document.body;

    var clone = root.cloneNode(true);
    var junk = clone.querySelectorAll(NOT_CONTENT);
    for (var j = 0; j < junk.length; j++) junk[j].remove();

    // innerText needs layout, so the cleaned clone is measured off-screen.
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    var text = wf(clone.innerText || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    holder.remove();

    var title = clean(document.title);
    if (title && text.indexOf(title) !== 0) text = title + '.\n\n' + text;
    return {
      lang: document.documentElement.lang || '',
      truncated: text.length > maxChars,
      text: cut(text, maxChars)
    };
  }

  // ---------- Reader mode ----------
  // A readability-style extraction: paragraphs score their ancestors (commas, length), class and id
  // names add or remove points, link-heavy blocks lose them; the best block and its similar siblings
  // are copied, through an allowlist of tags and attributes, into an inert document (nothing in it
  // loads or runs) and returned as HTML. It reads the live page so hidden elements can be left out.

  var READER_POSITIVE = /article|body|content|entry|hentry|h-entry|main|page|post|text|blog|story|prose/i;
  var READER_NEGATIVE = /hidden|^hid$|banner|combx|comment|com-|contact|foot|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget/i;
  var READER_UNLIKELY = /-ad-|\bads?\b|advert|agegate|banner|breadcrumb|combx|comment|community|consent|cookie|disqus|footer|gdpr|header|legends|menu|modal|navbar|newsletter|outbrain|pagination|pager|paywall|popup|promo|recirc|recommend|related|remark|replies|rss|share|sharing|shoutbox|sidebar|skyscraper|social|sponsor|subscribe|supplemental|taboola|toolbar|tooltip/i;
  var READER_MAYBE = /and|article|body|column|content|main|shadow|story|post/i;
  var READER_DROP = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, IFRAME: 1, FRAME: 1, FRAMESET: 1, OBJECT: 1, EMBED: 1,
    APPLET: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, OPTION: 1, LABEL: 1, FIELDSET: 1,
    NAV: 1, ASIDE: 1, FOOTER: 1, HEADER: 1, SVG: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1, SOURCE: 1, TRACK: 1,
    MAP: 1, AREA: 1, DIALOG: 1, MENU: 1, LINK: 1, META: 1, BASE: 1, HEAD: 1, TITLE: 1, SLOT: 1
  };
  var READER_DROP_ROLES = /^(navigation|banner|contentinfo|complementary|dialog|alertdialog|menu|menubar|toolbar|search|form|tablist|tooltip)$/;
  // Tags kept (by output name); everything else is unwrapped, keeping its text.
  var READER_KEEP = {
    P: 'p', H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h5', H6: 'h6', UL: 'ul', OL: 'ol', LI: 'li',
    BLOCKQUOTE: 'blockquote', FIGURE: 'figure', FIGCAPTION: 'figcaption', TABLE: 'table', CAPTION: 'caption',
    THEAD: 'thead', TBODY: 'tbody', TFOOT: 'tfoot', TR: 'tr', TH: 'th', TD: 'td', DL: 'dl', DT: 'dt', DD: 'dd',
    A: 'a', EM: 'em', I: 'em', STRONG: 'strong', B: 'strong', U: 'u', S: 's', DEL: 'del', INS: 'ins', SUB: 'sub',
    SUP: 'sup', CODE: 'code', KBD: 'kbd', SAMP: 'samp', VAR: 'var', MARK: 'mark', SMALL: 'small', ABBR: 'abbr',
    Q: 'q', CITE: 'cite', TIME: 'time'
  };
  // Unwrapped elements whose contents are blocks of their own (loose text in them becomes a paragraph).
  var READER_CONTAINER = /^(DIV|SECTION|ARTICLE|MAIN|DETAILS|SUMMARY|CENTER|HGROUP|ADDRESS)$/;
  var READER_INLINE = /^(a|em|strong|u|s|del|ins|sub|sup|code|kbd|samp|var|mark|small|abbr|q|cite|time|br|img)$/;
  var READER_SPEAK = 'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, figcaption, dt, dd, caption, th, td';
  var READER_MAX_NODES = 20000;
  var READER_MAX_HTML = 600000;

  function readerClass(el) {
    return (typeof el.className === 'string' ? el.className : '') + ' ' + (el.id || '');
  }

  function textLen(el) { return clean(el.textContent).length; }

  // Share of an element's text that is link text (in-page links count less).
  function linkDensity(el) {
    var total = textLen(el);
    if (!total) return 0;
    var links = el.getElementsByTagName('a');
    var linked = 0;
    for (var i = 0; i < links.length; i++) {
      var coef = /^#/.test(links[i].getAttribute('href') || '') ? 0.3 : 1;
      linked += textLen(links[i]) * coef;
    }
    return Math.min(1, linked / total);
  }

  function readerHidden(el) {
    // Collapsed sections that find in page can open (hidden="until-found") still count as content.
    var hidden = el.getAttribute('hidden');
    if ((hidden !== null && hidden !== 'until-found') || el.getAttribute('aria-hidden') === 'true') return true;
    var st = window.getComputedStyle(el);
    return st.display === 'none' || st.visibility === 'hidden';
  }

  // Class or id says navigation, ads, comments, sharing...; a wrapper holding most of the page's text is spared.
  function readerUnlikely(el, bodyLen) {
    var s = readerClass(el);
    if (s.length < 3 || !READER_UNLIKELY.test(s) || READER_MAYBE.test(s)) return false;
    return !(bodyLen && textLen(el) > bodyLen * 0.5);
  }

  function readerJunk(el, flags, bodyLen) {
    var tag = el.nodeName.toUpperCase();
    if (READER_DROP[tag]) return true;
    var role = el.getAttribute('role');
    if (role && READER_DROP_ROLES.test(role)) return true;
    if (flags.strip && tag !== 'BODY' && tag !== 'ARTICLE' && tag !== 'MAIN' && tag !== 'A' && readerUnlikely(el, bodyLen)) return true;
    return readerHidden(el);
  }

  function readerUrl(value, image) {
    if (!value) return '';
    var u;
    try { u = new URL(String(value).trim(), document.baseURI); } catch (e) { return ''; }
    var p = u.protocol;
    if (p === 'https:' || p === 'http:') {
      // A link to a place in this same page stays inside the reader view.
      if (!image && u.hash.length > 1 && u.href.split('#')[0] === location.href.split('#')[0]) {
        return '#qr-' + readerId(u.hash.slice(1));
      }
      return u.href;
    }
    if (!image && (p === 'mailto:' || p === 'tel:')) return u.href;
    return '';
  }

  function readerId(id) {
    try { id = decodeURIComponent(id); } catch (e) {}
    return String(id).replace(/[^\w-]/g, '_').slice(0, 80);
  }

  // The largest candidate of a srcset (by width or density).
  function bestFromSrcset(set) {
    var best = '';
    var bestSize = -1;
    var parts = String(set).split(/,\s+/);
    for (var i = 0; i < parts.length; i++) {
      var bits = parts[i].trim().split(/\s+/);
      if (!bits[0]) continue;
      var size = 1;
      var d = bits[1] || '';
      if (/w$/.test(d)) size = parseFloat(d);
      else if (/x$/.test(d)) size = parseFloat(d) * 1000;
      if (size > 2400 && best) continue;
      if (size > bestSize) { bestSize = size; best = bits[0].replace(/,$/, ''); }
    }
    return best;
  }

  // The image's real address: what the browser loaded, or what a lazy-loading script keeps aside.
  function readerImageSrc(img, picture) {
    var current = img.currentSrc && !/^data:/i.test(img.currentSrc) && img.naturalWidth > 0 ? img.currentSrc : '';
    if (current) return current;
    var lazy = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') ||
      img.getAttribute('data-url') || img.getAttribute('data-hi-res-src') || '';
    if (lazy) return lazy;
    var lazySet = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset');
    if (lazySet) return bestFromSrcset(lazySet);
    if (picture) {
      var sources = picture.querySelectorAll('source');
      for (var i = 0; i < sources.length; i++) {
        var set = sources[i].getAttribute('srcset') || sources[i].getAttribute('data-srcset');
        if (set) return bestFromSrcset(set);
      }
    }
    if (img.getAttribute('srcset')) return bestFromSrcset(img.getAttribute('srcset'));
    return img.getAttribute('src') || '';
  }

  function readerImage(img, parent, st, picture) {
    var alt = cut(clean(img.getAttribute('alt')), 300);
    var raw = readerImageSrc(img, picture);
    // Sizes of a lazy image's placeholder (often a 1x1 GIF) say nothing about the real picture.
    var loaded = img.naturalWidth > 0 && raw === img.currentSrc;
    var w = (loaded ? img.naturalWidth : 0) || parseInt(img.getAttribute('width'), 10) || 0;
    var h = (loaded ? img.naturalHeight : 0) || parseInt(img.getAttribute('height'), 10) || 0;
    // Tracking pixels and spacers.
    if (w && h && w <= 3 && h <= 3) return;
    var box = img.getBoundingClientRect();
    // Small inline pictures (emoji, icons) become their alt text.
    if (loaded && box.width > 0 && box.width <= 32 && box.height <= 32) {
      if (alt) parent.appendChild(st.doc.createTextNode(alt));
      return;
    }
    var src = '';
    if (/^data:image\/(png|jpe?g|gif|webp);/i.test(raw) && raw.length > 400 && raw.length < 300000) src = raw;
    else src = readerUrl(raw, true);
    if (!src || st.images >= 150) return;
    var out = st.doc.createElement('img');
    out.setAttribute('src', src);
    out.setAttribute('alt', alt);
    if (w > 3 && h > 3) {
      out.setAttribute('width', String(w));
      out.setAttribute('height', String(h));
    }
    out.setAttribute('loading', 'lazy');
    out.setAttribute('decoding', 'async');
    st.images++;
    parent.appendChild(out);
  }

  // A table used for page layout rather than data.
  function layoutTable(table) {
    if (table.getAttribute('role') === 'presentation') return true;
    if (table.querySelector('table')) return true;
    if (table.querySelector('th, caption, thead')) return false;
    var rows = table.rows ? table.rows.length : 0;
    var cols = rows ? table.rows[0].cells.length : 0;
    return rows < 2 || cols < 2;
  }

  function hasContent(el) {
    return clean(el.textContent) !== '' || !!el.querySelector('img');
  }

  // Moves loose inline content of 'frag' into paragraphs, appending everything to 'parent'.
  function groupInline(frag, parent, st) {
    var run = null;
    var flush = function () {
      if (run && hasContent(run)) parent.appendChild(run);
      run = null;
    };
    while (frag.firstChild) {
      var c = frag.firstChild;
      var inline = c.nodeType === 3 || READER_INLINE.test(c.nodeName.toLowerCase());
      if (inline) {
        if (!run) run = st.doc.createElement('p');
        run.appendChild(c);
      } else {
        flush();
        parent.appendChild(c);
      }
    }
    flush();
  }

  function readerCopyChildren(el, parent, st, flow) {
    for (var c = el.firstChild; c; c = c.nextSibling) readerCopy(c, parent, st, flow);
    if (el.shadowRoot) for (var s = el.shadowRoot.firstChild; s; s = s.nextSibling) readerCopy(s, parent, st, flow);
  }

  // Copies one node of the article into the inert document, allowlisted.
  // 'flow': the destination takes blocks (loose text there is wrapped in paragraphs).
  function readerCopy(node, parent, st, flow) {
    if (++st.nodes > READER_MAX_NODES) return;
    if (node.nodeType === 3) {
      parent.appendChild(st.doc.createTextNode(node.data));
      return;
    }
    if (node.nodeType !== 1) return;
    var el = node;
    var tag = el.nodeName.toUpperCase();
    if (st.skip.indexOf(el) !== -1) return;
    if (tag === 'PICTURE') {
      var pic = el.querySelector('img');
      if (pic && !readerHidden(el)) readerImage(pic, parent, st, el);
      return;
    }
    if (readerJunk(el, st.flags, st.bodyLen)) return;
    if (tag === 'IMG') return readerImage(el, parent, st, null);
    if (tag === 'BR') { parent.appendChild(st.doc.createElement('br')); return; }
    if (tag === 'HR') { if (flow) parent.appendChild(st.doc.createElement('hr')); return; }
    if (tag === 'PRE') {
      var pre = st.doc.createElement('pre');
      pre.textContent = el.textContent;
      if (pre.textContent.trim()) parent.appendChild(pre);
      return;
    }
    // Navigation lists, "related" blocks and the like: mostly links, little text.
    if (st.flags.conditional && /^(UL|OL|DL|DIV|SECTION|TABLE)$/.test(tag) && !el.querySelector('pre')) {
      var len = textLen(el);
      var density = linkDensity(el);
      if ((density > 0.5 && len < 2000) || (density > 0.3 && len < 200 && !el.querySelector('img'))) return;
    }
    var name = READER_KEEP[tag];
    if (tag === 'TABLE' && layoutTable(el)) name = null;
    if (!name) {
      var container = READER_CONTAINER.test(tag) || /^(TABLE|TBODY|THEAD|TFOOT|TR|TD|TH)$/.test(tag);
      if (container && flow) {
        var frag = st.doc.createDocumentFragment();
        readerCopyChildren(el, frag, st, true);
        groupInline(frag, parent, st);
      } else {
        readerCopyChildren(el, parent, st, flow);
      }
      return;
    }
    var out = st.doc.createElement(name);
    if (el.id && /^[\w-]{1,80}$/.test(el.id)) out.setAttribute('id', 'qr-' + el.id);
    if (name === 'a') {
      var href = readerUrl(el.getAttribute('href'), false);
      if (!href) {
        readerCopyChildren(el, parent, st, flow);
        return;
      }
      out.setAttribute('href', href);
    } else if (name === 'td' || name === 'th') {
      var cs = parseInt(el.getAttribute('colspan'), 10);
      var rs = parseInt(el.getAttribute('rowspan'), 10);
      if (cs > 1 && cs < 50) out.setAttribute('colspan', String(cs));
      if (rs > 1 && rs < 50) out.setAttribute('rowspan', String(rs));
    } else if (name === 'abbr' && el.getAttribute('title')) {
      out.setAttribute('title', cut(clean(el.getAttribute('title')), 200));
    } else if (name === 'ol' && parseInt(el.getAttribute('start'), 10) > 1) {
      out.setAttribute('start', String(parseInt(el.getAttribute('start'), 10)));
    }
    var childFlow = name === 'blockquote' || name === 'figure' || name === 'li' || name === 'dd' || name === 'td' || name === 'th';
    if (childFlow) {
      var inner = st.doc.createDocumentFragment();
      readerCopyChildren(el, inner, st, true);
      // Lists and cells keep loose text as is unless they also hold blocks.
      var blocks = false;
      for (var k = inner.firstChild; k; k = k.nextSibling) {
        if (k.nodeType === 1 && !READER_INLINE.test(k.nodeName.toLowerCase())) { blocks = true; break; }
      }
      if ((blocks && name !== 'figure') || name === 'blockquote') groupInline(inner, out, st);
      else out.appendChild(inner);
    } else {
      readerCopyChildren(el, out, st, false);
    }
    if (!hasContent(out) && name !== 'td' && name !== 'th') return;
    parent.appendChild(out);
  }

  // Scores blocks by the paragraphs inside them and returns the best one with its score map.
  function readerCandidates(flags, bodyLen) {
    var own = new Map();
    var junkSelf = function (n) {
      var v = own.get(n);
      if (v === undefined) { v = readerJunk(n, flags, bodyLen); own.set(n, v); }
      return v;
    };
    var inJunk = function (el) {
      for (var n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
        if (junkSelf(n)) return true;
      }
      return false;
    };
    var scores = new Map();
    var init = function (n) {
      if (scores.has(n)) return;
      var tag = n.nodeName.toUpperCase();
      var s = 0;
      if (tag === 'DIV') s = 5;
      else if (tag === 'ARTICLE') s = 10;
      else if (tag === 'MAIN' || tag === 'SECTION' || tag === 'PRE' || tag === 'TD' || tag === 'BLOCKQUOTE') s = 3;
      else if (/^(ADDRESS|OL|UL|DL|DD|DT|LI|FORM)$/.test(tag)) s = -3;
      else if (/^(H[1-6]|TH)$/.test(tag)) s = -5;
      if (flags.weight) {
        var cls = readerClass(n);
        if (READER_NEGATIVE.test(cls)) s -= 25;
        if (READER_POSITIVE.test(cls)) s += 25;
        if (n.getAttribute('itemprop') === 'articleBody') s += 30;
      }
      scores.set(n, s);
    };
    var paras = document.body.querySelectorAll('p, pre, td, blockquote, div, section, article');
    for (var i = 0; i < paras.length && i < 8000; i++) {
      var el = paras[i];
      var tag = el.nodeName;
      var text;
      if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
        // Only text sitting directly in it (as in <div>text<br>text</div>) makes it a paragraph.
        text = '';
        for (var c = el.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) text += c.data;
          else if (c.nodeType === 1 && READER_INLINE.test(c.nodeName.toLowerCase())) text += c.textContent;
        }
        text = clean(text);
      } else {
        text = clean(el.textContent);
      }
      if (text.length < 25 || inJunk(el)) continue;
      var score = 1 + (text.split(/[,，、]/).length - 1) + Math.min(Math.floor(text.length / 100), 3);
      var anc = el.parentElement;
      for (var level = 0; anc && anc !== document.documentElement && level < 5; level++, anc = anc.parentElement) {
        init(anc);
        var divider = level === 0 ? 1 : level === 1 ? 2 : level * 3;
        scores.set(anc, scores.get(anc) + score / divider);
      }
    }
    var best = null;
    var bestScore = 0;
    var adjusted = new Map();
    scores.forEach(function (s, n) {
      if (s <= 0) return;
      var a = s * (1 - linkDensity(n));
      adjusted.set(n, a);
      if (a > bestScore) { bestScore = a; best = n; }
    });
    return { best: best, bestScore: bestScore, adjusted: adjusted, junkSelf: junkSelf };
  }

  function readerMeta(name) {
    var el = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"], meta[itemprop="' + name + '"]');
    return el ? clean(el.getAttribute('content')) : '';
  }

  function readerTitle(parts) {
    var docTitle = clean(document.title);
    var og = readerMeta('og:title') || readerMeta('twitter:title');
    var h1 = null;
    for (var i = 0; i < parts.length && !h1; i++) h1 = parts[i].querySelector('h1');
    if (!h1) {
      var article = parts[0] && parts[0].closest ? parts[0].closest('article') : null;
      h1 = (article && article.querySelector('h1')) || document.querySelector('article h1, main h1, h1');
    }
    var h1Text = h1 && !readerHidden(h1) ? clean(h1.textContent) : '';
    if (h1Text && h1Text.length <= 300 &&
        (docTitle.indexOf(h1Text) !== -1 || og.indexOf(h1Text) !== -1 || (h1Text.length >= 8 && parts[0].contains(h1)))) {
      return h1Text;
    }
    if (og) return og;
    var bits = docTitle.split(/\s+[|\-–—»·:]\s+/);
    if (bits.length > 1 && bits[0].length >= 15) return bits[0];
    return docTitle || h1Text;
  }

  function readerByline(st) {
    var author = readerMeta('author') || readerMeta('article:author');
    if (author && !/^https?:/i.test(author) && author.length <= 100) return author;
    var el = document.querySelector('[rel="author"], [itemprop="author"], .byline, .author, [class*="byline"]');
    if (!el || readerHidden(el)) return '';
    var name = el.querySelector('[itemprop="name"]');
    var text = clean((name || el).textContent);
    if (text.length < 2 || text.length > 100) return '';
    st.skip.push(el);
    return text;
  }

  function readerPublished() {
    var value = readerMeta('article:published_time') || readerMeta('datePublished') || readerMeta('date') ||
      readerMeta('dc.date');
    if (!value) {
      var time = document.querySelector('article time[datetime], main time[datetime], time[datetime]');
      if (time) value = time.getAttribute('datetime') || '';
    }
    return isNaN(Date.parse(value)) ? '' : value;
  }

  function readerBuild(flags, bodyLen) {
    var found = readerCandidates(flags, bodyLen);
    var best = found.best || document.body;
    // An article split into sections (each scoring on its own): when at least three other blocks
    // outside this one score close to it, the nearest ancestor holding three of them is the article.
    var rivals = [];
    found.adjusted.forEach(function (score, n) {
      if (score >= found.bestScore * 0.4 && !n.contains(best) && !best.contains(n)) rivals.push([score, n]);
    });
    rivals.sort(function (a, b) { return b[0] - a[0]; });
    rivals = rivals.slice(0, 10);
    if (rivals.length >= 3) {
      for (var anc = best.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
        var held = 0;
        for (var r = 0; r < rivals.length; r++) if (anc.contains(rivals[r][1])) held++;
        if (held >= 3) { best = anc; break; }
      }
    }
    // Then walk up while the parents keep a good share of the score, taking each parent that scores
    // higher than the block below it.
    var last = found.bestScore;
    var floor = found.bestScore / 3;
    for (var up = best.parentElement; best !== document.body && up && up !== document.body; up = up.parentElement) {
      var upScore = found.adjusted.get(up);
      if (upScore === undefined) continue;
      if (upScore < floor) break;
      if (upScore > last) {
        best = up;
        found.bestScore = Math.max(found.bestScore, upScore);
      }
      last = upScore;
    }
    var parts = [best];
    var parent = best.parentElement;
    if (parent && best !== document.body) {
      // Siblings that score like the best block (an article split into several divs) come along.
      parts = [];
      var threshold = Math.max(10, found.bestScore * 0.2);
      var bestClass = typeof best.className === 'string' ? best.className : '';
      for (var sib = parent.firstElementChild; sib; sib = sib.nextElementSibling) {
        if (sib === best) { parts.push(sib); continue; }
        if (found.junkSelf(sib)) continue;
        var bonus = bestClass && sib.className === bestClass ? found.bestScore * 0.2 : 0;
        var score = found.adjusted.get(sib);
        if (score !== undefined && score + bonus >= threshold) { parts.push(sib); continue; }
        if (sib.nodeName === 'P') {
          var len = textLen(sib);
          var density = linkDensity(sib);
          if ((len > 80 && density < 0.25) || (len > 0 && len <= 80 && density === 0 && /\.( |$)/.test(clean(sib.textContent)))) {
            parts.push(sib);
          }
        }
      }
    }

    var doc = document.implementation.createHTMLDocument('');
    var root = doc.createElement('div');
    var st = { doc: doc, flags: flags, bodyLen: bodyLen, skip: [], nodes: 0, images: 0 };
    var title = readerTitle(parts);
    var byline = readerByline(st);
    var frag = doc.createDocumentFragment();
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === document.body) readerCopyChildren(parts[i], frag, st, true);
      else readerCopy(parts[i], frag, st, true);
    }
    groupInline(frag, root, st);

    // The title is shown above the article; the same heading at the top of the body would repeat it.
    var heading = root.querySelector('h2, h3');
    var titleKey = clean(title).toLowerCase();
    if (heading && clean(heading.textContent).toLowerCase() === titleKey) {
      var before = '';
      for (var n = root.firstChild; n && n !== heading && !n.contains(heading); n = n.nextSibling) before += n.textContent;
      if (clean(before).length < 200) heading.remove();
    }

    // Blocks read aloud one by one, numbered for highlighting; block 0 is the title.
    var speech = [clean(title)];
    var chars = 0;
    var paragraphs = 0;
    var blocks = root.querySelectorAll(READER_SPEAK);
    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];
      var text;
      if (block.querySelector(READER_SPEAK)) {
        // Only its own text (as in a list item holding a nested list).
        text = '';
        for (var ch = block.firstChild; ch; ch = ch.nextSibling) {
          if (ch.nodeType === 3) text += ch.data;
          else if (ch.nodeType === 1 && !ch.matches(READER_SPEAK) && !ch.querySelector(READER_SPEAK)) text += ch.textContent;
        }
        text = clean(text);
      } else {
        text = clean(block.textContent);
      }
      if (!text) continue;
      block.setAttribute('data-s', String(speech.length));
      speech.push(text);
      chars += text.length;
      if (text.length >= 80 && block.nodeName !== 'TD' && block.nodeName !== 'TH') paragraphs++;
    }

    // Ids are kept only where a link in the article points to them.
    var withId = root.querySelectorAll('[id]');
    for (var d = 0; d < withId.length; d++) {
      if (!root.querySelector('a[href="#' + withId[d].id + '"]')) withId[d].removeAttribute('id');
    }

    var html = root.innerHTML;
    while (html.length > READER_MAX_HTML && root.lastChild) {
      root.lastChild.remove();
      html = root.innerHTML;
    }
    var dir = (document.documentElement.getAttribute('dir') || (document.body && document.body.getAttribute('dir')) || '').toLowerCase();
    return {
      ok: false,
      title: title,
      byline: byline,
      published: readerPublished(),
      siteName: readerMeta('og:site_name') || location.hostname.replace(/^www\./, ''),
      lang: document.documentElement.lang || '',
      dir: dir === 'rtl' ? 'rtl' : 'ltr',
      url: location.href,
      html: html,
      speech: speech,
      chars: chars,
      paragraphs: paragraphs,
      images: st.images
    };
  }

  // The article for reader mode. Strict first, then (like Readability) with fewer rules when that
  // leaves too little: class names misjudged as "unlikely", then also link-density pruning.
  function readerArticle(minChars, minParagraphs) {
    minChars = Number(minChars) || 600;
    minParagraphs = Number(minParagraphs) || 3;
    if (!document.body) return null;
    var bodyLen = textLen(document.body);
    var attempts = [
      { strip: true, weight: true, conditional: true },
      { strip: false, weight: true, conditional: true },
      { strip: false, weight: false, conditional: false }
    ];
    var best = null;
    for (var i = 0; i < attempts.length; i++) {
      var article = readerBuild(attempts[i], bodyLen);
      if (article.chars >= minChars && article.paragraphs >= minParagraphs) {
        article.ok = true;
        return article;
      }
      if (!best || article.chars > best.chars) best = article;
    }
    return best;
  }

  // Quick check for the address bar indicator (after Firefox's isProbablyReaderable):
  // enough visible paragraphs of real length outside navigation-like blocks.
  function readerProbe() {
    if (!document.body) return false;
    var nodes = Array.prototype.slice.call(document.body.querySelectorAll('p, pre, article'));
    var brs = document.body.querySelectorAll('div > br');
    for (var b = 0; b < brs.length && b < 500; b++) {
      if (nodes.indexOf(brs[b].parentNode) === -1) nodes.push(brs[b].parentNode);
    }
    var score = 0;
    for (var i = 0; i < nodes.length && i < 3000; i++) {
      var n = nodes[i];
      if (readerUnlikely(n, 0) || n.closest('li, nav, aside, footer, form')) continue;
      var len = textLen(n);
      if (len < 140) continue;
      if (n.getClientRects().length === 0) continue;
      score += Math.sqrt(len - 140);
      if (score > 20) return true;
    }
    return false;
  }

  // ---------- Find in page ----------

  var MAX_MATCHES = 1000;
  var MATCH_STYLE = 'background:#ffe066;color:inherit;border-radius:2px;';
  var CURRENT_STYLE = 'background:#ff9f43;color:inherit;border-radius:2px;';
  var find = { marks: [], index: -1 };

  // Case-insensitive and lenient about Turkish dotted/dotless i, so "istanbul" finds
  // "İSTANBUL" and "ISTANBUL". Folding keeps one character per character, so indices
  // in the folded text match the original.
  function foldChar(ch) {
    if (ch === 'İ' || ch === 'I' || ch === 'ı') return 'i';
    var lower = ch.toLowerCase();
    return lower.length === 1 ? lower : ch;
  }
  function fold(text) {
    var out = '';
    for (var i = 0; i < text.length; i++) out += foldChar(text[i]);
    return out;
  }

  function clearFind() {
    var parents = [];
    for (var i = 0; i < find.marks.length; i++) {
      var mark = find.marks[i];
      var parent = mark.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parents.push(parent);
    }
    for (var j = 0; j < parents.length; j++) parents[j].normalize();
    find = { marks: [], index: -1 };
    return { index: -1, count: 0 };
  }

  function showMatch() {
    for (var i = 0; i < find.marks.length; i++) {
      find.marks[i].setAttribute('style', i === find.index ? CURRENT_STYLE : MATCH_STYLE);
    }
    var current = find.marks[find.index];
    if (current) current.scrollIntoView({ block: 'center', inline: 'nearest' });
    return { index: find.index, count: find.marks.length };
  }

  function findInPage(query) {
    clearFind();
    var needle = fold(String(query || ''));
    if (!needle.trim()) return { index: -1, count: 0 };

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var el = node.parentElement;
        if (!el || el.closest('script, style, noscript, template, textarea, [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        if (el.getClientRects().length === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    var marks = [];
    for (var n = 0; n < nodes.length && marks.length < MAX_MATCHES; n++) {
      var node = nodes[n];
      var haystack = fold(node.data);
      var starts = [];
      var at = haystack.indexOf(needle);
      while (at !== -1 && marks.length + starts.length < MAX_MATCHES) {
        starts.push(at);
        at = haystack.indexOf(needle, at + needle.length);
      }
      // Split from the end so earlier offsets stay valid.
      var nodeMarks = [];
      for (var k = starts.length - 1; k >= 0; k--) {
        node.splitText(starts[k] + needle.length);
        var match = node.splitText(starts[k]);
        var mark = document.createElement('mark');
        mark.setAttribute('data-qutai-find', '');
        mark.textContent = match.data;
        match.parentNode.replaceChild(mark, match);
        nodeMarks.unshift(mark);
      }
      marks = marks.concat(nodeMarks);
    }
    find = { marks: marks, index: marks.length ? 0 : -1 };
    return showMatch();
  }

  function findStep(delta) {
    var count = find.marks.length;
    if (!count) return { index: -1, count: 0 };
    find.index = (find.index + (Number(delta) || 1) + count) % count;
    return showMatch();
  }

  // Full-page capture: the app scrolls the page step by step and photographs each step.
  // Fixed elements (headers, chat buttons, cookie bars) are shown only on the first step,
  // sticky ones stay at their place in the page, and scrollbars and smooth scrolling are off.
  var CAPTURE_STYLE_ID = '__qutai-capture-style';
  var capture = null;

  function captureMetrics() {
    var se = document.scrollingElement || document.documentElement;
    return {
      y: Math.round(window.scrollY || se.scrollTop || 0),
      viewportHeight: window.innerHeight,
      pageHeight: Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0)
    };
  }

  function captureBegin() {
    if (capture) captureEnd();
    capture = { x: window.scrollX || 0, y: window.scrollY || 0 };
    var all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length; i++) {
      var pos = getComputedStyle(all[i]).position;
      if (pos === 'fixed') all[i].setAttribute('data-qutai-capture', 'fixed');
      else if (pos === 'sticky' || pos === '-webkit-sticky') all[i].setAttribute('data-qutai-capture', 'sticky');
    }
    var style = document.createElement('style');
    style.id = CAPTURE_STYLE_ID;
    style.textContent =
      'html, body { scroll-behavior: auto !important; scrollbar-width: none !important; }' +
      'html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }' +
      '[data-qutai-capture="sticky"] { position: relative !important; top: auto !important; bottom: auto !important; }' +
      'html[data-qutai-capture-rest] [data-qutai-capture="fixed"] { visibility: hidden !important; }';
    (document.head || document.documentElement).appendChild(style);
    window.scrollTo(0, 0);
    return captureMetrics();
  }

  function nextFrame() {
    return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Images in view that are still loading (lazy images start when they scroll in); gives up after a while.
  function waitForVisibleImages(timeoutMs) {
    var start = Date.now();
    function pending() {
      var imgs = document.images;
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].complete) continue;
        var r = imgs[i].getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight && r.width > 0) return true;
      }
      return false;
    }
    function loop() {
      if (!pending() || Date.now() - start > timeoutMs) return Promise.resolve();
      return wait(100).then(loop);
    }
    return loop();
  }

  function captureStep(y, index) {
    if (index > 0) document.documentElement.setAttribute('data-qutai-capture-rest', '');
    else document.documentElement.removeAttribute('data-qutai-capture-rest');
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        window.removeEventListener('scroll', finish);
        resolve();
      };
      window.addEventListener('scroll', finish);
      window.scrollTo(0, y);
      // No scroll event when the page is already there.
      setTimeout(finish, 150);
    })
      .then(nextFrame)
      .then(function () { return waitForVisibleImages(1500); })
      .then(function () { return wait(120); })
      .then(nextFrame)
      .then(captureMetrics);
  }

  function captureEnd() {
    var style = document.getElementById(CAPTURE_STYLE_ID);
    if (style) style.remove();
    document.documentElement.removeAttribute('data-qutai-capture-rest');
    var marked = document.querySelectorAll('[data-qutai-capture]');
    for (var i = 0; i < marked.length; i++) marked[i].removeAttribute('data-qutai-capture');
    if (capture) window.scrollTo(capture.x, capture.y);
    capture = null;
    return true;
  }


  // ---------- Files from the app (upload_image) ----------
  // The image arrives in base64 chunks under a one-time token and is kept in this closure only (not on window, not
  // in the DOM) until fileAssign puts the finished File into the field; a new transfer or fileAbort drops it.
  var incoming = null;

  function isFileInput(el) {
    return !!el && el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'file';
  }

  // The file input behind an element: the field itself, its label, the field inside it, the one its aria-controls
  // names, or the only one in its nearby wrapper (a styled button over a hidden input). Null when none is found.
  function fileInputOf(el) {
    if (isFileInput(el)) return { input: el, how: 'the file field itself' };
    if (el.tagName === 'LABEL' && isFileInput(el.control)) return { input: el.control, how: 'the field of this label' };
    var lab = el.closest && el.closest('label');
    if (lab && isFileInput(lab.control)) return { input: lab.control, how: 'the field of the label around it' };
    var doc = el.ownerDocument || document;
    var controls = el.getAttribute('aria-controls');
    if (controls) {
      var named = doc.getElementById(controls.split(/\s+/)[0]);
      if (isFileInput(named)) return { input: named, how: 'the field it controls' };
    }
    var inner = el.querySelectorAll ? el.querySelectorAll('input[type=file]') : [];
    if (inner.length === 1) return { input: inner[0], how: 'the file field inside it' };
    var scope = el.parentElement;
    for (var depth = 0; scope && depth < 4 && scope !== doc.body; depth++, scope = scope.parentElement) {
      var near = scope.querySelectorAll('input[type=file]');
      if (near.length === 1) return { input: near[0], how: 'the hidden file field next to it' };
      if (near.length > 1) break;
    }
    return null;
  }

  // What upload_image would put the file into, before anything happens: a file field (with its accept, multiple and
  // state), an element to probe with a click (its uploader may create the field), or a frame out of reach.
  function fileTarget(ref) {
    var el = getEl(ref);
    if (el.tagName === 'IFRAME') {
      var reachable = false;
      try { reachable = !!(el.contentDocument && el.contentDocument.body); } catch (e) {}
      var src = el.getAttribute('src') || '';
      if (!reachable) return { kind: 'frame', origin: cut(src, 120) };
    }
    var found = fileInputOf(el);
    if (!found) return { kind: 'probe', element: describe(el) };
    var input = found.input;
    return {
      kind: 'input',
      how: found.how,
      element: describe(el),
      field: input === el ? '' : describe(input),
      accept: input.getAttribute('accept') || '',
      multiple: !!input.multiple,
      disabled: !!input.disabled,
      required: !!input.required
    };
  }

  function fileBegin(token, total) {
    incoming = { token: String(token), parts: [], size: 0, total: Number(total) };
    return true;
  }

  function fileChunk(token, index, b64) {
    if (!incoming || incoming.token !== String(token) || index !== incoming.parts.length) {
      incoming = null;
      throw new Error('The file transfer was interrupted.');
    }
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    incoming.parts.push(bytes);
    incoming.size += bytes.length;
    return incoming.size;
  }

  function fileAbort() {
    incoming = null;
    return true;
  }

  function acceptsFile(accept, name, mime) {
    if (!accept) return true;
    var ext = ((/\.[^.]+$/.exec(name) || [''])[0]).toLowerCase();
    return accept.split(',').some(function (a) {
      a = a.trim().toLowerCase();
      if (!a) return false;
      if (a.charAt(0) === '.') return a === ext || (a === '.jpeg' && ext === '.jpg') || (a === '.jpg' && ext === '.jpeg');
      if (a.slice(-2) === '/*') return mime.indexOf(a.slice(0, -1)) === 0;
      return a === mime || (a === 'image/jpg' && mime === 'image/jpeg');
    });
  }

  // Clicks the element with the file chooser held back: an input[type=file] its click would open (through
  // HTMLInputElement.click, showPicker, or a label's activation) is caught instead of showing the picker.
  function inputOpenedBy(el) {
    var W = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    var proto = W.HTMLInputElement.prototype;
    var origClick = proto.click;
    var origPicker = proto.showPicker;
    var caught = null;
    function grab(input) { if (!caught && isFileInput(input)) caught = input; }
    proto.click = function () {
      if (isFileInput(this)) { grab(this); return; }
      return origClick.apply(this, arguments);
    };
    if (origPicker) {
      proto.showPicker = function () {
        if (isFileInput(this)) { grab(this); return; }
        return origPicker.apply(this, arguments);
      };
    }
    function onClick(e) {
      if (isFileInput(e.target)) { grab(e.target); e.preventDefault(); }
    }
    W.addEventListener('click', onClick, true);
    try {
      fireMouse(el);
      el.click();
    } finally {
      proto.click = origClick;
      if (origPicker) proto.showPicker = origPicker;
      W.removeEventListener('click', onClick, true);
    }
    return caught;
  }

  function previewImages(scope) {
    var set = [];
    if (!scope) return set;
    var imgs = scope.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].currentSrc || imgs[i].src || '';
      if (/^(blob:|data:image\/)/.test(src)) set.push(imgs[i]);
    }
    return set;
  }

  // A frame from another site inside the element or its close wrappers (not the whole page).
  function hasForeignFrame(el) {
    var scope = el;
    for (var depth = 0; depth < 2 && scope.parentElement && scope.parentElement !== el.ownerDocument.body; depth++) scope = scope.parentElement;
    var frames = scope.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var reachable = false;
      try { reachable = !!frames[i].contentDocument; } catch (e) {}
      if (!reachable) return true;
    }
    return false;
  }

  function scopeAround(el) {
    var scope = el.isConnected ? (formScope(el) || el.parentElement) : null;
    for (var depth = 0; scope && depth < 3 && scope.parentElement && scope !== scope.ownerDocument.body; depth++) {
      if (scope.querySelectorAll('img').length) break;
      scope = scope.parentElement;
    }
    return scope;
  }

  // Puts the transferred file into the field behind ref (or drops it on ref when it is a drop zone), fires the
  // events pages listen for, waits a moment and reports what the page did. Never submits anything.
  function fileAssign(token, ref, name, mime) {
    var data = incoming;
    incoming = null;
    if (!data || data.token !== String(token) || data.size !== data.total) throw new Error('The file did not arrive completely.');
    var el = getEl(ref);
    var found = fileInputOf(el);
    var input = found ? found.input : null;
    var how = found ? found.how : '';
    if (!input) {
      input = inputOpenedBy(el);
      if (input) how = 'the file field its button opens';
    }
    var target = input || el;
    var W = (target.ownerDocument && target.ownerDocument.defaultView) || window;
    if (input) {
      if (input.disabled) return { ok: false, reason: 'disabled' };
      var accept = input.getAttribute('accept') || '';
      if (!acceptsFile(accept, name, mime)) return { ok: false, reason: 'accept', accept: accept };
    }
    var file = new W.File(data.parts, name, { type: mime, lastModified: Date.now() });
    data = null;
    // A field the page made without adding it (opened by a button) shows its result near the button.
    var scope = scopeAround(input && input.isConnected ? input : el);
    var form = input && input.isConnected ? formScope(input) : null;
    var before = previewImages(scope);
    var dt = new W.DataTransfer();
    dt.items.add(file);
    var mode;
    var handled = true;
    if (input) {
      mode = 'input';
      input.files = dt.files;
      input.dispatchEvent(new W.Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new W.Event('change', { bubbles: true }));
      touched.add(input);
    } else {
      // A drop zone without a file field: the drag sequence with the same DataTransfer. A zone that handles drops
      // cancels dragover and drop; one that doesn't leaves them alone, and nothing happened.
      mode = 'drop';
      var r = el.getBoundingClientRect();
      var opts = { bubbles: true, cancelable: true, composed: true, dataTransfer: dt,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      el.dispatchEvent(new W.DragEvent('dragenter', opts));
      el.dispatchEvent(new W.DragEvent('dragover', opts));
      handled = !el.dispatchEvent(new W.DragEvent('drop', opts));
    }
    return new Promise(function (resolve) { setTimeout(resolve, 800); }).then(function () {
      var holds = false;
      if (input && input.files) {
        for (var i = 0; i < input.files.length; i++) if (input.files[i].name === name) holds = true;
      }
      var after = previewImages(scope);
      var preview = after.some(function (img) { return before.indexOf(img) < 0; });
      var shown = !!(scope && scope.isConnected && clean(scope.innerText).indexOf(name) >= 0);
      var errors = [];
      function addError(text) {
        var said = errors.some(function (e) { return e.indexOf(text.replace(/^ref=\d+( "[^"]*")?: /, '')) >= 0; });
        if (!said) errors.push(text);
      }
      if (input && input.isConnected) {
        var err = fieldError(input);
        if (err !== null) addError('ref=' + getRef(input) + ': ' + (err || 'invalid'));
      }
      var nearErr = target.isConnected ? errorTextNear(target) : '';
      if (nearErr) addError(nearErr);
      if (form) formErrorsIn(form, 6).forEach(addError);
      return {
        ok: true,
        mode: mode,
        how: how,
        field: input && input.isConnected ? describe(input) : '',
        detached: !!(input && !input.isConnected),
        handled: handled,
        holds: holds,
        multiple: !!(input && input.multiple),
        preview: preview,
        nameShown: shown,
        // An uploader inside a frame from another site is out of reach; say so when nothing took the file.
        foreignFrame: !input && !handled && el.isConnected && hasForeignFrame(el),
        errors: errors.slice(0, 8)
      };
    });
  }

  // ---------- Hidden values (view_screenshot) ----------

  // The label of the field behind ref, for the "enter your saved ID number?" dialog.
  function fieldLabel(ref) {
    return labelOf(getEl(ref));
  }

  var MASK_STYLE_ID = '__qutai-mask-style';
  var MASK_ATTR = 'data-qutai-mask';

  // The page's documents: the top one and same-origin frames (the only ones the agent can type into).
  function reachableDocs() {
    var docs = [document];
    for (var i = 0; i < docs.length; i++) {
      var frames = docs[i].querySelectorAll('iframe, frame');
      for (var j = 0; j < frames.length; j++) {
        try { if (frames[j].contentDocument && frames[j].contentDocument.body) docs.push(frames[j].contentDocument); } catch (e) {}
      }
    }
    return docs;
  }

  // Every text field in a fixed order (inputs that show text, textareas, contenteditable roots).
  function textFields() {
    var out = [];
    reachableDocs().forEach(function (doc) {
      var all = doc.querySelectorAll('input, textarea, [contenteditable]:not([contenteditable="false"])');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.tagName === 'INPUT' && /^(hidden|checkbox|radio|file|submit|button|reset|image|range|color)$/i.test(el.type || '')) continue;
        if (el.isContentEditable && el.parentElement && el.parentElement.isContentEditable) continue;
        out.push(el);
      }
    });
    return out;
  }

  // What a screenshot could show as text: each field's value and the documents' text. The app looks for hidden values
  // in it; nothing is sent here to look for.
  function screenFields() {
    var fields = textFields().map(function (el) {
      return cut(String((el.isContentEditable ? el.innerText : el.value) || ''), 2000);
    });
    var text = cut(reachableDocs().map(function (doc) { return doc.body ? doc.body.innerText : ''; }).join('\n'), 500000);
    return { fields: fields, text: text };
  }

  // Makes the fields at these positions (in screenFields' order) transparent until maskEnd, for one capture.
  function maskFields(indices) {
    var fields = textFields();
    reachableDocs().forEach(function (doc) {
      if (doc.getElementById(MASK_STYLE_ID)) return;
      var style = doc.createElement('style');
      style.id = MASK_STYLE_ID;
      style.textContent = '[' + MASK_ATTR + '], [' + MASK_ATTR + '] * { color: transparent !important; ' +
        '-webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }';
      (doc.head || doc.documentElement).appendChild(style);
    });
    (indices || []).forEach(function (i) { if (fields[i]) fields[i].setAttribute(MASK_ATTR, ''); });
    return nextFrame().then(function () { return true; });
  }

  function maskEnd() {
    reachableDocs().forEach(function (doc) {
      var style = doc.getElementById(MASK_STYLE_ID);
      if (style) style.remove();
      var masked = doc.querySelectorAll('[' + MASK_ATTR + ']');
      for (var i = 0; i < masked.length; i++) masked[i].removeAttribute(MASK_ATTR);
    });
    return true;
  }

  // ---------- Page kind (suggestions in the empty assistant panel) ----------
  // A few yes/no signals about what kind of page this is, from markup only (structured data, meta tags, elements and
  // attributes). No page text, field values or addresses leave the page: the app turns the flags into suggestions.

  var SCHEMA_KINDS = {
    product: 'product', productgroup: 'product', individualproduct: 'product', productmodel: 'product',
    article: 'article', newsarticle: 'article', blogposting: 'article', reportagenewsarticle: 'article',
    techarticle: 'article', scholarlyarticle: 'article',
    recipe: 'recipe',
    videoobject: 'video', movie: 'video', episode: 'video', tvepisode: 'video',
    event: 'event', musicevent: 'event', sportsevent: 'event', businessevent: 'event', theaterevent: 'event',
    educationevent: 'event', festival: 'event',
    localbusiness: 'localBusiness', restaurant: 'localBusiness', cafeorcoffeeshop: 'localBusiness',
    foodestablishment: 'localBusiness', hotel: 'localBusiness', lodgingbusiness: 'localBusiness',
    medicalbusiness: 'localBusiness', dentist: 'localBusiness', autorepair: 'localBusiness', barorpub: 'localBusiness',
    professionalservice: 'localBusiness', healthandbeautybusiness: 'localBusiness', bakery: 'localBusiness',
    jobposting: 'jobPosting'
  };

  function noteSchemaType(value, kinds) {
    var list = Array.isArray(value) ? value : [value];
    for (var i = 0; i < list.length; i++) {
      if (typeof list[i] !== 'string') continue;
      var name = list[i].replace(/^.*[\/#:]/, '').toLowerCase();
      if (SCHEMA_KINDS[name]) kinds[SCHEMA_KINDS[name]] = true;
    }
  }

  // The @type of JSON-LD items (also inside @graph and one level of mainEntity), capped so huge blocks stay cheap.
  function walkJsonLd(node, kinds, depth) {
    if (!node || typeof node !== 'object' || depth > 3) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length && i < 50; i++) walkJsonLd(node[i], kinds, depth + 1);
      return;
    }
    if (node['@type']) noteSchemaType(node['@type'], kinds);
    if (node['@graph']) walkJsonLd(node['@graph'], kinds, depth + 1);
    if (node.mainEntity) walkJsonLd(node.mainEntity, kinds, depth + 1);
  }

  function visible(el) {
    if (!el.getClientRects().length) return false;
    var st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  }

  // The form with the most visible fields (3 or more), and what it seems to be for.
  function formKind() {
    var best = null, bestCount = 0;
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length && i < 30; i++) {
      var fields = forms[i].querySelectorAll('input, select, textarea');
      var count = 0;
      for (var j = 0; j < fields.length && j < 80; j++) {
        var f = fields[j];
        if (f.tagName === 'INPUT' && /^(hidden|submit|button|reset|image)$/i.test(f.type || '')) continue;
        if (visible(f)) count++;
      }
      if (count > bestCount) { best = forms[i]; bestCount = count; }
    }
    if (!best || bestCount < 3) return null;
    if (best.querySelector('[autocomplete^="cc-"], [autocomplete~="cc-number"], [name*="card" i]')) return 'checkout';
    if (best.querySelector('[autocomplete="new-password"]') || best.querySelectorAll('input[type=password]').length > 1) return 'signup';
    if (best.querySelector('textarea') && best.querySelector('input[type=email], [autocomplete=email]')) return 'contact';
    if (best.querySelector('[autocomplete*="address-line"], [autocomplete="postal-code"], [autocomplete="shipping"]')) return 'checkout';
    return 'other';
  }

  // A data table: several rows of several cells (not a layout table).
  function hasDataTable() {
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length && i < 40; i++) {
      var tb = tables[i];
      if (layoutTable(tb) || !visible(tb)) continue;
      var rows = tb.rows ? tb.rows.length : 0;
      if (rows < 4) continue;
      var cells = tb.rows[1] ? tb.rows[1].cells.length : 0;
      if (cells >= 2 && cells <= 30) return true;
    }
    return false;
  }

  function hasVideo() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length && i < 20; i++) {
      var v = videos[i];
      // A muted, looping clip without controls is decoration (a hero background), not a video to ask about.
      if (v.loop && v.muted && !v.controls) continue;
      var r = v.getBoundingClientRect();
      if (r.width >= 200 && r.height >= 110) return true;
    }
    var frames = document.querySelectorAll('iframe[src*="youtube.com/embed"], iframe[src*="player.vimeo.com"], iframe[src*="dailymotion.com/embed"]');
    for (var k = 0; k < frames.length; k++) {
      var fr = frames[k].getBoundingClientRect();
      if (fr.width >= 280 && fr.height >= 150) return true;
    }
    return false;
  }

  function pageSignals() {
    var kinds = {};
    var blocks = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < blocks.length && i < 20; i++) {
      var raw = blocks[i].textContent || '';
      if (raw.length > 200000) continue;
      try { walkJsonLd(JSON.parse(raw), kinds, 0); } catch (e) {}
    }
    var micro = document.querySelectorAll('[itemscope][itemtype]');
    for (var m = 0; m < micro.length && m < 50; m++) noteSchemaType(String(micro[m].getAttribute('itemtype')).split(/\s+/), kinds);
    var og = (readerMeta('og:type') || '').toLowerCase();
    if (/^(product|og:product)/.test(og)) kinds.product = true;
    else if (og === 'article') kinds.article = true;
    else if (/^video/.test(og)) kinds.video = true;
    else if (/^(restaurant|business)/.test(og)) kinds.localBusiness = true;
    var body = document.body;
    var doc = document.documentElement;
    var height = Math.max(body ? body.scrollHeight : 0, doc ? doc.scrollHeight : 0);
    return {
      kinds: Object.keys(kinds),
      article: body ? readerProbe() : false,
      form: body ? formKind() : null,
      video: body ? hasVideo() : false,
      pdf: /^application\/pdf/i.test(document.contentType || ''),
      payment: !!document.querySelector('input[autocomplete^="cc-"]'),
      phone: !!document.querySelector('a[href^="tel:"], [itemprop=telephone]'),
      address: !!document.querySelector('address, [itemprop=address], [itemprop=streetAddress]'),
      table: body ? hasDataTable() : false,
      long: height > (window.innerHeight || 700) * 8
    };
  }

  window.__qutaiAgent = {
    pageSignals: pageSignals,
    readPage: readPage,
    readSource: readSource,
    click: click,
    clickAt: clickAt,
    type: type,
    select: select,
    scroll: scroll,
    scrollTo: scrollTo,
    formReport: formReport,
    linkHref: linkHref,
    snapshotHtml: snapshotHtml,
    readableText: readableText,
    readerArticle: readerArticle,
    readerProbe: readerProbe,
    findInPage: findInPage,
    findStep: findStep,
    clearFind: clearFind,
    imageData: imageData,
    fileData: fileData,
    blobInfo: blobInfo,
    blobChunk: blobChunk,
    blobRelease: blobRelease,
    downloadName: downloadName,
    captureBegin: captureBegin,
    captureStep: captureStep,
    captureEnd: captureEnd,
    fileTarget: fileTarget,
    fileBegin: fileBegin,
    fileChunk: fileChunk,
    fileAbort: fileAbort,
    fileAssign: fileAssign,
    fieldLabel: fieldLabel,
    screenFields: screenFields,
    maskFields: maskFields,
    maskEnd: maskEnd
  };
})();
`;

/**
 * Early script (main frame): keeps the Blob behind every blob: address the page creates, for two minutes after the page
 * revokes it, and notes the name a link's download attribute gives. Pages that generate a file often click a hidden
 * link and revoke its address at once, before the app could read it (the WebView only reports the address).
 */
export const BLOB_KEEP_SCRIPT = String.raw`
(function () {
  if (window.__qutaiBlobs) return;
  var keep = (window.__qutaiBlobs = {});
  var names = (window.__qutaiDlNames = {});
  var create = URL.createObjectURL;
  var revoke = URL.revokeObjectURL;
  URL.createObjectURL = function (obj) {
    var url = create.apply(URL, arguments);
    try { if (obj instanceof Blob) keep[url] = obj; } catch (e) {}
    return url;
  };
  URL.revokeObjectURL = function (url) {
    setTimeout(function () {
      delete keep[url];
      delete names[url];
      try { revoke.call(URL, url); } catch (e) {}
    }, 120000);
  };
  function note(a) {
    try {
      if (a && a.href && a.hasAttribute('download')) names[a.href] = a.getAttribute('download') || '';
    } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    note(a);
  }, true);
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    note(this);
    return click.apply(this, arguments);
  };
})();
`;
