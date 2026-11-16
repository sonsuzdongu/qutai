import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';
import { secureStoreReady } from '../storage/secureStoreGate';
import { isDeviceId, makeDeviceId } from './nonce';
import type { PendingStorage } from './emailSignIn';
import type { SessionStorage, StoredSession } from './session';

/**
 * The account session in the device's secure storage (Keychain / Android Keystore through expo-secure-store),
 * like the AI keys. One item, so the access and refresh tokens are always written together.
 * "This device only": the tokens and the device id never move to another phone through an iCloud Keychain or
 * a device backup (a session belongs to one device on the server).
 */
const SESSION_KEY = 'account_session';
const DEVICE_KEY = 'account_device_id';
const EMAIL_PENDING_KEY = 'account_email_pending';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

function isStoredSession(value: unknown): value is StoredSession {
  const s = value as StoredSession | null;
  return (
    !!s &&
    typeof s.accessToken === 'string' &&
    typeof s.refreshToken === 'string' &&
    typeof s.accessExpiresAt === 'number' &&
    typeof s.refreshExpiresAt === 'number' &&
    !!s.user &&
    typeof s.user.id === 'string' &&
    Array.isArray(s.user.providers) &&
    (s.user.status === 'active' || s.user.status === 'suspended')
  );
}

let deviceId: Promise<string> | null = null;

export const secureSessionStorage: SessionStorage = {
  async load() {
    await secureStoreReady();
    const raw = await SecureStore.getItemAsync(SESSION_KEY, OPTIONS);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isStoredSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  save: (session) => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), OPTIONS),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS),
  deviceId() {
    deviceId ??= (async () => {
      await secureStoreReady();
      const stored = await SecureStore.getItemAsync(DEVICE_KEY, OPTIONS).catch(() => null);
      if (isDeviceId(stored)) return stored;
      const created = makeDeviceId(getRandomBytes);
      await SecureStore.setItemAsync(DEVICE_KEY, created, OPTIONS).catch(() => {});
      return created;
    })();
    deviceId.catch(() => (deviceId = null));
    return deviceId;
  },
};

/**
 * Sign-in by email's pending address (src/account/emailSignIn.ts): the address and when its code runs out, so the code
 * screen and the mail's link still work after the system killed the app while the user read the mail. Never the code
 * or the link. Secure storage because it is an email address; cleared on success, cancel and expiry.
 */
export const securePendingEmailStorage: PendingStorage = {
  async load() {
    await secureStoreReady();
    const raw = await SecureStore.getItemAsync(EMAIL_PENDING_KEY, OPTIONS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  },
  save: (pending) => SecureStore.setItemAsync(EMAIL_PENDING_KEY, JSON.stringify(pending), OPTIONS),
  clear: () => SecureStore.deleteItemAsync(EMAIL_PENDING_KEY, OPTIONS),
};
