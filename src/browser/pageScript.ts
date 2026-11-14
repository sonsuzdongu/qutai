/**
 * JavaScript injected into the web page. It must stay plain ES5-compatible
 * source in a string: Hermes compiles functions to bytecode, so we cannot use
 * Function.prototype.toString() to ship code into the WebView.
 *
 * Exposes window.__qutaiAgent with: readPage, click, type, select, scroll, scrollTo.
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
    var text = (clone.innerText || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    holder.remove();

    var title = clean(document.title);
    if (title && text.indexOf(title) !== 0) text = title + '.\n\n' + text;
    return {
      lang: document.documentElement.lang || '',
      truncated: text.length > maxChars,
      text: text.slice(0, maxChars)
    };
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

  window.__qutaiAgent = {
    readPage: readPage,
    click: click,
    clickAt: clickAt,
    type: type,
    select: select,
    scroll: scroll,
    scrollTo: scrollTo,
    snapshotHtml: snapshotHtml,
    readableText: readableText,
    findInPage: findInPage,
    findStep: findStep,
    clearFind: clearFind,
    imageData: imageData,
    fileData: fileData
  };
})();
`;
