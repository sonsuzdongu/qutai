import { AppState } from 'react-native';
import type { ComponentRef } from 'react';
import type { WebView } from 'react-native-webview';
import { ensureMediaPermission, hasMediaPermission } from '../device/mediaPermissions';
import { offerSettings, PermissionDeniedError } from '../device/settings';
import { t } from '../i18n';
import { MEDIA_KINDS, MediaKind, PermissionSetting } from '../storage/sitePermissions';
import { askSitePermission, requestingSite } from './sitePrompt';
import { newNonce } from '../utils/ids';

/**
 * Camera and microphone for web pages (getUserMedia), with the user's per-site permission.
 *
 * The app can't produce a camera stream itself, so this gates the WebView's own capture instead of
 * replacing it, at two levels:
 *
 * - Native (the enforcement): react-native-webview is patched (patches/react-native-webview+14.0.1.patch)
 *   with a `mediaCaptureGrant` prop, "<origin> camera microphone". Every camera or microphone request
 *   not named there is refused without a prompt: iOS in WKUIDelegate's requestMediaCapturePermission
 *   (main frame of that exact origin, per kind), Android in WebChromeClient.onPermissionRequest
 *   (requesting frame's origin, per kind). The prop is empty except while one request the user
 *   approved is being answered, so holding the OS permission never lets a site in by itself.
 * - Page script (the prompt): getUserMedia in the main frame asks the app over the tab's authenticated
 *   channel; the app checks the site's settings, asks the user, asks the OS, opens the native grant
 *   for exactly that origin and those kinds, and only then lets the page call the real getUserMedia.
 *   The script also keeps the tracks it handed out, to show them in the address bar, pause them
 *   while the tab isn't on screen and stop them when the user revokes. Frames are refused (iOS: the
 *   script runs in every frame and native checks the main frame; Android: native checks the origin).
 *   getDisplayMedia (screen sharing) is always refused.
 */

/** The site settings the bridge needs; the app's SitePermissionStore. */
export interface MediaSettings {
  mediaFor(host: string, kind: MediaKind): PermissionSetting;
  setMedia(host: string, kind: MediaKind, setting: PermissionSetting): Promise<void>;
  subscribe(listener: () => void): () => void;
}

let settings: MediaSettings | null = null;

/** Pages with live camera or microphone tracks. */
const livePages = new Set<PageMediaCapture>();

/** Told when a page is about to get, or has, a live microphone (voice input gives the microphone up). */
const microphoneListeners = new Set<() => void>();

export function onPageMicrophone(listener: () => void): () => void {
  microphoneListeners.add(listener);
  return () => microphoneListeners.delete(listener);
}

/** A page in some tab is capturing the microphone. */
export function pageMicrophoneLive(): boolean {
  return [...livePages].some((page) => page.microphone);
}

/** Connects page capture to the stored site settings; until then every request is refused. */
export function configurePageMedia(store: MediaSettings) {
  settings = store;
  // A setting changed (sheet, Settings, reset): a page that may no longer capture is stopped.
  store.subscribe(() => livePages.forEach((page) => page.stopIfRevoked()));
}

let foreground = AppState.currentState === 'active' || AppState.currentState == null;
AppState.addEventListener('change', (state) => {
  const next = state === 'active';
  if (next === foreground) return;
  foreground = next;
  livePages.forEach((page) => page.updatePause());
});

/** How long the native grant stays open for one approved request if the page never reports back. */
const GRANT_WINDOW_MS = 15000;

