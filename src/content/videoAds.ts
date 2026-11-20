/**
 * "Block video ads" (Settings › Privacy and security, off by default; docs/design/09-blocking-and-my-rules.md
 * `BLK-29`, `BLK-30`). Domain blocking can't remove video ads on the supported video sites: the ad plan comes inside
 * the player's own data and the ad video from the same hosts as the real one. So a page script, installed before the
 * site's own scripts, takes the ad plan out of that data before the player reads it, and no ad starts. If one starts
 * anyway it is muted, sent to its end and skipped, and the sound comes back afterwards.
 *
 * Written for Qutai; no code taken from other blockers (only the knowledge of which fields carry the ads).
 *
 * Every host, field, address part and page element the feature needs is in VIDEO_AD_RULES, plain JSON and the only
 * place they appear, so a downloaded rule file can replace it later without an app update (TODO.md).
 */

export type VideoAdRules = {
  /** Bumped whenever the shape changes (for a later downloaded file). */
  version: number;
  /** Exact host names the script runs on (frames included, such as embedded players). */
  hosts: string[];
  /** Page globals holding the player data embedded in the page; cleaned when the page sets them. */
  embedded: string[];
  /** Fields removed from a player response object. */
  fields: string[];
  /** Fields holding a nested player response, whose ad fields are removed too ("playerResponse.adPlacements"). */
  nested: string[];
  /** Address parts of the requests whose JSON answers are cleaned (fetch's json() and XHR's json responses). */
  urls: string[];
  /** The player while an ad plays (the fallback when an ad starts anyway: muted, skipped, sound given back after). */
  adShowing: string[];
  /** How often the fallback looks at the player, in milliseconds (the owner's script: 300). */
  checkEveryMs: number;
  /** The player's own skip button. */
  skipButtons: string[];
  /** Ad boxes hidden on the page: promoted videos, companion, overlay and banner ads. One rule each. */
  hide: string[];
};

export const VIDEO_AD_RULES: VideoAdRules = {
  version: 1,
  hosts: [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
  ],
  embedded: ['ytInitialPlayerResponse'],
  fields: ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'],
  nested: ['playerResponse'],
  urls: [
    '/youtubei/v1/player',
    '/youtubei/v1/get_watch',
    '/youtubei/v1/next',
    '/youtubei/v1/reel/reel_item_watch',
    '/watch?',
    '/playlist?',
  ],
  adShowing: [
    '#movie_player.ad-showing',
    '#movie_player.ad-interrupting',
    '.html5-video-player.ad-showing',
    '.html5-video-player.ad-interrupting',
    '.ad-showing',
    '.ad-interrupting',
  ],
  checkEveryMs: 300,
  skipButtons: [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button',
    '.ytm-skip-ad-button',
  ],
  hide: [
    '#player-ads',
    '#masthead-ad',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-display-ad-renderer',
    'ytd-companion-slot-renderer',
    'ytd-action-companion-ad-renderer',
    'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    'ytd-search-pyv-renderer',
    'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
    'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
    '.ytp-ad-overlay-container',
    '.ytp-ad-overlay-slot',
    '.ytp-ad-image-overlay',
    '.ytp-ad-text-overlay',
    'ad-slot-renderer',
    'ytm-ad-slot-renderer',
    'ytm-promoted-sparkles-web-renderer',
    'ytm-promoted-sparkles-text-search-renderer',
    'ytm-promoted-video-renderer',
    'ytm-companion-ad-renderer',
    'ytm-companion-slot',
    'ytm-banner-promo-renderer',
    'ytm-rich-item-renderer:has(ad-slot-renderer)',
    'ytmusic-mealbar-promo-renderer',
    'ytmusic-statement-banner-renderer',
  ],
};

/**
 * The cleaning function as page JavaScript (also run by the tests, so they test what ships). Defines
 * `prune(value)`: removes the ad fields from a player response, from the player response nested in it, and from the
 * first few objects of an array of them; returns whether it removed anything. Anything else is left as it is and
 * nothing throws, so a changed shape only means the ad plays.
 */
export function pruneSource(rules: Pick<VideoAdRules, 'fields' | 'nested'>): string {
  return `var PRUNE_FIELDS = ${JSON.stringify(rules.fields)};
var PRUNE_NESTED = ${JSON.stringify(rules.nested)};
function pruneOne(o, depth) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  var changed = false, i, k;
  for (i = 0; i < PRUNE_FIELDS.length; i++) {
    k = PRUNE_FIELDS[i];
    if (k in o) {
      try { if (delete o[k]) changed = true; } catch (e) {}
    }
  }
  if (depth < 1) {
    for (i = 0; i < PRUNE_NESTED.length; i++) {
      var n = o[PRUNE_NESTED[i]];
      if (n && typeof n === 'object' && pruneOne(n, depth + 1)) changed = true;
    }
  }
  return changed;
}
function prune(v) {
  try {
    if (!v || typeof v !== 'object') return false;
    if (!Array.isArray(v)) return pruneOne(v, 0);
    var changed = false;
    for (var i = 0; i < v.length && i < 8; i++) if (pruneOne(v[i], 0)) changed = true;
    return changed;
  } catch (e) {
    return false;
  }
}`;
}

