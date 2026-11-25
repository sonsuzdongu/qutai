/**
 * Page zoom through the viewport (UI-84, browser/pageZoom.ts). iOS on a Mac and an iPad, main frame, at document start:
 * the page lays out at the view's width divided by the zoom (pageZoom.ts viewportWidthFor) because every viewport meta
 * tag is set to "width=<that>" (one is added when the page has none), as desktop Safari ignores sites' viewport tags;
 * WebKit then scales the page up to fill the view, sharp, with no sideways scrolling. Tags the page adds or changes
 * later are followed, and so are window resizes. At zoom 1 the page's own tags are left as they were (restored if they
 * had been changed). Run again under the same name, it only changes the zoom.
 */
export function viewportZoomScript(zoom: number, name: string): string {
  return `(function () {
  var NAME = ${JSON.stringify(name)};
  if (typeof window[NAME] === 'function') { window[NAME](${zoom}); return; }
  var zoom = ${zoom}, added = null, originals = new WeakMap(), view = 0;
  function viewWidth() {
    var v = window.visualViewport;
    return v && v.width > 0 && v.scale > 0 ? v.width * v.scale : window.innerWidth;
  }
  function want() {
    if (!view) view = viewWidth();
    return 'width=' + Math.max(320, Math.round(view / zoom));
  }
  function apply() {
    var metas = document.querySelectorAll('meta[name="viewport" i]');
    var i;
    if (Math.abs(zoom - 1) < 0.001) {
      for (i = 0; i < metas.length; i++) {
        if (!originals.has(metas[i])) continue;
        var was = originals.get(metas[i]);
        originals.delete(metas[i]);
        if (was === null) metas[i].removeAttribute('content'); else metas[i].setAttribute('content', was);
      }
      if (added) { added.remove(); added = null; }
      return;
    }
    var content = want(), own = 0;
    for (i = 0; i < metas.length; i++) {
      if (metas[i] === added) continue;
      own++;
      if (!originals.has(metas[i])) originals.set(metas[i], metas[i].getAttribute('content'));
      if (metas[i].getAttribute('content') !== content) metas[i].setAttribute('content', content);
    }
    if (own > 0 && added) { added.remove(); added = null; }
    if (own === 0) {
      if (!added) {
        var parent = document.head || document.documentElement;
        if (!parent) return;
        added = document.createElement('meta');
        added.setAttribute('name', 'viewport');
        parent.appendChild(added);
      }
      if (added.getAttribute('content') !== content) added.setAttribute('content', content);
    }
  }
  try {
    Object.defineProperty(window, NAME, { value: function (next) { zoom = next > 0 ? next : 1; apply(); } });
  } catch (e) {}
  try {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'attributes' ? r.target.nodeName === 'META' : r.addedNodes.length > 0) { apply(); return; }
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['content', 'name'] });
  } catch (e) {}
  // The window changed size: lay out again at the new width (the scale WebKit chose tells the view's width).
  window.addEventListener('resize', function () {
    var next = viewWidth();
    if (Math.abs(next - view) >= 1) { view = next; apply(); }
  });
  document.addEventListener('DOMContentLoaded', apply);
  apply();
})();`;
}
