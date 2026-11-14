/**
 * The page the hidden PDF reader WebView loads (src/components/PdfReaderHost.tsx): Mozilla PDF.js (pdfjs-dist,
 * Apache-2.0; legacy build, see scripts/build-pdf-reader.js) bundled with the app, plus a small script that opens a
 * PDF handed over in base64 pieces and answers three commands: open (page count and metadata), text (page by page)
 * and render (pages as JPEG images). Everything runs on the phone: the page's Content-Security-Policy allows no
 * network request at all, PDF.js runs without eval, and its image decoders (JBIG2, JPEG 2000) come from the bundle.
 * PDF.js runs on the page's own thread (its "fake worker"), which is simpler than a module worker from a blob URL and
 * fast enough for a page nobody looks at.
 */

/** The origin the page runs under (never contacted; it only gives blob: URLs an origin). */
export const READER_BASE_URL = 'https://pdf-reader.qutai.invalid/';

type Bundle = { version: string; main: string; worker: string; wasm: Record<string, string> };

let bundle: Bundle | null | undefined;

/** PDF.js as written by `postinstall`, or null when it is missing (an install that skipped it). */
export function pdfjsBundle(): Bundle | null {
  if (bundle !== undefined) return bundle;
  try {
    bundle = require('./pdfjs.generated.json') as Bundle;
  } catch {
    bundle = null;
  }
  return bundle;
}

/** A JavaScript string literal that is safe inside a <script> element. */
const literal = (text: string) => JSON.stringify(text).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

