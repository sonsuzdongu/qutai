import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { AppState, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { serverFlags } from '../account/serverFlags';
import { accountsEnabled, features } from '../config/features';
import { appVersion } from '../device/appVersion';
import { getLanguage } from '../i18n';
import { secureStoreReady } from '../storage/secureStoreGate';
import { Analytics } from './analytics';
import type { EventName, EventProps } from './events';

/**
 * Product analytics in the app (pro builds only; docs/design/37-server-and-analytics.md `SRV-31`…`SRV-33`).
 *
 * Consent is asked once (analytics/consent prompt), off until the user taps Allow, changeable in Settings › Privacy.
 * It is kept on this phone only, outside Settings, so it is never in a backup and every phone asks for itself. The install
 * id is a random UUID made at Allow and deleted at withdrawal; a later Allow makes a new one. The open-source build has
 * none of this (no account, no server): `track` does nothing there.
 */

export type AnalyticsConsent = 'ask' | 'allowed' | 'declined';

const CONSENT_KEY = 'analytics_consent';
const INSTALL_KEY = 'analytics_install_id';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

let consent: AnalyticsConsent = 'ask';
let installId: string | null = null;
let loaded = false;
let loading: Promise<void> | null = null;
let incognitoProbe: () => boolean = () => false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load(): Promise<void> {
  if (loaded || !accountsEnabled) return;
  loading ??= (async () => {
    try {
      await secureStoreReady();
      const [c, id] = await Promise.all([SecureStore.getItemAsync(CONSENT_KEY, OPTIONS), SecureStore.getItemAsync(INSTALL_KEY, OPTIONS)]);
      consent = c === 'allowed' || c === 'declined' ? c : 'ask';
      installId = consent === 'allowed' ? id : null;
    } catch {
      consent = 'ask';
    } finally {
      loaded = true;
      emit();
    }
  })();
  return loading;
}

const analytics = new Analytics({
  consent: () => consent,
  installId: () => installId,
  serverCollects: async () => (features.apiUrl ? (await serverFlags(features.apiUrl)).analytics : false),
  incognito: () => incognitoProbe(),
  sink: {
    async send(batch) {
      if (!features.apiUrl) return;
      // No Authorization header: events are never linked to the account.
      await fetch(`${features.apiUrl.replace(/\/+$/, '')}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    },
  },
  meta: () => ({ appVersion: appVersion().version, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale: getLanguage() }),
});

if (accountsEnabled) {
  void load();
  AppState.addEventListener('change', (state) => {
    if (state === 'background') void analytics.flush();
  });
}

/** Records one event (only with consent, the server collecting, and outside incognito). */
export function track<N extends EventName>(name: N, props?: EventProps<N>): void {
  if (!accountsEnabled || Platform.OS === 'web') return;
  analytics.track(name, props);
}

let setupPending = false;

/**
 * Setup just finished. Consent is asked only after setup, so the event is kept in memory for this run and sent if the
 * user taps Allow (never stored, never sent without it).
 */
export function noteSetupFinished(): void {
  if (!accountsEnabled) return;
  if (consent === 'allowed') track('setup_finished');
  else setupPending = true;
}

/** App.tsx tells whether the user is in an incognito tab right now. */
export function setIncognitoProbe(probe: () => boolean): void {
  incognitoProbe = probe;
}

export async function setAnalyticsConsent(allowed: boolean): Promise<void> {
  if (!accountsEnabled) return;
  await load();
  consent = allowed ? 'allowed' : 'declined';
  if (allowed) {
    installId ??= randomUUID();
    if (setupPending) {
      setupPending = false;
      track('setup_finished');
    }
  } else {
    setupPending = false;
    installId = null;
    analytics.clear();
  }
  emit();
  try {
    await secureStoreReady();
    await SecureStore.setItemAsync(CONSENT_KEY, consent, OPTIONS);
    if (installId) await SecureStore.setItemAsync(INSTALL_KEY, installId, OPTIONS);
    else await SecureStore.deleteItemAsync(INSTALL_KEY, OPTIONS);
  } catch {
    // Kept in memory for this run; asked again next time if it couldn't be saved.
  }
}

/** Whether the server collects events right now (the consent question and the Settings switch show only then). */
export async function analyticsOffered(): Promise<boolean> {
  if (!accountsEnabled || !features.apiUrl || Platform.OS === 'web') return false;
  return (await serverFlags(features.apiUrl)).analytics;
}

export async function analyticsConsent(): Promise<AnalyticsConsent> {
  await load();
  return consent;
}

/** The consent for the Settings switch (re-renders when it changes). */
export function useAnalyticsConsent(): AnalyticsConsent | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void load();
      return () => listeners.delete(l);
    },
    () => (accountsEnabled && loaded ? consent : null),
  );
}
