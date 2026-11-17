import type {
  PurchaseStore,
  ReportStore,
  StoreFailure,
  StoreName,
  StoreProduct,
  StoreUnavailable,
  VerifyAnswer,
  VerifyPurchaseRequest,
} from './types';

/** A pack from `GET /config` (credits in micro-credits). */
export interface Pack {
  store: StoreName;
  productId: string;
  credits: number;
}

/** A pack as the screen shows it: with the store's price, or none when the store can't be asked. */
export interface PackOffer {
  pack: Pack;
  /** The store's formatted price; null when purchases aren't available (no price is ever made up). */
  price: string | null;
}

/**
 * The packs to show: the server's packs for this phone's store, in the server's order. With a working store, only
 * those the store sells (a pack the store doesn't know can't be bought, and store products without a pack are never
 * shown: buying one would be held, not credited). Without a store, every pack without a price, so the user still
 * sees what credits come in.
 */
export function packOffers(packs: Pack[], store: StoreName, products: StoreProduct[] | null): PackOffer[] {
  const mine = packs.filter((p) => p.store === store);
  if (!products) return mine.map((pack) => ({ pack, price: null }));
  const prices = new Map(products.map((p) => [p.productId, p.price]));
  return mine.filter((p) => prices.has(p.productId)).map((pack) => ({ pack, price: prices.get(pack.productId)! }));
}

/** A paid purchase the server hasn't credited yet (kept on the phone and reported again later). */
export interface PendingPurchase {
  userId: string;
  /** `fake`: a FAKE purchase (the temporary stand-in, `fake.ts`), reported to `POST /purchases/fake`. */
  store: ReportStore;
  transactionId: string;
  productId: string;
  /** Store `fake` only: the store whose pack was bought. */
  packStore?: StoreName;
  at: number;
}

export interface PendingStorage {
  load(): Promise<PendingPurchase[]>;
  save(list: PendingPurchase[]): Promise<void>;
}

/** How a purchase (or a report of an earlier one) ended, for the screen. */
export type BuyResult =
  | { kind: 'credited'; credits: number; balance: number | null }
  | { kind: 'cancelled' }
  /** The store is waiting for something outside the app; credits come once it completes. */
  | { kind: 'pending' }
  | { kind: 'failed'; reason: StoreFailure }
  /** Paid, but the server couldn't confirm it yet; kept and reported again (and the webhook credits it anyway). */
  | { kind: 'notYetCredited' }
  /** Recorded but not credited (support resolves it), or refused as someone else's purchase. */
  | { kind: 'support'; reason: 'held' | 'rejected' }
  /** The store reversed the purchase (refunded or revoked). */
  | { kind: 'reversed' }
  | { kind: 'suspended' }
  | { kind: 'signedOut' }
  /** Fake purchases only: this account reached the server's daily allowance of test purchases. Nothing was charged. */
  | { kind: 'limit' }
  /** Fake purchases only: the server no longer takes them (switched off). Nothing was charged. */
  | { kind: 'testModeOff' }
  | { kind: 'unavailable'; reason: StoreUnavailable };

export interface PurchaseFlowDeps {
  /** The store, or how to get the current one (the FAKE store while the server is in fake mode, `index.ts`). */
  store: PurchaseStore | (() => PurchaseStore);
  storeName: StoreName;
  verify(request: VerifyPurchaseRequest): Promise<VerifyAnswer>;
  pending: PendingStorage;
  /** Waits before asking the server again. Tests pass a fast one. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Reports per purchase before it's left for later (default 3). */
  attempts?: number;
}

const DEFAULT_WAIT_S = 3;
const MAX_WAIT_S = 15;
/** Kept this long, then dropped: by then the webhook has credited it or support has to look. */
const PENDING_KEEP_MS = 30 * 24 * 3600_000;
const MAX_PENDING = 50;

/**
 * Buying a pack and telling Qutai's server about it (backend/DESIGN.md › Purchases › What the app-side purchase
 * screen must do and send): the store sells, the server checks the purchase with RevenueCat itself and adds the
 * credits once per store transaction. Pure code, so every ending is tested in Node against a fake store and server.
 *
 * - `404 purchase_not_found` and `503 unavailable` are asked again after `Retry-After` a few times; still nothing,
 *   and the purchase is kept on the phone and reported again later (`retryPending`: when the screen opens, on
 *   "Refresh", at app start). The server's webhook credits it anyway, so "not yet" never means lost.
 * - `held` and `422 purchase_rejected`: support helps, no retry. `403 account_suspended`: no purchases.
 * - A report is safe to repeat: the server credits a transaction once and answers the same again (`replayed`).
 */
