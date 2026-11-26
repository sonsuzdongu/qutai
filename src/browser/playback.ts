import { Platform } from 'react-native';
import type { ComponentRef } from 'react';
import type { WebView } from 'react-native-webview';
import { newNonce } from '../utils/ids';
import { AUTOPLAY_GUARD } from './autoplay';
import { derivedKey } from './pageKeys';

/**
 * Media playing in web pages: which tab is audible (tab switcher speaker, tabs that must not sleep), and the
 * commands that pause or control it.
 *
 * A page script, installed before the page's own scripts, watches the page's media elements (every element that
 * fires a media event in the document, and every element whose play() is called, also ones never added to the
 * page) and reports over the tab's authenticated channel (a nonce only the script knows):
 *
 * - audible: an element is playing (not paused or ended, has data, its time actually advances between checks)
 *   and not muted, with volume above 0. A page that only claims to play, or plays a muted or frozen element, is
 *   not audible. Web Audio is not counted (games and notification sounds; no way to tell silence from sound).
 * - the page's Media Session (navigator.mediaSession) metadata and action handlers. Android's WebView turns the
 *   Media Session API off, so the script provides a small navigator.mediaSession of its own there: sites that use
 *   it (most music and podcast sites) then give titles, artwork and next/previous to the notification.
 *
 * While anything plays the script reports again every 5 seconds; the app (and on Android the native service, which
 * runs without React Native while the app is in the background) treats a tab as silent when those reports stop.
 *
 * Frames: on iOS the script runs in every frame and a frame reports to the page above it (window.postMessage
 * with the tab's frame key, never the nonce, and hidden from the page's own listeners: pageKeys.ts); the main frame adds the frames' state to its own. On Android scripts reach the main frame only,
 * so media playing inside a frame (an embedded player) isn't seen there.
 *
 * Incognito tabs on iOS: WebKit shows the page's Media Session metadata on the lock screen itself, so in incognito
 * tabs every metadata the page sets is replaced with a generic "Private tab" title. On Android the notification
 * is Qutai's own and shows the generic label for incognito tabs (the WebView's mediaPlayback prop says "private").
 */

/** How often the script reports while something plays. */
const HEARTBEAT_MS = 5000;
/** Without a report for this long, the tab counts as silent again. */
const STALE_MS = 15000;

export type PlaybackAction =
  | 'play'
  | 'pause'
  | 'stop'
  | 'nexttrack'
  | 'previoustrack'
  | 'seekto'
  | 'seekforward'
  | 'seekbackward'
  | 'pauseAll';

/** What the script reports. */
type Report = {
  __qutaiPlayback?: string;
  audible?: boolean;
  playing?: boolean;
  paused?: boolean;
  video?: [number, number] | null;
  title?: string;
  artist?: string;
};

/**
 * `resumeVideo` (iOS, "Keep playing in the background" on, never incognito): WebKit pauses <video> elements when
 * the app leaves the foreground (audio-only media and picture-in-picture go on), and some sites pause their own
 * player when the page becomes hidden (YouTube's mobile site). When the page becomes hidden while audible media
 * plays (or such media was paused within 1.5 s before), the page is kept from seeing it: document.hidden and
 * visibilityState stay "visible" and the visibilitychange events of leaving and coming back are stopped before the
 * page's own listeners. Media paused just before that, or within 4 s after, is played again (at most 3 times per
 * element), which the audio background mode allows: the sound goes on, the picture doesn't. Pages that don't play
 * anything when the app leaves see visibility as usual. Development builds print each step in the Metro terminal
 * ("[Qutai playback]").
 */
