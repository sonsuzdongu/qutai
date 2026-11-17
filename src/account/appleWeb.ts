/**
 * Sign in with Apple on Android, the app's pure half (backend/README.md › Auth › Sign in with Apple on Android; no
 * React Native imports, tested in scripts/account-tests/). Apple has no Android SDK: the server starts Apple's web
 * authorization, Apple returns to the server, and the server sends the browser back to
 * `qutai://auth/apple/done?flow=…&handoff=…`. Neither value is a token: finishing also needs the verifier that never
 * left the app. The return link is never a page to open (src/device/entryPoints.ts ignores it).
 */
export const APPLE_RETURN_URL = 'qutai://auth/apple/done';

/** `qutai://auth/…`: the return from a web sign-in. Case-insensitive like the scheme and host. */
export function isAuthReturnLink(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^qutai:\/\/auth(?:[/?#]|$)/i.test(url.trim());
}

export type AppleReturn =
  | { ok: true; flow: string; handoff: string }
  | { ok: false; error: 'cancelled' | 'failed' | 'invalid' };

const FLOW = /^[0-9a-f-]{36}$/;
const HANDOFF = /^[A-Za-z0-9_-]{43}$/;

/** Reads the return link; anything unexpected is `invalid`. */
export function parseAppleReturn(url: string | null | undefined): AppleReturn {
  if (typeof url !== 'string' || url.length > 1024) return { ok: false, error: 'invalid' };
  const match = /^qutai:\/\/auth\/apple\/done\/?\?([^#]*)(?:#.*)?$/i.exec(url.trim());
  if (!match) return { ok: false, error: 'invalid' };
  const params: Record<string, string> = {};
  for (const pair of match[1].split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    const key = at < 0 ? pair : pair.slice(0, at);
    let value: string;
    try {
      value = decodeURIComponent(at < 0 ? '' : pair.slice(at + 1));
    } catch {
      return { ok: false, error: 'invalid' };
    }
    if (key in params) return { ok: false, error: 'invalid' };
    params[key] = value;
  }
  if (params.error === 'cancelled') return { ok: false, error: 'cancelled' };
  if (params.error) return { ok: false, error: params.error === 'invalid' ? 'invalid' : 'failed' };
  if (!FLOW.test(params.flow ?? '') || !HANDOFF.test(params.handoff ?? '')) return { ok: false, error: 'invalid' };
  return { ok: true, flow: params.flow, handoff: params.handoff };
}
