/**
 * Darkens light pages that have no dark design (iOS; Android uses the WebView's own force-dark).
 * Pages that are already dark, e.g. because they follow the system's dark mode, are left alone.
 * Colours are inverted and rotated back; images, videos and frames are inverted again so they look normal.
 */
export const DARK_SITE_SCRIPT = `(function () {
  if (window.__kutaiDark) return;
  window.__kutaiDark = true;
  function lightness(el) {
    if (!el) return null;
    var m = getComputedStyle(el).backgroundColor.match(/[\\d.]+/g);
    if (!m || (m.length > 3 && Number(m[3]) === 0)) return null;
    return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
  }
  function apply() {
    var l = lightness(document.body);
    if (l === null) l = lightness(document.documentElement);
    if (l === null) l = 1;
    if (l < 0.5 || document.getElementById('kutai-dark')) return;
    var style = document.createElement('style');
    style.id = 'kutai-dark';
    style.textContent = 'html{filter:invert(0.9) hue-rotate(180deg);background:#fff}' +
      'img,video,picture,canvas,iframe,embed,object,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)}';
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.body) apply(); else document.addEventListener('DOMContentLoaded', apply);
})(); true;`;
