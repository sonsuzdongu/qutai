// Android: the address bar asks for the keyboard again after it got focus (UI-39, src/utils/keyboardNudge.ts): the
// first request was dropped when focus came from the web page, leaving a focused field with no keyboard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KEYBOARD_RETRY_MS, nudgeKeyboard } from '../../src/utils/keyboardNudge.ts';

function fakeTimers() {
  const pending = new Map<number, { run: () => void; ms: number }>();
  let next = 1;
  return {
    setTimer: (run: () => void, ms: number) => {
      const id = next++;
      pending.set(id, { run, ms });
      return id;
    },
    clearTimer: (id: unknown) => {
      pending.delete(id as number);
    },
    /** Runs every timer due by `ms`, in order. */
    advanceTo(ms: number) {
      for (const [id, timer] of [...pending].sort((a, b) => a[1].ms - b[1].ms)) {
        if (timer.ms > ms) continue;
        pending.delete(id);
        timer.run();
      }
    },
    count: () => pending.size,
  };
}

test('asks again at each check while the keyboard stays hidden', () => {
  const timers = fakeTimers();
  let shows = 0;
  nudgeKeyboard({ isFocused: () => true, keyboardShown: () => false, show: () => shows++, ...timers });
  timers.advanceTo(10_000);
  assert.equal(shows, KEYBOARD_RETRY_MS.length);
});

test('stops asking once the keyboard is showing', () => {
  const timers = fakeTimers();
  let shown = false;
  let shows = 0;
  nudgeKeyboard({
    isFocused: () => true,
    keyboardShown: () => shown,
    show: () => {
      shows++;
      shown = true;
    },
    ...timers,
  });
  timers.advanceTo(10_000);
  assert.equal(shows, 1);
});

test('a page hiding the keyboard after it opened gets it asked for again', () => {
  const timers = fakeTimers();
  let shown = true;
  let shows = 0;
  nudgeKeyboard({ isFocused: () => true, keyboardShown: () => shown, show: () => shows++, ...timers });
  timers.advanceTo(KEYBOARD_RETRY_MS[0]);
  assert.equal(shows, 0);
  shown = false;
  timers.advanceTo(10_000);
  assert.ok(shows >= 1);
});

test('nothing is asked once the field lost focus or the nudge was cancelled', () => {
  const timers = fakeTimers();
  let shows = 0;
  nudgeKeyboard({ isFocused: () => false, keyboardShown: () => false, show: () => shows++, ...timers });
  timers.advanceTo(10_000);
  assert.equal(shows, 0);

  const later = fakeTimers();
  const cancel = nudgeKeyboard({ isFocused: () => true, keyboardShown: () => false, show: () => shows++, ...later });
  cancel();
  assert.equal(later.count(), 0);
  later.advanceTo(10_000);
  assert.equal(shows, 0);
});

test('the checks come soon and end within a second', () => {
  assert.ok(KEYBOARD_RETRY_MS[0] <= 100);
  assert.ok(KEYBOARD_RETRY_MS[KEYBOARD_RETRY_MS.length - 1] <= 1000);
});
