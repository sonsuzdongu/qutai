import type { PurchaseStore, StoreFailure, StoreOutcome, StoreProduct } from './types';

/**
 * The store through RevenueCat's `react-native-purchases` (checked against 11.0.2's typings, Nov 2026). The SDK is
 * passed in rather than imported, for two reasons: the package isn't a dependency yet (README.md › Qutai Credits ›
 * Buying credits says what adding it takes), and the tests run this file in Node with a fake SDK.
 *
 * - Configured once with the platform's public SDK key and **Qutai's account id as the App User ID**, and only while
 *   signed in, so a purchase is never made under an anonymous `$RCAnonymousID:` id the server can't match. Another
 *   account signing in switches with `logIn`; signing out switches to an anonymous id with `logOut`, and no purchase
 *   is offered then.
 * - Packs are consumables: fetched with the non-subscription category (Android needs it), bought with
 *   `purchaseStoreProduct`; RevenueCat finishes and consumes the store transaction itself.
 * - What the server is told is the purchase's `transaction.transactionIdentifier` (Apple's transaction id; on Android
 *   it must be the Play order id `GPA.…` the server searches for: to be checked with the first sandbox purchase).
 */

/** The parts of `react-native-purchases`' default export used here. */
export interface RevenueCatSdk {
  configure(config: { apiKey: string; appUserID?: string | null }): void;
  isConfigured(): Promise<boolean>;
  logIn(appUserID: string): Promise<unknown>;
  logOut(): Promise<unknown>;
  getProducts(productIdentifiers: string[], type?: string): Promise<{ identifier: string; priceString: string }[]>;
  purchaseStoreProduct(product: { identifier: string; priceString: string }): Promise<{
    productIdentifier: string;
    transaction?: { transactionIdentifier: string; productIdentifier: string } | null;
  }>;
  /** `Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION` ("NON_SUBSCRIPTION"). */
  readonly PRODUCT_CATEGORY: { NON_SUBSCRIPTION: string };
  /** `Purchases.PURCHASES_ERROR_CODE`: string codes ("1" cancelled, "20" payment pending…). */
  readonly PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: string;
    STORE_PROBLEM_ERROR: string;
    PURCHASE_NOT_ALLOWED_ERROR: string;
    PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: string;
    NETWORK_ERROR: string;
    OFFLINE_CONNECTION_ERROR: string;
    PAYMENT_PENDING_ERROR: string;
  };
}

export function createRevenueCatStore(sdk: RevenueCatSdk, apiKey: string): PurchaseStore {
  /** The account the SDK is set up for; null: not configured yet, or switched to anonymous on sign-out. */
  let current: string | null = null;
  let configured = false;
  /** Products fetched from the store, kept so a purchase uses the object the SDK gave. */
  const known = new Map<string, { identifier: string; priceString: string }>();
  let identifying: Promise<void> = Promise.resolve();

  async function setUser(userId: string | null) {
    if (userId === current) return;
    if (!configured) {
      // Not configured before sign-in: never an anonymous customer.
      if (!userId) return;
      sdk.configure({ apiKey, appUserID: userId });
      configured = true;
    } else if (userId) {
      await sdk.logIn(userId);
    } else {
      await sdk.logOut().catch(() => {});
    }
    current = userId;
    known.clear();
  }

  const codes = sdk.PURCHASES_ERROR_CODE;
  function outcomeOf(e: unknown): StoreOutcome {
    const error = (e ?? {}) as { code?: unknown; userCancelled?: unknown };
    if (error.userCancelled === true || error.code === codes.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
    if (error.code === codes.PAYMENT_PENDING_ERROR) return { kind: 'pending' };
    const reason: StoreFailure =
      error.code === codes.PURCHASE_NOT_ALLOWED_ERROR
        ? 'notAllowed'
        : error.code === codes.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
          ? 'productUnavailable'
          : error.code === codes.NETWORK_ERROR || error.code === codes.OFFLINE_CONNECTION_ERROR
            ? 'network'
            : error.code === codes.STORE_PROBLEM_ERROR
              ? 'storeProblem'
              : 'unknown';
    return { kind: 'failed', reason };
  }

  return {
    unavailable: null,
    identify(userId) {
      identifying = identifying.then(() => setUser(userId)).catch(() => {});
      return identifying;
    },
    async products(productIds): Promise<StoreProduct[]> {
      await identifying;
      if (!current || productIds.length === 0) return [];
      const products = await sdk.getProducts(productIds, sdk.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
      const wanted = new Set(productIds);
      return products
        .filter((p) => wanted.has(p.identifier))
        .map((p) => {
          known.set(p.identifier, p);
          return { productId: p.identifier, price: p.priceString };
        });
    },
    async purchase(productId): Promise<StoreOutcome> {
      await identifying;
      if (!current) return { kind: 'failed', reason: 'notAllowed' };
      let product = known.get(productId);
      try {
        if (!product) {
          product = (await sdk.getProducts([productId], sdk.PRODUCT_CATEGORY.NON_SUBSCRIPTION)).find(
            (p) => p.identifier === productId,
          );
          if (!product) return { kind: 'failed', reason: 'productUnavailable' };
        }
        const result = await sdk.purchaseStoreProduct(product);
        // Paid even without a transaction id to report: the server's webhook credits it then.
        const transactionId = result.transaction?.transactionIdentifier || null;
        return { kind: 'purchased', productId: result.productIdentifier || productId, transactionId };
      } catch (e) {
        return outcomeOf(e);
      }
    },
  };
}
