import { Linking, Platform } from 'react-native';

/**
 * Opens the system screen where the user picks their default browser.
 * Android: Settings › Apps › Default apps (Qutai is listed because it handles http/https links,
 * see app.json; Expo Go itself is not). iOS: Qutai's page in Settings, where "Default Browser App"
 * appears once the app has Apple's browser entitlement.
 */
export async function openDefaultBrowserSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.MANAGE_DEFAULT_APPS_SETTINGS');
      return;
    } catch {
      // Some Android skins don't expose that screen; fall back to the app's settings.
    }
  }
  await Linking.openSettings();
}

/** A link the system handed to Qutai (as the default browser) that should open in a tab. */
export function isIncomingWebLink(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