export function createPurchaseFlow(deps: PurchaseFlowDeps) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const attempts = deps.attempts ?? 3;
  /** One change to the stored list at a time. */
  let queue: Promise<unknown> = Promise.resolve();
  const edit = (change: (list: PendingPurchase[]) => PendingPurchase[]) => {
    const run = queue.then(async () => {
      const list = await deps.pending.load().catch(() => [] as PendingPurchase[]);
      const next = change(list)
        .filter((p) => now() - p.at < PENDING_KEEP_MS)
        .slice(-MAX_PENDING);
      await deps.pending.save(next).catch(() => {});
      return next;
    });
    queue = run.catch(() => {});
    return run;
  };
  const current = () => (typeof deps.store === 'function' ? deps.store() : deps.store);
  const sameTx = (a: PendingPurchase, b: { store: ReportStore; transactionId: string }) =>
    a.store === b.store && a.transactionId === b.transactionId;

  /** Reports one purchase until a final answer, or `notYetCredited` after the allowed attempts. */
  async function report(p: Pick<PendingPurchase, 'store' | 'transactionId' | 'productId' | 'packStore'>): Promise<BuyResult> {
    const fake = p.store === 'fake';
    // The real stores' report stays exactly `{ store, transactionId }`; a fake one names its pack.
    const request: VerifyPurchaseRequest = fake
      ? { store: 'fake', transactionId: p.transactionId, productId: p.productId, packStore: p.packStore }
      : { store: p.store, transactionId: p.transactionId };
    for (let attempt = 1; ; attempt++) {
      let answer: VerifyAnswer;
      try {
        answer = await deps.verify(request);
      } catch {
        answer = { ok: false, status: 0, code: 'network' };
      }
      if (answer.ok) {
        const r = answer.response;
        if (r.status === 'credited') return { kind: 'credited', credits: r.credits, balance: r.balance };
        if (r.status === 'held') return { kind: 'support', reason: 'held' };
        return { kind: 'reversed' };
      }
      if (answer.status === 422 || answer.code === 'purchase_rejected') return { kind: 'support', reason: 'rejected' };
      if (answer.code === 'account_suspended') return { kind: 'suspended' };
      if (answer.status === 401 || answer.code === 'not_signed_in') return { kind: 'signedOut' };
      // Fake purchases: final answers, nothing was charged so nothing is kept.
      if (fake && answer.code === 'purchase_limit') return { kind: 'limit' };
      if (fake && (answer.status === 404 || answer.code === 'not_found')) return { kind: 'testModeOff' };
      // Not found yet, unavailable, the network: worth asking again shortly.
      if (attempt >= attempts) return { kind: 'notYetCredited' };
      await sleep(Math.min(MAX_WAIT_S, answer.retryAfter ?? DEFAULT_WAIT_S) * 1000);
    }
  }

  /** Whether a report's ending means the purchase still has to be reported later. */
  const keep = (r: BuyResult) => r.kind === 'notYetCredited' || r.kind === 'signedOut';

  return {
    /** Buys a pack for the signed-in account `userId`. */
    async buy(pack: Pack, userId: string): Promise<BuyResult> {
      const store = current();
      if (store.unavailable) return { kind: 'unavailable', reason: store.unavailable };
      await store.identify(userId);
      const outcome = await store.purchase(pack.productId);
      if (outcome.kind !== 'purchased') return outcome;
      if (!outcome.transactionId) return { kind: 'notYetCredited' };
      const entry: PendingPurchase = {
        userId,
        store: store.fake ? 'fake' : deps.storeName,
        transactionId: outcome.transactionId,
        productId: outcome.productId,
        ...(store.fake ? { packStore: pack.store } : {}),
        at: now(),
      };
      // Kept before the report, so a crash or a lost connection right now can't lose it.
      await edit((list) => [...list.filter((p) => !sameTx(p, entry)), entry]);
      const result = await report(entry);
      if (!keep(result)) await edit((list) => list.filter((p) => !sameTx(p, entry)));
      return result;
    },

    /**
     * Reports this account's purchases that weren't credited yet. Returns the credits added now and the latest
     * balance the server gave, and how many are still waiting.
     */
    async retryPending(userId: string): Promise<{ credited: number; balance: number | null; waiting: number }> {
      const list = await edit((l) => l);
      let credited = 0;
      let balance: number | null = null;
      let waiting = 0;
      for (const p of list.filter((x) => x.userId === userId)) {
        const result = await report(p);
        if (result.kind === 'credited') {
          credited += result.credits;
          balance = result.balance ?? balance;
        }
        if (keep(result)) waiting++;
        else await edit((l) => l.filter((x) => !sameTx(x, p)));
      }
      return { credited, balance, waiting };
    },

    /** How many of this account's purchases are waiting to be credited. */
    async waiting(userId: string): Promise<number> {
      const list = await deps.pending.load().catch(() => []);
      return list.filter((p) => p.userId === userId).length;
    },
  };
}

export type PurchaseFlow = ReturnType<typeof createPurchaseFlow>;