export function playbackScript(nonce: string, incognito: boolean, privateLabel: string, resumeVideo = false): string {
  return `(function () {
  if (window.__qutaiPlaybackInstalled) return;
  Object.defineProperty(window, '__qutaiPlaybackInstalled', { value: true });
  // Called directly, never through Function.prototype.call / .apply: a page can replace those and read what passes
  // through them (the nonce in a message to the app), or make a call do nothing.
  var apply = window.Reflect && window.Reflect.apply;
  if (typeof apply !== 'function') return;
  var NONCE = ${JSON.stringify(nonce)};
  var FRAMES = ${JSON.stringify(derivedKey(nonce, 'frames'))};
  var PRIVATE = ${incognito ? 'true' : 'false'};
  var PRIVATE_LABEL = ${JSON.stringify(privateLabel)};
  var POLYFILL = ${Platform.OS === 'android' ? 'true' : 'false'};
  var RESUME_VIDEO = ${resumeVideo && !incognito ? 'true' : 'false'};
  var DEBUG = ${__DEV__ ? 'true' : 'false'};
  var HEARTBEAT = ${HEARTBEAT_MS};
  var ME = window.HTMLMediaElement;
  if (!ME) return;
  var stringify = JSON.stringify;
  var bridge = window.ReactNativeWebView;
  var post = bridge && bridge.postMessage;
  var mainFrame = window.top === window;
  var setTimer = window.setTimeout, clearTimer = window.clearTimeout;
  var setRepeat = window.setInterval, clearRepeat = window.clearInterval;
  var now = Date.now;
  var proto = ME.prototype;
  // The page's play() goes through the autoplay guard when it is there (autoplay.ts); Qutai's own commands (lock
  // screen, notification, PiP window) use the real one, which the guard gives for this tab's play key.
  var pagePlay = proto.play;
  var guard = window[${JSON.stringify(AUTOPLAY_GUARD)}];
  var handed = null;
  try { handed = typeof guard === 'function' ? guard(${JSON.stringify(derivedKey(nonce, 'play'))}) : null; } catch (e) {}
  var realPlay = typeof handed === 'function' ? handed : pagePlay, realPause = proto.pause;
  var stopNow = window.Event && window.Event.prototype.stopImmediatePropagation;
  function hush(e) { try { apply(stopNow, e, []); } catch (err) {} }
  function getter(target, name) { var d = target && Object.getOwnPropertyDescriptor(target, name); return d && d.get; }
  var gPaused = getter(proto, 'paused'), gEnded = getter(proto, 'ended'), gMuted = getter(proto, 'muted');
  var gVolume = getter(proto, 'volume'), gReady = getter(proto, 'readyState'), gDuration = getter(proto, 'duration');
  var gRate = getter(proto, 'playbackRate');
  var timeDesc = Object.getOwnPropertyDescriptor(proto, 'currentTime');
  var VE = window.HTMLVideoElement;
  var gWidth = VE && getter(VE.prototype, 'videoWidth'), gHeight = VE && getter(VE.prototype, 'videoHeight');
  var elements = [];
  var infos = typeof WeakMap === 'function' ? new WeakMap() : null;
  var current = null;
  var frames = [];
  var handlers = {};
  var lastKey = '';
  var pending = null;
  var repeat = null;

  function info(el) {
    if (!infos) return { time: -1, startedAt: 0 };
    var i = infos.get(el);
    if (!i) { i = { time: -1, startedAt: 0 }; infos.set(el, i); }
    return i;
  }
  var EVENTS = ['play', 'playing', 'pause', 'ended', 'volumechange', 'emptied', 'seeked', 'loadeddata'];
  function onMediaEvent(e) {
    var el = e.target;
    if (!(el instanceof ME)) return;
    track(el);
    if (e.type === 'playing') {
      info(el).startedAt = now();
      // A muted video (autoplay, a looping preview: 'playing' again on every loop) doesn't take over from one with
      // sound; the controls, the reported position and picture-in-picture stay with the media the user hears.
      if (loud(el) || !current || apply(gPaused, current, []) || !loud(current)) current = el;
    }
    schedule();
  }
  function loud(el) { return !apply(gMuted, el, []) && apply(gVolume, el, []) > 0; }
  function track(el) {
    for (var i = 0; i < elements.length; i++) if (elements[i] === el) return;
    elements[elements.length] = el;
    // An element never added to the document (new Audio(), common in music players) fires its events on itself
    // only; the document listeners below never see them.
    for (var j = 0; j < EVENTS.length; j++) el.addEventListener(EVENTS[j], onMediaEvent);
  }
  try {
    Object.defineProperty(proto, 'play', {
      value: function play() { track(this); schedule(); return apply(pagePlay, this, arguments); },
      writable: true, configurable: true,
    });
  } catch (e) {}
  EVENTS.forEach(function (type) { document.addEventListener(type, onMediaEvent, true); });

  // iOS: media keeps playing when the app leaves the foreground; see resumeVideo above.
  var docProto = window.Document && Document.prototype;
  var gVisibility = getter(docProto, 'visibilityState');
  var gHidden = getter(docProto, 'hidden');
  if (RESUME_VIDEO && gVisibility && gHidden) {
    var masking = false;
    var hiddenAt = 0;
    var recentPauses = [];
    var attempts = [];
    var audibleNow = function () {
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (!apply(gPaused, el, []) && !apply(gEnded, el, []) && !apply(gMuted, el, []) && apply(gVolume, el, []) > 0) return true;
      }
      return false;
    };
    var log = function (text) {
      if (!DEBUG) return;
      try { apply(post, bridge, [stringify({ __qutaiPlaybackLog: NONCE, at: now(), text: text, frame: !mainFrame })]); } catch (e) {}
    };
    var resume = function (el, why) {
      var count = 0;
      for (var i = 0; i < attempts.length; i++) if (attempts[i] === el) count++;
      if (count >= 3 || !apply(gPaused, el, []) || apply(gEnded, el, [])) return;
      attempts[attempts.length] = el;
      log('resume (' + why + ', try ' + (count + 1) + ')');
      try {
        var p = apply(realPlay, el, []);
        if (p && p.then) p.then(function () { log('play() resolved'); }, function (err) { log('play() rejected: ' + (err && err.name)); });
      } catch (err) { log('play() threw: ' + (err && err.name)); }
    };
    // Real visibility, for the app's own logic; the page sees "visible" while masking.
    var reallyHidden = function () { return apply(gVisibility, document, []) !== 'visible'; };
    try {
      Object.defineProperty(docProto, 'visibilityState', {
        get: function () { return masking ? 'visible' : apply(gVisibility, this, []); }, configurable: true,
      });
      Object.defineProperty(docProto, 'hidden', {
        get: function () { return masking ? false : apply(gHidden, this, []); }, configurable: true,
      });
      var gWebkitHidden = getter(docProto, 'webkitHidden');
      if (gWebkitHidden) {
        Object.defineProperty(docProto, 'webkitHidden', {
          get: function () { return masking ? false : apply(gWebkitHidden, this, []); }, configurable: true,
        });
      }
    } catch (e) {}
    // A pause of audible media: WebKit's own at backgrounding (just before or after the page is hidden), or a site
    // reacting to it. Pauses within a few seconds of leaving are undone (each element at most 3 times).
    document.addEventListener('pause', function (e) {
      var el = e.target;
      if (!(el instanceof ME) || apply(gEnded, el, []) || apply(gMuted, el, []) || !(apply(gVolume, el, []) > 0)) return;
      var t = now();
      log('pause, hidden=' + reallyHidden() + ', ' + (hiddenAt ? t - hiddenAt : -1) + ' ms after hide');
      if (!reallyHidden()) { recentPauses[recentPauses.length] = { el: el, at: t }; return; }
      if (masking && t - hiddenAt < 4000) setTimer(function () { resume(el, 'paused in background'); }, 50);
    }, true);
    // Runs before every other listener (window, capture): the page doesn't see leaving and coming back while audio
    // plays, so players that pause themselves on hidden (YouTube's mobile site) go on.
    var onVisibility = function (e) {
      var t = now();
      if (!reallyHidden()) {
        log('visible again, masking was ' + masking);
        hiddenAt = 0;
        attempts = [];
        recentPauses = [];
        if (masking) { masking = false; e.stopImmediatePropagation(); }
        return;
      }
      if (e.type !== 'visibilitychange') { if (masking) e.stopImmediatePropagation(); return; }
      hiddenAt = t;
      var candidates = [];
      for (var i = 0; i < recentPauses.length; i++) if (t - recentPauses[i].at < 1500) candidates[candidates.length] = recentPauses[i].el;
      recentPauses = [];
      log('hidden, audible=' + audibleNow() + ', paused just before=' + candidates.length);
      if (!audibleNow() && !candidates.length) return;
      masking = true;
      e.stopImmediatePropagation();
      for (var j = 0; j < candidates.length; j++) resume(candidates[j], 'paused just before hide');
    };
    window.addEventListener('visibilitychange', onVisibility, true);
    window.addEventListener('webkitvisibilitychange', onVisibility, true);
  }

  // Android: the WebView has no Media Session API; a small one lets sites describe what plays and handle buttons.
  if (POLYFILL && !('mediaSession' in navigator)) {
    var Metadata = function MediaMetadata(init) {
      init = init || {};
      this.title = String(init.title || '');
      this.artist = String(init.artist || '');
      this.album = String(init.album || '');
      this.artwork = Array.isArray(init.artwork) ? init.artwork.slice() : [];
    };
    var metadata = null;
    var session = {
      playbackState: 'none',
      setActionHandler: function (action, handler) { handlers[String(action)] = typeof handler === 'function' ? handler : null; schedule(); },
      setPositionState: function () {},
      setCameraActive: function () {},
      setMicrophoneActive: function () {},
    };
    Object.defineProperty(session, 'metadata', {
      get: function () { return metadata; },
      set: function (value) { metadata = value || null; schedule(); },
    });
    try {
      window.MediaMetadata = Metadata;
      Object.defineProperty(Navigator.prototype, 'mediaSession', { get: function () { return session; }, configurable: true });
    } catch (e) {}
  } else if (window.MediaSession) {
    var realSet = MediaSession.prototype.setActionHandler;
    if (realSet) {
      try {
        Object.defineProperty(MediaSession.prototype, 'setActionHandler', {
          value: function setActionHandler(action, handler) {
            handlers[String(action)] = typeof handler === 'function' ? handler : null;
            schedule();
            return apply(realSet, this, arguments);
          },
          writable: true, configurable: true,
        });
      } catch (e) {}
    }
    // iOS incognito: WebKit shows the metadata on the lock screen, so it only ever gets a generic title.
    var metaDesc = Object.getOwnPropertyDescriptor(MediaSession.prototype, 'metadata');
    if (PRIVATE && metaDesc && metaDesc.set && window.MediaMetadata) {
      var generic = function () { try { return new MediaMetadata({ title: PRIVATE_LABEL }); } catch (e) { return null; } };
      try {
        Object.defineProperty(MediaSession.prototype, 'metadata', {
          get: metaDesc.get, set: function () { apply(metaDesc.set, this, [generic()]); }, configurable: false,
        });
        apply(metaDesc.set, navigator.mediaSession, [generic()]);
      } catch (e) {}
    }
  }

  function check() {
    var t = now(), audible = false, playing = false, video = null, loudVideo = null, loudest = null, keep = [];
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var paused = apply(gPaused, el, []);
      if (paused && !el.isConnected && el !== current) continue;
      keep[keep.length] = el;
      if (paused || apply(gEnded, el, []) || apply(gReady, el, []) < 2) continue;
      var data = info(el);
      var time = apply(timeDesc.get, el, []);
      var advancing = time !== data.time || t - data.startedAt < HEARTBEAT + 2000;
      data.time = time;
      if (!advancing) continue;
      playing = true;
      var isLoud = loud(el);
      if (isLoud) {
        audible = true;
        if (!loudest || el === current) loudest = el;
      }
      if (VE && el instanceof VE && apply(gWidth, el, []) > 0) {
        if (!video || el === current) video = el;
        if (isLoud && (!loudVideo || el === current)) loudVideo = el;
      }
    }
    if (loudest && (!current || apply(gPaused, current, []) || !loud(current))) current = loudest;
    // The video reported (its size and place, for picture-in-picture): the one with sound before a muted one.
    if (loudVideo) video = loudVideo;
    elements = keep;
    var live = [];
    for (var j = 0; j < frames.length; j++) {
      if (t - frames[j].at > HEARTBEAT * 3) continue;
      live[live.length] = frames[j];
      if (frames[j].audible) audible = true;
      if (frames[j].playing) playing = true;
    }
    frames = live;
    return { audible: audible, playing: playing, video: video };
  }

  // Android picture-in-picture for a video that plays inline (modules/qutai-media, PictureInPicture.kt): the part
  // of the page's view the video covers now, in device pixels ([left, top, width, height], clipped to the visible
  // viewport; null when it is scrolled out of view), for the PiP window's enter animation and to tell whether the
  // video is on screen at all.
  function rectOf(el) {
    try {
      var r = el.getBoundingClientRect();
      var vv = window.visualViewport;
      var ox = vv ? vv.offsetLeft : 0, oy = vv ? vv.offsetTop : 0;
      var vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
      var k = (window.devicePixelRatio || 1) * (vv ? vv.scale : 1);
      var l = Math.max(r.left - ox, 0), t = Math.max(r.top - oy, 0);
      var w = Math.min(r.right - ox, vw) - l, h = Math.min(r.bottom - oy, vh) - t;
      if (!(w >= 1 && h >= 1)) return null;
      return [Math.round(l * k), Math.round(t * k), Math.round(w * k), Math.round(h * k)];
    } catch (e) { return null; }
  }
  var lastVideo = null;
  // Android: the size of the video the page shows full screen, so the app turns to landscape for a landscape video
  // (modules/qutai-media, FullscreenOrientation.kt). A frame shown full screen gives the size its own script
  // reported (iOS, where frames run it), else its width and height attributes (an embedded player), else 16:9.
  function fullVideo() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return null;
    var best = null, area = 0;
    var list = VE && fs instanceof VE ? [fs] : (fs.querySelectorAll ? fs.querySelectorAll('video') : []);
    for (var i = 0; i < list.length; i++) {
      var w = apply(gWidth, list[i], []), h = apply(gHeight, list[i], []);
      if (w > 0 && h > 0 && w * h > area) { area = w * h; best = [w, h]; }
    }
    if (best) return best;
    if (String(fs.tagName).toUpperCase() !== 'IFRAME') return null;
    for (var j = 0; j < frames.length; j++) {
      if (frames[j].source === fs.contentWindow && frames[j].full) return frames[j].full;
    }
    var aw = parseInt(fs.getAttribute('width'), 10), ah = parseInt(fs.getAttribute('height'), 10);
    if (aw > 0 && ah > 0) return [aw, ah];
    return [16, 9];
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (type) { document.addEventListener(type, schedule, true); });
  // A video's size known (or changed) while it is full screen.
  ['loadedmetadata', 'resize'].forEach(function (type) {
    document.addEventListener(type, function () { if (document.fullscreenElement || document.webkitFullscreenElement) schedule(); }, true);
  });
  // Sites that refuse picture-in-picture themselves. YouTube's mobile site allows it only for "backgroundable" videos
  // (YouTube Premium): otherwise it treats a small window as PiP, leaves full screen and pauses, and keeps pausing
  // until the window is big again, which would also stop the sound that background playback keeps going. Its
  // player's own API says which it is; without the API, no PiP there.
  function pipRefused() {
    if (!/(^|\\.)youtube\\.com$/.test(location.hostname)) return false;
    try {
      var player = document.getElementById('movie_player');
      var data = player && typeof player.getVideoData === 'function' ? player.getVideoData() : null;
      return !(data && data.backgroundable === true);
    } catch (e) { return true; }
  }
  // While a video plays, scrolling moves it: reported again (at most every 150 ms, only when the rect changed).
  var onMove = function () { if (repeat && lastVideo) schedule(); };
  window.addEventListener('scroll', onMove, { capture: true, passive: true });
  window.addEventListener('resize', onMove, { capture: true, passive: true });
  // Going into PiP with an inline video: the video must be full screen first, so the PiP window shows only the
  // video, and the Fullscreen API needs a user activation. The app arms this ("pipEnter") and then sends one tap to
  // the page's view itself (a real input event, so the browser gives it the activation): the tap is swallowed here,
  // before any of the page's listeners, and makes the video full screen. Only trusted events, only within 1.5 s of
  // arming, only the app's own command (nonce).
  var pipArmedUntil = 0, pipTarget = null, pipFullscreen = null;
  // The element made full screen: the outermost ancestor with the video's own box (the site's player, which keeps
  // its controls and its own idea of full screen: YouTube's mobile site exits a full screen on anything but its
  // player container, then pauses), else the video itself.
  function playerOf(video) {
    var el = video, box = video.getBoundingClientRect();
    for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      var r = p.getBoundingClientRect();
      if (Math.abs(r.left - box.left) <= 2 && Math.abs(r.top - box.top) <= 2 &&
        Math.abs(r.width - box.width) <= 2 && Math.abs(r.height - box.height) <= 2) el = p;
      // A bigger ancestor is the page around the player; a smaller one (a zero-height wrapper) is skipped.
      else if (r.width > box.width + 2 || r.height > box.height + 2) break;
    }
    return el;
  }
  function pipGo() {
    var video = pipTarget;
    pipTarget = null;
    if (!video || !video.isConnected || document.fullscreenElement || document.webkitFullscreenElement) return;
    var el = playerOf(video);
    var request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) return;
    try {
      var p = apply(request, el, [{ navigationUI: 'hide' }]);
      pipFullscreen = el;
      if (p && p.catch) p.catch(function () { if (pipFullscreen === el) pipFullscreen = null; });
    } catch (e) { pipFullscreen = null; }
  }
  function pipSwallow(e) {
    if (!e.isTrusted || now() > pipArmedUntil) return;
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
    if (e.type === 'pointerup' || e.type === 'touchend') pipGo();
    else if (e.type === 'click') pipArmedUntil = 0;
  }
  if (mainFrame) {
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click'].forEach(function (type) {
      window.addEventListener(type, pipSwallow, { capture: true, passive: false });
    });
  }

  function metadataOf() {
    var ms = navigator.mediaSession;
    var m = ms && ms.metadata;
    if (!m) return { title: '', artist: '', album: '', artwork: '' };
    var art = '';
    var list = m.artwork || [];
    var best = 0;
    for (var i = 0; i < list.length; i++) {
      var size = parseInt(String((list[i] && list[i].sizes) || '0'), 10) || 1;
      if (list[i] && list[i].src && size >= best) { best = size; art = String(list[i].src); }
    }
    if (art) { try { art = new URL(art, location.href).href; } catch (e) { art = ''; } }
    return { title: String(m.title || ''), artist: String(m.artist || ''), album: String(m.album || ''), artwork: art };
  }

  function report() {
    pending = null;
    var s = check();
    if (s.playing || frames.length) { if (!repeat) repeat = setRepeat(heartbeat, HEARTBEAT); }
    else if (repeat) { clearRepeat(repeat); repeat = null; }
    if (!mainFrame) {
      try { window.parent.postMessage({ __qutaiPlaybackFrame: FRAMES, audible: s.audible, playing: s.playing, full: fullVideo() }, '*'); } catch (e) {}
      return;
    }
    var meta = metadataOf();
    var actions = [];
    for (var name in handlers) if (handlers[name]) actions[actions.length] = name;
    var el = current;
    var duration = el ? apply(gDuration, el, []) : 0;
    lastVideo = s.video;
    var msg = {
      __qutaiPlayback: NONCE,
      audible: s.audible,
      playing: s.playing,
      paused: el ? apply(gPaused, el, []) : true,
      ended: el ? apply(gEnded, el, []) : false,
      video: s.video ? [apply(gWidth, s.video, []), apply(gHeight, s.video, [])] : null,
      full: fullVideo(),
      rect: s.video ? rectOf(s.video) : null,
      noPip: s.video ? pipRefused() : false,
      title: meta.title || document.title || '',
      artist: meta.artist,
      album: meta.album,
      artwork: meta.artwork,
      actions: actions,
      duration: isFinite(duration) && duration > 0 ? duration : 0,
      rate: el ? apply(gRate, el, []) : 1,
    };
    var key = stringify(msg);
    // Reported when something changed, and on every heartbeat while playing (the app's proof of life).
    if (key === lastKey && !s.playing) return;
    lastKey = key;
    msg.position = el ? apply(timeDesc.get, el, []) : 0;
    try { apply(post, bridge, [stringify(msg)]); } catch (e) {}
  }
  function heartbeat() { report(); }
  function schedule() {
    if (pending) return;
    pending = setTimer(report, 150);
  }

  function broadcast(action) {
    for (var i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage({ __qutaiPlaybackCommand: FRAMES, action: action }, '*'); } catch (e) {}
    }
  }
  function command(action, seconds) {
    var i;
    if (action === 'pauseAll') {
      // A video in picture-in-picture was moved there by the user to keep watching: left playing.
      for (i = 0; i < elements.length; i++) {
        var item = elements[i];
        if (document.pictureInPictureElement === item || item.webkitPresentationMode === 'picture-in-picture') continue;
        try { apply(realPause, item, []); } catch (e) {}
      }
      broadcast(action);
      return;
    }
    if (action === 'pipEnter') {
      pipTarget = lastVideo;
      pipArmedUntil = pipTarget ? now() + 1500 : 0;
      return;
    }
    if (action === 'pipExit') {
      // Leaves the full screen that pipEnter started (PiP expanded back into the app, or closed).
      var fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (pipFullscreen && fs === pipFullscreen) {
        try { apply((document.exitFullscreen || document.webkitExitFullscreen), document, []); } catch (e) {}
      }
      pipFullscreen = null;
      return;
    }
    var handler = handlers[action];
    if (handler) {
      var details = { action: action };
      if (action === 'seekto') details.seekTime = seconds;
      if (action === 'seekforward' || action === 'seekbackward') details.seekOffset = 10;
      try { handler(details); } catch (e) {}
      return;
    }
    var el = current;
    if (!el) return;
    try {
      if (action === 'play') { var p = apply(realPlay, el, []); if (p && p.catch) p.catch(function () {}); }
      else if (action === 'pause' || action === 'stop') apply(realPause, el, []);
      else if (action === 'seekto' && typeof seconds === 'number') apply(timeDesc.set, el, [seconds]);
      else if (action === 'seekforward') apply(timeDesc.set, el, [apply(timeDesc.get, el, []) + 10]);
      else if (action === 'seekbackward') apply(timeDesc.set, el, [Math.max(0, apply(timeDesc.get, el, []) - 10)]);
    } catch (e) {}
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    // The page's own listeners (added after this one) never see these messages.
    if (d.__qutaiPlaybackFrame === FRAMES || d.__qutaiPlaybackCommand === FRAMES) hush(e);
    if (d.__qutaiPlaybackFrame === FRAMES && mainFrame) {
      var found = null;
      for (var i = 0; i < frames.length; i++) if (frames[i].source === e.source) found = frames[i];
      if (!found) { found = { source: e.source }; frames[frames.length] = found; }
      found.audible = d.audible === true;
      found.playing = d.playing === true;
      found.full = d.full && d.full.length === 2 && d.full[0] > 0 && d.full[1] > 0 ? [+d.full[0], +d.full[1]] : null;
      found.at = now();
      schedule();
    } else if (d.__qutaiPlaybackFrame === FRAMES) {
      // A frame inside a frame: passed up.
      try { window.parent.postMessage(d, '*'); } catch (err) {}
    } else if (d.__qutaiPlaybackCommand === FRAMES && !mainFrame && d.action === 'pauseAll') {
      command('pauseAll');
    }
  }, true);

  if (mainFrame) {
    Object.defineProperty(window, '__qutaiPlayback', {
      value: function (nonce, action, seconds) {
        if (nonce !== NONCE) return;
        command(String(action), seconds);
        schedule();
      },
    });
  }
})();`;
}