/** Installed in every frame before the page's own scripts (and again after load, if Android missed the early run). */
export function mediaCaptureScript(nonce: string): string {
  return `(function () {
  if (window.__qutaiMediaInstalled) return;
  Object.defineProperty(window, '__qutaiMediaInstalled', { value: true });
  var NONCE = ${JSON.stringify(nonce)};
  var stringify = JSON.stringify;
  var bridge = window.ReactNativeWebView;
  var post = bridge && bridge.postMessage;
  var mainFrame = window.top === window;
  var MD = window.MediaDevices;
  var devices = navigator.mediaDevices;
  var realGetUserMedia = (MD && MD.prototype.getUserMedia) || (devices && devices.getUserMedia);
  var Track = window.MediaStreamTrack;
  var realStop = Track && Track.prototype.stop;
  var realClone = Track && Track.prototype.clone;
  var enabled = Track && Object.getOwnPropertyDescriptor(Track.prototype, 'enabled');
  var nextId = 1;
  var calls = {};
  var states = {};
  var tracks = [];
  var pausedTracks = [];
  var paused = false;
  function lock(target, name, value) {
    try { Object.defineProperty(target, name, { value: value, writable: false, configurable: false }); } catch (e) {}
  }
  function notAllowed() { return new DOMException('Permission denied', 'NotAllowedError'); }
  function refuse() { return Promise.reject(notAllowed()); }
  function send(payload) {
    payload.__qutaiMedia = NONCE;
    payload.origin = location.origin;
    try { post.call(bridge, stringify(payload)); return true; } catch (e) { return false; }
  }
  function held(track) {
    for (var i = 0; i < tracks.length; i++) if (tracks[i] === track) return true;
    return false;
  }
  function report() {
    var live = [];
    var camera = false;
    var microphone = false;
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      if (track.readyState === 'ended') continue;
      live[live.length] = track;
      if (track.kind === 'video') camera = true;
      else if (track.kind === 'audio') microphone = true;
    }
    tracks = live;
    send({ type: 'active', camera: camera, microphone: microphone });
  }
  function pauseTrack(track) {
    if (!enabled || !enabled.get.call(track)) return;
    enabled.set.call(track, false);
    pausedTracks[pausedTracks.length] = track;
  }
  function setPaused(on) {
    if (on === paused) return;
    paused = on;
    var i;
    if (on) {
      pausedTracks = [];
      for (i = 0; i < tracks.length; i++) pauseTrack(tracks[i]);
    } else {
      for (i = 0; i < pausedTracks.length; i++) {
        if (pausedTracks[i].readyState !== 'ended') enabled.set.call(pausedTracks[i], true);
      }
      pausedTracks = [];
    }
  }
  function hold(track) {
    if (held(track)) return;
    tracks[tracks.length] = track;
    track.addEventListener('ended', report);
    if (paused) pauseTrack(track);
  }
  function gate(constraints) {
    var target = MD && this instanceof MD ? this : devices;
    var c = constraints || {};
    var camera = !!c.video;
    var microphone = !!c.audio;
    // Nothing asked for: the real function throws the right TypeError.
    if (!camera && !microphone) return realGetUserMedia.call(target, constraints);
    if (!mainFrame || !post) return refuse();
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      calls[id] = function (answer) {
        if (answer.kind !== 'go') return reject(notAllowed());
        if (answer.paused) setPaused(true);
        function attempt(retry) {
          realGetUserMedia.call(target, constraints).then(function (stream) {
            var list = stream.getTracks();
            for (var i = 0; i < list.length; i++) hold(list[i]);
            send({ type: 'done', id: id });
            report();
            resolve(stream);
          }, function (error) {
            // The native grant may reach the WebView a moment after the answer: one more try.
            if (retry && error && error.name === 'NotAllowedError') return setTimeout(function () { attempt(false); }, 400);
            send({ type: 'done', id: id });
            reject(error);
          });
        }
        attempt(true);
      };
      if (!send({ type: 'request', id: id, camera: camera, microphone: microphone })) {
        delete calls[id];
        reject(notAllowed());
      }
    });
  }
  if (realGetUserMedia) {
    if (MD) lock(MD.prototype, 'getUserMedia', gate);
    if (devices) lock(devices, 'getUserMedia', gate);
    ['getUserMedia', 'webkitGetUserMedia'].forEach(function (name) {
      if (!(name in navigator)) return;
      lock(navigator, name, function (constraints, onSuccess, onError) {
        gate.call(devices, constraints).then(onSuccess, function (e) { if (typeof onError === 'function') onError(e); });
      });
    });
  }
  if (MD) lock(MD.prototype, 'getDisplayMedia', refuse);
  if (devices) lock(devices, 'getDisplayMedia', refuse);
  if (Track && realStop && realClone) {
    lock(Track.prototype, 'stop', function () {
      realStop.call(this);
      if (held(this)) report();
    });
    lock(Track.prototype, 'clone', function () {
      var copy = realClone.call(this);
      if (held(this)) { hold(copy); report(); }
      return copy;
    });
  }
  var permissions = navigator.permissions;
  var permProto = permissions && (Object.getPrototypeOf(permissions) || permissions);
  if (permProto && permProto.query) {
    var query = permProto.query;
    permProto.query = function (descriptor) {
      var name = descriptor && descriptor.name;
      if (name !== 'camera' && name !== 'microphone') return query.apply(this, arguments);
      return new Promise(function (resolve) {
        function status(state) {
          return {
            name: name, state: state, onchange: null,
            addEventListener: function () {}, removeEventListener: function () {},
            dispatchEvent: function () { return true; }
          };
        }
        if (!mainFrame || !post) return resolve(status('denied'));
        var id = nextId++;
        states[id] = function (state) { resolve(status(state)); };
        if (!send({ type: 'state', id: id, kind: name })) { delete states[id]; resolve(status('denied')); }
      });
    };
  }
  Object.defineProperty(window, '__qutaiMedia', {
    value: function (nonce, msg) {
      if (nonce !== NONCE || !msg) return;
      if (msg.kind === 'go' || msg.kind === 'deny') {
        var call = calls[msg.id];
        if (call) { delete calls[msg.id]; call(msg); }
      } else if (msg.kind === 'state') {
        var done = states[msg.id];
        if (done) { delete states[msg.id]; done(msg.state); }
      } else if (msg.kind === 'pause') {
        setPaused(!!msg.on);
      } else if (msg.kind === 'stop') {
        for (var i = 0; i < tracks.length; i++) realStop.call(tracks[i]);
        report();
      }
    }
  });
})();`;
}

