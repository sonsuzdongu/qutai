// Buying credits (src/purchases/): the flow against a fake store (every ending, a lost answer reported again, purchases
// found again in the store's list, packs matched to store products), the client's POST /purchases/verify against the
// fake server, and the RevenueCat adapter against a fake SDK. Real purchases are tried on a phone (checklist.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPurchaseFlow, packOffers, type Pack, type PendingPurchase } from '../../src/purchases/flow.ts';
import type { StoreTransaction } from '../../src/purchases/types.ts';
import { createRevenueCatStore, type RevenueCatSdk } from '../../src/purchases/revenuecat.ts';
import type { PurchaseStore, StoreOutcome, VerifyAnswer, VerifyPurchaseResponse } from '../../src/purchases/types.ts';
import { createUnavailableStore } from '../../src/purchases/unavailable.ts';
import { error, fakeServer, json } from './fake.ts';

const PACK: Pack = { store: 'google', productId: 'credits_100', credits: 100_000_000 };

function fakeStore(outcome: StoreOutcome): PurchaseStore & { identified: (string | null)[]; bought: string[] } {
  const identified: (string | null)[] = [];
  const bought: string[] = [];
  return {
    unavailable: null,
    identified,
    bought,
    identify: async (id) => {
      identified.push(id);
    },
    products: async (ids) => ids.map((productId) => ({ productId, price: '₺49,99' })),
    purchase: async (id) => {
      bought.push(id);
      return outcome;
    },
  };
}

function memory(initial: PendingPurchase[] = []) {
  let list = [...initial];
  return { load: async () => [...list], save: async (l: PendingPurchase[]) => void (list = [...l]), get: () => list };
}

const credited = (credits = 100_000_000, balance: number | null = 105_000_000): VerifyAnswer => ({
  ok: true,
  response: { store: 'google', transactionId: 'GPA.1', productId: 'credits_100', status: 'credited', credits, balance, replayed: false },
});

function flowWith(store: PurchaseStore, answers: VerifyAnswer[], pending = memory()) {
  const asked: { store: string; transactionId: string }[] = [];
  const waits: number[] = [];
  const flow = createPurchaseFlow({
    store,
    storeName: 'google',
    verify: async (req) => {
      asked.push(req);
      return answers.length > 1 ? answers.shift()! : answers[0];
    },
    pending,
    sleep: async (ms) => void waits.push(ms),
    now: () => 1_000_000,
  });
  return { flow, asked, waits, pending };
}

const BOUGHT: StoreOutcome = { kind: 'purchased', productId: 'credits_100', transactionId: 'GPA.1' };

test('offers: the server packs for this store, priced by the store; none made up without one', () => {
  const packs: Pack[] = [PACK, { store: 'apple', productId: 'credits_100', credits: 1 }, { store: 'google', productId: 'credits_500', credits: 5 }];
  assert.deepEqual(packOffers(packs, 'google', [{ productId: 'credits_100', price: '$1.99' }, { productId: 'not_a_pack', price: '$9' }]), [
    { pack: PACK, price: '$1.99' },
  ]);
  assert.deepEqual(
    packOffers(packs, 'google', null).map((o) => [o.pack.productId, o.price]),
    [
      ['credits_100', null],
      ['credits_500', null],
    ],
  );
  assert.deepEqual(packOffers([], 'google', []), []);
});

test('buy: identifies the account, buys, reports and returns the new balance', async () => {
  const store = fakeStore(BOUGHT);
  const { flow, asked, pending } = flowWith(store, [credited()]);
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'credited', credits: 100_000_000, balance: 105_000_000, replayed: false });
  assert.deepEqual(store.identified, ['user-1']);
  assert.deepEqual(store.bought, ['credits_100']);
  assert.deepEqual(asked, [{ store: 'google', transactionId: 'GPA.1' }]);
  assert.deepEqual(pending.get(), [], 'nothing left waiting');
});

