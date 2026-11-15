/**
 * Addresses on the user's own device or local network: loopback, private IPv4 ranges, link-local, `.local`
 * (mDNS) and `.home.arpa` names, `localhost`, and IPv6 loopback, unique-local and link-local addresses.
 * Used to read typed addresses as addresses (not searches), to pick http for them, and to explain local
 * connection failures. Not a security boundary: a public name can resolve to a private address and back.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function privateIpv4(host: string): boolean {
  const m = IPV4.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
  return (
    a === 127 || // loopback
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) // link-local
  );
}

function localIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h.includes(':')) return false;
  if (h === '::1') return true;
  // fc00::/7 (unique local) and fe80::/10 (link-local).
  return /^f[cd][0-9a-f]{0,2}:/.test(h) || /^fe[89ab][0-9a-f]?:/.test(h);
}

/** Whether a host name (as in a URL, IPv6 in brackets or not, without the port) is local. */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.home.arpa')) return true;
  return privateIpv4(h) || localIpv6(h);
}

/** The host of an http(s) URL (IPv6 keeps its brackets), lowercase, without user info or port; '' if none. */
export function hostOfUrl(url: string): string {
  const authority = /^https?:\/\/([^/?#]*)/i.exec(url.trim())?.[1] ?? '';
  const hostPort = authority.replace(/^[^@]*@/, '').toLowerCase();
  if (hostPort.startsWith('[')) return hostPort.slice(0, hostPort.indexOf(']') + 1);
  return hostPort.replace(/:\d*$/, '');
}

export function isLocalUrl(url: string): boolean {
  return isLocalHost(hostOfUrl(url));
}
