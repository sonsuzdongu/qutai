import * as SecureStore from 'expo-secure-store';
import { requireOptionalNativeModule } from 'expo';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { secureStoreReady } from '../storage/secureStoreGate';
import { withoutQutaiToken } from '../net/userAgentToken';

/**
 * Android: the system WebView announces itself as embedded ("; wv" and "Version/4.0"), which
 * Google sign-in and bot checks treat with suspicion (endless "are you human?" loops). Qutai uses
 * the same string without those marks, i.e. what Chrome on the same engine sends. The engine version comes from the
 * system (the QutaiEntry module's webViewUserAgent), never from a web page: a page's word for it would let any page,
 * an incognito one included, write a lasting mark into what every tab sends (DATA-34). A build without the native
 * getter still learns from the first page, in the narrow form handleUserAgentMessage allows.
 */

/** The oldest and newest engine versions a report may name; anything else is not a WebView Qutai runs on. */
const MIN_MAJOR = 80;
const MAX_MAJOR = 999;

/** The Android System WebView's own string, and nothing else: only the device part and the version numbers vary. */
const WEBVIEW_SHAPE =
  /^Mozilla\/5\.0 \(Linux; Android [^()]{1,120}; wv\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Version\/4\.0 Chrome\/(\d{2,3})\.\d{1,5}\.\d{1,5}\.\d{1,5}( Mobile)? Safari\/537\.36$/;

/**
 * The Chrome-style string for a WebView's own one, built from its two facts only (the engine's major version and
 * whether it says "Mobile"); null for anything that isn't exactly a WebView's string. Nothing else of the input
 * survives, so whoever supplies it can't put a mark of their own into what every tab sends (DATA-34).
 */
export function canonicalChromeUserAgent(webViewUserAgent: string, reportedMajor?: number): string | null {
  const m = WEBVIEW_SHAPE.exec(withoutQutaiToken(webViewUserAgent).trim());
  if (!m) return null;
  const own = Number(m[1]);
  // userAgentData's version is the truer one where the string is frozen, but it may only be the same or newer.
  const major =
    typeof reportedMajor === 'number' && Number.isInteger(reportedMajor) && reportedMajor >= own ? reportedMajor : own;
  if (major < MIN_MAJOR || major > MAX_MAJOR) return null;
  return `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0${m[2] ?? ''} Safari/537.36`;
}

type NativeUserAgent = { webViewUserAgent?(): Promise<string> };
const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeUserAgent>('QutaiEntry') : null;
/** Builds with the native getter ask the system; older ones can only ask a page (below). */
const askSystem = typeof native?.webViewUserAgent === 'function';

/**
 * Collects the page's user agent and engine version once per page, only in an Android build without the native
 * getter. A page can send this message too, so the app takes only what canonicalChromeUserAgent leaves of it.
 */
export const USER_AGENT_SCRIPT = askSystem
  ? ''
  : `(function () {
  if (window.__qutaiUA) return;
  window.__qutaiUA = true;
  var brand = (navigator.userAgentData && navigator.userAgentData.brands || []).filter(function (b) {
    return /Chromium/.test(b.brand);
  })[0];
  window.ReactNativeWebView.postMessage(JSON.stringify({
    __qutaiUA: true, ua: navigator.userAgent, major: brand ? Number(brand.version) : 0
  }));
})(); true;`;

/** How far one report may move the learned version: WebView updates arrive every four weeks or so. */
const MAX_MAJOR_STEP = 12;
/** Without the native getter, a learned string is changed by a page's report at most once per run of the app. */
let refreshed = false;

const KEY = 'webview_user_agent';
let learned: string | null = null;
const listeners = new Set<() => void>();

/** The engine's major version in a learned string. */
function majorOf(userAgent: string | null): number {
  return Number(/Chrome\/(\d+)\./.exec(userAgent ?? '')?.[1] ?? 0);
}

/** A string kept by an earlier build is used only if it is one this build would have made itself. */
function canonicalSaved(saved: string): string | null {
  const m = /^Mozilla\/5\.0 \(Linux; Android 10; K\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/(\d{2,3})\.[\d.]+( Mobile)? Safari\/537\.36$/.exec(
    withoutQutaiToken(saved).trim(),
  );
  if (!m) return null;
  return canonicalChromeUserAgent(
    `Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${m[1]}.0.0.0${m[2] ?? ''} Safari/537.36`,
  );
}

function set(next: string) {
  if (next === learned) return;
  learned = next;
  listeners.forEach((l) => l());
}

function keep(next: string) {
  set(next);
  SecureStore.setItemAsync(KEY, next).catch(() => {});
}

if (Platform.OS === 'android') {
  secureStoreReady()
    .then(() => SecureStore.getItemAsync(KEY))
    .then((saved) => {
      const kept = saved ? canonicalSaved(saved) : null;
      if (kept && !learned) set(kept);
      // A string a page wrote under an earlier build (or any other shape) is dropped, not sent again.
      if (saved && kept !== saved) {
        if (kept) SecureStore.setItemAsync(KEY, kept).catch(() => {});
        else SecureStore.deleteItemAsync(KEY).catch(() => {});
      }
    })
    .catch(() => {});
  // The system's answer wins over anything kept: it is the WebView that is installed now.
  if (askSystem) {
    Promise.resolve()
      .then(() => native!.webViewUserAgent!())
      .then((own) => {
        const next = typeof own === 'string' ? canonicalChromeUserAgent(own) : null;
        if (next && next !== learned) keep(next);
      })
      .catch(() => {});
  }
}

/**
 * Handles a USER_AGENT_SCRIPT message; returns false for other messages. With the native getter the message is
 * swallowed and changes nothing. Without it, a report is taken only in the WebView's exact shape, rebuilt from its
 * version and "Mobile" alone, and a learned version only goes up, by a little, once per run of the app: a page forging
 * the message can at most name a slightly newer engine.
 */
export function handleUserAgentMessage(data: string): boolean {
  if (!data.includes('__qutaiUA')) return false;
  let msg: { __qutaiUA?: unknown; ua?: unknown; major?: unknown };
  try {
    msg = JSON.parse(data);
  } catch {
    return false;
  }
  if (msg.__qutaiUA !== true || typeof msg.ua !== 'string') return false;
  if (askSystem) return true;
  // Once learned, a report changes it at most once per run of the app.
  if (learned && refreshed) return true;
  const next = reportedUserAgent(learned, msg.ua, typeof msg.major === 'number' ? msg.major : undefined);
  if (!next) return true;
  if (learned) refreshed = true;
  keep(next);
  return true;
}

/**
 * What a page's report may change the learned string to, or null to leave it: the first report in the WebView's
 * exact shape is taken (in its canonical form); after that the form factor stays and the version only moves forward,
 * a few releases at a time.
 */
export function reportedUserAgent(known: string | null, userAgent: string, reportedMajor?: number): string | null {
  const next = canonicalChromeUserAgent(userAgent, reportedMajor);
  if (!next || next === known) return null;
  if (!known) return next;
  if (/ Mobile /.test(next) !== / Mobile /.test(known)) return null;
  const before = majorOf(known);
  const now = majorOf(next);
  return now > before && now <= before + MAX_MAJOR_STEP ? next : null;
}

/** The learned Chrome-style user agent, or undefined until the first page has told us. */
export function useChromeUserAgent(): string | undefined {
  return (
    useSyncExternalStore(
      (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      () => learned,
    ) ?? undefined
  );
}
