import { t, type MessageKey } from '../i18n';
import type { RelayErrorCode, RelayProvider, UpstreamError } from './types';

/**
 * Why a Qutai Credits request didn't go through: the relay's own error codes (backend/README.md › Relay › Answer),
 * and the app's own for when no answer came or the app can tell before sending.
 */
export type RelayErrorKind =
  | Exclude<RelayErrorCode, 'unauthorized' | 'internal'>
  | 'not_signed_in'
  | 'network'
  | 'timeout'
  | 'stream_lost'
  | 'bad_response'
  | 'not_accepted'
  | 'unknown';

const SERVER_CODES: ReadonlySet<string> = new Set<RelayErrorCode>([
  'bad_request',
  'account_suspended',
  'rate_limited',
  'unavailable',
  'payload_too_large',
  'upgrade_required',
  'maintenance',
  'model_not_allowed',
  'step_limit',
  'profile_unknown',
  'insufficient_credits',
  'task_active',
  'upstream_rejected',
  'upstream_unavailable',
  'upstream_error',
  'upstream_timeout',
  'tier_unknown',
  'tier_unavailable',
  'tier_moved',
  'continuation_invalid',
]);

const MESSAGES: Record<RelayErrorKind, MessageKey> = {
  not_signed_in: 'credits.error.notSignedIn',
  insufficient_credits: 'credits.error.insufficient',
  task_active: 'credits.error.taskActive',
  rate_limited: 'credits.error.rateLimited',
  model_not_allowed: 'credits.error.modelNotAllowed',
  payload_too_large: 'credits.error.tooLarge',
  step_limit: 'credits.error.stepLimit',
  account_suspended: 'credits.error.suspended',
  maintenance: 'credits.error.maintenance',
  unavailable: 'credits.error.unavailable',
  upgrade_required: 'credits.error.upgrade',
  profile_unknown: 'credits.error.upgrade',
  bad_request: 'credits.error.badRequest',
  upstream_unavailable: 'credits.error.providerBusy',
  upstream_error: 'credits.error.providerBroke',
  upstream_timeout: 'credits.error.providerTimeout',
  upstream_rejected: 'credits.error.providerRefused',
  tier_unknown: 'credits.error.tierUnknown',
  tier_unavailable: 'credits.error.tierUnavailable',
  // Handled by the provider (one rebuilt retry); seen only when the tier moved again during that retry.
  tier_moved: 'credits.error.tierMoved',
  // Handled by the task (it ends with the pause note); seen only outside a continuation.
  continuation_invalid: 'credits.error.unexpected',
  network: 'credits.error.unreachable',
  timeout: 'credits.error.unreachable',
  stream_lost: 'credits.error.streamLost',
  bad_response: 'credits.error.unexpected',
  not_accepted: 'credits.error.notAccepted',
  unknown: 'credits.error.unexpected',
};

export class RelayError extends Error {
  /**
   * Not repeated by an adapter's fallback (Gemini's "try without streaming"): the relay said no, or the connection
   * broke. A provider's stream that the server reports as cut (`qutai.error`) is like a broken stream on a direct
   * call, so that one may be tried again without streaming.
   */
  readonly final: boolean;
  readonly retryAfter?: number;
  readonly upstream?: UpstreamError;
  readonly requestId?: string;
  /** Micro-credits the request was charged before it failed (a stream cut short is still paid for what came). */
  readonly charged: number;
  /** `tier_moved`: the provider format the tier runs on now (`error.tier.provider`). */
  readonly movedTo?: RelayProvider;
  /** The server's short reason code (for example `device_check` on a 403), when it sent one. */
  readonly reason?: string;

  constructor(
    readonly kind: RelayErrorKind,
    /** HTTP status, 0 when no answer came. */
    readonly status: number,
    extra: {
      retryAfter?: number;
      upstream?: UpstreamError;
      requestId?: string;
      charged?: number;
      detail?: string;
      movedTo?: RelayProvider;
      reason?: string;
    } = {},
  ) {
    super(relayErrorMessage(kind, extra));
    this.name = 'RelayError';
    this.final = !(status === 200 && (kind === 'upstream_error' || kind === 'upstream_timeout'));
    this.retryAfter = extra.retryAfter;
    this.upstream = extra.upstream;
    this.requestId = extra.requestId;
    this.charged = extra.charged ?? 0;
    this.movedTo = extra.movedTo;
    this.reason = extra.reason;
  }

  /** The kind for a server error code, or by HTTP status when the body had none the app knows. */
  static kindFor(code: string, status: number): RelayErrorKind {
    if (code === 'unauthorized') return 'not_signed_in';
    if (code === 'internal') return 'unknown';
    if (SERVER_CODES.has(code)) return code as RelayErrorKind;
    if (status === 401) return 'not_signed_in';
    if (status === 402) return 'insufficient_credits';
    if (status === 413) return 'payload_too_large';
    if (status === 426) return 'upgrade_required';
    if (status === 429) return 'rate_limited';
    if (status === 503) return 'unavailable';
    if (status === 502 || status === 504) return 'network';
    return 'unknown';
  }
}

/** The sentence the user sees. `detail`: the maintenance message the server gave, if any. */
export function relayErrorMessage(kind: RelayErrorKind, extra: { retryAfter?: number; detail?: string } = {}): string {
  if (kind === 'rate_limited' && extra.retryAfter) return t('credits.error.rateLimitedFor', { seconds: extra.retryAfter });
  if (kind === 'maintenance' && extra.detail) return t('credits.error.maintenanceWith', { message: extra.detail });
  return t(MESSAGES[kind]);
}

/** Refusals before the provider was reached: nothing was charged and nothing reached the AI. */
export function nothingSent(e: unknown): boolean {
  return (
    e instanceof RelayError &&
    e.charged === 0 &&
    !['upstream_error', 'upstream_timeout', 'stream_lost', 'bad_response', 'upstream_rejected'].includes(e.kind)
  );
}
