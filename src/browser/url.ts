import { isLocalHost } from './localNetwork';
import { SEARCH_ENGINES, type SearchEngineId } from './search';

/**
 * "host", "host:port" or "[ipv6]:port" at the start of what was typed, followed by nothing or a path, query or
 * fragment. The host part is checked separately.
 */
const HOST_START = /^(\[[0-9a-f:.%]+\]|[^\s/?#:[\]]+)(:\d{1,5})?([/?#]\S*)?$/i;

/** A typed local address without a scheme ("192.168.1.2:3000", "localhost:8080/app", "[::1]:8080", "nas.local"). */
function typedLocalHost(text: string): boolean {
  const m = HOST_START.exec(text);
  if (!m) return false;
  // A single-label name with a port ("myserver:8080") is an intranet machine too.
  return isLocalHost(m[1]) || (!!m[2] && /^[a-z0-9-]+$/i.test(m[1]) && !/^\d+$/.test(m[1]));
}

/** True for things the user clearly meant as an address: a URL, or a domain-like word without spaces. */
export function looksLikeUrl(input: string): boolean {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return true;
  if (/\s/.test(text)) return false;
  if (typedLocalHost(text)) return true;
  // A domain ("example.com", "example.com/path", "example.com:8443"), or any host name with a port.
  return (
    /\.[a-z]{2,}(\/|$|:|\?|#)/i.test(text) ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)*:\d{1,5}([/?#]|$)/i.test(text) ||
    // An IPv4 address ("8.8.8.8", "203.0.113.5/status").
    /^\d{1,3}(\.\d{1,3}){3}([/?#]|$)/.test(text)
  );
}

/**
 * Turns what the user typed into a URL: an address as-is, anything else as a search. Without a scheme, public
 * addresses get https:// and local ones http://, since most servers on a local network (development servers,
 * routers, NAS boxes) only speak http; with HTTPS-only on, the http address is tried over https first anyway, and the
 * existing prompt offers http when that fails.
 */
export function toUrl(input: string, engine: SearchEngineId = 'google'): string {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (typedLocalHost(text)) return `http://${text}`;
  if (looksLikeUrl(text)) return `https://${text}`;
  return SEARCH_ENGINES[engine].searchUrl(text);
}
