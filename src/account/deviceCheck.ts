import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { accountsEnabled, features } from '../config/features';
import { secureStoreReady } from '../storage/secureStoreGate';
import { createApi } from './api';
import { createDeviceProof, type DeviceProof, type IntegrityModule } from './deviceProof';
import { serverFlags } from './serverFlags';

/**
 * The app's device verification (src/account/deviceProof.ts) wired to React Native: pro builds only. The native module
 * `@expo/app-integrity` is linked only into pro builds (plugins/proBuild.js PRO_ONLY_PACKAGES); the open-source build
 * gets an empty module from Metro and never calls this (no account, no server).
 */

const KEY_ID = 'device_app_attest_key';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

let instance: DeviceProof | null = null;

function nativeModule(): IntegrityModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@expo/app-integrity') as Partial<IntegrityModule> | undefined;
    return m && typeof m.generateAssertionAsync === 'function' ? (m as IntegrityModule) : null;
  } catch {
    return null;
  }
}

/** The device proof for requests to Qutai's server, or null outside pro builds. */
export function deviceProof(): DeviceProof | null {
  if (!accountsEnabled || !features.apiUrl) return null;
  if (!instance) {
    const baseUrl = features.apiUrl;
    const api = createApi(baseUrl);
    instance = createDeviceProof({
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other',
      module: nativeModule,
      config: async () => (await serverFlags(baseUrl)).deviceCheck,
      post: (path, body) => api.request({ method: 'POST', path, body }),
      keys: {
        async get() {
          try {
            await secureStoreReady();
            return await SecureStore.getItemAsync(KEY_ID, OPTIONS);
          } catch {
            return null;
          }
        },
        async set(keyId) {
          try {
            await secureStoreReady();
            if (keyId) await SecureStore.setItemAsync(KEY_ID, keyId, OPTIONS);
            else await SecureStore.deleteItemAsync(KEY_ID, OPTIONS);
          } catch {
            // Not kept: a new key is made and attested next time.
          }
        },
      },
    });
  }
  return instance;
}