/** The part of Tab the playback state needs. */
export interface PlaybackTab {
  readonly webview: ComponentRef<typeof WebView> | null;
  notifyPlaybackChange(): void;
}

/** Pages with media playing (audible or not). */
const playingPages = new Set<PagePlayback>();

/** Pauses the media in every tab (iOS, "Keep playing in the background" off, when the app leaves the foreground). */
export function pauseAllPages() {
  playingPages.forEach((page) => page.command('pauseAll'));
}

/** One tab's media, as the page script reports it. */
export class PagePlayback {
  /** A random token only the injected script knows. */
  readonly nonce = newNonce();
  /** Audible media plays in the page (or in a frame of it, iOS). */
  audible = false;
  /** Some media plays (also muted video), e.g. for picture-in-picture. */
  playing = false;
  title = '';
  artist = '';
  private staleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private tab: PlaybackTab) {}

  /** Handles a message from the injected script; false for other messages. */
  handleMessage(data: string): boolean {
    if (data.startsWith('{"__qutaiPlaybackLog":')) {
      // Development builds: the background playback steps, printed in the Metro terminal.
      try {
        const log = JSON.parse(data) as { __qutaiPlaybackLog?: string; at?: number; text?: string; frame?: boolean };
        if (__DEV__ && log.__qutaiPlaybackLog === this.nonce) {
          console.log(`[Qutai playback] ${new Date(log.at ?? 0).toISOString().slice(11, 23)}${log.frame ? ' (frame)' : ''} ${log.text}`);
        }
      } catch {}
      return true;
    }
    if (!data.startsWith('{"__qutaiPlayback":')) return false;
    let msg: Report;
    try {
      msg = JSON.parse(data);
    } catch {
      return true;
    }
    if (msg.__qutaiPlayback !== this.nonce) return true;
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = msg.playing ? setTimeout(() => this.update(false, false), STALE_MS) : null;
    this.title = typeof msg.title === 'string' ? msg.title.slice(0, 200) : '';
    this.artist = typeof msg.artist === 'string' ? msg.artist.slice(0, 200) : '';
    this.update(msg.audible === true, msg.playing === true);
    return true;
  }

  /** Runs a playback command in the page (pause from the tab switcher, pauseAll). */
  command(action: PlaybackAction, seconds?: number) {
    const arg = typeof seconds === 'number' && Number.isFinite(seconds) ? String(seconds) : 'null';
    this.tab.webview?.injectJavaScript(
      `if (window.__qutaiPlayback) window.__qutaiPlayback(${JSON.stringify(this.nonce)}, ${JSON.stringify(action)}, ${arg}); true;`,
    );
  }

  /** A new document, a sleeping or closed tab: nothing plays any more. */
  reset() {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = null;
    this.title = '';
    this.artist = '';
    this.update(false, false);
  }

  private update(audible: boolean, playing: boolean) {
    const audibleChanged = audible !== this.audible;
    if (!audibleChanged && playing === this.playing) return;
    this.audible = audible;
    this.playing = playing;
    if (audible || playing) playingPages.add(this);
    else playingPages.delete(this);
    this.tab.notifyPlaybackChange();
  }
}
