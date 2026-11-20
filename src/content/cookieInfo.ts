import { parseWebUrl } from '../utils/webUrl';
import { registrableDomain } from './filterLists';

/**
 * The cookie list (docs/page-customisation.md › Cookies). Pure code: no React Native, also runs in Node.
 *
 * The native cookie store (src/device/cookieStore.ts) gives cookies with their values; the values stay in the
 * Cookies view. Everything the assistant sees is made by cookieMetadata, which copies named fields only, and
 * formatCookieList; no value can pass either.
 */

export type SameSite = 'Strict' | 'Lax' | 'None';

/** A cookie as the store has it. null: the platform did not say. */
export type StoreCookie = {
  name: string;
  value: string;
  /** Without a leading dot. */
  domain: string;
  /** Sent to `domain` only, not its subdomains; null when unknown. */
  hostOnly: boolean | null;
  path: string;
  /** When it expires (ms since 1970); null for a session cookie (or unknown when `limited`). */
  expires: number | null;
  secure: boolean | null;
  httpOnly: boolean | null;
  sameSite: SameSite | null;
  /** The store gave names and values only (old Android WebView): domain, path, flags and expiry are guesses or unknown. */
  limited?: boolean;
};

/** What identifies a cookie for deleting it; never the value. */
export type CookieKey = { name: string; domain: string; hostOnly: boolean | null; path: string; secure: boolean | null };

/** What the assistant may know about a cookie: everything but its value. */
export type CookieMeta = {
  handle: string;
  name: string;
  domain: string;
  path: string;
  /** ms since 1970, or null for a session cookie. */
  expires: number | null;
  /** Characters of name and value, as browsers count a cookie's size. */
  size: number;
  httpOnly: boolean | null;
  secure: boolean | null;
  sameSite: SameSite | null;
  /** first: the page's own site (same registrable domain); third: another site's. */
  party: 'first' | 'third';
  limited: boolean;
};

const SAMESITE: Record<string, SameSite> = { strict: 'Strict', lax: 'Lax', none: 'None' };

/** The address's host as the WebView reads it (utils/webUrl.ts), the cookie store's own host. */
function hostOf(url: string): string | null {
  return parseWebUrl(url.trim())?.host ?? null;
}

/**
 * One cookie from Android's CookieManagerCompat.getCookieInfo (a Set-Cookie line with its attributes) for the
 * address it was asked for. A line without a Domain attribute is a host-only cookie of that address's host.
 */
export function parseCookieInfoLine(line: string, url: string): StoreCookie | null {
  const parts = line.split(';');
  const first = parts.shift() ?? '';
  const eq = first.indexOf('=');
  const name = (eq >= 0 ? first.slice(0, eq) : '').trim();
  const value = (eq >= 0 ? first.slice(eq + 1) : first).trim();
  const host = hostOf(url);
  if (!host || (!name && !value)) return null;
  const cookie: StoreCookie = {
    name,
    value,
    domain: host,
    hostOnly: true,
    path: '/',
    expires: null,
    secure: false,
    httpOnly: false,
    sameSite: null,
  };
  let maxAge: number | null = null;
  for (const raw of parts) {
    const at = raw.indexOf('=');
    const key = (at >= 0 ? raw.slice(0, at) : raw).trim().toLowerCase();
    const val = at >= 0 ? raw.slice(at + 1).trim() : '';
    if (key === 'domain' && val) {
      // Chromium writes a host-only cookie's domain as its host and a domain cookie's with a leading dot.
      cookie.domain = val.toLowerCase().replace(/^\./, '');
      cookie.hostOnly = !val.startsWith('.');
    } else if (key === 'path' && val) cookie.path = val;
    else if (key === 'expires' && val) {
      const time = Date.parse(val);
      if (Number.isFinite(time)) cookie.expires = time;
    } else if (key === 'max-age' && /^-?\d+$/.test(val)) maxAge = Number(val);
    else if (key === 'secure') cookie.secure = true;
    else if (key === 'httponly') cookie.httpOnly = true;
    else if (key === 'samesite') cookie.sameSite = SAMESITE[val.toLowerCase()] ?? null;
  }
  if (maxAge !== null) cookie.expires = Date.now() + maxAge * 1000;
  return cookie;
}

