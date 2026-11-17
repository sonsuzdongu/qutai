// Keeping an own-key AI request alive while Qutai is in the background (src/device/requestHoldLogic.ts): which
// requests hold, one native hold shared by requests in flight at once, and the hold ending however the request ends.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REQUEST_HOLD_MAX_MS, createRequestHold, mayHold } from '../../src/device/requestHoldLogic.ts';

const own = { platform: 'android' as const, ownKey: true, incognito: false };

test('own-key requests hold on Android and iOS; Qutai Credits, other platforms and Android incognito never do', () => {
  assert.equal(mayHold(own), true);
  assert.equal(mayHold({ ...own, platform: 'ios' }), true);
  assert.equal(mayHold({ ...own, platform: 'ios', incognito: true }), true, 'iOS background time shows nothing');
  assert.equal(mayHold({ ...own, incognito: true }), false, 'Android would show a notification');
  assert.equal(mayHold({ ...own, ownKey: false }), false);
  assert.equal(mayHold({ ...own, platform: 'ios', ownKey: false }), false);
  assert.equal(mayHold({ ...own, platform: 'other' }), false);
  assert.equal(REQUEST_HOLD_MAX_MS, 180_000, 'matches AgentHub.REQUEST_HOLD_MS and the iOS cap');
});

test('the native side hears true at the first request and false after the last; ending twice is harmless', () => {
  const calls: boolean[] = [];
  const hold = createRequestHold((v) => calls.push(v));
  const a = hold.begin(own);
  const b = hold.begin({ ...own, platform: 'android' });
  assert.deepEqual(calls, [true]);
  a();
  a();
  assert.deepEqual(calls, [true]);
  assert.equal(hold.inFlight(), 1);
  b();
  assert.deepEqual(calls, [true, false]);
  assert.equal(hold.inFlight(), 0);
  // Requests that may not hold never reach the native side.
  hold.begin({ ...own, ownKey: false })();
  hold.begin({ ...own, incognito: true })();
  assert.deepEqual(calls, [true, false]);
});

test('around: the hold ends when the request succeeds, fails or is aborted', async () => {
  const calls: boolean[] = [];
  const hold = createRequestHold((v) => calls.push(v));
  assert.equal(await hold.around(own, async () => 'answer'), 'answer');
  await assert.rejects(hold.around(own, async () => Promise.reject(new Error('cut'))), /cut/);
  const abort = new AbortController();
  const pending = hold.around(own, () => new Promise((_, reject) => abort.signal.addEventListener('abort', () => reject(new Error('aborted')))));
  assert.equal(hold.inFlight(), 1);
  abort.abort();
  await assert.rejects(pending, /aborted/);
  assert.deepEqual(calls, [true, false, true, false, true, false]);
  assert.equal(hold.inFlight(), 0);
});