/** The script inside the page; `READER` talks to the app through window.ReactNativeWebView. */
const READER_SCRIPT = `
(function () {
  var post = function (msg) { msg.qutaiPdf = true; window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
  var pieces = {};
  var lib = null;
  var doc = null;
  var docKey = null;
  var task = null;

  function EmbeddedData() {}
  EmbeddedData.prototype.fetch = function (req) {
    var data = req && req.kind === 'wasmUrl' ? WASM[req.filename] : null;
    if (!data) return Promise.reject(new Error('Not bundled: ' + (req && req.filename)));
    return Promise.resolve(fromBase64(data));
  };

  function fromBase64(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function load() {
    if (lib) return Promise.resolve(lib);
    var url = function (text) { return URL.createObjectURL(new Blob([text], { type: 'text/javascript' })); };
    return import(url(WORKER)).then(function (worker) {
      globalThis.pdfjsWorker = worker;
      return import(url(MAIN));
    }).then(function (pdfjs) {
      lib = pdfjs;
      return lib;
    });
  }

  function errorText(e) {
    if (e && e.name === 'PasswordException') return 'password';
    if (e && e.name === 'InvalidPDFException') return 'invalid';
    return (e && e.message) || String(e);
  }

  function run(id, work) {
    Promise.resolve().then(work).then(
      function (result) { post({ id: id, ok: true, result: result }); },
      function (e) { post({ id: id, ok: false, error: errorText(e) }); }
    );
  }

  function opened(key) {
    if (!doc || docKey !== key) throw new Error('not open');
    return doc;
  }

  function pageText(content) {
    var out = '';
    var lastY = null;
    var lastEnd = null;
    for (var i = 0; i < content.items.length; i++) {
      var it = content.items[i];
      if (typeof it.str !== 'string') continue;
      var t = it.transform || [1, 0, 0, 1, 0, 0];
      var x = t[4], y = t[5];
      var size = Math.abs(t[3]) || Math.abs(t[0]) || 10;
      if (lastY !== null && Math.abs(y - lastY) > size * 0.5) {
        if (out && out.charAt(out.length - 1) !== '\\n') out += '\\n';
      } else if (lastEnd !== null && it.str && x - lastEnd > size * 0.2) {
        var prev = out.charAt(out.length - 1);
        if (prev && prev !== ' ' && prev !== '\\n' && it.str.charAt(0) !== ' ') out += ' ';
      }
      out += it.str;
      if (it.hasEOL) out += '\\n';
      lastY = y;
      lastEnd = x + (it.width || 0);
    }
    return out.replace(/[ \\t]+\\n/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();
  }

  window.__qutaiPdf = {
    piece: function (id, part) { (pieces[id] = pieces[id] || []).push(part); },
    open: function (id, key, from) {
      run(id, function () {
        var data = fromBase64((pieces[from] || []).join(''));
        delete pieces[from];
        return load().then(function (pdfjs) {
          var old = task;
          doc = null;
          docKey = null;
          task = null;
          if (old) old.destroy();
          task = pdfjs.getDocument({
            data: data,
            isEvalSupported: false,
            disableFontFace: true,
            useSystemFonts: false,
            enableXfa: false,
            isOffscreenCanvasSupported: false,
            disableWorkerRendering: true,
            wasmUrl: 'embedded/',
            BinaryDataFactory: EmbeddedData,
            verbosity: 0
          });
          return task.promise;
        }).then(function (pdf) {
          doc = pdf;
          docKey = key;
          return pdf.getMetadata().catch(function () { return null; }).then(function (meta) {
            var info = (meta && meta.info) || {};
            var pick = {};
            ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'].forEach(function (k) {
              if (typeof info[k] === 'string' && info[k].trim()) pick[k] = info[k].trim().slice(0, 300);
            });
            return { pages: pdf.numPages, info: pick };
          });
        });
      });
    },
    text: function (id, key, from, to, budget) {
      run(id, function () {
        var pdf = opened(key);
        var pages = [];
        var total = 0;
        var n = from;
        function next() {
          if (n > to || (pages.length && total >= budget)) return { pages: pages };
          return pdf.getPage(n).then(function (page) {
            return page.getTextContent().then(function (content) {
              var text = pageText(content);
              pages.push({ page: n, text: text });
              total += text.length;
              page.cleanup();
              n++;
              return next();
            });
          });
        }
        return next();
      });
    },
    render: function (id, key, list, edge) {
      run(id, function () {
        var pdf = opened(key);
        var out = [];
        var i = 0;
        function next() {
          if (i >= list.length) return out;
          var n = list[i++];
          return pdf.getPage(n).then(function (page) {
            var base = page.getViewport({ scale: 1 });
            var scale = Math.min(4, edge / Math.max(base.width, base.height));
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // The print intent draws without requestAnimationFrame, which never fires in a WebView nobody sees.
            return page.render({ canvas: canvas, canvasContext: ctx, viewport: viewport, intent: 'print' }).promise.then(function () {
              var url = canvas.toDataURL('image/jpeg', 0.8);
              out.push({ page: n, width: canvas.width, height: canvas.height, data: url.slice(url.indexOf(',') + 1) });
              canvas.width = 0;
              canvas.height = 0;
              page.cleanup();
              return next();
            });
          });
        }
        return next();
      });
    },
    close: function () {
      if (task) task.destroy();
      task = null;
      doc = null;
      docKey = null;
      pieces = {};
    }
  };
  post({ ready: true });
})();
`;

let html: string | null = null;

/** The reader page, built once per app run (about 2.4 MB of text), or null without the bundle. */
export function readerHtml(): string | null {
  if (html) return html;
  const b = pdfjsBundle();
  if (!b) return null;
  const csp =
    "default-src 'none'; script-src 'unsafe-inline' blob: 'wasm-unsafe-eval'; worker-src blob:; " +
    "img-src blob: data:; style-src 'unsafe-inline'; font-src blob: data:";
  html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    '</head><body><script>' +
    `var MAIN = ${literal(b.main)};\nvar WORKER = ${literal(b.worker)};\nvar WASM = ${JSON.stringify(b.wasm)};\n` +
    READER_SCRIPT +
    '</script></body></html>';
  return html;
}
