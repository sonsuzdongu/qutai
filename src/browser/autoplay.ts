import { Platform } from 'react-native';
import { derivedKey } from './pageKeys';

/**
 * "Let sites play videos with sound automatically" (Settings › Appearance › Media), off by default: a page can't
 * start media with sound until the user has touched it (Chrome's rule: the page has had a user activation), while
 * muted autoplay (silent previews, GIF-like videos) keeps working. The WebView itself lets pages play without a
 * gesture (mediaPlaybackRequiresUserAction off), and this script, in every frame at document start, holds back the
 * sound:
 *
 * - play() on an element that would be heard rejects with NotAllowedError, as in Chrome;
 * - an element that starts by itself (the autoplay attribute) or unmutes itself while playing is paused;
 * - a Web Audio context starts suspended and resumes at the first touch.
 *
 * A frame counts the touch on its own page or on the page around it (the main frame tells its frames); the script
 * keeps its own record of real touches and keys (see autoplayGuardScript about iOS). Camera and microphone streams
 * (srcObject) are never held back. With the setting on, the script isn't added.
 *
 * Plain ES5 in a string, like the page script. The real play() stays reachable for Qutai's own playback commands
 * (lock screen, notification): the guard hands it to whoever shows the tab's play key, which only the playback
 * script has (playback.ts). Nothing on `window` and no message between frames carries the tab's nonce (pageKeys.ts).
 */

/** The rule as the page runs it (tested in scripts/media-tests/autoplay.test.ts). */
export const AUTOPLAY_RULE = String.raw`
function qutaiMayStart(muted, volume, stream, activated) {
  return activated || stream || muted || !(volume > 0);
}
`;

/** The guard's one name on `window`: a function that gives the real play() for the tab's play key. */
export const AUTOPLAY_GUARD = '__qutaiAutoplayGuard';

/**
 * `browserActivation`: also trust the browser's own record of a user activation (`navigator.userActivation`, which
 * also covers a touch before the script was installed). Android only: WebKit counts the app's own injected scripts
 * (WKWebView evaluateJavaScript, which Qutai uses after every load) as a user gesture, so on iOS a page would count as
 * touched without the user; there only the touches and keys the script saw itself count.
 */
