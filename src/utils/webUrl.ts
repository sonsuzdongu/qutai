/**
 * Web addresses, read the way the WebView reads them (`SITE-25` in docs/design/05-site-permissions.md): one parser for every security decision (site permissions, the outbound check,
 * cookies' party, downloads) and for every host shown to the user.
 *
 * The parser is the WHATWG URL Standard's, which WebKit and Chromium follow: in the app the global `URL` Expo installs
 * (whatwg-url-minimum, expo/src/winter), in the tests Node's own; scripts/injection-tests/webUrl.test.ts checks that
 * both read the hostile cases alike. So "https://evil.example\@named.example/" is evil.example here as in the WebView
 * (a backslash is a slash), userinfo never counts as the host, IDN hosts are punycode, IPv4 shorthands
 * ("http://0x7f.1/") are the dotted address, IPv6 literals keep their brackets, and default ports are dropped.
 *
 * What "site" means, in one place:
 * - siteKey: the host without "www." and without one trailing dot, plus the port when it isn't the scheme's default.
 *   Site permissions, personal-data settings, blocking exceptions and the action history are keyed by it, and it is
 *   the host the user is shown. Two subdomains are two sites here, on purpose: a permission for shop.example says
 *   nothing about mail.example.
 * - registrableSite: the registrable domain ("shop.example.com.tr" → "example.com.tr", content/filterLists.ts
 *   registrableDomain), for "same site" questions: first- or third-party cookies and requests, and whether the user
 *   named or had open the site an address goes to (agent/outbound.ts).
 * Only http and https addresses have a site; data:, blob:, javascript:, file: and addresses without a scheme have none.
 */
import { registrableDomain } from '../content/filterLists';

export type WebUrl = {
  scheme: 'http' | 'https';
  /** Lower-case ASCII host (IDN in punycode), without a trailing dot; IPv6 in brackets. */
  host: string;
  /** The port when it isn't the scheme's default, else ''. */
  port: string;
  /** The address as the WebView would load it. */
  href: string;
};

/** An http(s) address as the WebView reads it, or null for anything else (or anything that isn't an address). */
export function parseWebUrl(raw: unknown): WebUrl | null {
  if (typeof raw !== 'string') return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const scheme = u.protocol === 'https:' ? 'https' : u.protocol === 'http:' ? 'http' : null;
  if (!scheme) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  return { scheme, host, port: u.port, href: u.href };
}

/** The site an address belongs to for permissions and display: host without "www.", with a non-default port. */
export function siteKey(raw: unknown): string | null {
  const u = parseWebUrl(raw);
  if (!u) return null;
  const host = u.host.startsWith('www.') && u.host.length > 4 ? u.host.slice(4) : u.host;
  return u.port ? `${host}:${u.port}` : host;
}

/** A stored or typed host ("Bücher.de", "example.com.", "www.a.com:8080") as siteKey would make it; null if not one. */
export function siteKeyOfHost(host: string): string | null {
  const text = host.trim();
  if (!text || /[/?#@\\\s]/.test(text)) return null;
  return siteKey(`https://${text}`);
}

/** The registrable domain of an address ("shop.example.com.tr" → "example.com.tr"), or null. */
export function registrableSite(raw: unknown): string | null {
  const u = parseWebUrl(raw);
  return u ? registrableDomain(u.host) : null;
}

/** The host to show the user for an address: siteKey (punycode keeps look-alike names visible), or null. */
export function shownHost(raw: unknown): string | null {
  return siteKey(raw);
}
