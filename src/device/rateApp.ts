import * as StoreReview from 'expo-store-review';
import { Linking } from 'react-native';

/**
 * "Rate Qutai": the system's in-app rating sheet where available, otherwise the store page.
 * Resolves false when neither exists yet (before the app is published there is no store page).
 */
export async function rateApp(): Promise<boolean> {
  if (await StoreReview.isAvailableAsync()) {
    await StoreReview.requestReview();
    return true;
  }
  const url = StoreReview.storeUrl();
  if (!url) return false;
  await Linking.openURL(url);
  return true;
}
