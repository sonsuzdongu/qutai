import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';
import { matchLanguage, setLanguageOverride, type Language } from './index';

/**
 * Settings › Language: which language Qutai's interface is in, and where that choice lives.
 *
 * - Android 13+ ('system'): the system's per-app language. Picking one in Qutai hands it to the system (the same
 *   setting as Settings › Apps › Qutai › Language), so the system screen, the launcher shortcuts and the widget follow,
 *   and a change made in the system screen shows here. The interface switches at once; the activity is not restarted
 *   (it handles locale changes itself), so tabs and open conversations stay.
 * - Android before 13 ('app'): there is no per-app language in the system. The choice is kept by the native module and
 *   applied to the interface, the launcher shortcuts and the widget; the notifications follow the interface. The
 *   system's own screens (permission requests, the app's name) stay in the phone's language, as for every app there.
 * - iOS ('settings'): the per-app language lives in the Settings app (Settings › Qutai › Language), which also
 *   translates the system's permission requests and the Home Screen quick actions, and restarts Qutai when changed.
 *   Switching only the JavaScript interface from inside the app would leave those in the other language until the next
 *   launch, so Qutai opens that page instead of keeping a choice of its own.
 */
export type LanguageChoiceMode = 'system' | 'app' | 'settings' | 'none';

type NativeEntry = {
  getAppLanguage?(): string;
  setAppLanguage?(tag: string): boolean;
  hasSystemAppLanguage?(): boolean;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeEntry>('QutaiEntry') : null;

export function languageChoiceMode(): LanguageChoiceMode {
  if (Platform.OS === 'ios') return 'settings';
  if (!native?.setAppLanguage || !native.getAppLanguage) return 'none';
  return native.hasSystemAppLanguage?.() ? 'system' : 'app';
}

/** The language picked for Qutai, or null for "System default". */
export function chosenLanguage(): Language | null {
  const mode = languageChoiceMode();
  if (mode === 'system' || mode === 'app') return matchLanguage(native?.getAppLanguage?.() ?? '');
  return null;
}

/**
 * Applies the stored choice before the first render (Android before 13; on Android 13+ the system already starts the
 * app in its per-app language, which expo-localization reports).
 */
export function initAppLanguage() {
  if (languageChoiceMode() !== 'app') return;
  try {
    const chosen = chosenLanguage();
    if (chosen) setLanguageOverride(chosen);
  } catch {
    // A build without the function: the phone's language.
  }
}

/** Picks Qutai's language (null = the system's) and switches the interface to it straight away. */
export function chooseLanguage(language: Language | null): boolean {
  const mode = languageChoiceMode();
  if (mode !== 'system' && mode !== 'app') return false;
  if (!native?.setAppLanguage?.(language ?? '')) return false;
  if (mode === 'app') setLanguageOverride(language);
  // Android 13+: the interface switches now; the system's per-app language reaches expo-localization a moment later
  // and takes over (useLanguage). Back to the system default: the override clears and the system's language shows
  // once the configuration change arrives.
  else setLanguageOverride(language, { bridge: true });
  return true;
}

/** iOS: Qutai's page in the Settings app, where its Language row is. */
export function openLanguageSettings(): Promise<void> {
  return Linking.openSettings();
}
