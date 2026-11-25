/**
 * The browser identity web pages see (DATA-23, DATA-33 in docs/design/03-data-on-the-phone.md). Pure: tested with
 * node:test (scripts/useragent-tests/safariUserAgent.test.ts).
 *
 * iOS, iPadOS and the iOS app on a Mac: WKWebView's own string ends without Safari's "Version/N … Safari/…" part, so
 * sites such as Gmail took Qutai for an old, unsupported browser. The web view gets the same ending Safari sends on
 * that device, with Safari's version taken from the running system (Safari's version follows the OS: iOS 26 → 26.0),
 * never a fixed number. Desktop-site mode is built from the same real versions.
 */

export type AppleDevice = 'phone' | 'pad' | 'mac';

/** Safari's version on this system: the OS version's major and minor ("26.1"; "26" → "26.0"); null if unreadable. */
export function safariVersion(osVersion: string | number | null | undefined): string | null {
  const match = String(osVersion ?? '').match(/^(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const major = Number(match[1]);
  if (!major) return null;
  return `${major}.${Number(match[2] ?? 0)}`;
}

/**
 * What WKWebView adds after its own "(KHTML, like Gecko)" (its `applicationNameForUserAgent`): Safari's ending on that
 * device. iPhone: "Version/26.0 Mobile/15E148 Safari/604.1"; iPad and Mac (desktop-class pages): "Version/26.0
 * Safari/605.1.15". Null when the version can't be read (the web view keeps its own ending).
 */
export function safariApplicationName(osVersion: string | number | null | undefined, device: AppleDevice): string | null {
  const version = safariVersion(osVersion);
  if (!version) return null;
  return device === 'phone' ? `Version/${version} Mobile/15E148 Safari/604.1` : `Version/${version} Safari/605.1.15`;
}

/** The Chrome major version in a user agent ("Chrome/142.0.0.0" → 142), or null. */
export function chromeMajor(userAgent: string | null | undefined): number | null {
  const match = (userAgent ?? '').match(/Chrome\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Used only until the WebView has told Qutai its engine version (Android), or when the OS version is unreadable. */
const FALLBACK_CHROME_MAJOR = 130;
const FALLBACK_SAFARI_VERSION = '18.0';

/**
 * Desktop-site mode's identity. iOS: Safari on a Mac, with the system's Safari version. Android: Chrome on Linux
 * desktop, with the WebView engine's real major version (learned from the WebView, `chromeUserAgent`).
 */
export function desktopUserAgent(
  platform: 'ios' | 'android',
  versions: { osVersion?: string | number | null; learnedUserAgent?: string | null },
): string {
  if (platform === 'ios') {
    const version = safariVersion(versions.osVersion) ?? FALLBACK_SAFARI_VERSION;
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`;
  }
  const major = chromeMajor(versions.learnedUserAgent) ?? FALLBACK_CHROME_MAJOR;
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}
