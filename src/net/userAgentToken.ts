/**
 * The "qutai.<build>" token that ends the User-Agent of requests to Qutai's own server, and only those (DESIGN.md ›
 * docs/design/03-data-on-the-phone.md, DATA-23). Pure code, no native imports, so it runs in the server-free tests
 * (scripts/useragent-tests).
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

/**
 * A user agent without any qutai.<n> token. Web views no longer send one, but Android strings learned and saved by the
 * builds of 19-20 Nov 2026 (which added it) may still carry it.
 */
export function withoutQutaiToken(userAgent: string): string {
  return userAgent.replace(TOKEN, '').replace(/\s+/g, ' ').trim();
}

/** The user agent with exactly one token, at the end after a space: "Qutai/0.1.3 (iOS) qutai.103". */
export function withQutaiToken(userAgent: string, token: string | null): string {
  const base = withoutQutaiToken(userAgent);
  return token ? `${base} ${token}` : base;
}

/**
 * The User-Agent of requests to Qutai's server: "Qutai/0.1.3 (iOS) qutai.103". It replaces the platform's default
 * (CFNetwork on iOS, okhttp on Android) for those requests only.
 */
export function appUserAgent(version: string, os: string, token: string | null): string {
  const platform = os === 'ios' ? 'iOS' : os === 'android' ? 'Android' : os;
  const v = /^\d+(\.\d+)*$/.test(version) ? version : '0';
  return withQutaiToken(`Qutai/${v} (${platform})`, token);
}

/** "https://api.example.com/v1/" → "https://api.example.com"; null for no address or anything that isn't http(s). */
export function originOf(address: string | null | undefined): string | null {
  if (!address) return null;
  try {
    const url = new URL(address.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/** The address a fetch call goes to: a string or URL as given; a Request object's own url. */
export function requestAddress(input: unknown): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input != null && typeof input === 'object' && typeof (input as { url?: unknown }).url === 'string') {
    return (input as { url: string }).url;
  }
  return null;
}

/**
 * Whether a request goes to Qutai's server: its origin (scheme, host and port) equals the origin of
 * EXPO_PUBLIC_QUTAI_API_URL. Nothing else counts, not a subdomain, another port or plain http for an https server; no
 * server address means no request is Qutai's.
 */
export function isQutaiServer(input: unknown, serverUrl: string | null | undefined): boolean {
  const server = originOf(serverUrl);
  if (!server) return false;
  return originOf(requestAddress(input)) === server;
}

type HeadersLike = Headers | [string, string][] | Record<string, string> | undefined;

function hasUserAgent(headers: HeadersLike): boolean {
  if (!headers) return false;
  if (typeof (headers as Headers).has === 'function') return (headers as Headers).has('user-agent');
  if (Array.isArray(headers)) return headers.some(([name]) => name.toLowerCase() === 'user-agent');
  return Object.keys(headers).some((name) => name.toLowerCase() === 'user-agent');
}

/**
 * fetch's init with a User-Agent added when the caller set none (a caller's own is kept). A Request object as input is
 * left alone: headers in init would replace all of its own.
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

/**
 * The one decision every fetch goes through (src/net/qutaiUserAgent.ts): a request to Qutai's server gets the app's
 * User-Agent unless it set its own; any other request's init is returned untouched (the same object), so it sends what
 * the platform sends by default, as before the token existed.
 */
export function initForRequest<T extends { headers?: unknown }>(
  input: unknown,
  init: T | undefined,
  serverUrl: string | null | undefined,
  userAgent: string,
): T | undefined {
  return isQutaiServer(input, serverUrl) ? withUserAgentInit(input, init, userAgent) : init;
}