/** Android's plain CookieManager.getCookie ("a=1; b=2"): names and values only, everything else unknown. */
export function parsePlainCookieHeader(header: string, url: string): StoreCookie[] {
  const host = hostOf(url);
  if (!host) return [];
  return header
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      return {
        name: eq >= 0 ? pair.slice(0, eq).trim() : '',
        value: eq >= 0 ? pair.slice(eq + 1).trim() : pair,
        domain: host,
        hostOnly: null,
        path: '/',
        expires: null,
        secure: null,
        httpOnly: null,
        sameSite: null,
        limited: true,
      };
    });
}

/** iOS: one HTTPCookie as the native module writes it. */
export type IosCookie = {
  name?: unknown;
  value?: unknown;
  domain?: unknown;
  path?: unknown;
  expires?: unknown;
  secure?: unknown;
  httpOnly?: unknown;
  sameSite?: unknown;
};

export function fromIosCookie(c: IosCookie): StoreCookie | null {
  if (typeof c.name !== 'string' || typeof c.domain !== 'string') return null;
  const domain = c.domain.toLowerCase();
  return {
    name: c.name,
    value: typeof c.value === 'string' ? c.value : '',
    domain: domain.replace(/^\./, ''),
    hostOnly: !domain.startsWith('.'),
    path: typeof c.path === 'string' && c.path ? c.path : '/',
    expires: typeof c.expires === 'number' && Number.isFinite(c.expires) ? c.expires : null,
    secure: c.secure === true,
    httpOnly: c.httpOnly === true,
    sameSite: typeof c.sameSite === 'string' ? (SAMESITE[c.sameSite.toLowerCase()] ?? null) : null,
  };
}

/** Whether a cookie would be sent to an address (domain and path match; Secure ones only over https or localhost). */
export function cookieApplies(cookie: StoreCookie, url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const domainOk =
    cookie.hostOnly === true ? host === cookie.domain : host === cookie.domain || host.endsWith(`.${cookie.domain}`);
  if (!domainOk) return false;
  const path = /^https?:\/\/[^/?#]*([^?#]*)/i.exec(url)?.[1] || '/';
  const cp = cookie.path || '/';
  const pathOk = path === cp || (path.startsWith(cp) && (cp.endsWith('/') || path[cp.length] === '/'));
  if (!pathOk) return false;
  if (cookie.secure === true && !/^https:/i.test(url) && host !== 'localhost' && host !== '127.0.0.1') return false;
  return true;
}

/** The same cookie (name, domain and path); a store asked about several addresses gives some more than once. */
export function cookieId(c: { name: string; domain: string; path: string }): string {
  return `${c.name}\n${c.domain}\n${c.path}`;
}

export function dedupeCookies(cookies: StoreCookie[]): StoreCookie[] {
  const seen = new Map<string, StoreCookie>();
  for (const c of cookies) {
    const id = cookieId(c);
    const had = seen.get(id);
    // A detailed entry wins over a limited one.
    if (!had || (had.limited && !c.limited)) seen.set(id, c);
  }
  return [...seen.values()];
}

function partyOf(domain: string, pageHost: string): 'first' | 'third' {
  const bare = pageHost.replace(/:\d+$/, '').replace(/^www\./, '');
  return registrableDomain(domain) === registrableDomain(bare) ? 'first' : 'third';
}

/**
 * The cookies in a stable order (first-party first, then by domain, name and path) with their metadata and handles
 * c1, c2…, and the key behind each handle for deleting. The value is read for its length only.
 */
export function cookieMetadata(cookies: StoreCookie[], pageHost: string): { list: CookieMeta[]; keys: Map<string, CookieKey> } {
  const sorted = [...cookies].sort((a, b) => {
    const pa = partyOf(a.domain, pageHost) === 'first' ? 0 : 1;
    const pb = partyOf(b.domain, pageHost) === 'first' ? 0 : 1;
    return pa - pb || a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name) || a.path.localeCompare(b.path);
  });
  const keys = new Map<string, CookieKey>();
  const list = sorted.map((c, i): CookieMeta => {
    const handle = `c${i + 1}`;
    keys.set(handle, { name: c.name, domain: c.domain, hostOnly: c.hostOnly, path: c.path, secure: c.secure });
    return {
      handle,
      name: c.name,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      size: c.name.length + c.value.length,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
      party: partyOf(c.domain, pageHost),
      limited: !!c.limited,
    };
  });
  return { list, keys };
}

