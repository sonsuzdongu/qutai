import * as SecureStore from 'expo-secure-store';
import { secureStoreReady } from '../storage/secureStoreGate';
import { createConsentStore } from './consentLogic';

/**
 * The own-key consent store on this phone (AI-32). Kept in secure storage "this device only": never in Qutai's backup
 * file or server backup, and on iOS not carried to another phone by a device backup; on Android the Keystore key that
 * protects it is not backed up either. So after any restore the screen is shown again before the first request.
 */
const KEY = 'ai_consent_accepted';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const aiConsent = createConsentStore({
  read: () => secureStoreReady().then(() => SecureStore.getItemAsync(KEY, OPTIONS)),
  write: (value) => SecureStore.setItemAsync(KEY, value, OPTIONS),
});
