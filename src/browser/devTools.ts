/**
 * "Allow developer tools" (WPERM-20 in docs/design/05-site-permissions.md): whether Safari's Web Inspector (or Chrome's
 * DevTools on Android) may see Qutai's tabs. Pure: tested with node:test (scripts/useragent-tests/devTools.test.ts).
 */

/** Never chosen: on for a Mac, where it is a desktop browser's usual tool; off on iPhone, iPad and Android. */
export function devToolsFor(stored: string | null | undefined, onMac: boolean): boolean {
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return onMac;
}

/**
 * Whether one tab's web view is inspectable. iOS: per web view, and never an incognito tab. Android: the switch is the
 * WebView's own and covers every web view of the app at once, incognito ones included (setWebContentsDebuggingEnabled).
 */
export function tabInspectable(setting: boolean, incognito: boolean, platform: 'ios' | 'android'): boolean {
  if (!setting) return false;
  return platform === 'android' || !incognito;
}