export function autoplayGuardScript(nonce: string, browserActivation = Platform.OS === 'android'): string {
  return String.raw`(function () {
  var ME = window.HTMLMediaElement;
  var GUARD = ${JSON.stringify(AUTOPLAY_GUARD)};
  var PLAY = ${JSON.stringify(derivedKey(nonce, 'play'))};
  if (!ME || GUARD in window) return;
  ${AUTOPLAY_RULE}
  // Called directly, never through Function.prototype.call / .apply: a page can replace those and read what passes
  // through them (the nonce in a message to the app), or make a call do nothing.
  var apply = window.Reflect && window.Reflect.apply;
  var construct = window.Reflect && window.Reflect.construct;
  if (typeof apply !== 'function' || typeof construct !== 'function') return;
  var FRAMES = ${JSON.stringify(derivedKey(nonce, 'frames'))};
  var BROWSER_ACTIVATION = ${browserActivation ? 'true' : 'false'};
  var proto = ME.prototype;
  var realPlay = proto.play, realPause = proto.pause;
  // Elements Qutai's own commands played (the user pressed play on the lock screen or in the notification).
  var permitted = typeof WeakSet === 'function' ? new WeakSet() : null;
  function ownPlay() {
    if (permitted) permitted.add(this);
    return apply(realPlay, this, arguments);
  }
  function hand(key) { return key === PLAY ? ownPlay : null; }
  try { Object.defineProperty(window, GUARD, { value: hand, writable: false, enumerable: false, configurable: false }); } catch (e) { return; }
  function getter(name) { var d = Object.getOwnPropertyDescriptor(proto, name); return d && d.get; }
  var gMuted = getter('muted'), gVolume = getter('volume'), gPaused = getter('paused');
  var srcObject = getter('srcObject');
  var MS = window.MediaStream;
  var P = window.Promise;
  var DOMEx = window.DOMException;
  var mainFrame = window.top === window;
  var stopNow = window.Event && window.Event.prototype.stopImmediatePropagation;
  var touched = false;
  var told = false;
  function activated() {
    if (touched || told) return true;
    if (!BROWSER_ACTIVATION) return false;
    try { if (navigator.userActivation && navigator.userActivation.hasBeenActive) return true; } catch (e) {}
    return false;
  }
  function stream(el) {
    try { var s = srcObject && apply(srcObject, el, []); return !!(s && MS && s instanceof MS); } catch (e) { return false; }
  }
  function mayStart(el) {
    if (permitted && permitted.has(el)) return true;
    var muted = true, volume = 0;
    try { muted = apply(gMuted, el, []); volume = apply(gVolume, el, []); } catch (e) { return true; }
    return qutaiMayStart(muted, volume, stream(el), activated());
  }
  function refused() {
    var msg = "play() failed because the user didn't interact with the document first.";
    try { return new DOMEx(msg, 'NotAllowedError'); } catch (e) { var err = new Error(msg); err.name = 'NotAllowedError'; return err; }
  }
  try {
    Object.defineProperty(proto, 'play', {
      value: function play() {
        if (!mayStart(this)) return P.reject(refused());
        return apply(realPlay, this, arguments);
      },
      writable: true, configurable: true,
    });
  } catch (e) {}
  // Started by itself (autoplay attribute, or a play() kept from before) or unmuted while playing: paused.
  function check(e) {
    var el = e.target;
    if (!(el instanceof ME)) return;
    try { if (apply(gPaused, el, []) || mayStart(el)) return; } catch (err) { return; }
    try { apply(realPause, el, []); } catch (err) {}
  }
  document.addEventListener('play', check, true);
  document.addEventListener('playing', check, true);
  document.addEventListener('volumechange', check, true);

  // Web Audio: suspended until the first touch, then resumed (unless the page suspended it itself).
  var held = [];
  function wrapAudio(name) {
    var C = window[name];
    if (typeof C !== 'function' || !C.prototype) return;
    var suspend = C.prototype.suspend, resume = C.prototype.resume;
    if (typeof suspend !== 'function' || typeof resume !== 'function') return;
    function Wrapped() {
      var ctx = construct(C, arguments);
      if (!activated()) {
        held[held.length] = { ctx: ctx, resume: resume };
        try { var p = apply(suspend, ctx, []); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      }
      return ctx;
    }
    Wrapped.prototype = C.prototype;
    try { Object.setPrototypeOf(Wrapped, C); } catch (e) {}
    try {
      Object.defineProperty(C.prototype, 'resume', {
        value: function () {
          if (!activated()) {
            var ctx = this;
            for (var i = 0; i < held.length; i++) if (held[i].ctx === ctx) return P.resolve();
            held[held.length] = { ctx: ctx, resume: resume };
            return P.resolve();
          }
          return apply(resume, this, arguments);
        },
        writable: true, configurable: true,
      });
      Object.defineProperty(window, name, { value: Wrapped, writable: true, configurable: true });
    } catch (e) {}
  }
  wrapAudio('AudioContext');
  wrapAudio('webkitAudioContext');

  function release() {
    var list = held;
    held = [];
    for (var i = 0; i < list.length; i++) {
      try { var p = apply(list[i].resume, list[i].ctx, []); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
  }
  // Tells the frames inside (and theirs) that the user touched the page around them.
  function tellFrames(win) {
    for (var i = 0; i < win.length; i++) {
      try { win[i].postMessage({ __qutaiAutoplay: FRAMES }, '*'); } catch (e) {}
      try { tellFrames(win[i]); } catch (e) {}
    }
  }
  function onInput(e) {
    if (!e.isTrusted || touched) return;
    touched = true;
    release();
    tellFrames(window);
  }
  ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'].forEach(function (type) {
    window.addEventListener(type, onInput, { capture: true, passive: true });
  });
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || d.__qutaiAutoplay !== FRAMES) return;
    // The page's own listeners (added after this one) never see the message.
    try { apply(stopNow, e, []); } catch (err) {}
    if (d.ask && activated() && e.source) {
      try { e.source.postMessage({ __qutaiAutoplay: FRAMES }, '*'); } catch (err) {}
      return;
    }
    if (!d.ask && !mainFrame && !told) { told = true; release(); }
  }, true);
  // A frame loaded after the touch asks the main frame.
  if (!mainFrame) { try { window.top.postMessage({ __qutaiAutoplay: FRAMES, ask: true }, '*'); } catch (e) {} }
})();
`;
}
