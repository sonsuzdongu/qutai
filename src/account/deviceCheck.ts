import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { accountsEnabled, features } from '../config/features';
import { secureStoreReady } from '../storage/secureStoreGate';
import { createApi } from './api';
import { createDeviceProof, type DeviceCheckConfig, type DeviceProof, type IntegrityModule } from './deviceProof';

/**
 * The app's device verification (src/account/deviceProof.ts) wired to React Native: pro builds only. The native module
 * `@expo/app-integrity` is linked only into pro builds (plugins/proBuild.js PRO_ONLY_PACKAGES); the open-source build
 * gets an empty module from Metro and never calls this (no account, no server).
 */

const KEY_ID = 'device_app_attest_key';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
/** `/config` is read at most this often for the device check (the server lets it be cached a minute). */
const CONFIG_TTL_MS = 10 * 60_000;

let instance: DeviceProof | null = null;
let config: { value: DeviceCheckConfig | null; at: number } | null = null;

function nativeModule(): IntegrityModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@expo/app-integrity') as Partial<IntegrityModule> | undefined;
    return m && typeof m.generateAssertionAsync === 'function' ? (m as IntegrityModule) : null;
  } catch {
    return null;
  }
}

async function readConfig(baseUrl: string): Promise<DeviceCheckConfig | null> {
  if (config && Date.now() - config.at < CONFIG_TTL_MS) return config.value;
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/config`, { headers: { Accept: 'application/json' } });
    const body = (await res.json()) as { deviceCheck?: Partial<DeviceCheckConfig> };
    const d = body?.deviceCheck;
    const value: DeviceCheckConfig | null =
      d && (d.mode === 'log' || d.mode === 'enforce')
        ? { mode: d.mode, playCloudProjectNumber: typeof d.playCloudProjectNumber === 'string' && /^\d{1,20}$/.test(d.playCloudProjectNumber) ? d.playCloudProjectNumber : null, appAttest: d.appAttest === true }
        : null;
    config = { value, at: Date.now() };
    return value;
  } catch {
    // No answer: send nothing this time (the server counts it as missing, and refuses only in "enforce").
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
      config: () => readConfig(baseUrl),
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
