import { AppState } from 'react-native';
import type { ComponentRef } from 'react';
import type { WebView } from 'react-native-webview';
import { siteKey } from '../agent/sitePolicy';
import { dialog } from '../components/Dialog';
import {
  ensureLocationPermission,
  hasLocationPermission,
  LocationUnavailableError,
  Position,
  readPosition,
  watchPosition,
} from '../device/location';
import { offerSettings, PermissionDeniedError } from '../device/settings';
import { t } from '../i18n';
import type { LocationSetting } from '../storage/sitePermissions';

/**
 * Web pages' navigator.geolocation, answered by the app.
 *
 * Neither WebView lets the app decide per site: Android's WebView (react-native-webview 14) grants
 * every origin as soon as the app holds the location permission, and WKWebView shows WebKit's own
 * prompt with no hook for the app. So native geolocation stays off (Android: geolocationEnabled is
 * left false) or is shadowed (iOS), and a script injected before the page's own replaces
 * getCurrentPosition, watchPosition, clearWatch and permissions.query({name: 'geolocation'}) in the
 * main frame. It asks the app over the tab's authenticated message channel; the app checks the
 * site's setting, asks the user, reads the position with expo-location and replies only to the
 * same origin. Frames (embedded maps…) always get PERMISSION_DENIED: the decision is the top site's.
 */

/** What the page can be told about its permission (navigator.permissions). */
type PermissionState = 'granted' | 'denied' | 'prompt';

/** The site settings the bridge needs; the app's SitePermissionStore. */
export interface LocationSettings {
  locationFor(host: string): LocationSetting;
  setLocation(host: string, setting: LocationSetting): Promise<void>;
}

let settings: LocationSettings | null = null;

/** Connects page geolocation to the stored site settings; until then every request is denied. */
export function configurePageLocation(store: LocationSettings) {
  settings = store;
}

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

/** Installed in every frame before the page's own scripts (and again after load, if Android missed the early run). */
export function geolocationScript(nonce: string): string {
  return `(function () {
  if (window.__qutaiGeoInstalled || !navigator.geolocation) return;
  Object.defineProperty(window, '__qutaiGeoInstalled', { value: true });
  var NONCE = ${JSON.stringify(nonce)};
  var stringify = JSON.stringify;
  var bridge = window.ReactNativeWebView;
  var post = bridge && bridge.postMessage;
  var mainFrame = window.top === window;
  var geo = navigator.geolocation;
  var proto = Object.getPrototypeOf(geo) || geo;
  var nextId = 1;
  var calls = {};
  var watches = {};
  function positionError(code, message) {
    return { code: code, message: message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
  }
  function toPosition(p) {
    var coords = {
      latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, altitude: p.altitude,
      altitudeAccuracy: p.altitudeAccuracy, heading: p.heading, speed: p.speed
    };
    var plain = {};
    for (var key in coords) plain[key] = coords[key];
    coords.toJSON = function () { return plain; };
    return { coords: coords, timestamp: p.timestamp, toJSON: function () { return { coords: plain, timestamp: p.timestamp }; } };
  }
  function send(payload) {
    payload.__qutaiGeo = NONCE;
    payload.origin = location.origin;
    try { post.call(bridge, stringify(payload)); return true; } catch (e) { return false; }
  }
  function later(fn) { setTimeout(fn, 0); }
  function deny(error) {
    if (typeof error === 'function') later(function () { error(positionError(1, 'User denied Geolocation')); });
  }
  function opts(options) {
    options = options || {};
    return {
      highAccuracy: !!options.enableHighAccuracy,
      maximumAge: Number(options.maximumAge) || 0,
      timeout: options.timeout === undefined || options.timeout === Infinity ? null : Math.max(0, Number(options.timeout) || 0)
    };
  }
  if (!mainFrame || !post) {
    // Frames never get the location (the user decides for the site in the address bar, not for what it embeds).
    proto.getCurrentPosition = function (success, error) { deny(error); };
    proto.watchPosition = function (success, error) { deny(error); return nextId++; };
    proto.clearWatch = function () {};
  } else {
    proto.getCurrentPosition = function (success, error, options) {
      if (typeof success !== 'function') throw new TypeError('getCurrentPosition needs a callback');
      var id = nextId++;
      calls[id] = { success: success, error: error };
      if (!send({ type: 'get', id: id, options: opts(options) })) { delete calls[id]; deny(error); }
    };
    proto.watchPosition = function (success, error, options) {
      if (typeof success !== 'function') throw new TypeError('watchPosition needs a callback');
      var id = nextId++;
      watches[id] = { success: success, error: error };
      if (!send({ type: 'watch', id: id, options: opts(options) })) { delete watches[id]; deny(error); }
      return id;
    };
    proto.clearWatch = function (id) {
      if (!watches[id]) return;
      delete watches[id];
      send({ type: 'clear', id: id });
    };
  }
  var permissions = navigator.permissions;
  var permProto = permissions && (Object.getPrototypeOf(permissions) || permissions);
  if (permProto && permProto.query) {
    var query = permProto.query;
    var pendingStates = {};
    permProto.query = function (descriptor) {
      if (!descriptor || descriptor.name !== 'geolocation') return query.apply(this, arguments);
      return new Promise(function (resolve) {
        function status(state) {
          return {
            name: 'geolocation', state: state, onchange: null,
            addEventListener: function () {}, removeEventListener: function () {},
            dispatchEvent: function () { return true; }
          };
        }
        if (!mainFrame || !post) return resolve(status('denied'));
        var id = nextId++;
        pendingStates[id] = function (state) { resolve(status(state)); };
        if (!send({ type: 'state', id: id })) { delete pendingStates[id]; resolve(status('denied')); }
      });
    };
  }
  Object.defineProperty(window, '__qutaiGeo', {
    value: function (nonce, msg) {
      if (nonce !== NONCE || !msg) return;
      if (msg.kind === 'state') {
        var done = pendingStates && pendingStates[msg.id];
        if (done) { delete pendingStates[msg.id]; done(msg.state); }
        return;
      }
      var call = calls[msg.id];
      var target = call || watches[msg.id];
      if (!target) return;
      if (call) delete calls[msg.id];
      try {
        if (msg.kind === 'position') target.success(toPosition(msg.position));
        else if (typeof target.error === 'function') target.error(positionError(msg.code, msg.message));
      } catch (e) {
        setTimeout(function () { throw e; }, 0);
      }
    }
  });
})();`;
}

