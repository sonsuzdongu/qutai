import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { accountSession } from '../account';
import { anthropic } from '../ai/anthropic';
import { gemini } from '../ai/gemini';
import { openai } from '../ai/openai';
import type { Provider } from '../ai/types';
import { creditsEnabled, features } from '../config/features';
import { appVersion } from '../device/appVersion';
import { getLanguage, t } from '../i18n';
import { waitForForeground } from '../utils/foreground';
import { createCreditsClient, type CreditsClient } from './client';
import { formatCredits, separators } from './format';
import { createCreditsProvider } from './provider';
import { offeredModels } from './rules';
import { createCreditsStore, type CreditsState } from './store';
import type { PublicConfig } from './types';
import { preTierChoice, resolveTier, tierName, usesTiers } from './tiers';

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
    });
    // Another account's balance must never show: forget it when the account changes.
    let user: string | null = null;
    session.subscribe((state) => {
      const next = state.status === 'signedIn' ? state.user.id : null;
      if (next !== user) creditsStore.forgetAccount();
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
  SecureStore.getItemAsync(CONSENT_KEY)
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

const KNOWN_MODELS = [...anthropic.models, ...openai.models, ...gemini.models];

/** What a model is in the own-key lists (fastest, recommended, strongest), to map a choice saved before tiers. */
export const modelTag = (id: string) => KNOWN_MODELS.find((m) => m.id === id)?.tag;

/** A provider model's display name: the name the own-key list gives it, else its id. */
export function providerModelName(id: string): string {
  return KNOWN_MODELS.find((m) => m.id === id)?.name ?? id;
}

/**
 * The name of a Qutai Credits id as recorded (logs, answer costs): a tier's name for a tier id, a model's name for a
 * provider model id (requests made before tiers, or on a server without them).
 */
export function creditsModelName(id: string): string {
  const config = creditsStore.getState().config;
  if (config?.tiers.some((tier) => tier.id === id)) return tierName(id);
  if (KNOWN_MODELS.some((m) => m.id === id)) return providerModelName(id);
  return KNOWN_TIER_IDS.includes(id) ? tierName(id) : id;
}

const KNOWN_TIER_IDS = ['fast', 'standard', 'pro'];

/**
 * What the stored Qutai choice (Settings, or a conversation's) means now, by name: the tier it maps to on a server
 * with tiers (a model saved before them included), else the model's name.
 */
export function creditsChoiceName(stored: string | undefined): string {
  const tier = currentTier(stored);
  if (tier) return tierName(tier.id);
  return stored ? creditsModelName(stored) : '';
}

/** The tier a stored Qutai choice means now (null on a server without tiers, or before `/config` was read). */
export function currentTier(stored: string | undefined) {
  const config = creditsStore.getState().config;
  return usesTiers(config) ? resolveTier(config, stored, modelTag) : null;
}

/** A Qutai choice saved before tiers (a provider model id): rewritten as its tier when first used with tiers. */
export const isPreTierChoice = (stored: string | undefined, config: PublicConfig) =>
  preTierChoice(stored, config, (id) => KNOWN_MODELS.some((m) => m.id === id));

const core = createCreditsProvider({
  client: signedInClient,
  config: () => creditsStore.config(),
  refreshConfig: () => creditsStore.config(0),
  appVersion: creditsEnabled ? appVersion().version : '0',
  tagOf: modelTag,
});

export const creditsProvider: Provider = {
  ...core,
  get label() {
    return t('credits.provider');
  },
  shortLabel: 'Qutai',
  /**
   * The tiers Qutai's server offers (`GET /config` › `tiers`, in their order), or on a server without tiers the models
   * it offers; empty until the configuration was read.
   */
  get models() {
    const config = creditsStore.getState().config;
    if (usesTiers(config)) return config.tiers.map((tier) => ({ id: tier.id, name: tierName(tier.id) }));
    return offeredModels(config).map((m) => ({ id: m.model, name: providerModelName(m.model) }));
  },
  get defaultModel() {
    const config = creditsStore.getState().config;
    if (usesTiers(config)) return resolveTier(config, '')?.id ?? '';
    return offeredModels(config)[0]?.model ?? '';
  },
};

/** Reads the configuration and, when signed in, the balance (app start, sign-in, opening the account screen). */
export function refreshCredits(): void {
  if (!creditsEnabled) return;
  creditsStore.config().catch(() => {});
  if (signedInClient()) creditsStore.refreshCredits().catch(() => {});
}
