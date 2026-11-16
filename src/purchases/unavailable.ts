import type { PurchaseStore, StoreUnavailable } from './types';

/**
 * UNAVAILABLE STORE: used when the build has no store to buy from. Today that is every build, because the RevenueCat
 * SDK (react-native-purchases) isn't added yet (README.md › Qutai Credits › Buying credits lists the steps). It is
 * also what a build without RevenueCat keys, or a platform without a store, gets later.
 *
 * Nothing here touches a store or the network: the screen shows the packs and the balance, says purchases aren't
 * available in this build, and shows no Buy button.
 */
export function createUnavailableStore(reason: StoreUnavailable): PurchaseStore {
  return {
    unavailable: reason,
    identify: async () => {},
    products: async () => [],
    purchase: async () => ({ kind: 'failed', reason: 'storeProblem' }),
  };
}
