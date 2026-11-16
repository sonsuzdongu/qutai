import { AccountApiError } from './api';

/**
 * The technical line under "Details" when signing in fails (the plain sentence comes from accountErrorMessage):
 * the native exception's type and message for a provider failure, or the HTTP status, the server's error code,
 * its reason (backend/README.md › Auth › Sign-in error reasons) and request id. Pure code, tested in
 * scripts/account-tests/.
 *
 * Never shows a token, nonce, client id or email: provider messages are scrubbed before they are kept, and the
 * server's reason is a fixed code word (api.ts keeps only [a-z_]).
 */

const MAX_LENGTH = 300;

/** Removes anything that could be an identifier or a secret from a provider's message. */
export function scrubDetail(text: string): string {
  return text
    // Expo's wrapper around a native module's error: "Call to function 'QutaiAuth.googleSignIn' has been rejected.\n→ Caused by: …"
    .replace(/^[\s\S]*→ Caused by:\s*/, '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/[\w-]+\.apps\.googleusercontent\.com/gi, '[client id]')
    .replace(/eyJ[\w-]*\.[\w-]+\.[\w-]*/g, '[token]')
    .replace(/qel_[\w-]+/g, '[token]')
    .replace(/[A-Za-z0-9_+/=-]{32,}/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

/** A provider failure's technical line, from the native error's code and message. */
export function providerFailureDetail(provider: string, code: unknown, message: unknown): string | undefined {
  const parts = [typeof code === 'string' && /^[A-Z_]{1,40}$/.test(code) ? code : null, typeof message === 'string' ? scrubDetail(message) : null]
    .filter((p): p is string => !!p);
  return parts.length ? `${provider}: ${parts.join(': ')}` : undefined;
}

/** The "Details" text for a failed sign-in, or undefined when there's nothing more to say than the sentence. */
export function accountErrorDetails(error: unknown): string | undefined {
  if (error instanceof AccountApiError) {
    const head =
      error.status > 0 ? `Qutai server: HTTP ${error.status} ${error.code}` : `Qutai server: no answer (${error.code})`;
    const parts = [error.reason ? `${head} (${error.reason})` : head];
    if (error.retryAfter) parts.push(`Retry-After ${error.retryAfter} s`);
    if (error.requestId && /^[\w-]{1,64}$/.test(error.requestId)) parts.push(`request ${error.requestId}`);
    return parts.join('; ');
  }
  const detail = (error as { detail?: unknown } | null)?.detail;
  return typeof detail === 'string' && detail ? detail : undefined;
}
