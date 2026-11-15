import { useSyncExternalStore } from 'react';
import { accountsEnabled, features } from '../config/features';
import { t } from '../i18n';
import { AccountApiError, createApi } from './api';
import { SignInFailed } from './providers';
import { AccountSession, type AccountState } from './session';
import { secureSessionStorage } from './storage';

/**
 * Accounts with Qutai's server: pro mode only (`accountsEnabled`: EXPO_PUBLIC_PRO_MODE=on and
 * EXPO_PUBLIC_QUTAI_API_URL set). Without it there is no session object at all, so nothing here can reach the
 * server; the open-source build never creates one.
 */

let instance: AccountSession | null = null;

export function accountSession(): AccountSession | null {
  if (!accountsEnabled || !features.apiUrl) return null;
  if (!instance) {
    instance = new AccountSession(createApi(features.apiUrl), secureSessionStorage);
    instance.load();
  }
  return instance;
}

const SIGNED_OUT: AccountState = { status: 'signedOut' };

/** The account's state for the UI; `signedOut` forever when accounts are off. */
export function useAccountState(): AccountState {
  const session = accountSession();
  return useSyncExternalStore(
    (onChange) => session?.subscribe(onChange) ?? (() => {}),
    () => session?.getState() ?? SIGNED_OUT,
  );
}

/** A user-facing sentence for anything an account action can throw (never the server's raw text or a token). */
export function accountErrorMessage(error: unknown): string {
  if (error instanceof SignInFailed) {
    if (error.reason === 'notConfigured') return t('account.error.notConfigured');
    if (error.reason === 'needsBuild') return t('account.error.needsBuild');
    if (error.reason === 'noAccount') return t('account.error.noGoogleAccount');
    return t('account.error.providerFailed');
  }
  if (!(error instanceof AccountApiError)) return t('account.error.unexpected');
  switch (error.code) {
    case 'network':
    case 'timeout':
      return t('account.error.offline');
    case 'unavailable':
    case 'not_implemented':
    case 'internal':
    case 'bad_response':
      return t('account.error.unavailable');
    case 'rate_limited':
      return t('account.error.rateLimited');
    case 'account_suspended':
      return t('account.error.suspended');
    case 'unauthorized':
      return t('account.error.signInAgain');
    default:
      return t('account.error.unexpected');
  }
}

/** Server-unavailable kinds of error: the account is still there, the server just can't be reached now. */
export function isServerUnreachable(error: unknown): boolean {
  return (
    error instanceof AccountApiError &&
    ['network', 'timeout', 'unavailable', 'internal', 'bad_response', 'not_implemented'].includes(error.code)
  );
}
