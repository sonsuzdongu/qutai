import { RelayError } from '../credits/errors';
import { t, type MessageKey } from '../i18n';
import { ApiError } from './http';

/**
 * A failed assistant request as the user sees it: one plain sentence in the interface language, with the raw text
 * (status, the provider's own message, already shortened and with credentials removed by serverError.ts) kept as
 * `details` for whoever wants it. Raw provider text ("API error 400: request body is not valid JSON: unexpected end
 * of hex escape…") never is the chat's message.
 */
export type ErrorClass =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'rateLimit'
  | 'overloaded'
  | 'rejected'
  | 'credits'
  | 'unavailable'
  | 'unknown';

export type PlainError = {
  kind: ErrorClass;
  /** One sentence for the chat. */
  message: string;
  /** The raw error text, when it says more than `message`. */
  details?: string;
};

const MESSAGES: Record<ErrorClass, MessageKey> = {
  network: 'error.plain.network',
  timeout: 'error.plain.timeout',
  auth: 'error.plain.auth',
  rateLimit: 'error.plain.rateLimit',
  overloaded: 'error.plain.overloaded',
  rejected: 'error.plain.rejected',
  credits: 'error.plain.credits',
  unavailable: 'error.plain.unavailable',
  unknown: 'error.plain.unknown',
};

const NETWORK = /network request failed|failed to fetch|network ?error|internet|offline|connection (was )?(refused|reset|lost|closed)|could not connect|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up|load failed/i;
const TIMEOUT = /timed? ?out|timeout|deadline exceeded|took too long/i;
const OVERLOADED = /overloaded|over capacity|capacity|temporarily unavailable|try again later|server is busy|high demand/i;
const OUT_OF_CREDIT = /insufficient[_ ](quota|balance|credit|funds)|quota exceeded|exceeded your (current )?quota|credit balance|out of credits?|billing|payment required|spend(ing)? limit/i;
const AUTH = /invalid[_ ]?(api[_ ]?)?key|api key not valid|incorrect api key|unauthori[sz]ed|authentication|permission denied|forbidden/i;

/** The class of a raw HTTP status and message from a provider. `credits`: the request went through Qutai Credits. */
export function classifyStatus(status: number, message: string, credits = false): ErrorClass {
  if (OUT_OF_CREDIT.test(message) || status === 402) return credits ? 'unavailable' : 'credits';
  // With Qutai Credits the key is the server's, not the user's: nothing for the user to fix there.
  if (status === 401 || status === 403 || (status === 400 && AUTH.test(message))) return credits ? 'unavailable' : 'auth';
  if (status === 429) return OVERLOADED.test(message) ? 'overloaded' : 'rateLimit';
  if (status === 529 || status === 503 || OVERLOADED.test(message)) return 'overloaded';
  if (status === 408 || status === 504 || TIMEOUT.test(message)) return 'timeout';
  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'rejected';
  return 'unknown';
}

/** Built from a raw response ("API error 400: …"); the adapters' own sentences (no tool support…) are not. */
function isRaw(e: ApiError): boolean {
  return e.message.startsWith(t('error.api', { status: e.status }));
}

function statusOf(e: Error): number | undefined {
  const status = (e as { status?: unknown }).status;
  return typeof status === 'number' && status > 0 ? status : undefined;
}

function relayDetails(e: RelayError): string {
  const parts = [`Qutai Credits: ${e.kind}${e.status ? ` (HTTP ${e.status})` : ''}`];
  if (e.upstream) {
    parts.push(`provider ${e.upstream.status}${e.upstream.code ? ` ${e.upstream.code}` : ''}${e.upstream.message ? `: ${e.upstream.message}` : ''}`);
  }
  if (e.requestId) parts.push(`request ${e.requestId}`);
  return parts.join('; ');
}

/** What the chat shows for an error that ended an assistant task. */
export function plainError(e: unknown, opts: { credits?: boolean } = {}): PlainError {
  const sentence = (kind: ErrorClass, details?: string): PlainError => ({
    kind,
    message: t(MESSAGES[kind]),
    ...(details && details.trim() ? { details: details.trim() } : {}),
  });

  // Qutai Credits' own refusals are already plain sentences, often with a way on (buy credits, sign in, update).
  if (e instanceof RelayError) return { kind: relayClass(e), message: e.message, details: relayDetails(e) };

  if (!(e instanceof Error)) return sentence('unknown', e === undefined || e === null ? undefined : String(e));
  const raw = e.message;

  if (e instanceof ApiError) {
    // The adapters' own sentences (custom endpoint path, no tool or image support) say what to do already.
    if (!isRaw(e)) return { kind: 'rejected', message: raw };
    return sentence(classifyStatus(e.status, raw, opts.credits), raw);
  }
  // fetch's own failures: no answer at all.
  if (e.name === 'TypeError' && NETWORK.test(raw)) return sentence('network', raw);
  if (e.name === 'TimeoutError' || TIMEOUT.test(raw)) return sentence('timeout', raw);
  if (NETWORK.test(raw)) return sentence('network', raw);
  const status = statusOf(e);
  if (status) return sentence(classifyStatus(status, raw, opts.credits), raw);
  if (OVERLOADED.test(raw)) return sentence('overloaded', raw);
  return sentence('unknown', raw);
}

function relayClass(e: RelayError): ErrorClass {
  switch (e.kind) {
    case 'network':
    case 'stream_lost':
      return 'network';
    case 'timeout':
    case 'upstream_timeout':
      return 'timeout';
    case 'not_signed_in':
      return 'auth';
    case 'rate_limited':
    case 'task_active':
      return 'rateLimit';
    case 'upstream_unavailable':
      return 'overloaded';
    case 'insufficient_credits':
      return 'credits';
    case 'maintenance':
    case 'unavailable':
    case 'tier_unavailable':
    case 'upstream_error':
      return 'unavailable';
    case 'unknown':
    case 'bad_response':
      return 'unknown';
    default:
      return 'rejected';
  }
}