test('buy: cancelled, pending and failed purchases report nothing', async () => {
  const outcomes = [
    { kind: 'cancelled' },
    { kind: 'pending' },
    { kind: 'failed', reason: 'network' },
    { kind: 'failed', reason: 'notAllowed' },
    { kind: 'failed', reason: 'billingUnavailable' },
    { kind: 'failed', reason: 'storeProblem' },
    { kind: 'failed', reason: 'productUnavailable' },
  ] as StoreOutcome[];
  for (const outcome of outcomes) {
    const { flow, asked, pending } = flowWith(fakeStore(outcome), [credited()]);
    assert.deepEqual(await flow.buy(PACK, 'user-1'), outcome);
    assert.equal(asked.length, 0);
    assert.deepEqual(pending.get(), []);
  }
});

test('buy: unavailable store never buys', async () => {
  const { flow, asked } = flowWith(createUnavailableStore('notInBuild'), [credited()]);
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'unavailable', reason: 'notInBuild' });
  assert.equal(asked.length, 0);
});

test('buy: not found yet is asked again after Retry-After, then credited', async () => {
  const { flow, waits } = flowWith(fakeStore(BOUGHT), [{ ok: false, status: 404, code: 'purchase_not_found', retryAfter: 10 }, credited()]);
  assert.equal((await flow.buy(PACK, 'user-1')).kind, 'credited');
  assert.deepEqual(waits, [10_000]);
});

test('buy: still not credited after the attempts is kept and reported later', async () => {
  const unavailable: VerifyAnswer = { ok: false, status: 503, code: 'unavailable', retryAfter: 60 };
  const answers = [unavailable, unavailable, unavailable, credited(100_000_000, 7)];
  const { flow, asked, waits, pending } = flowWith(fakeStore(BOUGHT), answers);
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'notYetCredited' });
  assert.equal(asked.length, 3);
  assert.deepEqual(waits, [15_000, 15_000], 'long Retry-After values are capped');
  assert.equal(pending.get().length, 1);
  assert.equal(await flow.waiting('user-1'), 1);
  assert.equal(await flow.waiting('user-2'), 0, "another account's purchases aren't counted");
  // Later (screen opened, Refresh, app start): credited now, and forgotten.
  assert.deepEqual(await flow.retryPending('user-2'), { credited: 0, balance: null, waiting: 0 });
  assert.deepEqual(await flow.retryPending('user-1'), { credited: 100_000_000, balance: 7, waiting: 0 });
  assert.deepEqual(pending.get(), []);
});

test('buy: a network failure while reporting keeps the purchase', async () => {
  const pending = memory();
  const flow = createPurchaseFlow({
    store: fakeStore(BOUGHT),
    storeName: 'google',
    verify: async () => {
      throw new Error('offline');
    },
    pending,
    sleep: async () => {},
  });
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'notYetCredited' });
  assert.equal(pending.get()[0].transactionId, 'GPA.1');
});

test('buy: held, rejected, reversed and suspended are final and not retried', async () => {
  const response = (status: VerifyPurchaseResponse['status']): VerifyAnswer => ({
    ok: true,
    response: { store: 'google', transactionId: 'GPA.1', productId: 'x', status, credits: 0, balance: null, replayed: false },
  });
  const cases: [VerifyAnswer, unknown][] = [
    [response('held'), { kind: 'support', reason: 'held' }],
    [{ ok: false, status: 422, code: 'purchase_rejected' }, { kind: 'support', reason: 'rejected' }],
    [response('refunded'), { kind: 'reversed' }],
    [response('revoked'), { kind: 'reversed' }],
    [{ ok: false, status: 403, code: 'account_suspended' }, { kind: 'suspended' }],
  ];
  for (const [answer, expected] of cases) {
    const { flow, asked, pending } = flowWith(fakeStore(BOUGHT), [answer]);
    assert.deepEqual(await flow.buy(PACK, 'user-1'), expected);
    assert.equal(asked.length, 1);
    assert.deepEqual(pending.get(), []);
  }
});

