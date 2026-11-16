import type { ProviderId } from '../ai/types';

/**
 * Whether Qutai Credits can be the provider in use (pro mode only). Pure code, so the rules are tested in Node
 * (scripts/credits-tests/gate.test.ts):
 * - Qutai Credits is only ever the active provider while signed in: the account pays, so without one nothing can be
 *   sent. Signing out, deleting the account, a session the server ended, or a backup restored on a new phone (the
 *   session isn't in backups) all leave the provider set to Qutai with no account; the app then asks the user to sign
 *   in or to choose another provider, and keeps the message they typed.
 * - The disclosure (content passes through Qutai's server) must be accepted on this phone first.
 */
export type QutaiAccess = 'ready' | 'signIn' | 'consent' | 'suspended' | 'loading' | 'off';

export type AccountStatus = 'loading' | 'signedOut' | 'signedIn';

export function qutaiAccess(input: {
  enabled: boolean;
  account: AccountStatus;
  suspended?: boolean;
  consented: boolean;
}): QutaiAccess {
  if (!input.enabled) return 'off';
  if (input.account === 'loading') return 'loading';
  if (input.account !== 'signedIn') return 'signIn';
  if (input.suspended) return 'suspended';
  if (!input.consented) return 'consent';
  return 'ready';
}

/**
 * The account went from signed in to signed out while Qutai Credits is the provider (the default, or the
 * conversation's own choice): the user is told once, with a way to sign in again or choose another provider.
 */
export function lostQutaiAccount(previous: AccountStatus, next: AccountStatus, providers: ProviderId[]): boolean {
  return previous === 'signedIn' && next === 'signedOut' && providers.includes('qutai');
}

/**
 * The provider setup may save: Qutai Credits only with an account. Anything else is kept as it is. When Qutai was
 * picked but there is no account (signed out during setup), the provider goes back to `fallback`, which setup
 * passes as the provider it started with, so nothing is left selected that can't be used.
 */
export function providerToSave(provider: ProviderId, signedIn: boolean, fallback: ProviderId): ProviderId {
  if (provider !== 'qutai' || signedIn) return provider;
  return fallback === 'qutai' ? 'anthropic' : fallback;
}
