import { useSyncExternalStore } from 'react';
import { accountsEnabled, features } from '../config/features';
import { getLocale, t } from '../i18n';
import { AccountApiError, createApi } from './api';
import { deviceProof } from './deviceCheck';
import { EmailSignInFlow, emailErrorMessage, waitSpan, type EmailSignInState } from './emailSignIn';
import { SignInFailed } from './providers';
import { AccountSession, type AccountState } from './session';
import { securePendingEmailStorage, secureSessionStorage } from './storage';
import { reportStorageFailure } from '../storage/failures';

export { accountErrorDetails } from './errorDetails';

/**
 * Accounts with Qutai's server: pro mode only (`accountsEnabled`: EXPO_PUBLIC_PRO_MODE=on and
 * EXPO_PUBLIC_QUTAI_API_URL set). Without it there is no session object at all, so nothing here can reach the
 * server; the open-source build never creates one.
 */

let instance: AccountSession | null = null;
let emailFlow: EmailSignInFlow | null = null;

export function accountSession(): AccountSession | null {
  if (!accountsEnabled || !features.apiUrl) return null;
  if (!instance) {
    // The interface language goes with every sign-in: the server writes its mails in it.
    // A sign-in the phone couldn't save (or a sign-out it couldn't remove) is told to the user once.
    instance = new AccountSession(createApi(features.apiUrl, fetch, deviceProof), secureSessionStorage, Date.now, getLocale, (kind, error) =>
      reportStorageFailure('account.session', error, 'user', kind === 'save' ? 'account.saveFailed' : 'account.clearFailed'),
    );
    instance.load();
  }
  return instance;
}

/** Sign-in by email's state (pending address, code screen); null when accounts are off. */
export function emailSignIn(): EmailSignInFlow | null {
  const session = accountSession();
  if (!session) return null;
  if (!emailFlow) {
    const flow = new EmailSignInFlow(session, securePendingEmailStorage);
    emailFlow = flow;
    flow.load();
    // Signed in another way (Apple, Google) while a code was waiting: that address is no longer needed.
    session.onSignIn(() => {
      const state = flow.getState();
      if (state.status === 'pending' && !state.verifying) flow.cancel();
    });
  }
  return emailFlow;
}

const IDLE: EmailSignInState = { status: 'idle' };

export function useEmailSignInState(): EmailSignInState {
  const flow = emailSignIn();
  return useSyncExternalStore(
    (onChange) => flow?.subscribe(onChange) ?? (() => {}),
    () => flow?.getState() ?? IDLE,
  );
}

/** "45 seconds", "2 minutes", "1 hour", in the interface language. */
export function waitText(seconds: number): string {
  const { unit, count } = waitSpan(seconds);
  if (count === 1) return t(unit === 'second' ? 'when.second' : unit === 'minute' ? 'when.minute' : 'when.hour');
  return t(unit === 'second' ? 'when.seconds' : unit === 'minute' ? 'when.minutes' : 'when.hours', { count });
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

/**
 * A user-facing sentence for anything an account action can throw (never the server's raw text or a token).
 * The technical line for "Details" under it is accountErrorDetails().
 */
export function accountErrorMessage(error: unknown): string {
  if (error instanceof SignInFailed) {
    if (error.reason === 'notConfigured') return t('account.error.notConfigured');
    if (error.reason === 'needsBuild') return t('account.error.needsBuild');
    if (error.reason === 'noAccount') return t('account.error.noGoogleAccount');
    return t('account.error.providerFailed');
  }
  const email = emailErrorMessage(error);
  if (email) {
    const sentence = t(email.key);
    return email.waitSeconds ? `${sentence} ${t('account.email.error.waitFor', { wait: waitText(email.waitSeconds) })}` : sentence;
  }
  if (!(error instanceof AccountApiError)) return t('account.error.unexpected');
  switch (error.code) {
    case 'network':
    case 'timeout':
      return t('account.error.offline');
    case 'unavailable':
      // The sign-in routes say why (backend/README.md › Auth › Sign-in error reasons).
      if (error.reason === 'not_configured') return t('account.error.serverNotConfigured');
      return t('account.error.unavailable');
    case 'not_implemented':
    case 'internal':
    case 'bad_response':
      return t('account.error.unavailable');
    case 'rate_limited':
      return t('account.error.rateLimited');
    case 'account_suspended':
      return t('account.error.suspended');
    case 'unauthorized':
      // With a reason it's a refused sign-in, not an ended session.
      return error.reason ? t('account.error.signInRejected') : t('account.error.signInAgain');
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
