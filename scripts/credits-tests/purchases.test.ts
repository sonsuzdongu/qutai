// Buying credits (src/purchases/): the flow against a fake store and the client's POST /purchases/verify against the
// fake server, and the RevenueCat adapter against a fake SDK. No store or RevenueCat project exists yet, so this is
// what checks the logic; real purchases are still to be tried (README.md › Qutai Credits › Buying credits).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPurchaseFlow, packOffers, type Pack, type PendingPurchase } from '../../src/purchases/flow.ts';
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
  assert.deepEqual(await flow.buy(PACK, 'user-1'), { kind: 'credited', credits: 100_000_000, balance: 105_000_000 });
  assert.deepEqual(store.identified, ['user-1']);
  assert.deepEqual(store.bought, ['credits_100']);
  assert.deepEqual(asked, [{ store: 'google', transactionId: 'GPA.1' }]);
  assert.deepEqual(pending.get(), [], 'nothing left waiting');
});

test('buy: cancelled, pending and failed purchases report nothing', async () => {
  for (const outcome of [{ kind: 'cancelled' }, { kind: 'pending' }, { kind: 'failed', reason: 'network' }] as StoreOutcome[]) {
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
  const sdk: RevenueCatSdk = {
    configure: (c) => void calls.push(`configure ${c.appUserID}`),
    isConfigured: async () => true,
    logIn: async (id) => void calls.push(`logIn ${id}`),
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
    PRODUCT_CATEGORY: { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: '1',
      STORE_PROBLEM_ERROR: '2',
      PURCHASE_NOT_ALLOWED_ERROR: '3',
      PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
      NETWORK_ERROR: '10',
      OFFLINE_CONNECTION_ERROR: '35',
      PAYMENT_PENDING_ERROR: '20',
    },
  };
  return {
    sdk,
    calls,
    failWith: (e: unknown) => void (fail = e),
    noTransaction: () => void (transaction = null),
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
