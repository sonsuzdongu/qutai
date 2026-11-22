import type { EventErrorClass } from './events';

/**
 * The kind of a failed task for the `task_failed` event: one of a few fixed words, never the error's message (which can
 * quote a provider's text or a page). Reads only status codes and our own error kinds.
 */
export function errorClassOf(e: unknown): EventErrorClass {
  const err = (typeof e === 'object' && e !== null ? e : {}) as { kind?: unknown; status?: unknown; name?: unknown };
  const kind = typeof err.kind === 'string' ? err.kind : '';
  const status = typeof err.status === 'number' ? err.status : 0;
  if (kind === 'network' || kind === 'stream_lost') return 'network';
  if (kind === 'timeout' || kind === 'upstream_timeout' || err.name === 'TimeoutError') return 'timeout';
  if (kind === 'rate_limited' || status === 429) return 'rate_limited';
  if (kind === 'insufficient_credits') return 'insufficient_credits';
  if (kind.startsWith('upstream_') || status >= 500) return 'provider';
  if (status === 401 || status === 403 || kind === 'not_signed_in' || kind === 'account_suspended' || kind === 'maintenance' || kind === 'upgrade_required') return 'refused';
  if (status === 0 && err.name === 'TypeError') return 'network';
  return 'other';
}