type Request = {
  __qutaiMedia?: unknown;
  type?: unknown;
  id?: unknown;
  origin?: unknown;
  camera?: unknown;
  microphone?: unknown;
  kind?: unknown;
};

type Reply =
  | { kind: 'go'; id: number; paused: boolean }
  | { kind: 'deny'; id: number }
  | { kind: 'state'; id: number; state: 'granted' | 'denied' | 'prompt' }
  | { kind: 'pause'; on: boolean }
  | { kind: 'stop' };

/** The tab as the bridge sees it. */
export interface MediaTab {
  readonly url: string;
  readonly incognito: boolean;
  readonly webview: ComponentRef<typeof WebView> | null;
  /** The grant, the playback rule or what is being captured changed (WebView props, address bar). */
  notifyMediaChange(): void;
}

/** "<site> wants to use your camera / microphone / camera and microphone". */
function promptKey(kinds: MediaKind[]) {
  if (kinds.length > 1) return 'media.promptTitle.both' as const;
  return kinds[0] === 'camera' ? ('media.promptTitle.camera' as const) : ('media.promptTitle.microphone' as const);
}

/** One tab's page camera and microphone: permission, prompts, the native grant and what is live. */
export class PageMediaCapture {
  /** A random token only the injected script knows (separate from the page command and geolocation nonces). */
  readonly nonce = newNonce();
  /** The page has a live camera / microphone track: shown in the address bar. */
  camera = false;
  microphone = false;
  /** The WebView's mediaCaptureGrant prop: empty, or the one request being answered. */
  grant = '';
  /** Android: once capture was allowed, the page may start playback (its own preview) without a tap. */
  playbackUnlocked = false;
  /** Counts page loads: an answer for an earlier page is never delivered. */
  private generation = 0;
  /** Kinds the user allowed once for this page (normal tabs; forgotten on the next load). */
  private allowedOnce = new Set<MediaKind>();
  /** Kinds allowed in incognito for the request that is live now (never remembered). */
  private liveGrant = new Set<MediaKind>();
  /** Kinds the user refused for this page, so the page can't ask again and again. */
  private deniedOnce = new Set<MediaKind>();
  /** Requests are answered one at a time: one prompt and one native grant at once. */
  private queue: Promise<void> = Promise.resolve();
  private abort = new AbortController();
  private windowDone: { id: number; resolve: () => void } | null = null;
  private grantApplied: { value: string; resolve: () => void } | null = null;
  /** "Open settings" is offered once per page, not on every request. */
  private offeredSettings = false;
  /** The tab is the one on screen. */
  private shown = true;
  private paused = false;

  constructor(private tab: MediaTab) {}

  /** The page has a live track (kept awake, never put to sleep). */
  get capturing(): boolean {
    return this.camera || this.microphone;
  }

