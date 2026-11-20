// A button whose action is still running ignores further presses (UI-28): a double tap on "Save" in the profile
// questions used to save the same fact twice.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPressGuard } from '../../src/ui/pressGuard.ts';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test('a second press while the first action runs is ignored', async () => {
  const states: boolean[] = [];
  const guard = createPressGuard((busy) => states.push(busy));
  const work = deferred();
  let runs = 0;
  const action = () => {
    runs++;
    return work.promise;
  };
  const first = guard.press(action);
  guard.press(action);
  guard.press(action);
  assert.equal(runs, 1);
  assert.equal(guard.isBusy(), true);
  work.resolve();
  await first;
  assert.equal(guard.isBusy(), false);
  guard.press(action);
  assert.equal(runs, 2);
  assert.deepEqual(states, [true, false, true]);
});

test('an action that returns nothing is never held', () => {
  const guard = createPressGuard();
  let runs = 0;
  guard.press(() => void runs++);
  guard.press(() => void runs++);
  assert.equal(runs, 2);
  assert.equal(guard.isBusy(), false);
});

test('a failed action frees the button and keeps its error', async () => {
  const guard = createPressGuard();
  const work = deferred();
  const pressed = guard.press(() => work.promise);
  work.reject(new Error('disk full'));
  await assert.rejects(pressed as Promise<void>, /disk full/);
  assert.equal(guard.isBusy(), false);
});