type Request = {
  __qutaiGeo?: unknown;
  type?: unknown;
  id?: unknown;
  origin?: unknown;
  options?: { highAccuracy?: unknown; maximumAge?: unknown; timeout?: unknown };
};

type Reply =
  | { kind: 'position'; id: number; position: Position }
  | { kind: 'error'; id: number; code: number; message: string }
  | { kind: 'state'; id: number; state: PermissionState };

type Watch = { origin: string; highAccuracy: boolean; stop: (() => void) | null; starting: boolean };

/** The tab as the bridge sees it. */
export interface GeoTab {
  readonly url: string;
  readonly incognito: boolean;
  readonly webview: ComponentRef<typeof WebView> | null;
  /** Called when the address bar's location indicator should change. */
  notifyLocationUse(): void;
}

/** Bridges with live watches, paused while the app is in the background. */
const watching = new Set<PageGeolocation>();
let foreground = AppState.currentState === 'active' || AppState.currentState == null;
AppState.addEventListener('change', (state) => {
  const next = state === 'active';
  if (next === foreground) return;
  foreground = next;
  watching.forEach((bridge) => (next ? bridge.resumeWatches() : bridge.pauseWatches()));
});

/** One tab's page geolocation: permission, prompts and watches for the page currently loaded. */
export class PageGeolocation {
  /** A random token only the injected script knows (separate from the page command nonce). */
  readonly nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  /** The page was given a position, or is watching it: shown in the address bar. */
  inUse = false;
  /** Counts page loads: an answer for an earlier page is never delivered. */
  private generation = 0;
  /** Origins the user allowed once for this page (normal tabs; forgotten on the next load). */
  private allowedOnce = new Set<string>();
  /** Origins the user refused for this page, so the page can't ask again and again. */
  private deniedOnce = new Set<string>();
  /** One prompt per origin at a time; later requests wait for the same answer. */
  private prompts = new Map<string, Promise<boolean>>();
  private abort = new AbortController();
  private watches = new Map<number, Watch>();
  /** "Open settings" is offered once per page, not on every request. */
  private offeredSettings = false;

