// The restore offer after a fresh sign-in (src/backup/server/offer.ts, BACK-21): marked only once the dialog was
// answered; a result dropped because the screen stopped wanting it comes back.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRestoreOffer, type OfferAccount } from '../../src/backup/server/offer.ts';

type Backup = { id: string };

/** A phone's stored offer state and the server's list; `start()` is an app start (a new runner, same storage). */
function world(initial: { backups: Backup[]; account?: Partial<OfferAccount> }) {
  const store: { account: OfferAccount | null } = {
    account: { userId: 'u1', signedInAt: 1000, ...initial.account },
  };
  const server = { backups: initial.backups, listDelay: null as Promise<void> | null, lists: 0 };
  const start = () =>
    createRestoreOffer<Backup>({
      account: async () => (store.account ? { ...store.account } : null),
      list: async () => {
        server.lists++;
        if (server.listDelay) await server.listDelay;
        return [...server.backups];
      },
      mark: async (userId, signedInAt) => {
        if (store.account?.userId === userId) store.account = { ...store.account, offeredFor: signedInAt };
      },
    });
  return { store, server, start };
}

const answer = (yes: boolean) => {
  const asked: Backup[] = [];
  return { asked, ask: async (b: Backup) => (asked.push(b), yes) };
};
const always = () => true;

test('a fresh sign-in with a backup is asked once; "Restore" hands back the newest', async () => {
  const w = world({ backups: [{ id: 'b2' }, { id: 'b1' }] });
  const run = w.start();
  const a = answer(true);
  assert.deepEqual(await run(always, a.ask), { outcome: 'accepted', backup: { id: 'b2' } });
  assert.deepEqual(a.asked, [{ id: 'b2' }]);
  assert.equal((await run(always, a.ask)).outcome, 'none');
  assert.equal(a.asked.length, 1);
});

test('ready flips during the request: the result is dropped unmarked and asked when ready again', async () => {
  const w = world({ backups: [{ id: 'b1' }] });
  const run = w.start();
  let release!: () => void;
  w.server.listDelay = new Promise((r) => (release = r));
  let ready = true;
  const a = answer(false);
  const first = run(() => ready, a.ask);
  // The first-run intro (or a lock, Settings, a task) comes in front while the list is on its way.
  ready = false;
  release();
  assert.equal((await first).outcome, 'dropped');
  assert.equal(a.asked.length, 0);
  assert.equal(w.store.account?.offeredFor, undefined);
  ready = true;
  w.server.listDelay = null;
  assert.equal((await run(() => ready, a.ask)).outcome, 'declined');
  assert.equal(a.asked.length, 1);
});

test('ready again while the first request is still out: one request, one dialog', async () => {
  const w = world({ backups: [{ id: 'b1' }] });
  const run = w.start();
  let release!: () => void;
  w.server.listDelay = new Promise((r) => (release = r));
  let firstLive = true;
  const a = answer(false);
  const first = run(() => firstLive, a.ask);
  firstLive = false; // the effect's cleanup
  const second = run(always, a.ask); // the effect again, ready once more
  release();
  const outcomes = [(await first).outcome, (await second).outcome];
  assert.deepEqual(outcomes, ['dropped', 'declined']);
  assert.equal(w.server.lists, 1);
  assert.equal(a.asked.length, 1);
});

test('the app is closed before the dialog shows: offered at the next start', async () => {
  const w = world({ backups: [{ id: 'b1' }] });
  const a = answer(true);
  assert.equal((await w.start()(() => false, a.ask)).outcome, 'dropped');
  // Next start: no new sign-in (the session is kept), same stored state.
  assert.equal((await w.start()(always, a.ask)).outcome, 'accepted');
  assert.equal(a.asked.length, 1);
});

test('"Not now": not offered again until the next sign-in', async () => {
  const w = world({ backups: [{ id: 'b1' }] });
  const a = answer(false);
  assert.equal((await w.start()(always, a.ask)).outcome, 'declined');
  assert.equal((await w.start()(always, a.ask)).outcome, 'none');
  w.server.backups = [{ id: 'b2' }, { id: 'b1' }]; // even with a newer backup in the same sign-in
  assert.equal((await w.start()(always, a.ask)).outcome, 'none');
  // Signing in again.
  w.store.account = { ...w.store.account!, signedInAt: 2000 };
  assert.equal((await w.start()(always, a.ask)).outcome, 'declined');
  assert.equal(a.asked.length, 2);
});

test('no backups yet: nothing marked; asked once when one appears during the same sign-in', async () => {
  const w = world({ backups: [] });
  const run = w.start();
  const a = answer(false);
  assert.equal((await run(always, a.ask)).outcome, 'none');
  assert.equal(w.store.account?.offeredFor, undefined);
  w.server.backups = [{ id: 'b1' }];
  assert.equal((await run(always, a.ask)).outcome, 'declined');
  assert.equal((await run(always, a.ask)).outcome, 'none');
  assert.equal(a.asked.length, 1);
});

test("the newest backup is this install's own upload: settled without a dialog", async () => {
  const w = world({ backups: [{ id: 'mine' }, { id: 'older' }], account: { lastUploadId: 'mine' } });
  const a = answer(true);
  assert.equal((await w.start()(always, a.ask)).outcome, 'own');
  assert.equal(w.store.account?.offeredFor, 1000);
  assert.equal(a.asked.length, 0);
});

test('signed out, no sign-in noted, or the list fails: nothing asked, nothing marked', async () => {
  const a = answer(true);
  const out = world({ backups: [{ id: 'b1' }] });
  out.store.account = null;
  assert.equal((await out.start()(always, a.ask)).outcome, 'none');
  const kept = world({ backups: [{ id: 'b1' }], account: { signedInAt: undefined } });
  assert.equal((await kept.start()(always, a.ask)).outcome, 'none');
  const failing = createRestoreOffer<Backup>({
    account: async () => ({ userId: 'u1', signedInAt: 1 }),
    list: async () => {
      throw new Error('offline');
    },
    mark: async () => assert.fail('must not mark'),
  });
  assert.equal((await failing(always, a.ask)).outcome, 'none');
  assert.equal(a.asked.length, 0);
});

test('a second run while the dialog is open does nothing; the answer marks it', async () => {
  const w = world({ backups: [{ id: 'b1' }] });
  const run = w.start();
  let reply!: (yes: boolean) => void;
  const first = run(always, () => new Promise<boolean>((r) => (reply = r)));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal((await run(always, async () => assert.fail('second dialog'))).outcome, 'busy');
  reply(false);
  assert.equal((await first).outcome, 'declined');
  assert.equal(w.store.account?.offeredFor, 1000);
});
