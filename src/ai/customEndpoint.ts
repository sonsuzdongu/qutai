/**
 * The base URL of a custom OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, a company gateway): checked and
 * normalised before it is saved or used. Pure (no URL class: React Native's is incomplete), so it can be tested
 * outside the app.
 *
 * Rules: https for everything; plain http only for loopback and private-network addresses (127/8, ::1, 10/8,
 * 172.16/12, 192.168/16, link-local 169.254/16 and fe80::/10, unique-local fc00::/7, `localhost`, `*.localhost`,
 * `*.local`; not carrier-grade NAT 100.64/10), and only where the platform lets the app make cleartext
 * requests at all (`allowCleartext`: iOS, through App Transport Security's local-networking exception; Android
 * release builds allow no cleartext, see docs/permissions.md). No user name or password in the URL, no query or
 * fragment. Trailing slashes and a pasted `/chat/completions` are removed; a path without `/v1` gets a hint,
 * since most servers serve the API under it.
 */

export type BaseUrlError =
  'empty' | 'invalid' | 'scheme' | 'credentials' | 'query' | 'cleartextPublic' | 'cleartextPlatform';

export type BaseUrlResult =
  | {
      ok: true;
      /** Normalised: lower-case scheme and host, no trailing slash. Requests go to `${url}/chat/completions`. */
      url: string;
      host: string;
      /** Plain http (to a private address): not encrypted, local network only. */
      cleartext: boolean;
      /** The path has no `/v1` segment; most servers need it. */
      missingV1: boolean;
    }
  | { ok: false; error: BaseUrlError };

function ipv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((p) => p <= 255) ? parts : null;
}

/** Loopback, private ranges, link-local, and local names. `host` is lower-case, IPv6 without brackets. */
export function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  const v4 = ipv4(host);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
    );
  }
  if (host.includes(':')) {
    if (host === '::1') return true;
    // IPv4-mapped (::ffff:192.168.1.2).
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(host);
    if (mapped) return isPrivateHost(mapped[1]);
    const first = parseInt(host.split(':')[0] || '0', 16);
    return (first & 0xffc0) === 0xfe80 || (first & 0xfe00) === 0xfc00;
  }
  return false;
}

export function normalizeBaseUrl(input: string, { allowCleartext }: { allowCleartext: boolean }): BaseUrlResult {
  let text = input.trim();
  if (!text) return { ok: false, error: 'empty' };
  // No scheme typed: http for a local address (where allowed), https otherwise.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const bareHost = text
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, '')
      .replace(/^\[|\]$/g, '')
      .toLowerCase();
    text = `${allowCleartext && isPrivateHost(bareHost) ? 'http' : 'https'}://${text}`;
  }
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(text);
  if (!m) return { ok: false, error: 'invalid' };
  const scheme = m[1].toLowerCase();
  const authority = m[2];
  let path = m[3];
  if (scheme !== 'http' && scheme !== 'https') return { ok: false, error: 'scheme' };
  if (authority.includes('@')) return { ok: false, error: 'credentials' };
  if (m[4] || m[5]) return { ok: false, error: 'query' };

  const hp = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(authority);
  if (!hp) return { ok: false, error: 'invalid' };
  const host = hp[1].toLowerCase();
  const port = hp[2];
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) return { ok: false, error: 'invalid' };
  const bare = host.replace(/^\[|\]$/g, '');
  if (!host.startsWith('[') && (bare.startsWith('.') || bare.endsWith('.') || bare.includes('..'))) {
    return { ok: false, error: 'invalid' };
  }

  if (scheme === 'http') {
    if (!isPrivateHost(bare)) return { ok: false, error: 'cleartextPublic' };
    if (!allowCleartext) return { ok: false, error: 'cleartextPlatform' };
  }

  path = path
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/+$/, '');
  if (/\s/.test(path)) return { ok: false, error: 'invalid' };
  const url = `${scheme}://${host}${port ? `:${port}` : ''}${path}`;
  return { ok: true, url, host: bare, cleartext: scheme === 'http', missingV1: !/\/v\d+(\/|$)/i.test(path) };
}

/** The host of a saved base URL, for the "What was sent to the AI" log (empty when it isn't a URL). */
export function endpointHost(baseUrl: string): string {
  const m = /^[a-z]+:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(baseUrl);
  return m ? m[1].replace(/^\[|\]$/g, '').toLowerCase() : '';
}