  constructor(private tab: GeoTab) {}

  /** Handles a message from the injected script; false for other messages. */
  handleMessage(data: string): boolean {
    if (!data.includes('__qutaiGeo')) return false;
    let msg: Request;
    try {
      msg = JSON.parse(data);
    } catch {
      return false;
    }
    if (msg.__qutaiGeo !== this.nonce) return true;
    const id = Number(msg.id);
    const origin = typeof msg.origin === 'string' ? msg.origin : '';
    if (!Number.isInteger(id) || !origin) return true;
    const generation = this.generation;
    const options = {
      highAccuracy: msg.options?.highAccuracy === true,
      maximumAge: Math.max(0, Number(msg.options?.maximumAge) || 0),
      timeout: msg.options?.timeout == null ? undefined : Math.max(0, Number(msg.options.timeout) || 0),
    };
    if (msg.type === 'state') {
      void this.permissionState(origin).then((state) => this.reply(generation, origin, { kind: 'state', id, state }));
    } else if (msg.type === 'get') {
      void this.getPosition(generation, origin, id, options);
    } else if (msg.type === 'watch') {
      void this.startWatch(generation, origin, id, options.highAccuracy);
    } else if (msg.type === 'clear') {
      this.stopWatch(id);
    }
    return true;
  }

  /** A new page, another site, a sleeping or closed tab: stop everything and forget this page's answers. */
  reset() {
    this.generation++;
    this.abort.abort();
    this.abort = new AbortController();
    this.prompts.clear();
    this.allowedOnce.clear();
    this.deniedOnce.clear();
    this.offeredSettings = false;
    this.watches.forEach((w) => w.stop?.());
    this.watches.clear();
    watching.delete(this);
    this.setInUse(false);
  }

  pauseWatches() {
    this.watches.forEach((w) => {
      w.stop?.();
      w.stop = null;
    });
  }

  resumeWatches() {
    const generation = this.generation;
    this.watches.forEach((w, id) => {
      if (!w.stop && !w.starting) void this.runWatch(generation, id, w);
    });
  }

  private setInUse(on: boolean) {
    if (this.inUse === on) return;
    this.inUse = on;
    this.tab.notifyLocationUse();
  }

  /** The site the request is for, if it may ask at all: https only, and only the tab's own site. */
  private siteOf(origin: string): string | null {
    if (!/^https:\/\//i.test(origin)) return null;
    const host = siteKey(origin);
    return host && host === siteKey(this.tab.url) ? host : null;
  }

  /** The stored setting; incognito tabs keep a block but never use a stored allow. */
  private settingFor(host: string): LocationSetting {
    const stored = settings?.locationFor(host) ?? 'block';
    return this.tab.incognito && stored === 'allow' ? 'ask' : stored;
  }

  private async permissionState(origin: string): Promise<PermissionState> {
    const host = this.siteOf(origin);
    if (!host || !settings) return 'denied';
    const setting = this.settingFor(host);
    if (setting === 'block' || this.deniedOnce.has(origin)) return 'denied';
    if (setting === 'allow' || this.allowedOnce.has(origin)) {
      return (await hasLocationPermission()) ? 'granted' : 'prompt';
    }
    return 'prompt';
  }

  /** Decides whether this page may have the location now, asking the user when the site is set to ask. */
  private async authorize(origin: string): Promise<boolean> {
    const host = this.siteOf(origin);
    if (!host || !settings) return false;
    const setting = this.settingFor(host);
    if (setting === 'block') return false;
    if (setting === 'allow' || this.allowedOnce.has(origin)) return true;
    if (this.deniedOnce.has(origin)) return false;
    let prompt = this.prompts.get(origin);
    if (!prompt) {
      prompt = this.ask(origin, host).finally(() => this.prompts.delete(origin));
      this.prompts.set(origin, prompt);
    }
    return prompt;
  }

  private async ask(origin: string, host: string): Promise<boolean> {
    const incognito = this.tab.incognito;
    const buttons = [
      { text: t('location.deny'), style: 'cancel' as const },
      // The easiest choice is the narrowest one; "Always allow" stays a plain secondary action.
      { text: t('location.allowOnce'), primary: true },
      ...(incognito ? [] : [{ text: t('location.allowAlways') }]),
    ];
    const generation = this.generation;
    const result = await dialog.show({
      title: t('location.promptTitle', { host }),
      message: t(incognito ? 'location.promptIncognito' : 'location.promptBody'),
      buttons,
      signal: this.abort.signal,
    });
    if (generation !== this.generation) return false;
    if (result.button === 1) {
      // Incognito: this request only; normal tabs: until the page is left or reloaded.
      if (!incognito) this.allowedOnce.add(origin);
      return true;
    }
    if (result.button === 2 && settings) {
      await settings.setLocation(host, 'allow').catch(() => {});
      return true;
    }
    if (result.button === 0) this.deniedOnce.add(origin);
    return false;
  }

  /** Site allowed: now the phone's own permission (asked the first time only). */
  private async systemPermission(): Promise<{ code: number; message: string } | null> {
    try {
      await ensureLocationPermission();
      return null;
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        if (!e.canAskAgain && !this.offeredSettings) {
          this.offeredSettings = true;
          offerSettings(t('location.systemDenied'));
        }
        return { code: PERMISSION_DENIED, message: 'User denied Geolocation' };
      }
      return this.unavailable(e);
    }
  }

