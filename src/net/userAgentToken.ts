/**
 * The "qutai.<build>" token every User-Agent Qutai sends ends with (DESIGN.md › docs/design/03-data-on-the-phone.md, DATA-23). Pure code, no
 * native imports, so it runs in the server-free tests (scripts/useragent-tests).
 *
 * The build number is the app's own (Android versionCode, iOS CFBundleVersion: src/device/appVersion.ts), which
 * docs/versioning.md computes from the version (0.1.3 → 103) and keeps equal on both platforms, so the token is never
 * a second hard-coded number.
 */

const TOKEN = /\s*\bqutai\.\d+\b/g;

/** "103" → "qutai.103"; null when the build number is unknown or not a plain number ('–' in a broken install). */
export function qutaiToken(build: string | number | null | undefined): string | null {
  const text = typeof build === 'number' ? String(build) : (build ?? '').trim();
  return /^\d+$/.test(text) && Number(text) > 0 ? `qutai.${Number(text)}` : null;
}

/** A user agent without any qutai.<n> token (one learned from a page, or saved by an older version). */
export function withoutQutaiToken(userAgent: string): string {
  return userAgent.replace(TOKEN, '').replace(/\s+/g, ' ').trim();
}

/** The user agent with exactly one token, at the end after a space: "… Safari/537.36 qutai.103". */
export function withQutaiToken(userAgent: string, token: string | null): string {
  const base = withoutQutaiToken(userAgent);
  return token ? `${base} ${token}` : base;
}

/**
 * The User-Agent of the app's own requests (Qutai's server, AI providers, search suggestions, block lists, downloads
 * without a page's user agent): "Qutai/0.1.3 (iOS) qutai.103". The platform's default (CFNetwork on iOS, okhttp on
 * Android) can't be read from JavaScript to append to, so this replaces it, and says less than iOS's did (no Darwin
 * version).
 */
export function appUserAgent(version: string, os: string, token: string | null): string {
  const platform = os === 'ios' ? 'iOS' : os === 'android' ? 'Android' : os;
  const v = /^\d+(\.\d+)*$/.test(version) ? version : '0';
  return withQutaiToken(`Qutai/${v} (${platform})`, token);
}

type HeadersLike = Headers | [string, string][] | Record<string, string> | undefined;

function hasUserAgent(headers: HeadersLike): boolean {
  if (!headers) return false;
  if (typeof (headers as Headers).has === 'function') return (headers as Headers).has('user-agent');
  if (Array.isArray(headers)) return headers.some(([name]) => name.toLowerCase() === 'user-agent');
  return Object.keys(headers).some((name) => name.toLowerCase() === 'user-agent');
}

/**
 * fetch's init with a User-Agent added when the caller set none (a caller's own, e.g. a tab's, is kept). A Request
 * object as input is left alone: headers in init would replace all of its own.
 */
export function withUserAgentInit<T extends { headers?: unknown }>(
  input: unknown,
  init: T | undefined,
  userAgent: string,
): T | undefined {
  if (input != null && typeof input === 'object' && !(input instanceof URL) && 'headers' in (input as object)) {
    return init;
  }
  const headers = init?.headers as HeadersLike;
  if (hasUserAgent(headers)) return init;
  let next: HeadersLike;
  if (headers && typeof (headers as Headers).forEach === 'function' && !Array.isArray(headers)) {
    const copy: Record<string, string> = {};
    (headers as Headers).forEach((value, name) => {
      copy[name] = value;
    });
    next = { ...copy, 'User-Agent': userAgent };
  } else if (Array.isArray(headers)) {
    next = [...headers, ['User-Agent', userAgent]];
  } else {
    next = { ...(headers ?? {}), 'User-Agent': userAgent };
  }
  return { ...(init ?? ({} as T)), headers: next };
}
