import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Android: incognito tabs get their own WebView profile (cookies, localStorage/IndexedDB, cache, service workers,
 * geolocation permissions), through the patched react-native-webview (webviewProfile prop, RNCWebViewProfiles.java).
 *
 * All incognito tabs open at the same time share one profile (one private session, like other browsers' incognito
 * windows). WebView can't delete a profile this run has used, so every session gets a new profile name: when the
 * last incognito tab closes the profile is emptied (natively, once its last WebView is destroyed), and leftover
 * incognito profiles are deleted at the next start, before any is used. Data of one session is never visible to the next.
 *
 * iOS gives each incognito tab its own non-persistent data store instead (the WebView's incognito prop).
 */
interface ProfileModule extends TurboModule {
  isMultiProfileSupported(): boolean;
  endProfile(name: string): void;
  deleteUnusedProfiles(prefix: string): void;
}

const PREFIX = 'qutai-incognito-';

const native: ProfileModule | null = (() => {
  if (Platform.OS !== 'android') return null;
  const module = TurboModuleRegistry.get<ProfileModule>('RNCWebViewModule');
  // Without the patch the methods are missing: behave as on a WebView without profiles.
  return module && typeof module.isMultiProfileSupported === 'function' ? module : null;
})();

let supported: boolean | null = null;

/** Android: this device's WebView supports profiles, so incognito tabs are isolated from normal tabs. */
export function incognitoProfilesSupported(): boolean {
  if (supported === null) {
    try {
      supported = native?.isMultiProfileSupported() ?? false;
    } catch {
      supported = false;
    }
  }
  return supported;
}

/**
 * Whether incognito tabs keep their cookies and site data apart from normal tabs on this device: always on iOS,
 * on Android only when the system WebView supports profiles.
 */
export function incognitoIsolated(): boolean {
  return Platform.OS === 'ios' || incognitoProfilesSupported();
}

/** A new profile name for an incognito session, or undefined where profiles aren't used (iOS, old WebView). */
export function newIncognitoProfile(): string | undefined {
  if (!incognitoProfilesSupported()) return undefined;
  return `${PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The incognito session using this profile is over; its data goes once its last WebView is destroyed. */
export function endIncognitoProfile(name: string) {
  try {
    native?.endProfile(name);
  } catch {
    // Deleted at the next start anyway.
  }
}

/**
 * At start: deletes incognito profiles left from an earlier run (e.g. the app was killed with incognito tabs open;
 * incognito tabs are never restored). Profiles already used in this run are skipped natively.
 */
export function deleteLeftoverIncognitoProfiles() {
  if (!incognitoProfilesSupported()) return;
  try {
    native?.deleteUnusedProfiles(PREFIX);
  } catch {
    // Tried again at the next start.
  }
}

/** The sentence saying how incognito tabs keep their cookies and site data on this device. */
export function incognitoInfoKey(): 'tabs.incognitoInfoIos' | 'tabs.incognitoInfoAndroid' | 'tabs.incognitoInfoAndroidShared' {
  if (Platform.OS === 'ios') return 'tabs.incognitoInfoIos';
  return incognitoProfilesSupported() ? 'tabs.incognitoInfoAndroid' : 'tabs.incognitoInfoAndroidShared';
}