test('buy: signed out while reporting keeps the purchase for when the user signs in', async () => {
  const { flow, pending } = flowWith(fakeStore(BOUGHT), [{ ok: false, status: 401, code: 'not_signed_in' }]);
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'signedOut' });
  assert.equal(pending.get().length, 1);
});

test('buy: paid without a transaction id to report says not yet credited (the webhook credits it)', async () => {
  const { flow, asked } = flowWith(fakeStore({ kind: 'purchased', productId: 'credits_100', transactionId: null }), [credited()]);
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'notYetCredited' });
  assert.equal(asked.length, 0);
});

/** A fake store that also lists the customer's recent purchases (as RevenueCat's customer info does). */
function storeWithRecent(outcome: StoreOutcome, recent: StoreTransaction[]) {
  const store = fakeStore(outcome);
  return Object.assign(store, { recent: async () => recent });
}

function settledMemory(initial: string[] = []) {
  let list = [...initial];
  return { load: async () => [...list], save: async (l: string[]) => void (list = [...l]), get: () => list };
}

test('buy: paid without a transaction id, found in the store’s list: reported and credited', async () => {
  const store = storeWithRecent({ kind: 'purchased', productId: 'credits_100', transactionId: null }, [
    { transactionId: 'GPA.7', productId: 'credits_100', at: 999_000 },
  ]);
  const { flow, asked, pending } = flowWith(store, [credited()]);
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'credited', credits: 100_000_000, balance: 105_000_000 });
  assert.deepEqual(asked, [{ store: 'google', transactionId: 'GPA.7' }]);
  assert.deepEqual(pending.get(), []);
});

test('buy: already owned (an earlier purchase not consumed yet): the earlier one is found and reported', async () => {
  const store = storeWithRecent({ kind: 'alreadyOwned' }, [{ transactionId: 'GPA.earlier', productId: 'credits_100', at: 900_000 }]);
  const { flow, asked } = flowWith(store, [credited(100_000_000, 205_000_000)]);
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'credited', credits: 100_000_000, balance: 205_000_000 });
  assert.deepEqual(asked, [{ store: 'google', transactionId: 'GPA.earlier' }]);

  // Nothing in the store's list (or it was credited before): says so, nothing charged twice.
  const replay: VerifyAnswer = { ok: true, response: { ...(credited() as { response: VerifyPurchaseResponse }).response, replayed: true } };
  const again = flowWith(storeWithRecent({ kind: 'alreadyOwned' }, [{ transactionId: 'GPA.earlier', productId: 'credits_100', at: 1 }]), [replay]);
  assert.deepEqual(await again.flow.buy(PACK, 'user-1'), { kind: 'alreadyOwned' });
  const none = flowWith(fakeStore({ kind: 'alreadyOwned' }), [credited()]);
  assert.deepEqual(await none.flow.buy(PACK, 'user-1'), { kind: 'alreadyOwned' });
  assert.equal(none.asked.length, 0);
});

test('lost answer: the store charged, the server’s answer never arrived; reported at the next start and credited once', async () => {
  const pending = memory();
  const settled = settledMemory();
  let online = false;
  let creditedTimes = 0;
  const seen = new Set<string>();
  const store = storeWithRecent(BOUGHT, [{ transactionId: 'GPA.1', productId: 'credits_100', at: 999_000 }]);
  const flow = createPurchaseFlow({
    store,
    storeName: 'google',
    // The server credits a transaction once and answers the same again (replayed) for a repeat.
    verify: async (req) => {
      if (!online) throw new Error('connection lost');
      const replayed = seen.has(req.transactionId);
      if (!replayed) creditedTimes++;
      seen.add(req.transactionId);
      return { ok: true, response: { store: 'google', transactionId: req.transactionId, productId: 'credits_100', status: 'credited', credits: 100_000_000, balance: 100_000_000, replayed } };
    },
    pending,
    settled,
    sleep: async () => {},
    now: () => 1_000_000,
  });
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'notYetCredited' });
  assert.equal(pending.get().length, 1, 'kept on the phone');
  assert.equal(await flow.waiting('user-1'), 1);

  online = true;
  assert.deepEqual(await flow.retryPending('user-1'), { credited: 100_000_000, balance: 100_000_000, waiting: 0 });
  assert.deepEqual(pending.get(), []);
  assert.deepEqual(settled.get(), ['google:GPA.1']);
  // Later starts: the store still lists it, but it's settled: not reported again, nothing added.
  assert.deepEqual(await flow.retryPending('user-1'), { credited: 0, balance: null, waiting: 0 });
  assert.equal(creditedTimes, 1);
});

