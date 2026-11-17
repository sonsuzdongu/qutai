import type { PurchaseStore } from './types';

/**
 * FAKE STORE: a TEMPORARY STAND-IN until RevenueCat and the store products exist (TODO.md › Before launch: remove fake
 * purchases). Used only while Qutai's server says it runs in fake mode (`GET /config` › `purchases.mode` = `fake`,
 * which the server allows only on a local development server and refuses in production). Remove this file and its use
 * in `index.ts` once real purchases work.
 *
 * Nothing here touches a store or charges anyone: "buying" makes a transaction id (`fake-` + a random id) that the
 * flow then reports to `POST /purchases/fake` as store `fake`, through the same pending-purchase queue as a real
 * purchase, so a lost answer is reported again with the same id and credited once. There are no store prices: the
 * screen shows a test-mode notice instead.
 */
export function createFakeStore(newId: () => string): PurchaseStore {
  return {
    unavailable: null,
    fake: true,
    identify: async () => {},
    products: async () => [],
    purchase: async (productId) => ({ kind: 'purchased', productId, transactionId: `fake-${newId()}` }),
  };
}

/** A transaction id body the server accepts (`fake-` + 8–100 of A-Za-z0-9_-) from any random text. */
export function fakeTransactionId(random: string): string {
  const clean = random.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
  return clean.length >= 8 ? clean : `${clean}${Date.now().toString(36)}xxxxxxxx`.slice(0, 16);
}