function hostIn(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Whether a page at this host gets the script (the same test the page makes: exact host names). */
export function isVideoAdHost(host: string, rules: VideoAdRules = VIDEO_AD_RULES): boolean {
  return rules.hosts.includes(host.toLowerCase());
}

/** Whether "Block ads and trackers here" is off for this host (the same test as the page script's). */
export function videoAdsOffHere(host: string, offSites: string[]): boolean {
  return hostIn(host.toLowerCase(), offSites);
}

/**
 * The page script: installed at document start in every frame (iOS: WebKit user script; Android: the patched
 * WebView's document-start script, with the early script as a fallback). It does nothing on other hosts or on sites
 * where "Block ads and trackers here" is off (the frame's own site or, for an embedded player, the page around it).
 * Installs once per document.
 */
export function videoAdScript(rules: VideoAdRules = VIDEO_AD_RULES, offSites: string[] = []): string {
  return `(function () {
  var HOSTS = ${JSON.stringify(rules.hosts)};
  var here = location.hostname.toLowerCase();
  if (HOSTS.indexOf(here) < 0) return;
  if (window.__qutaiVideoAds) return;
  try { Object.defineProperty(window, '__qutaiVideoAds', { value: true }); } catch (e) { return; }
  var OFF = ${JSON.stringify(offSites)};
  function off(host) {
    for (var j = 0; j < OFF.length; j++) {
      if (host === OFF[j] || host.slice(-OFF[j].length - 1) === '.' + OFF[j]) return true;
    }
    return false;
  }
  var outer = here;
  try {
    var ao = location.ancestorOrigins;
    if (ao && ao.length) outer = new URL(ao[ao.length - 1]).hostname.toLowerCase();
  } catch (e) {}
  if (off(here) || off(outer)) return;
  ${pruneSource(rules)}
  var URLS = ${JSON.stringify(rules.urls)};
  function wanted(url) {
    if (!url) return true;
    url = String(url);
    for (var i = 0; i < URLS.length; i++) if (url.indexOf(URLS[i]) >= 0) return true;
    return false;
  }
  // 1. The player data embedded in the page ("var <name> = {...}").
  var EMBEDDED = ${JSON.stringify(rules.embedded)};
  EMBEDDED.forEach(function (name) {
    try {
      var held = window[name];
      prune(held);
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: function () { return held; },
        set: function (v) { prune(v); held = v; },
      });
    } catch (e) {}
  });
  // 2. Data the page parses itself (the phone site's embedded data, XHR text, later navigations).
  try {
    var parse0 = JSON.parse;
    JSON.parse = function parse(text, reviver) {
      var r = parse0.apply(this, arguments);
      if (r && typeof r === 'object') prune(r);
      return r;
    };
  } catch (e) {}
  // 3. Answers read with fetch's json() (the player and watch requests).
  try {
    var json0 = Response.prototype.json;
    Response.prototype.json = function json() {
      var p = json0.apply(this, arguments);
      if (!wanted(this.url)) return p;
      return p.then(function (v) { prune(v); return v; });
    };
  } catch (e) {}
  // XHR with responseType "json".
  try {
    var d = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
    if (d && d.get && d.configurable) {
      var get0 = d.get;
      Object.defineProperty(XMLHttpRequest.prototype, 'response', {
        configurable: true,
        enumerable: d.enumerable,
        get: function () {
          var v = get0.call(this);
          if (v && typeof v === 'object' && this.responseType === 'json' && wanted(this.responseURL)) prune(v);
          return v;
        },
      });
    }
  } catch (e) {}
  // 4. Ad boxes hidden (one rule each, so a selector one WebView doesn't know drops only itself).
  var HIDE = ${JSON.stringify(rules.hide)};
  function addStyle() {
    var root = document.documentElement;
    if (!root) return false;
    var s = document.createElement('style');
    var css = '';
    for (var i = 0; i < HIDE.length; i++) css += HIDE[i] + '{display:none!important}\\n';
    s.textContent = css;
    (document.head || root).appendChild(s);
    return true;
  }
  try {
    if (!addStyle()) {
      var mo = new MutationObserver(function () { if (addStyle()) mo.disconnect(); });
      mo.observe(document, { childList: true });
    }
  } catch (e) {}
  // 5. When an ad starts anyway: muted at once, sent to its end and skipped; the sound comes back when it ends
  // (never unmuting a video the user had muted).
  var SHOWING = ${JSON.stringify(rules.adShowing)}.join(',');
  var SKIP = ${JSON.stringify(rules.skipButtons)};
  var muted = null, wasMuted = false;
  function check() {
    try {
      var player = document.querySelector(SHOWING);
      if (!player) {
        if (muted) {
          if (!wasMuted) muted.muted = false;
          muted = null;
        }
        return;
      }
      var v = player.querySelector('video') || document.querySelector('video');
      if (v) {
        if (muted !== v) {
          if (muted && !wasMuted) muted.muted = false;
          wasMuted = !!v.muted;
          muted = v;
        }
        v.muted = true;
        if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.3) v.currentTime = v.duration;
      }
      for (var i = 0; i < SKIP.length; i++) {
        var b = document.querySelector(SKIP[i]);
        if (b && (b.offsetWidth || b.offsetHeight || (b.getClientRects && b.getClientRects().length))) b.click();
      }
    } catch (e) {}
  }
  document.addEventListener('loadedmetadata', check, true);
  document.addEventListener('playing', check, true);
  document.addEventListener('volumechange', function () { if (muted && !document.querySelector(SHOWING)) check(); }, true);
  setInterval(function () { if (muted || document.querySelector('video')) check(); }, ${Math.max(100, rules.checkEveryMs)});
})();`;
}