test('retry: a purchase found in the store’s list that the server had credited before adds nothing to the count', async () => {
  const replayed: VerifyAnswer = { ok: true, response: { store: 'google', transactionId: 'GPA.old', productId: 'credits_100', status: 'credited', credits: 100_000_000, balance: 300_000_000, replayed: true } };
  const settled = settledMemory();
  const flow = createPurchaseFlow({
    store: storeWithRecent(BOUGHT, [{ transactionId: 'GPA.old', productId: 'credits_100', at: 1 }]),
    storeName: 'google',
    verify: async () => replayed,
    pending: memory(),
    settled,
    sleep: async () => {},
  });
  assert.deepEqual(await flow.retryPending('user-1'), { credited: 0, balance: 300_000_000, waiting: 0 });
  assert.deepEqual(settled.get(), ['google:GPA.old']);
});

test('retry: without looking in the store (app start before the buy screen was used) only kept purchases are reported', async () => {
  let asked = 0;
  const store = Object.assign(fakeStore(BOUGHT), {
    recent: async () => {
      asked++;
      return [{ transactionId: 'GPA.x', productId: 'credits_100', at: 1 }];
    },
  });
  const flow = createPurchaseFlow({ store, storeName: 'google', verify: async () => credited(), pending: memory(), sleep: async () => {} });
  assert.deepEqual(await flow.retryPending('user-1', { lookInStore: false }), { credited: 0, balance: null, waiting: 0 });
  assert.equal(asked, 0);
  assert.equal(store.identified.length, 0, 'the store is not even set up');
});

test('retry: the store’s list is never read for an unavailable store', async () => {
  for (const base of [createUnavailableStore('notInBuild')]) {
    let asked = 0;
    const store = Object.assign(base, {
      recent: async () => {
        asked++;
        return [];
      },
    });
    const flow = createPurchaseFlow({ store, storeName: 'google', verify: async () => credited(), pending: memory(), sleep: async () => {} });
    await flow.retryPending('user-1');
    assert.equal(asked, 0);
  }
});

test('held by the server: said once, not retried, not looked for again', async () => {
  const held: VerifyAnswer = { ok: true, response: { store: 'google', transactionId: 'GPA.1', productId: 'credits_100', status: 'held', credits: 0, balance: null, replayed: false } };
  const settled = settledMemory();
  const flow = createPurchaseFlow({
    store: storeWithRecent(BOUGHT, [{ transactionId: 'GPA.1', productId: 'credits_100', at: 1 }]),
    storeName: 'google',
    verify: async () => held,
    pending: memory(),
    settled,
    sleep: async () => {},
  });
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'support', reason: 'held' });
  assert.deepEqual(settled.get(), ['google:GPA.1']);
  assert.deepEqual(await flow.retryPending('user-1'), { credited: 0, balance: null, waiting: 0 });
});

test('pending: old entries are dropped', async () => {
  const pending = memory([{ userId: 'user-1', store: 'google', transactionId: 'GPA.old', productId: 'x', at: 0 }]);
  const flow = createPurchaseFlow({
    store: fakeStore(BOUGHT),
    storeName: 'google',
    verify: async () => credited(),
    pending,
    now: () => 31 * 24 * 3600_000,
  });
  assert.deepEqual(await flow.retryPending('user-1'), { credited: 0, balance: null, waiting: 0 });
});

