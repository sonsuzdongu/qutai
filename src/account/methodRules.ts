import type { SignInMethod } from './types';

/**
 * Rules the server applies to sign-in methods, mirrored for the UI (backend/README.md › Auth › Sign-in methods). Pure,
 * tested in scripts/account-tests/.
 */

/**
 * An Apple "Hide My Email" relay address (…@privaterelay.appleid.com): the account screen says "hidden email" instead
 * of showing it.
 */
export function isPrivateRelayAddress(email: string): boolean {
  return /@privaterelay\.appleid\.com$/i.test(email.trim());
}

/** Removing needs more than one method, and an id from a current `GET /me`. */
export function canRemove(methods: SignInMethod[], method: SignInMethod): boolean {
  return methods.length > 1 && typeof method.id === 'string' && method.id.length > 0;
}

/**
 * The methods that may confirm the removal of `target`: those at least as old as it (the target included). The
 * server refuses a proof by a newer one, so the app offers only these.
 */
export function methodsThatCanConfirm(methods: SignInMethod[], target: SignInMethod): SignInMethod[] {
  return methods.filter((m) => m.linkedAt <= target.linkedAt);
}

/** A pending email proof (add, re-check or combine): in memory only, so a link from the mail can finish it here. */
export type PendingEmailProof = { email: string; take: (linkToken: string) => void };

let pendingProof: PendingEmailProof | null = null;

export function setPendingEmailProof(pending: PendingEmailProof | null): void {
  pendingProof = pending;
}

/** Hands a link token to the waiting email proof; false when none waits (then it's a sign-in link). */
export function takeEmailProofLink(linkToken: string): boolean {
  if (!pendingProof) return false;
  pendingProof.take(linkToken);
  return true;
}

/** Retry-After for a merge that waits: at least 2 s, at most a minute between the app's own retries. */
export function mergeRetryDelayMs(retryAfterSeconds: number | null): number {
  const seconds = retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : 5;
  return Math.min(60, Math.max(2, seconds)) * 1000;
}
