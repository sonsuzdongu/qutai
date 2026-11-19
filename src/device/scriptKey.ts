import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { secureStoreReady } from '../storage/secureStoreGate';

/**
 * This install's key for kept scripts' approval seals (content/userScripts.ts scriptSeal; docs/page-customisation.md ›
 * Kept scripts). Kept in secure storage only: never in a backup, so a backup or a rules file can't claim that a
 * script was approved, and a restore on another phone (or after a reinstall) asks again.
 */
const KEY = 'qutai.scriptSealKey';

let cached: Uint8Array | null = null;
let loading: Promise<Uint8Array | null> | null = null;

/** The key, made on first use; null when secure storage can't be used (scripts then never count as approved). */
export function loadScriptKey(): Promise<Uint8Array | null> {
  loading ??= (async () => {
    try {
      await secureStoreReady();
      const stored = await SecureStore.getItemAsync(KEY);
      if (stored && /^[0-9a-f]{64}$/.test(stored)) {
        cached = hexToBytes(stored);
        return cached;
      }
      const fresh = getRandomBytes(32);
      await SecureStore.setItemAsync(KEY, bytesToHex(fresh), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
      cached = fresh;
      return cached;
    } catch {
      loading = null;
      return null;
    }
  })();
  return loading;
}

/** The key once loaded (null before, or when it can't be used). */
export function scriptKey(): Uint8Array | null {
  return cached;
}
