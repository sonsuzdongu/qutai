export type LoadErrorKind = 'offline' | 'dns' | 'timeout' | 'ssl' | 'generic';

export type LoadError = { kind: LoadErrorKind; code: number; description: string };

/**
 * Maps WebView load errors to a few kinds the user can act on. iOS reports NSURLError codes;
 * Android reports WebViewClient codes with Chromium's net::ERR_* names in the description.
 */
export function classifyLoadError(code: number, description: string): LoadErrorKind {
  const d = description.toUpperCase();
  if (code === -1009 || d.includes('INTERNET_DISCONNECTED') || d.includes('NETWORK_CHANGED')) return 'offline';
  if (code === -1003 || d.includes('NAME_NOT_RESOLVED') || d.includes('NAME_RESOLUTION')) return 'dns';
  if (code === -1001 || code === -8 || d.includes('TIMED_OUT')) return 'timeout';
  if ((code <= -1200 && code >= -1206) || code === -11 || d.includes('SSL') || d.includes('CERT_')) return 'ssl';
  return 'generic';
}

/** Schemes the WebView itself handles; everything that isn't web or one of these belongs to another app. */
const IN_PAGE_SCHEMES = /^(about|data|blob|javascript):/i;

export type LinkTarget = 'web' | 'in-page' | 'external';

export function linkTarget(url: string): LinkTarget {
  if (/^https?:/i.test(url)) return 'web';
  if (IN_PAGE_SCHEMES.test(url)) return 'in-page';
  return 'external';
}

/**
 * Android `intent://` links (`intent://host/path#Intent;scheme=x;package=y;S.browser_fallback_url=…;end`)
 * can't be opened as-is from React Native. They become the app's own URL, plus the web
 * fallback the page provided for when the app isn't installed.
 */
export function parseIntentUrl(url: string): { appUrl?: string; fallbackUrl?: string } {
  const match = /^intent:\/\/([^#]*)#Intent;(.*?);?end;?$/i.exec(url);
  if (!match) return {};
  const [, rest, params] = match;
  const fields = new Map<string, string>();
  for (const part of params.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) fields.set(part.slice(0, eq), part.slice(eq + 1));
  }
  const scheme = fields.get('scheme');
  let fallbackUrl: string | undefined;
  try {
    const raw = fields.get('S.browser_fallback_url');
    if (raw) fallbackUrl = decodeURIComponent(raw);
  } catch {}
  if (fallbackUrl && !/^https?:\/\//i.test(fallbackUrl)) fallbackUrl = undefined;
  return { appUrl: scheme ? `${scheme}://${rest}` : undefined, fallbackUrl };
}

/** Short, readable form of an external link for the confirmation prompt. */
export function describeExternalUrl(url: string): string {
  const intent = parseIntentUrl(url);
  const shown = intent.appUrl ?? url;
  return shown.length > 80 ? `${shown.slice(0, 77)}…` : shown;
}
