import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform, Settings as IosUserDefaults, TurboModuleRegistry, type TurboModule } from 'react-native';
import { getLanguage, matchLanguage, setLanguageOverride, type Language } from './index';

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

/**
 * Setup's first step: the language list, preselected to the language Qutai is already in (the phone's, or a per-app
 * language set before the first launch). Each pick switches the interface at once and is stored in the same place as
 * Settings › Language, so there is one setting:
 * - Android: chooseLanguage (the system's per-app language on 13+, Qutai's stored choice before). Going back to the
 *   language the step opened with restores what was there (usually "System default", so Qutai keeps following the
 *   phone).
 * - iOS: the app's own `AppleLanguages` user default, which is exactly what Settings › Qutai › Language writes. iOS reads
 *   it at the next launch (the system's permission requests and quick actions follow from then on); the interface
 *   switches now through the in-memory override. Going back to the opening language removes the value again.
 * Returns false where no choice can be kept (an Android build without the native function): the step is left out.
 */
export function setupLanguageAvailable(): boolean {
  return languageChoiceMode() !== 'none';
}

export type SetupLanguageStart = { shown: Language; chosen: Language | null };

/** What the step opened with, captured once so a pick can be undone exactly. */
export function setupLanguageStart(): SetupLanguageStart {
  return { shown: getLanguage(), chosen: chosenLanguage() };
}

let iosWrote = false;

/**
 * React Native's own NSUserDefaults module (the one `Settings` wraps). `Settings.set` can't remove a key (a null is
 * dropped on the way to native), so removal uses the module's `deleteValues`.
 */
type IosSettingsManager = TurboModule & { deleteValues(keys: string[]): void };
const iosSettingsManager = Platform.OS === 'ios' ? TurboModuleRegistry.get<IosSettingsManager>('SettingsManager') : null;

export function chooseSetupLanguage(language: Language, start: SetupLanguageStart): void {
  const mode = languageChoiceMode();
  const back = language === start.shown;
  if (mode === 'settings') {
    try {
      if (!back) {
        IosUserDefaults.set({ AppleLanguages: [language] });
        iosWrote = true;
      } else if (iosWrote) {
        // Removing the app's own value: back to the system's language list ("System default").
        iosSettingsManager?.deleteValues(['AppleLanguages']);
        iosWrote = false;
      }
    } catch {
      // Not stored: the interface still switches for this run.
    }
    // Held in memory for this run (iOS applies the stored value from the next launch, or after its own restart).
    setLanguageOverride(language);
    return;
  }
  if (mode === 'system' || mode === 'app') {
    const target = back ? start.chosen : language;
    if (target === chosenLanguage() && getLanguage() === language) return;
    if (!chooseLanguage(target)) setLanguageOverride(language);
    // Back to "System default" on Android 13+: the system's language arrives with the configuration change; show the
    // picked one meanwhile so the step doesn't flicker.
    else if (target === null) setLanguageOverride(language, { bridge: true });
  }
}

/** iOS: Qutai's page in the Settings app, where its Language row is. */
export function openLanguageSettings(): Promise<void> {
  return Linking.openSettings();
}