test('client: POST /purchases/verify with the token, the store and the transaction; answers kept apart', async () => {
  const ok = { store: 'google', transactionId: 'GPA.1', productId: 'credits_100', status: 'credited', credits: 5, balance: 9, replayed: true };
  const server = fakeServer({
    verify: [json(ok), error('purchase_not_found', 404, {}, { 'Retry-After': '10' }), error('purchase_rejected', 422), error('account_suspended', 403)],
  });
  const client = server.client();
  assert.deepEqual(await client.verifyPurchase({ store: 'google', transactionId: 'GPA.1' }), { ok: true, response: ok });
  const sent = server.requests.find((r) => r.path === '/purchases/verify')!;
  assert.equal(sent.method, 'POST');
  assert.equal(sent.headers.authorization, 'Bearer token-1');
  assert.deepEqual(sent.body, { store: 'google', transactionId: 'GPA.1' });
  assert.deepEqual(server.events.balances, [9], 'the new balance reaches the store');
  assert.deepEqual(await client.verifyPurchase({ store: 'google', transactionId: 'GPA.2' }), {
    ok: false,
    status: 404,
    code: 'purchase_not_found',
    retryAfter: 10,
  });
  assert.deepEqual(await client.verifyPurchase({ store: 'google', transactionId: 'GPA.3' }), { ok: false, status: 422, code: 'purchase_rejected' });
  assert.deepEqual(await client.verifyPurchase({ store: 'google', transactionId: 'GPA.4' }), { ok: false, status: 403, code: 'account_suspended' });
  assert.equal(server.events.suspended, 1);
});

test('client: an expired session reports not_signed_in', async () => {
  const server = fakeServer({ verify: [json({})] });
  server.expireToken(true);
  assert.deepEqual(await server.client().verifyPurchase({ store: 'apple', transactionId: '2000' }), {
    ok: false,
    status: 401,
    code: 'not_signed_in',
  });
});

function fakeSdk() {
  const calls: string[] = [];
  let fail: unknown = null;
  let transaction: { transactionIdentifier: string; productIdentifier: string } | null = {
    transactionIdentifier: 'GPA.9',
    productIdentifier: 'credits_100',
  };
  let canPay = true;
  let logInFails = false;
  let configured: Record<string, unknown> | null = null;
  const history: { transactionIdentifier: string; productIdentifier: string; purchaseDate: string }[] = [];
  const sdk: RevenueCatSdk = {
    configure: (c) => {
      configured = c;
      calls.push(`configure ${c.appUserID}`);
    },
    logIn: async (id) => {
      calls.push(`logIn ${id}`);
      if (logInFails) throw new Error('offline');
    },
    logOut: async () => void calls.push('logOut'),
    getProducts: async (ids, type) => {
      calls.push(`getProducts ${ids.join(',')} ${type}`);
      return ids.filter((id) => id !== 'unknown').map((identifier) => ({ identifier, priceString: '$1.99' }));
    },
    purchaseStoreProduct: async (p) => {
      calls.push(`purchase ${p.identifier}`);
      if (fail) throw fail;
      return { productIdentifier: p.identifier, transaction };
    },
    getCustomerInfo: async () => {
      calls.push('getCustomerInfo');
      return { nonSubscriptionTransactions: history };
    },
    canMakePayments: async () => canPay,
    PRODUCT_CATEGORY: { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: '1',
      STORE_PROBLEM_ERROR: '2',
      PURCHASE_NOT_ALLOWED_ERROR: '3',
      PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
      PRODUCT_ALREADY_PURCHASED_ERROR: '6',
      NETWORK_ERROR: '10',
      OFFLINE_CONNECTION_ERROR: '35',
      PAYMENT_PENDING_ERROR: '20',
    },
  };
  return {
    sdk,
    calls,
    history,
    configured: () => configured,
    failWith: (e: unknown) => void (fail = e),
    noTransaction: () => void (transaction = null),
    noBilling: () => void (canPay = false),
    logInFails: (v: boolean) => void (logInFails = v),
  };
}

