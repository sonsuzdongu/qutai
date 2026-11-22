import * as SecureStore from 'expo-secure-store';
import { secureStoreReady } from '../storage/secureStoreGate';
import { useSyncExternalStore } from 'react';
import { accountSession } from '../account';
import { deviceProof } from '../account/deviceCheck';
import type { Provider } from '../ai/types';
import { creditsEnabled, features } from '../config/features';
import { appVersion } from '../device/appVersion';
import { getLanguage, t } from '../i18n';
import { waitForForeground } from '../utils/foreground';
import { createCreditsClient, type CreditsClient, type IntroRequestBody } from './client';
import { INTRO_AUDIT } from '../intro/request';
import { newSentId, recordSent } from '../storage/sentLog';
import { formatCredits, separators } from './format';
import { createCreditsProvider } from './provider';
import { createCreditsStore, type CreditsState } from './store';

/**
 * Qutai Credits in the app (pro mode only, `creditsEnabled`): the client, the store the screens follow, the
 * "Qutai Credits" provider and the user's answer to the disclosure. Without pro mode and a server address nothing
 * here is created: no client, no request, and the provider isn't in the list (ai/providers.ts PROVIDER_ORDER).
 */

let client: CreditsClient | null = null;

function getClient(): CreditsClient | null {
  if (!creditsEnabled || !features.apiUrl) return null;
  const session = accountSession();
  if (!session) return null;
  if (!client) {
    client = createCreditsClient({
      baseUrl: features.apiUrl,
      appVersion: appVersion().version,
      tokens: {
        get: () => session.currentAccessToken(),
        renew: (stale) => session.renewAccessToken(stale),
        suspended: () => session.noteSuspended(),
        ended: () => session.noteSessionEnded(),
      },
      onBalance: (balance) => creditsStore.setBalance(balance),
      beforeRetry: (signal) => waitForForeground(signal),
      deviceProof: deviceProof(),
    });
    // Another account's balance must never show: forget it when the account changes.
    let user: string | null = null;
    session.subscribe((state) => {
      const next = state.status === 'signedIn' ? state.user.id : null;
      if (next !== user) {
        creditsStore.forgetAccount();
        deviceProof()?.reset();
      }
      user = next;
    });
  }
  return client;
}

/** The client for requests that need the account: null while signed out. */
function signedInClient(): CreditsClient | null {
  const session = accountSession();
  return session?.getState().status === 'signedIn' ? getClient() : null;
}

/**
 * The free introduction (backend README › Relay › Introduction): null when there is no signed-in client, so the
 * caller uses the credits relay as before.
 */
export function freeIntro(): ((body: IntroRequestBody, signal: AbortSignal) => Promise<unknown>) | null {
  const c = signedInClient();
  if (!c) return null;
  return (body, signal) => {
    // The user's words leave the phone: listed in "What was sent to the AI" like the relay's request (INTRO-9).
    const text = body.round === 'introduction' ? body.text : body.answers.map((a) => a.text).join('\n');
    const at = Date.now();
    recordSent({
      id: newSentId(at),
      at,
      provider: 'qutai',
      model: '',
      host: null,
      conversation: INTRO_AUDIT,
      items: [{ kind: 'message', chars: text.length }],
      totalChars: text.length,
      images: 0,
      resentTurns: 0,
      resentChars: 0,
      webSearch: false,
      research: false,
      incognito: false,
      content: [{ text }],
    });
    return c.intro(body, signal);
  };
}

/** The signed-in client (purchases report through it); null while signed out or without credits. */
export function creditsClient(): CreditsClient | null {
  return signedInClient();
}

export const creditsStore = createCreditsStore({ client: signedInClient, publicClient: getClient });

export function useCreditsState(): CreditsState {
  return useSyncExternalStore(creditsStore.subscribe, creditsStore.getState);
}

/** Balance as text in the app's language ("12.35"). */
export function creditsText(micro: number): string {
  return formatCredits(micro, separators(getLanguage()));
}

// --- The disclosure: in credit mode the conversation and page content pass through Qutai's server ---

const CONSENT_KEY = 'credits_disclosure_accepted';
/** Raise when the disclosure's substance changes, so everyone is asked again. */
const CONSENT_VERSION = '1';
let consent: boolean | null = null;
const consentListeners = new Set<() => void>();

if (creditsEnabled) {
  secureStoreReady()
    .then(() => SecureStore.getItemAsync(CONSENT_KEY))
    .then((v) => setConsentState(v === CONSENT_VERSION))
    .catch(() => setConsentState(false));
}

function setConsentState(value: boolean) {
  consent = value;
  consentListeners.forEach((l) => l());
}

/** Whether the user accepted the disclosure on this phone (false until read). */
export function creditsConsented(): boolean {
  return consent === true;
}

export async function setCreditsConsent(accepted: boolean): Promise<void> {
  setConsentState(accepted);
  await (accepted ? SecureStore.setItemAsync(CONSENT_KEY, CONSENT_VERSION) : SecureStore.deleteItemAsync(CONSENT_KEY)).catch(() => {});
}

export function useCreditsConsent(): boolean {
  return useSyncExternalStore(
    (l) => {
      consentListeners.add(l);
      return () => {
        consentListeners.delete(l);
      };
    },
    () => consent === true,
  );
}

/** The provider can be used now: credits in this build, signed in, disclosure accepted. */
export function creditsReady(): boolean {
  return creditsEnabled && consent === true && accountSession()?.getState().status === 'signedIn';
}

// --- The provider ---

const core = createCreditsProvider({
  client: signedInClient,
  config: () => creditsStore.config(),
  refreshConfig: () => creditsStore.config(0),
  appVersion: creditsEnabled ? appVersion().version : '0',
});

export const creditsProvider: Provider = {
  ...core,
  get label() {
    return t('credits.provider');
  },
  shortLabel: 'Qutai',
  /** Nothing to choose with Qutai Credits (CRED-39): the server's default tier serves every request. */
  models: [],
  defaultModel: '',
};

/** Reads the configuration and, when signed in, the balance (app start, sign-in, opening the account screen). */
export function refreshCredits(): void {
  if (!creditsEnabled) return;
  creditsStore.config().catch(() => {});
  if (signedInClient()) creditsStore.refreshCredits().catch(() => {});
}
