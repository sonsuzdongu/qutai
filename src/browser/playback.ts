import { Platform } from 'react-native';
import type { ComponentRef } from 'react';
import type { WebView } from 'react-native-webview';

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
 * with the nonce); the main frame adds the frames' state to its own. On Android scripts reach the main frame only,
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

export function playbackScript(nonce: string, incognito: boolean, privateLabel: string): string {
  return `(function () {
  if (window.__qutaiPlaybackInstalled) return;
  Object.defineProperty(window, '__qutaiPlaybackInstalled', { value: true });
  var NONCE = ${JSON.stringify(nonce)};
  var PRIVATE = ${incognito ? 'true' : 'false'};
  var PRIVATE_LABEL = ${JSON.stringify(privateLabel)};
  var POLYFILL = ${Platform.OS === 'android' ? 'true' : 'false'};
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
  var realPlay = proto.play, realPause = proto.pause;
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
  function track(el) {
    for (var i = 0; i < elements.length; i++) if (elements[i] === el) return;
    elements[elements.length] = el;
  }
  try {
    Object.defineProperty(proto, 'play', {
      value: function play() { track(this); return realPlay.apply(this, arguments); },
      writable: true, configurable: true,
    });
  } catch (e) {}
  ['play', 'playing', 'pause', 'ended', 'volumechange', 'emptied', 'seeked', 'loadeddata'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var el = e.target;
      if (!(el instanceof ME)) return;
      track(el);
      if (type === 'playing') { info(el).startedAt = now(); current = el; }
      schedule();
    }, true);
  });

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
            return realSet.apply(this, arguments);
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
          get: metaDesc.get, set: function () { metaDesc.set.call(this, generic()); }, configurable: false,
        });
        metaDesc.set.call(navigator.mediaSession, generic());
      } catch (e) {}
    }
  }

  function check() {
    var t = now(), audible = false, playing = false, video = null, keep = [];
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var paused = gPaused.call(el);
      if (paused && !el.isConnected && el !== current) continue;
      keep[keep.length] = el;
      if (paused || gEnded.call(el) || gReady.call(el) < 2) continue;
      var data = info(el);
      var time = timeDesc.get.call(el);
      var advancing = time !== data.time || t - data.startedAt < HEARTBEAT + 2000;
      data.time = time;
      if (!advancing) continue;
      playing = true;
      if (VE && el instanceof VE && gWidth.call(el) > 0 && (!video || el === current)) video = el;
      if (!gMuted.call(el) && gVolume.call(el) > 0) {
        audible = true;
        if (!current || gPaused.call(current)) current = el;
      }
    }
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
      try { window.parent.postMessage({ __qutaiPlaybackFrame: NONCE, audible: s.audible, playing: s.playing }, '*'); } catch (e) {}
      return;
    }
    var meta = metadataOf();
    var actions = [];
    for (var name in handlers) if (handlers[name]) actions[actions.length] = name;
    var el = current;
    var duration = el ? gDuration.call(el) : 0;
    var msg = {
      __qutaiPlayback: NONCE,
      audible: s.audible,
      playing: s.playing,
      paused: el ? gPaused.call(el) : true,
      video: s.video ? [gWidth.call(s.video), gHeight.call(s.video)] : null,
      title: meta.title || document.title || '',
      artist: meta.artist,
      album: meta.album,
      artwork: meta.artwork,
      actions: actions,
      duration: isFinite(duration) && duration > 0 ? duration : 0,
      rate: el ? gRate.call(el) : 1,
    };
    var key = stringify(msg);
    // Reported when something changed, and on every heartbeat while playing (the app's proof of life).
    if (key === lastKey && !s.playing) return;
    lastKey = key;
    msg.position = el ? timeDesc.get.call(el) : 0;
    try { post.call(bridge, stringify(msg)); } catch (e) {}
  }
  function heartbeat() { report(); }
  function schedule() {
    if (pending) return;
    pending = setTimer(report, 150);
  }

  function broadcast(action) {
    for (var i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage({ __qutaiPlaybackCommand: NONCE, action: action }, '*'); } catch (e) {}
    }
  }
  function command(action, seconds) {
    var i;
    if (action === 'pauseAll') {
      // A video in picture-in-picture was moved there by the user to keep watching: left playing.
      for (i = 0; i < elements.length; i++) {
        var item = elements[i];
        if (document.pictureInPictureElement === item || item.webkitPresentationMode === 'picture-in-picture') continue;
        try { realPause.call(item); } catch (e) {}
      }
      broadcast(action);
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
      if (action === 'play') { var p = realPlay.call(el); if (p && p.catch) p.catch(function () {}); }
      else if (action === 'pause' || action === 'stop') realPause.call(el);
      else if (action === 'seekto' && typeof seconds === 'number') timeDesc.set.call(el, seconds);
      else if (action === 'seekforward') timeDesc.set.call(el, timeDesc.get.call(el) + 10);
      else if (action === 'seekbackward') timeDesc.set.call(el, Math.max(0, timeDesc.get.call(el) - 10));
    } catch (e) {}
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.__qutaiPlaybackFrame === NONCE && mainFrame) {
      var found = null;
      for (var i = 0; i < frames.length; i++) if (frames[i].source === e.source) found = frames[i];
      if (!found) { found = { source: e.source }; frames[frames.length] = found; }
      found.audible = d.audible === true;
      found.playing = d.playing === true;
      found.at = now();
      schedule();
    } else if (d.__qutaiPlaybackFrame === NONCE) {
      // A frame inside a frame: passed up.
      try { window.parent.postMessage(d, '*'); } catch (err) {}
    } else if (d.__qutaiPlaybackCommand === NONCE && !mainFrame && d.action === 'pauseAll') {
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

const listeners = new Set<() => void>();
/** Pages with media playing (audible or not). */
const playingPages = new Set<PagePlayback>();

/** Called when any tab starts or stops being audible. */
export function onAudibleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Pauses the media in every tab (iOS, "Keep playing in the background" off, when the app leaves the foreground). */
export function pauseAllPages() {
  playingPages.forEach((page) => page.command('pauseAll'));
}

/** One tab's media, as the page script reports it. */
export class PagePlayback {
  /** A random token only the injected script knows. */
  readonly nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
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
    if (audibleChanged) listeners.forEach((l) => l());
  }
}