test('RevenueCat: configured only once signed in, with the account id; switches with logIn / logOut', async () => {
  const { sdk, calls } = fakeSdk();
  const store = createRevenueCatStore(sdk, 'goog_public');
  await store.identify(null);
  assert.deepEqual(await store.products(['credits_100']), [], 'nothing before sign-in');
  assert.equal((await store.purchase('credits_100')).kind, 'failed');
  assert.deepEqual(calls, [], 'never configured with an anonymous id');
  await store.identify('user-1');
  await store.identify('user-1');
  await store.identify('user-2');
  await store.identify(null);
  assert.deepEqual(calls, ['configure user-1', 'logIn user-2', 'logOut']);
});

test('RevenueCat: consumables fetched as non-subscriptions, bought, transaction id reported', async () => {
  const { sdk, calls } = fakeSdk();
  const store = createRevenueCatStore(sdk, 'goog_public');
  await store.identify('user-1');
  assert.deepEqual(await store.products(['credits_100', 'unknown']), [{ productId: 'credits_100', price: '$1.99' }]);
  assert.deepEqual(await store.purchase('credits_100'), { kind: 'purchased', productId: 'credits_100', transactionId: 'GPA.9' });
  assert.ok(calls.includes('getProducts credits_100,unknown NON_SUBSCRIPTION'));
  assert.equal(calls.filter((c) => c.startsWith('getProducts')).length, 1, 'the fetched product is reused');
  assert.deepEqual(await store.purchase('unknown'), { kind: 'failed', reason: 'productUnavailable' });
});

test('RevenueCat: errors become outcomes', async () => {
  const cases: [unknown, StoreOutcome][] = [
    [{ code: '1', userCancelled: true }, { kind: 'cancelled' }],
    [{ code: '1', userCancelled: null }, { kind: 'cancelled' }],
    [{ code: '20' }, { kind: 'pending' }],
    [{ code: '6' }, { kind: 'alreadyOwned' }],
    [{ code: '3' }, { kind: 'failed', reason: 'notAllowed' }],
    [{ code: '10' }, { kind: 'failed', reason: 'network' }],
    [{ code: '35' }, { kind: 'failed', reason: 'network' }],
    [{ code: '2' }, { kind: 'failed', reason: 'storeProblem' }],
    [new Error('boom'), { kind: 'failed', reason: 'unknown' }],
  ];
  for (const [e, expected] of cases) {
    const { sdk, failWith } = fakeSdk();
    failWith(e);
    const store = createRevenueCatStore(sdk, 'k');
    await store.identify('user-1');
    assert.deepEqual(await store.purchase('credits_100'), expected);
  }
  const { sdk, noTransaction } = fakeSdk();
  noTransaction();
  const store = createRevenueCatStore(sdk, 'k');
  await store.identify('user-1');
  assert.deepEqual(await store.purchase('credits_100'), { kind: 'purchased', productId: 'credits_100', transactionId: null });
});

test('RevenueCat: configured with diagnostics and device-identifier collection off', async () => {
  const { sdk, configured } = fakeSdk();
  const store = createRevenueCatStore(sdk, 'goog_public');
  await store.identify('user-1');
  assert.deepEqual(configured(), { apiKey: 'goog_public', appUserID: 'user-1', diagnosticsEnabled: false, automaticDeviceIdentifierCollectionEnabled: false });
});

test('RevenueCat: a failed switch to another account never buys for the previous one', async () => {
  const { sdk, calls, logInFails } = fakeSdk();
  const store = createRevenueCatStore(sdk, 'k');
  await store.identify('user-1');
  logInFails(true);
  await store.identify('user-2');
  assert.deepEqual(await store.purchase('credits_100'), { kind: 'failed', reason: 'notAllowed' });
  assert.ok(!calls.includes('purchase credits_100'));
  logInFails(false);
  await store.identify('user-2');
  assert.equal((await store.purchase('credits_100')).kind, 'purchased');
});

