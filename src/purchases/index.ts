import * as SecureStore from 'expo-secure-store';
import { secureStoreReady } from '../storage/secureStoreGate';
import { Platform } from 'react-native';
import { accountSession } from '../account';
import { creditsEnabled, features } from '../config/features';
import { creditsClient } from '../credits';
import { createPurchaseFlow, type PendingPurchase, type PurchaseFlow } from './flow';
import type { PurchaseStore, StoreName } from './types';
import { createUnavailableStore } from './unavailable';

/**
 * Buying Qutai Credits in the app (pro mode only). Which store this build has:
 *
 * - **Today: none.** RevenueCat's SDK (`react-native-purchases`) isn't a dependency yet, so every build uses the
 *   unavailable store (`unavailable.ts`): the screen shows packs and balance and says buying isn't available in this
 *   build. README.md › Qutai Credits › Buying credits lists the steps to switch it on; in short: add the package,
 *   then here, when `revenueCatKey()` gives a key, `createRevenueCatStore(Purchases, key)` (`revenuecat.ts`).
 * - The keys are RevenueCat's public SDK keys per platform, `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and
 *   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (.env.example); without one, the unavailable store stays.
 */

/** The store this phone buys from, as the server names it. */
export const storeName: StoreName = Platform.OS === 'ios' ? 'apple' : 'google';

/** RevenueCat's public SDK key for this platform, or null. */
export function revenueCatKey(): string | null {
  return Platform.OS === 'ios' ? features.revenueCatIosKey : Platform.OS === 'android' ? features.revenueCatAndroidKey : null;
}

let store: PurchaseStore | null = null;

export function purchaseStore(): PurchaseStore {
  if (!store) {
    // No SDK in this build (see above); a key alone doesn't make a store.
    store = createUnavailableStore(!creditsEnabled || (Platform.OS !== 'ios' && Platform.OS !== 'android') ? 'notSupported' : 'notInBuild');
  }
  return store;
}

const PENDING_KEY = 'credits_pending_purchases';

const pendingStorage = {
  async load(): Promise<PendingPurchase[]> {
    await secureStoreReady();
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? (list as PendingPurchase[]) : [];
  },
  async save(list: PendingPurchase[]) {
    if (list.length) await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(list));
    else await SecureStore.deleteItemAsync(PENDING_KEY);
  },
};

let flow: PurchaseFlow | null = null;

/** The purchase flow, or null without credits in this build. */
export function purchaseFlow(): PurchaseFlow | null {
  if (!creditsEnabled) return null;
  if (!flow) {
    flow = createPurchaseFlow({
      store: purchaseStore(),
      storeName,
      verify: async (request) => {
        const client = creditsClient();
        if (!client) return { ok: false, status: 401, code: 'not_signed_in' };
        return client.verifyPurchase(request);
      },
      pending: pendingStorage,
    });
    // The store's customer follows the account: Qutai's id while signed in, never anonymous purchases.
    const session = accountSession();
    const follow = () => {
      const state = session?.getState();
      void purchaseStore().identify(state?.status === 'signedIn' ? state.user.id : null);
    };
    session?.subscribe(follow);
    follow();
  }
  return flow;
}

/** At app start and when the account changes: reports purchases the server hasn't credited yet (quietly). */
export async function reportPendingPurchases(): Promise<void> {
  const state = accountSession()?.getState();
  const f = purchaseFlow();
  if (!f || state?.status !== 'signedIn') return;
  await f.retryPending(state.user.id).catch(() => {});
}