  /** Handles a message from the injected script; false for other messages. */
  handleMessage(data: string): boolean {
    if (!data.includes('__qutaiMedia')) return false;
    let msg: Request;
    try {
      msg = JSON.parse(data);
    } catch {
      return false;
    }
    if (msg.__qutaiMedia !== this.nonce) return true;
    const origin = typeof msg.origin === 'string' ? msg.origin : '';
    const id = Number(msg.id);
    const generation = this.generation;
    if (!origin) return true;
    if (!this.siteOf(origin)) {
      // Not the tab's own https site (e.g. the tab is already on its way elsewhere): a plain no, so the page doesn't wait.
      if (Number.isInteger(id) && msg.type === 'request') this.deliver(origin, { kind: 'deny', id });
      if (Number.isInteger(id) && msg.type === 'state') this.deliver(origin, { kind: 'state', id, state: 'denied' });
      return true;
    }
    if (msg.type === 'active') {
      this.setActive(msg.camera === true, msg.microphone === true);
    } else if (!Number.isInteger(id)) {
      return true;
    } else if (msg.type === 'request') {
      const kinds = MEDIA_KINDS.filter((kind) => msg[kind] === true);
      this.queue = this.queue
        .then(() => this.serve(generation, origin, id, kinds))
        .catch(() => this.reply(generation, origin, { kind: 'deny', id }));
    } else if (msg.type === 'done') {
      if (this.windowDone?.id === id) this.windowDone.resolve();
    } else if (msg.type === 'state' && (msg.kind === 'camera' || msg.kind === 'microphone')) {
      const kind = msg.kind;
      void this.permissionState(origin, kind).then((state) => this.reply(generation, origin, { kind: 'state', id, state }));
    }
    return true;
  }

  /** The WebView rendered this grant (called from the component after the prop reached it). */
  applied(value: string) {
    if (this.grantApplied?.value === value) this.grantApplied.resolve();
  }

  /** The tab came on screen or left it: capture is paused while it is not shown or the app is in the background. */
  setShown(shown: boolean) {
    this.shown = shown;
    this.updatePause();
  }

  updatePause() {
    const paused = !(this.shown && foreground);
    if (paused === this.paused) return;
    this.paused = paused;
    if (this.capturing) this.send({ kind: 'pause', on: paused });
  }

  /** The user revoked or tapped stop: the page's tracks end, and the page reloads so nothing is left running. */
  stop() {
    if (!this.tab.webview) return this.reset();
    this.send({ kind: 'stop' });
    this.reset();
    this.tab.webview.reload();
  }

  /** Stops capture the site's settings no longer allow (a block, or "always" taken back). */
  stopIfRevoked() {
    const host = this.siteOf(this.tab.url);
    const revoked = MEDIA_KINDS.some((kind) => this[kind] && (!host || !this.permitted(host, kind)));
    if (revoked) this.stop();
  }

  /** A new page, another site, a sleeping or closed tab: close the grant and forget this page's answers. */
  reset() {
    this.generation++;
    this.abort.abort();
    this.abort = new AbortController();
    this.queue = Promise.resolve();
    this.allowedOnce.clear();
    this.liveGrant.clear();
    this.deniedOnce.clear();
    this.offeredSettings = false;
    this.windowDone?.resolve();
    this.windowDone = null;
    this.grantApplied?.resolve();
    this.grantApplied = null;
    livePages.delete(this);
    const changed = this.grant !== '' || this.playbackUnlocked || this.capturing;
    this.grant = '';
    this.playbackUnlocked = false;
    this.camera = false;
    this.microphone = false;
    if (changed) this.tab.notifyMediaChange();
  }

  private siteOf(origin: string): string | null {
    return requestingSite(origin, this.tab.url);
  }

  /** The stored setting; incognito tabs keep a block but never use a stored allow. */
  private settingFor(host: string, kind: MediaKind): PermissionSetting {
    const stored = settings?.mediaFor(host, kind) ?? 'block';
    return this.tab.incognito && stored === 'allow' ? 'ask' : stored;
  }

  /** Whether the page may (still) use this kind: allowed for the site, or by an answer for this page. */
  private permitted(host: string, kind: MediaKind): boolean {
    return this.settingFor(host, kind) === 'allow' || this.allowedOnce.has(kind) || this.liveGrant.has(kind);
  }

  private async permissionState(origin: string, kind: MediaKind): Promise<'granted' | 'denied' | 'prompt'> {
    const host = this.siteOf(origin);
    if (!host || !settings) return 'denied';
    if (this.settingFor(host, kind) === 'block' || this.deniedOnce.has(kind)) return 'denied';
    if (this.permitted(host, kind)) return (await hasMediaPermission(kind)) ? 'granted' : 'prompt';
    return 'prompt';
  }

