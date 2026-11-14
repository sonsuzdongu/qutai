import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * Android: the system WebView announces itself as embedded ("; wv" and "Version/4.0"), which
 * Google sign-in and bot checks treat with suspicion (endless "are you human?" loops). Qutai uses
 * the same string without those marks, i.e. what Chrome on the same engine sends. It is learned
 * from the WebView itself (so the engine version is true) and kept current from userAgentData.
 */
export function chromeUserAgent(webViewUserAgent: string): string {
  return (
    webViewUserAgent
      // Chrome's reduced platform part; the WebView adds the model and "Build/…", another tell.
      .replace(/\(Linux; Android [^)]*\)/, '(Linux; Android 10; K)')
      .replace(/; wv\)/, ')')
      .replace(/ Version\/[\d.]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Puts the engine's real major version into a learned user agent (Chrome's reduced form: N.0.0.0). */
export function withChromeMajor(userAgent: string, major: number): string {
  return userAgent.replace(/Chrome\/[\d.]+/, `Chrome/${major}.0.0.0`);
}

/** Collects the page's user agent and engine version once per page (Android). */
export const USER_AGENT_SCRIPT = `(function () {
  if (window.__qutaiUA) return;
  window.__qutaiUA = true;
  var brand = (navigator.userAgentData && navigator.userAgentData.brands || []).filter(function (b) {
    return /Chromium/.test(b.brand);
  })[0];
  window.ReactNativeWebView.postMessage(JSON.stringify({
    __qutaiUA: true, ua: navigator.userAgent, major: brand ? Number(brand.version) : 0
  }));
})(); true;`;

const KEY = 'webview_user_agent';
let learned: string | null = null;
const listeners = new Set<() => void>();

SecureStore.getItemAsync(KEY)
  .then((saved) => {
    if (saved && !learned) set(saved);
  })
  .catch(() => {});

function set(next: string) {
  if (next === learned) return;
  learned = next;
  listeners.forEach((l) => l());
}

/** Handles a USER_AGENT_SCRIPT message; returns false for other messages. */
export function handleUserAgentMessage(data: string): boolean {
  if (!data.includes('__qutaiUA')) return false;
  let msg: { __qutaiUA?: unknown; ua?: unknown; major?: unknown };
  try {
    msg = JSON.parse(data);
  } catch {
    return false;
  }
  if (msg.__qutaiUA !== true || typeof msg.ua !== 'string') return false;
  // A page loaded with the WebView's own string: learn from it. Otherwise only refresh the version.
  let next = /; wv\)/.test(msg.ua) ? chromeUserAgent(msg.ua) : learned;
  if (next && typeof msg.major === 'number' && msg.major > 0) next = withChromeMajor(next, msg.major);
  if (next && next !== learned) {
    set(next);
    SecureStore.setItemAsync(KEY, next).catch(() => {});
  }
  return true;
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
