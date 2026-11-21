/**
 * Buying Qutai Credits (pro mode only): the store behind a small interface, so the screen and its rules don't depend on
 * one payments SDK. Implementations: `revenuecat.ts` (RevenueCat's react-native-purchases, given the SDK object),
 * `unavailable.ts` (builds without a store: packs and balance still show, buying says it isn't available) and the
 * temporary `fake.ts`.
 * Pure types, no React Native imports: the flow is tested in Node (scripts/credits-tests/purchases.test.ts).
 */

/** The store the app is installed from, as Qutai's server names it (`POST /purchases/verify`, `GET /config` packs). */
export type StoreName = 'apple' | 'google';


/** A product as the store sells it to this user: the price is the store's, in the user's currency, never ours. */
export interface StoreProduct {
  /** The store product id (the same id a pack in `GET /config` carries). */
  productId: string;
  /** The store's formatted price ("₺49,99", "$1.99"). */
  price: string;
}

/** What a purchase in the store ended with (before Qutai's server has seen it). */
export type StoreOutcome =
  /** Paid. `transactionId` null: the store gave none to report; the server's webhook credits it anyway. */
  | { kind: 'purchased'; productId: string; transactionId: string | null }
  | { kind: 'cancelled' }
  /** Waiting for something outside the app (Ask to Buy, a cash or bank payment): the store finishes it later. */
  | { kind: 'pending' }
  /**
   * The store says this account already owns the product: an earlier purchase of the same pack isn't finished (not yet
   * consumed on Google Play). The SDK finishes it by itself; its credits come through `recent` or the server's webhook.
   */
  | { kind: 'alreadyOwned' }
  | { kind: 'failed'; reason: StoreFailure };

/** `billingUnavailable`: the device can't pay through its store at all (no Play Store, no Google account, billing off). */
export type StoreFailure = 'storeProblem' | 'notAllowed' | 'billingUnavailable' | 'network' | 'productUnavailable' | 'unknown';

/** A finished store purchase as the store's SDK remembers it for this customer (to report one whose answer was lost). */
export interface StoreTransaction {
  transactionId: string;
  productId: string;
  /** When it was bought (ms), or null when the SDK didn't say. */
  at: number | null;
}

/** Why purchases can't be made at all on this build or phone. */
export type StoreUnavailable = 'notInBuild' | 'notConfigured' | 'notSupported';

export interface PurchaseStore {
  /** `null` when purchases work; otherwise why not (the screen says so and offers no Buy buttons). */
  readonly unavailable: StoreUnavailable | null;
  /**
   * Ties the store's customer to Qutai's account id before anything is bought, so the server can match the
   * purchase to the account (RevenueCat: the App User ID). `null` on sign-out.
   */
  identify(userId: string | null): Promise<void>;
  /** The products the store sells among these ids, with their prices. Products it doesn't know are left out. */
  products(productIds: string[]): Promise<StoreProduct[]>;
  /** Buys one product (consumable). Never throws: every ending is an outcome. */
  purchase(productId: string): Promise<StoreOutcome>;
  /** Whether this device can pay through its store at all. Absent: assumed yes. */
  canPay?(): Promise<boolean>;
  /**
   * The signed-in customer's recent one-time purchases as the store's SDK knows them (newest first), so a purchase whose
   * report never reached Qutai's server (the app was killed, the answer was lost, the store gave no id) can be reported
   * again. Absent for stores that can't say. Never throws: an empty list when it can't be read.
   */
  recent?(): Promise<StoreTransaction[]>;
}

/** `POST /purchases/verify` (backend/packages/shared/src/purchases.ts). */
export interface VerifyPurchaseRequest {
  store: StoreName;
  transactionId: string;
}

export type PurchaseStatus = 'credited' | 'refunded' | 'revoked' | 'held';

export interface VerifyPurchaseResponse {
  store: StoreName;
  transactionId: string;
  productId: string;
  status: PurchaseStatus;
  /** Micro-credits this purchase added (0 unless credited). */
  credits: number;
  /** The balance afterwards, when the server reached the ledger; null otherwise. */
  balance: number | null;
  replayed: boolean;
}

/** The server's answer to a verification, as the flow needs it. */
export type VerifyAnswer =
  | { ok: true; response: VerifyPurchaseResponse }
  | { ok: false; status: number; code: string; retryAfter?: number };
