// FAKE purchases (the temporary stand-in while no store is connected; backend README › Fake purchases): the app learns
// the mode from GET /config, buys through the fake store, reports to POST /purchases/fake as store `fake` with its
// pack, keeps a purchase whose answer was lost and reports it again with the same id, and drops it on a final answer.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseConfig } from '../../src/credits/client.ts';
import { createFakeStore, fakeTransactionId } from '../../src/purchases/fake.ts';
import { createPurchaseFlow, packOffers, type Pack, type PendingPurchase } from '../../src/purchases/flow.ts';
import type { PurchaseStore, VerifyAnswer, VerifyPurchaseRequest } from '../../src/purchases/types.ts';
import { createUnavailableStore } from '../../src/purchases/unavailable.ts';
import { error, fakeServer, json } from './fake.ts';

const PACK: Pack = { store: 'google', productId: 'credits_100', credits: 100_000_000 };

function memory(initial: PendingPurchase[] = []) {
  let list = [...initial];
  return { load: async () => [...list], save: async (l: PendingPurchase[]) => void (list = [...l]), get: () => list };
}

let n = 0;
const fakeStore = () => createFakeStore(() => `id${String(++n).padStart(8, '0')}`);

const credited = (transactionId: string, replayed = false): VerifyAnswer => ({
  ok: true,
  response: { store: 'fake', transactionId, productId: 'credits_100', status: 'credited', credits: 100_000_000, balance: 105_000_000, replayed },
});

function flowWith(store: PurchaseStore | (() => PurchaseStore), answer: (req: VerifyPurchaseRequest) => VerifyAnswer, pending = memory()) {
  const asked: VerifyPurchaseRequest[] = [];
  const flow = createPurchaseFlow({
    store,
    storeName: 'google',
    verify: async (req) => {
      asked.push(req);
      return answer(req);
    },
    pending,
    sleep: async () => {},
    now: () => 1_000_000,
  });
  return { flow, asked, pending };
}

test('config: only an explicit fake mode switches the app to fake purchases', () => {
  assert.deepEqual(parseConfig({ purchases: { mode: 'fake' } }).purchases, { mode: 'fake' });
  for (const purchases of [undefined, null, { mode: 'store' }, { mode: 'FAKE' }, { mode: true }, 'fake', []]) {
    assert.deepEqual(parseConfig({ purchases }).purchases, { mode: 'store' }, JSON.stringify(purchases));
  }
});

test('fake store: buys without a store, with a transaction id the server accepts, and no prices', async () => {
  const store = fakeStore();
  assert.equal(store.unavailable, null);
  assert.equal(store.fake, true);
  assert.deepEqual(await store.products(['credits_100']), []);
  const outcome = await store.purchase('credits_100');
  assert.equal(outcome.kind, 'purchased');
  assert.match(outcome.kind === 'purchased' ? outcome.transactionId! : '', /^fake-[A-Za-z0-9_-]{8,100}$/);
  for (const random of [crypto.randomUUID(), 'a', '', '!!!!', 'x'.repeat(300)]) {
    assert.match(`fake-${fakeTransactionId(random)}`, /^fake-[A-Za-z0-9_-]{8,100}$/, random);
  }
  // The screen shows every pack of this phone's store without a price.
  assert.deepEqual(packOffers([PACK, { ...PACK, store: 'apple' }], 'google', null), [{ pack: PACK, price: null }]);
});

test('buy in fake mode: reported as store fake with its pack, credited, nothing left waiting', async () => {
  const { flow, asked, pending } = flowWith(fakeStore(), (req) => credited(req.transactionId));
  const result = await flow.buy(PACK, 'u1');
  assert.deepEqual(result, { kind: 'credited', credits: 100_000_000, balance: 105_000_000 });
  assert.equal(asked.length, 1);
  assert.deepEqual({ ...asked[0], transactionId: 'x' }, { store: 'fake', transactionId: 'x', productId: 'credits_100', packStore: 'google' });
  assert.deepEqual(pending.get(), []);
});

test('buy in fake mode: a lost answer keeps the purchase and the next report uses the same id (credited once)', async () => {
  let online = false;
  const { flow, asked, pending } = flowWith(fakeStore(), (req) =>
    online ? credited(req.transactionId, asked.filter((a) => a.transactionId === req.transactionId).length > 1) : { ok: false, status: 0, code: 'network' },
  );
  assert.deepEqual(await flow.buy(PACK, 'u1'), { kind: 'notYetCredited' });
  const kept = pending.get();
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.store, 'fake');
  assert.equal(kept[0]!.packStore, 'google');
  assert.equal(await flow.waiting('u1'), 1);
  const tx = kept[0]!.transactionId;
  // Three attempts, all with the same id.
  assert.deepEqual(new Set(asked.map((a) => a.transactionId)), new Set([tx]));

  online = true;
  const r = await flow.retryPending('u1');
  assert.deepEqual(r, { credited: 100_000_000, balance: 105_000_000, waiting: 0 });
  assert.equal(asked.at(-1)!.transactionId, tx);
  assert.deepEqual(asked.at(-1), { store: 'fake', transactionId: tx, productId: 'credits_100', packStore: 'google' });
  assert.deepEqual(pending.get(), []);
});

