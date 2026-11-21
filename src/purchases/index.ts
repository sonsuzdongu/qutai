import * as SecureStore from 'expo-secure-store';
import { secureStoreReady } from '../storage/secureStoreGate';
import { NativeModules, Platform } from 'react-native';
import { accountSession } from '../account';
import { creditsEnabled, features } from '../config/features';
import { creditsClient, creditsStore } from '../credits';
import { createPurchaseFlow, type PendingPurchase, type PurchaseFlow } from './flow';
import { createRevenueCatStore, type RevenueCatSdk } from './revenuecat';
import type { PurchaseStore, StoreName } from './types';
import { createUnavailableStore } from './unavailable';

/**
 * Buying Qutai Credits in the app (pro mode only). Which store is used, asked at every purchase:
 *
 * - **RevenueCat** (`revenuecat.ts`, `react-native-purchases`): a pro build with RevenueCat's public SDK key for this
 *   platform (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`; scripts/build/release.mjs reads the
 *   Android one from .build.local.env), the SDK's native module linked into the build, and signed in to Qutai's
 *   server. Android first (20 Nov 2026); iOS takes the same path once its key and
 *   App Store products exist.
 * - **Unavailable** (`unavailable.ts`) otherwise: no key, no native module (the open-source build never links it:
 *   react-native.config.js and metro.config.js leave the SDK out without pro mode), or a platform without a store. The
 *   screen shows packs and balance and says buying isn't available in this build.
 *
 * The temporary fake store (purchases without any store on a local development server) was removed on 21 Nov 2026
 * (docs/design/35-purchases.md › BUY-21).
 */

/** The store this phone buys from, as the server names it. */
export const storeName: StoreName = Platform.OS === 'ios' ? 'apple' : 'google';

/** RevenueCat's public SDK key for this platform, or null. */
export function revenueCatKey(): string | null {
  return Platform.OS === 'ios' ? features.revenueCatIosKey : Platform.OS === 'android' ? features.revenueCatAndroidKey : null;
}

let unavailableStore: PurchaseStore | null = null;
/** RevenueCat's store, made once the first time it may be used; kept so sign-out reaches it whatever the mode. */
let revenueCatStore: PurchaseStore | null = null;

/**
 * RevenueCat's SDK, or null when this build can't use it. Required here, not imported: the open-source build resolves
 * the package to an empty module (metro.config.js) and never links its native code (react-native.config.js), and Expo
 * Go has no native module (the SDK would fall back to its "preview" mock, which must never sell anything).
 */
function revenueCatSdk(): RevenueCatSdk | null {
  if (!creditsEnabled || !NativeModules.RNPurchases) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = (require('react-native-purchases') as { default?: unknown }).default as RevenueCatSdk | undefined;
    return sdk && typeof sdk.configure === 'function' ? sdk : null;
  } catch {
    return null;
  }
}

/** RevenueCat's store when this build has the SDK and a key for this platform; null otherwise. */
function revenueCat(): PurchaseStore | null {
  if (revenueCatStore) return revenueCatStore;
  const key = revenueCatKey();
  const sdk = key ? revenueCatSdk() : null;
  if (!key || !sdk) return null;
  revenueCatStore = createRevenueCatStore(sdk, key);
  return revenueCatStore;
}

/** The store to buy from now (see above): RevenueCat when this build can use it, else the unavailable store. */
export function purchaseStore(): PurchaseStore {
  const real = creditsEnabled ? revenueCat() : null;
  if (real) return real;
  unavailableStore ??= createUnavailableStore(
    !creditsEnabled || (Platform.OS !== 'ios' && Platform.OS !== 'android') ? 'notSupported' : 'notInBuild',
  );
  return unavailableStore;
}

const PENDING_KEY = 'credits_pending_purchases';
const SETTLED_KEY = 'credits_settled_purchases';
/** Set once this phone has used the store for credits (the buy screen loaded prices): from then on, every start looks. */
const STORE_USED_KEY = 'credits_store_used';

/** Called by the buy screen when it asks the store for prices: later app starts may look for unreported purchases. */
export function noteStoreUsed(): void {
  void secureStoreReady()
    .then(() => SecureStore.setItemAsync(STORE_USED_KEY, '1'))
    .catch(() => {});
}

async function storeUsed(): Promise<boolean> {
  await secureStoreReady();
  return (await SecureStore.getItemAsync(STORE_USED_KEY)) === '1';
}

const pendingStorage = {
  async load(): Promise<PendingPurchase[]> {
    await secureStoreReady();
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    // Only real stores' purchases: a leftover from the removed fake store (a development phone) is dropped.
    return Array.isArray(list) ? (list as PendingPurchase[]).filter((p) => p?.store === 'apple' || p?.store === 'google') : [];
  },
  async save(list: PendingPurchase[]) {
    if (list.length) await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(list));
    else await SecureStore.deleteItemAsync(PENDING_KEY);
  },
};

/** Store transactions Qutai's server has answered for good (ids only), so they aren't reported again. */
const settledStorage = {
  async load(): Promise<string[]> {
    await secureStoreReady();
    const raw = await SecureStore.getItemAsync(SETTLED_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  },
  async save(list: string[]) {
    if (list.length) await SecureStore.setItemAsync(SETTLED_KEY, JSON.stringify(list));
    else await SecureStore.deleteItemAsync(SETTLED_KEY);
  },
};

let flow: PurchaseFlow | null = null;

/** The purchase flow, or null without credits in this build. */
export function purchaseFlow(): PurchaseFlow | null {
  if (!creditsEnabled) return null;
  if (!flow) {
    flow = createPurchaseFlow({
      // Asked at every purchase: the server's mode (fake or the stores) can change while the app runs.
      store: purchaseStore,
      storeName,
      verify: async (request) => {
        const client = creditsClient();
        if (!client) return { ok: false, status: 401, code: 'not_signed_in' };
        return client.verifyPurchase(request);
      },
      pending: pendingStorage,
      settled: settledStorage,
    });
    // The store's customer follows the account: Qutai's id while signed in, never anonymous purchases. RevenueCat is
    // configured at the first purchase screen or purchase after sign-in (not at app start), and told about every
    // later account change, sign-out included, whatever the server's mode is then.
    const session = accountSession();
    const follow = () => {
      const state = session?.getState();
      const id = state?.status === 'signedIn' ? state.user.id : null;
      if (revenueCatStore) void revenueCatStore.identify(id);
    };
    session?.subscribe(follow);
    follow();
  }
  return flow;
}

/**
 * At app start and when the account changes: reports purchases the server hasn't credited yet (quietly). The store is
 * asked for unreported purchases (which sets RevenueCat up and lets it finish a Google Play purchase whose payment
 * completed meanwhile, within Play's three days) only on a phone that has used the buy screen; otherwise only the kept
 * list is reported and RevenueCat isn't contacted at start.
 */
export async function reportPendingPurchases(): Promise<void> {
  const state = accountSession()?.getState();
  const f = purchaseFlow();
  if (!f || state?.status !== 'signedIn') return;
  const lookInStore = await storeUsed().catch(() => false);
  await f.retryPending(state.user.id, { lookInStore }).catch(() => {});
}