/** Cookies grouped by domain, first-party domains first (the order cookieMetadata gives). */
export function groupByDomain<T extends { domain: string }>(list: T[]): { domain: string; cookies: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const c of list) {
    const group = groups.get(c.domain);
    if (group) group.push(c);
    else groups.set(c.domain, [c]);
  }
  return [...groups.entries()].map(([domain, cookies]) => ({ domain, cookies }));
}

/**
 * The list as rows of a virtualised list (UI-32): a domain's heading, then one row per cookie, drawn so each domain
 * still reads as one card. A heavy site has hundreds of cookies; only the rows on screen are mounted.
 */
export type CookieRow =
  | { kind: 'domain'; key: string; domain: string; party: CookieMeta['party']; first: boolean; empty: boolean }
  | { kind: 'cookie'; key: string; meta: CookieMeta; last: boolean };

export function cookieRows(list: CookieMeta[]): CookieRow[] {
  const rows: CookieRow[] = [];
  groupByDomain(list).forEach(({ domain, cookies }, i) => {
    rows.push({ kind: 'domain', key: `d:${domain}`, domain, party: cookies[0].party, first: i === 0, empty: !cookies.length });
    cookies.forEach((meta, j) => rows.push({ kind: 'cookie', key: `c:${cookieId(meta)}`, meta, last: j === cookies.length - 1 }));
  });
  return rows;
}

const flag = (v: boolean | null, word: string) => (v === null ? `${word} unknown` : v ? word : `not ${word}`);

/** The list as the assistant reads it (English): metadata only, grouped by domain. */
export function formatCookieList(list: CookieMeta[], site: string, platformNote: string, now = Date.now()): string {
  if (!list.length) return `No cookies apply to this page of ${site} in this tab's cookie store. ${platformNote}`;
  const lines = groupByDomain(list).map(({ domain, cookies }) => {
    const party = cookies[0].party === 'first' ? 'first-party' : 'third-party';
    const rows = cookies.map((c) => {
      const expiry =
        c.expires === null
          ? c.limited
            ? 'expiry unknown'
            : 'session'
          : c.expires <= now
            ? 'expired'
            : `expires ${new Date(c.expires).toISOString().slice(0, 10)}`;
      const bits = [
        `path ${c.path}`,
        expiry,
        `${c.size} chars`,
        flag(c.httpOnly, 'HttpOnly'),
        flag(c.secure, 'Secure'),
        c.sameSite ? `SameSite=${c.sameSite}` : c.limited ? 'SameSite unknown' : 'SameSite not set',
      ];
      return `  - [${c.handle}] ${JSON.stringify(c.name)}: ${bits.join(', ')}`;
    });
    return `${domain} (${party}, ${cookies.length}):\n${rows.join('\n')}`;
  });
  return (
    `${list.length} cookie${list.length === 1 ? '' : 's'} apply to this page of ${site} (values are never shown to you; ` +
    `the user sees them in the Cookies view):\n${lines.join('\n')}\n${platformNote}`
  );
}

/** Android: the address and Set-Cookie line that make the store drop a cookie (an expired one with the same key). */
export function expiringCookie(key: CookieKey, pageUrl: string): { url: string; line: string } {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(key.domain) || /^\d+\.\d+\.\d+\.\d+$/.test(key.domain);
  const scheme = key.secure === true || !local || /^https:/i.test(pageUrl) ? 'https:' : 'http:';
  const line = [
    `${key.name}=`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    `Path=${key.path || '/'}`,
    ...(key.hostOnly === false ? [`Domain=.${key.domain}`] : []),
    ...(key.secure ? ['Secure'] : []),
  ].join('; ');
  return { url: `${scheme}//${key.domain}${key.path || '/'}`, line };
}