test('RevenueCat: billing not supported on the device is told apart from "not allowed"', async () => {
  const { sdk, failWith, noBilling } = fakeSdk();
  const store = createRevenueCatStore(sdk, 'k');
  await store.identify('user-1');
  assert.equal(await store.canPay!(), true);
  noBilling();
  assert.equal(await store.canPay!(), false);
  failWith({ code: '3' });
  assert.deepEqual(await store.purchase('credits_100'), { kind: 'failed', reason: 'billingUnavailable' });
});

test('RevenueCat: recent purchases from the customer info, newest first, only the last 30 days, at most 10', async () => {
  const { sdk, history } = fakeSdk();
  const day = 24 * 3600_000;
  const now = Date.parse('2026-11-20T12:00:00Z');
  history.push({ transactionIdentifier: 'GPA.old', productIdentifier: 'credits_100', purchaseDate: new Date(now - 40 * day).toISOString() });
  for (let i = 0; i < 12; i++) {
    history.push({ transactionIdentifier: `GPA.${i}`, productIdentifier: 'credits_100', purchaseDate: new Date(now - i * 3600_000).toISOString() });
  }
  const store = createRevenueCatStore(sdk, 'k', () => now);
  assert.deepEqual(await store.recent!(), [], 'nothing before sign-in');
  await store.identify('user-1');
  const recent = await store.recent!();
  assert.equal(recent.length, 10);
  assert.equal(recent[0].transactionId, 'GPA.0');
  assert.ok(!recent.some((t) => t.transactionId === 'GPA.old'));
});

test('a kept list that cannot be read is never written over; the purchase is kept in memory (BUY-35)', async () => {
  const earlier: PendingPurchase = { userId: 'user-1', store: 'google', transactionId: 'GPA.0', productId: 'credits_100', at: 999_000 };
  const store = memory([earlier]);
  let broken = true;
  const failures: string[] = [];
  const unavailable: VerifyAnswer = { ok: false, status: 503, code: 'unavailable' };
  const flow = createPurchaseFlow({
    store: fakeStore(BOUGHT),
    storeName: 'google',
    verify: async () => unavailable,
    pending: {
      load: async () => {
        if (broken) throw new Error('keychain');
        return store.load();
      },
      save: store.save,
    },
    onStorageFailure: (label) => void failures.push(label),
    sleep: async () => {},
    now: () => 1_000_000,
  });
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'notYetCredited' });
  assert.deepEqual(store.get(), [earlier], 'the stored list is untouched');
  assert.ok(failures.includes('purchases.pending.load'));
  assert.equal(await flow.waiting('user-1'), 1, 'the new purchase waits in memory');
  // Storage answers again: the earlier purchase and the new one are both there and stored.
  broken = false;
  assert.equal((await flow.retryPending('user-1')).waiting, 2);
  assert.deepEqual(store.get().map((p) => p.transactionId).sort(), ['GPA.0', 'GPA.1']);
});

test('a kept list that cannot be written stays in memory and is written at the next change (BUY-35)', async () => {
  const store = memory();
  let broken = true;
  const unavailable: VerifyAnswer = { ok: false, status: 503, code: 'unavailable' };
  const flow = createPurchaseFlow({
    store: fakeStore(BOUGHT),
    storeName: 'google',
    verify: async () => unavailable,
    pending: {
      load: store.load,
      save: async (l) => {
        if (broken) throw new Error('keychain');
        await store.save(l);
      },
    },
    sleep: async () => {},
    now: () => 1_000_000,
  });
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'notYetCredited' });
  assert.deepEqual(store.get(), []);
  assert.equal(await flow.waiting('user-1'), 1);
  broken = false;
  assert.equal((await flow.retryPending('user-1')).waiting, 1);
  assert.equal(store.get().length, 1);
});