test('buy in fake mode: the daily limit and a server no longer in fake mode are final, nothing is kept', async () => {
  const limit = flowWith(fakeStore(), () => ({ ok: false, status: 429, code: 'purchase_limit', retryAfter: 3600 }));
  assert.deepEqual(await limit.flow.buy(PACK, 'u1'), { kind: 'limit' });
  assert.equal(limit.asked.length, 1, 'not asked again');
  assert.deepEqual(limit.pending.get(), []);

  const off = flowWith(fakeStore(), () => ({ ok: false, status: 404, code: 'not_found' }));
  assert.deepEqual(await off.flow.buy(PACK, 'u1'), { kind: 'testModeOff' });
  assert.deepEqual(off.pending.get(), []);

  // A fake purchase left waiting is dropped once the server says fake purchases are off.
  const left: PendingPurchase = { userId: 'u1', store: 'fake', transactionId: 'fake-left0000', productId: 'credits_100', packStore: 'google', at: 999_000 };
  const later = flowWith(createUnavailableStore('notInBuild'), () => ({ ok: false, status: 404, code: 'not_found' }), memory([left]));
  assert.deepEqual(await later.flow.retryPending('u1'), { credited: 0, balance: null, waiting: 0 });
  assert.deepEqual(later.pending.get(), []);
});

test('the real stores keep their own report: a 429 or 404 there is not a fake-mode answer', async () => {
  const realStore: PurchaseStore = {
    unavailable: null,
    identify: async () => {},
    products: async () => [],
    purchase: async (productId) => ({ kind: 'purchased', productId, transactionId: 'GPA.1' }),
  };
  const { flow, asked, pending } = flowWith(realStore, () => ({ ok: false, status: 404, code: 'purchase_not_found' }));
  assert.deepEqual(await flow.buy(PACK, 'u1'), { kind: 'notYetCredited' });
  assert.deepEqual(asked[0], { store: 'google', transactionId: 'GPA.1' });
  assert.equal(pending.get().length, 1);
});

test('the store is asked for at every purchase: switching to fake mode needs no restart', async () => {
  let fakeMode = false;
  const unavailable = createUnavailableStore('notInBuild');
  const fake = fakeStore();
  const { flow, asked } = flowWith(() => (fakeMode ? fake : unavailable), (req) => credited(req.transactionId));
  assert.deepEqual(await flow.buy(PACK, 'u1'), { kind: 'unavailable', reason: 'notInBuild' });
  assert.equal(asked.length, 0);
  fakeMode = true;
  assert.equal((await flow.buy(PACK, 'u1')).kind, 'credited');
});

test('client: a fake purchase goes to POST /purchases/fake with its pack; the answer and the balance are read', async () => {
  const ok = { store: 'fake', transactionId: 'fake-abcdefgh', productId: 'credits_100', status: 'credited', credits: 5, balance: 9, replayed: false };
  const server = fakeServer({ verify: [json(ok), error('purchase_limit', 429, {}, { 'Retry-After': '3600' }), error('not_found', 404)] });
  const client = server.client();
  const req: VerifyPurchaseRequest = { store: 'fake', transactionId: 'fake-abcdefgh', productId: 'credits_100', packStore: 'google' };
  assert.deepEqual(await client.verifyPurchase(req), { ok: true, response: ok });
  const sent = server.requests.find((r) => r.path === '/purchases/fake')!;
  assert.equal(sent.method, 'POST');
  assert.equal(sent.headers.authorization, 'Bearer token-1');
  assert.deepEqual(sent.body, { packStore: 'google', productId: 'credits_100', transactionId: 'fake-abcdefgh' });
  assert.equal(server.requests.some((r) => r.path === '/purchases/verify'), false);
  assert.deepEqual(server.events.balances, [9], 'the new balance reaches the header, account screen and low-credit note');
  assert.deepEqual(await client.verifyPurchase(req), { ok: false, status: 429, code: 'purchase_limit', retryAfter: 3600 });
  assert.deepEqual(await client.verifyPurchase(req), { ok: false, status: 404, code: 'not_found' });
});
