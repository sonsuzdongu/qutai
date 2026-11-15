export type LoadErrorKind =
  | 'offline'
  | 'dns'
  | 'timeout'
  | 'unreachable'
  | 'cert'
  | 'ssl'
  | 'cleartext'
  | 'generic';

/** What is wrong with a certificate the WebView refused (kind 'cert'). */
export type CertProblem = 'untrusted' | 'expired' | 'notYetValid' | 'hostname' | 'invalid';

export type LoadError = {
  kind: LoadErrorKind;
  code: number;
  description: string;
  /** Kind 'cert' only. */
  cert?: CertProblem;
  /**
   * Android, kind 'cert' on the page itself: SHA-256 of the refused certificate (lowercase hex), reported by the
   * patched react-native-webview; what "Continue anyway" allows (certificateExceptions.ts).
   */
  fingerprint?: string;
};

/** The patched react-native-webview appends this to the description of a certificate error on Android. */
const FINGERPRINT = /\s*\[qutai-cert ([0-9a-f]{64})\]$/;

/**
 * Maps WebView load errors to a few kinds the user can act on. iOS reports NSURLError codes; Android reports
 * WebViewClient codes with Chromium's net::ERR_* names in the description, and certificate errors (from
 * onReceivedSslError) as SslError's primary error code (0-5) with an "SSL error: " description.
 */
export function classifyLoadError(code: number, description: string): LoadErrorKind {
  const d = description.toUpperCase();
  if (certProblem(code, description)) return 'cert';
  if (code === -1009 || d.includes('INTERNET_DISCONNECTED') || d.includes('NETWORK_CHANGED')) return 'offline';
  if (code === -1003 || d.includes('NAME_NOT_RESOLVED') || d.includes('NAME_RESOLUTION')) return 'dns';
  if (code === -1001 || code === -8 || d.includes('TIMED_OUT')) return 'timeout';
  if (code === -1022 || d.includes('CLEARTEXT_NOT_PERMITTED')) return 'cleartext';
  // The server answered but not with TLS (an http-only server opened over https), or the handshake failed.
  if (code === -1200 || code === -1205 || code === -1206 || code === -11 || d.includes('SSL') || d.includes('CERT_'))
    return 'ssl';
  if (
    code === -1004 ||
    code === -6 ||
    d.includes('CONNECTION_REFUSED') ||
    d.includes('ADDRESS_UNREACHABLE') ||
    d.includes('CONNECTION_FAILED') ||
    d.includes('CONNECTION_RESET')
  )
    return 'unreachable';
  return 'generic';
}

/** For a certificate error: what is wrong with it; null for other errors. */
export function certProblem(code: number, description: string): CertProblem | null {
  if (/^SSL error: /.test(description) && code >= 0 && code <= 5) {
    // SslError: NOTYETVALID 0, EXPIRED 1, IDMISMATCH 2, UNTRUSTED 3, DATE_INVALID 4, INVALID 5.
    return (['notYetValid', 'expired', 'hostname', 'untrusted', 'expired', 'invalid'] as const)[code];
  }
  switch (code) {
    case -1201: // NSURLErrorServerCertificateHasBadDate
      return 'expired';
    case -1202: // NSURLErrorServerCertificateUntrusted (also a name mismatch)
    case -1203: // NSURLErrorServerCertificateHasUnknownRoot
      return 'untrusted';
    case -1204: // NSURLErrorServerCertificateNotYetValid
      return 'notYetValid';
  }
  const d = description.toUpperCase();
  if (d.includes('ERR_CERT_DATE_INVALID')) return 'expired';
  if (d.includes('ERR_CERT_COMMON_NAME_INVALID')) return 'hostname';
  if (d.includes('ERR_CERT_AUTHORITY_INVALID')) return 'untrusted';
  if (d.includes('ERR_CERT_')) return 'invalid';
  return null;
}

/** A WebView load error as the app keeps it, with the certificate details split off the description. */
export function toLoadError(code: number, rawDescription: string): LoadError {
  const fingerprint = FINGERPRINT.exec(rawDescription)?.[1];
  const description = rawDescription.replace(FINGERPRINT, '');
  const kind = classifyLoadError(code, description);
  if (kind !== 'cert') return { kind, code, description };
  return { kind, code, description, cert: certProblem(code, description) ?? 'invalid', fingerprint };
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
