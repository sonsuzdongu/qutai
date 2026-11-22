import { Linking, Platform } from 'react-native';

/** Qutai's numeric Apple ID in App Store Connect (App Information › Apple ID). */
const APP_STORE_ID = '6835885082';
/** The Android package name (app.json android.package). */
const PLAY_PACKAGE = 'com.sonsuzdongu.qutai';

/** The store page where a review is written: the App Store's review form, Google Play's app page. */
export function reviewUrls(os: string = Platform.OS): string[] {
  if (os === 'ios') return [`https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`];
  if (os === 'android') {
    return [`market://details?id=${PLAY_PACKAGE}`, `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`];
  }
  return [];
}

/**
 * "Rate Qutai" opens the store's review page directly, not the system's in-app rating sheet: the sheet is for prompts
 * the app shows on its own, and iOS and Google Play silently skip it once their quota is used (and always in
 * TestFlight), so a button the user taps on purpose would do nothing. Resolves false when no store page opens.
 */
export async function rateApp(): Promise<boolean> {
  for (const url of reviewUrls()) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // market:// fails without the Play Store app: try the web page next.
    }
  }
  return false;
}
