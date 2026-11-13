/**
 * Ad and tracker servers (matched with their subdomains). A short built-in list for now; the
 * development build will use full filter lists with native request blocking.
 */
export const AD_HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'googletagservices.com',
  'amazon-adsystem.com',
  'adnxs.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'adform.net',
  'smartadserver.com',
  'casalemedia.com',
  'indexww.com',
  '2mdn.net',
  'moatads.com',
  'scorecardresearch.com',
  'teads.tv',
  'media.net',
  'popads.net',
  'propellerads.com',
  'exoclick.com',
  'mgid.com',
  'revcontent.com',
  'sharethrough.com',
  'triplelift.com',
  'bidswitch.net',
  'sonobi.com',
  'lijit.com',
  'yieldmo.com',
  'adsrvr.org',
  'quantserve.com',
  'admatic.com.tr',
  'hotjar.com',
  'mouseflow.com',
  'crazyegg.com',
];

/** Whether a URL points to a listed ad or tracker server (or a subdomain of one). */
export function isAdUrl(url: string, hosts: string[] = AD_HOSTS): boolean {
  const match = /^(?:https?:)?\/\/([^/?#:]+)/i.exec(url.trim());
  if (!match) return false;
  const host = match[1].toLowerCase();
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Runs before the page's own scripts: stops scripts from loading resources from ad servers
 * later on (inserted elements, fetch, XHR, beacons, pop-ups). What the page's HTML loads
 * directly can't be stopped from here; that needs native blocking.
 */
export function adBlockScript(hosts: string[] = AD_HOSTS): string {
  return `(function () {
  if (window.__kutaiAdBlock) return;
  window.__kutaiAdBlock = true;
  var HOSTS = ${JSON.stringify(hosts)};
  function blocked(url) {
    try {
      var host = new URL(String(url), location.href).hostname.toLowerCase();
      for (var i = 0; i < HOSTS.length; i++) {
        var h = HOSTS[i];
        if (host === h || host.slice(-h.length - 1) === '.' + h) return true;
      }
    } catch (e) {}
    return false;
  }
  function srcOf(node) {
    return node && node.nodeType === 1 && (node.src || node.href || (node.getAttribute && (node.getAttribute('src') || node.getAttribute('data-src')))) || '';
  }
  function guard(proto, name) {
    var original = proto[name];
    proto[name] = function (node) {
      var tag = node && node.tagName;
      if ((tag === 'SCRIPT' || tag === 'IFRAME' || tag === 'IMG' || tag === 'LINK') && blocked(srcOf(node))) return node;
      return original.apply(this, arguments);
    };
  }
  guard(Node.prototype, 'appendChild');
  guard(Node.prototype, 'insertBefore');
  var fetch0 = window.fetch;
  if (fetch0) window.fetch = function (input) {
    var url = typeof input === 'string' ? input : input && input.url;
    if (blocked(url)) return Promise.reject(new TypeError('Blocked by Kutai'));
    return fetch0.apply(this, arguments);
  };
  var open0 = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__kutaiBlocked = blocked(url);
    return open0.apply(this, arguments);
  };
  var send0 = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (this.__kutaiBlocked) { this.abort(); return; }
    return send0.apply(this, arguments);
  };
  if (navigator.sendBeacon) {
    var beacon0 = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url) { return blocked(url) ? false : beacon0.apply(null, arguments); };
  }
  var windowOpen0 = window.open;
  window.open = function (url) { return blocked(url) ? null : windowOpen0.apply(window, arguments); };
})(); true;`;
}