  /** One request, start to end: decide, ask the OS, open the native grant, let the page in, close it. */
  private async serve(generation: number, origin: string, id: number, kinds: MediaKind[]) {
    if (generation !== this.generation) return;
    const deny = () => this.reply(generation, origin, { kind: 'deny', id });
    // The grant names the origin verbatim; anything odd in it is refused.
    if (!kinds.length || !/^https:\/\/[^\s/]+$/i.test(origin)) return deny();
    if (!(await this.authorize(generation, origin, kinds))) return deny();
    if (!(await this.systemPermission(kinds))) return deny();
    if (generation !== this.generation) return;
    if (kinds.includes('microphone')) microphoneListeners.forEach((l) => l());

    const grant = `${origin.toLowerCase()} ${kinds.join(' ')}`;
    const applied = new Promise<void>((resolve) => {
      this.grantApplied = { value: grant, resolve };
      setTimeout(resolve, 1000);
    });
    this.grant = grant;
    this.playbackUnlocked = true;
    this.tab.notifyMediaChange();
    await applied;
    this.grantApplied = null;
    if (generation !== this.generation) return;

    const done = new Promise<void>((resolve) => {
      this.windowDone = { id, resolve };
      setTimeout(resolve, GRANT_WINDOW_MS);
    });
    this.reply(generation, origin, { kind: 'go', id, paused: this.paused });
    await done;
    this.windowDone = null;
    if (generation !== this.generation) return;
    this.grant = '';
    this.tab.notifyMediaChange();
  }

  /** Decides whether this page may capture these kinds now, asking the user about the undecided ones. */
  private async authorize(generation: number, origin: string, kinds: MediaKind[]): Promise<boolean> {
    const host = this.siteOf(origin);
    if (!host || !settings) return false;
    const undecided: MediaKind[] = [];
    for (const kind of kinds) {
      if (this.settingFor(host, kind) === 'block' || this.deniedOnce.has(kind)) return false;
      if (!this.permitted(host, kind)) undecided.push(kind);
    }
    if (!undecided.length) return true;
    const incognito = this.tab.incognito;
    const answer = await askSitePermission({
      title: t(promptKey(undecided), { host }),
      message: t(incognito ? 'media.promptIncognito' : 'media.promptBody'),
      incognito,
      signal: this.abort.signal,
    });
    if (generation !== this.generation) return false;
    if (answer === 'once') {
      // Incognito: this request only; normal tabs: until the page is left or reloaded.
      undecided.forEach((kind) => (incognito ? this.liveGrant : this.allowedOnce).add(kind));
      return true;
    }
    if (answer === 'always' && settings) {
      const store = settings;
      await Promise.all(undecided.map((kind) => store.setMedia(host, kind, 'allow').catch(() => {})));
      return generation === this.generation;
    }
    if (answer === 'deny') undecided.forEach((kind) => this.deniedOnce.add(kind));
    return false;
  }

  /** Site allowed: now the phone's own permissions (asked the first time only). */
  private async systemPermission(kinds: MediaKind[]): Promise<boolean> {
    for (const kind of kinds) {
      try {
        await ensureMediaPermission(kind);
      } catch (e) {
        if (e instanceof PermissionDeniedError && !e.canAskAgain && !this.offeredSettings) {
          this.offeredSettings = true;
          offerSettings(t(kind === 'camera' ? 'media.systemDenied.camera' : 'media.systemDenied.microphone'));
        }
        return false;
      }
    }
    return true;
  }

  private setActive(camera: boolean, microphone: boolean) {
    if (camera === this.camera && microphone === this.microphone) return;
    const microphoneStarted = microphone && !this.microphone;
    this.camera = camera;
    this.microphone = microphone;
    if (microphoneStarted) microphoneListeners.forEach((l) => l());
    if (this.capturing) livePages.add(this);
    else {
      livePages.delete(this);
      // An incognito "allow once" covered that capture only.
      this.liveGrant.clear();
    }
    this.tab.notifyMediaChange();
  }

  private send(command: Reply) {
    this.tab.webview?.injectJavaScript(
      `if (window.__qutaiMedia) window.__qutaiMedia(${JSON.stringify(this.nonce)}, ${JSON.stringify(command)}); true;`,
    );
  }

  /** Delivers an answer only to the page that asked: same load, and the document's origin checked in the page. */
  private reply(generation: number, origin: string, reply: Reply) {
    if (generation !== this.generation || !this.siteOf(origin)) return;
    this.deliver(origin, reply);
  }

  private deliver(origin: string, reply: Reply) {
    this.tab.webview?.injectJavaScript(
      `if (location.origin === ${JSON.stringify(origin)} && window.__qutaiMedia) ` +
        `window.__qutaiMedia(${JSON.stringify(this.nonce)}, ${JSON.stringify(reply)}); true;`,
    );
  }
}