  private unavailable(e: unknown): { code: number; message: string } {
    if (e instanceof LocationUnavailableError && e.reason === 'timeout') return { code: TIMEOUT, message: 'Timeout expired' };
    return { code: POSITION_UNAVAILABLE, message: e instanceof Error ? e.message : 'Position unavailable' };
  }

  private async getPosition(
    generation: number,
    origin: string,
    id: number,
    options: { highAccuracy: boolean; maximumAge: number; timeout?: number },
  ) {
    const error = (code: number, message: string) => this.reply(generation, origin, { kind: 'error', id, code, message });
    if (!(await this.authorize(origin))) return error(PERMISSION_DENIED, 'User denied Geolocation');
    const denied = await this.systemPermission();
    if (denied) return error(denied.code, denied.message);
    try {
      const position = await readPosition(options);
      this.reply(generation, origin, { kind: 'position', id, position });
    } catch (e) {
      const failure = this.unavailable(e);
      error(failure.code, failure.message);
    }
  }

  private async startWatch(generation: number, origin: string, id: number, highAccuracy: boolean) {
    const error = (code: number, message: string) => this.reply(generation, origin, { kind: 'error', id, code, message });
    if (!(await this.authorize(origin))) return error(PERMISSION_DENIED, 'User denied Geolocation');
    const denied = await this.systemPermission();
    if (denied) return error(denied.code, denied.message);
    if (generation !== this.generation) return;
    const watch: Watch = { origin, highAccuracy, stop: null, starting: false };
    this.watches.set(id, watch);
    watching.add(this);
    if (foreground) await this.runWatch(generation, id, watch);
  }

  private async runWatch(generation: number, id: number, watch: Watch) {
    const { origin } = watch;
    watch.starting = true;
    try {
      const stop = await watchPosition(
        watch.highAccuracy,
        (position) => this.reply(generation, origin, { kind: 'position', id, position }),
        (message) => this.reply(generation, origin, { kind: 'error', id, code: POSITION_UNAVAILABLE, message }),
      );
      // Cleared, left or backgrounded while starting.
      if (this.watches.get(id) !== watch || generation !== this.generation || !foreground) stop();
      else {
        watch.stop = stop;
        this.setInUse(true);
      }
    } catch (e) {
      const failure = this.unavailable(e);
      this.reply(generation, origin, { kind: 'error', id, code: failure.code, message: failure.message });
    } finally {
      watch.starting = false;
    }
  }

  private stopWatch(id: number) {
    this.watches.get(id)?.stop?.();
    this.watches.delete(id);
    if (!this.watches.size) watching.delete(this);
  }

  /** Delivers an answer only to the page that asked: same load, and the document's origin checked in the page. */
  private reply(generation: number, origin: string, reply: Reply) {
    if (generation !== this.generation || !this.siteOf(origin)) return;
    if (reply.kind === 'position') this.setInUse(true);
    this.tab.webview?.injectJavaScript(
      `if (location.origin === ${JSON.stringify(origin)} && window.__qutaiGeo) ` +
        `window.__qutaiGeo(${JSON.stringify(this.nonce)}, ${JSON.stringify(reply)}); true;`,
    );
  }
}
