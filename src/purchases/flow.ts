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

/**
 * The purchases the server already answered for good (`<store>:<transaction id>`), so the store's list of recent
 * purchases (`PurchaseStore.recent`) isn't reported again at every start.
 */
export interface SettledStorage {
  load(): Promise<string[]>;
  save(list: string[]): Promise<void>;
}

/** How a purchase (or a report of an earlier one) ended, for the screen. */
export type BuyResult =
  /** `replayed`: the server had credited it before (an earlier report); nothing new was added now. */
  | { kind: 'credited'; credits: number; balance: number | null; replayed?: boolean }
  | { kind: 'cancelled' }
  /** The store is waiting for something outside the app; credits come once it completes. */
  | { kind: 'pending' }
  /** An earlier purchase of this pack isn't finished yet; its credits come by themselves (`retryPending`, the webhook). */
  | { kind: 'alreadyOwned' }
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
  /** Purchases already answered for good; without it, `recent` purchases are reported every time (safe, just slower). */
  settled?: SettledStorage;
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
const MAX_SETTLED = 200;

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
 * - A purchase the store finished but the phone never reported (killed mid-purchase, no transaction id, "already
 *   owned") is found in the store's list of the customer's recent purchases (`recent`) by `retryPending` and reported
 *   then; what the server has answered for good is remembered (`settled`) so it isn't asked again.
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
  const key = (p: { store: ReportStore; transactionId: string }) => `${p.store}:${p.transactionId}`;
  let settledQueue: Promise<unknown> = Promise.resolve();
  const settle = (p: { store: ReportStore; transactionId: string }) => {
    if (!deps.settled) return Promise.resolve();
    const store = deps.settled;
    const run = settledQueue.then(async () => {
      const list = await store.load().catch(() => [] as string[]);
      if (list.includes(key(p))) return;
      await store.save([...list, key(p)].slice(-MAX_SETTLED)).catch(() => {});
    });
    settledQueue = run.catch(() => {});
    return run;
  };
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
        if (r.status === 'credited') return { kind: 'credited', credits: r.credits, balance: r.balance, replayed: r.replayed };
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

  /** Reports one kept purchase and keeps or drops it (and remembers a final answer). */
  async function reportKept(p: PendingPurchase): Promise<BuyResult> {
    const result = await report(p);
    if (!keep(result)) {
      await edit((l) => l.filter((x) => !sameTx(x, p)));
      await settle(p);
    }
    return result;
  }

  /**
   * Adds the store's recent purchases of this customer that the server hasn't answered for good and that aren't kept
   * already (real stores only; the SDK knows only the signed-in customer, so they are this account's).
   */
  async function recover(store: PurchaseStore, userId: string): Promise<void> {
    if (!store.recent || store.unavailable || store.fake) return;
    await store.identify(userId);
    const recent = await store.recent().catch(() => []);
    if (recent.length === 0) return;
    const settled = new Set(await deps.settled?.load().catch(() => [] as string[]) ?? []);
    const found = recent
      .map((t): PendingPurchase => ({ userId, store: deps.storeName, transactionId: t.transactionId, productId: t.productId, at: now() }))
      .filter((p) => !settled.has(key(p)));
    if (found.length === 0) return;
    await edit((list) => [...list, ...found.filter((p) => !list.some((x) => sameTx(x, p)))]);
  }

  /** Reports this account's kept purchases (after looking for lost ones in the store). */
  async function reportAll(userId: string, lookInStore = true): Promise<{ credited: number; balance: number | null; waiting: number }> {
    if (lookInStore) await recover(current(), userId).catch(() => {});
    const list = await edit((l) => l);
    let credited = 0;
    let balance: number | null = null;
    let waiting = 0;
    for (const p of list.filter((x) => x.userId === userId)) {
      const result = await reportKept(p);
      if (result.kind === 'credited') {
        // A purchase the server had credited before (found again in the store's list) adds nothing now.
        if (!result.replayed) credited += result.credits;
        balance = result.balance ?? balance;
      }
      if (keep(result)) waiting++;
    }
    return { credited, balance, waiting };
  }

  /** After a purchase without a report of its own: what looking for it in the store found. */
  async function afterLost(userId: string, otherwise: BuyResult): Promise<BuyResult> {
    const r = await reportAll(userId);
    return r.credited > 0 ? { kind: 'credited', credits: r.credited, balance: r.balance } : otherwise;
  }

  return {
    /** Buys a pack for the signed-in account `userId`. */
    async buy(pack: Pack, userId: string): Promise<BuyResult> {
      const store = current();
      if (store.unavailable) return { kind: 'unavailable', reason: store.unavailable };
      await store.identify(userId);
      const outcome = await store.purchase(pack.productId);
      // Already owned: an earlier purchase of this pack isn't finished; find it in the store's list and report it.
      if (outcome.kind === 'alreadyOwned') return afterLost(userId, outcome);
      if (outcome.kind !== 'purchased') return outcome;
      // Paid, but the store gave no id to report: look for it in the store's list (the webhook credits it anyway).
      if (!outcome.transactionId) return afterLost(userId, { kind: 'notYetCredited' });
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
      return reportKept(entry);
    },

    /**
     * Reports this account's purchases that weren't credited yet, including any the store finished but the phone never
     * reported (unless `lookInStore` is false). Returns the credits added now (not those credited before) and the latest balance the server gave, and
     * how many are still waiting.
     */
    retryPending(userId: string, options: { lookInStore?: boolean } = {}): Promise<{ credited: number; balance: number | null; waiting: number }> {
      return reportAll(userId, options.lookInStore ?? true);
    },

    /** How many of this account's purchases are waiting to be credited. */
    async waiting(userId: string): Promise<number> {
      const list = await deps.pending.load().catch(() => []);
      return list.filter((p) => p.userId === userId).length;
    },
  };
}

export type PurchaseFlow = ReturnType<typeof createPurchaseFlow>;
