// The address suggestions are drawn in a page-sized layer (UI-37, src/components/overlaySlot.ts): on Android a tap on
// the list, which hung outside the address bar's box, also pressed the web page behind it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOverlaySlot, omniboxOverlayFrame } from '../../src/components/overlaySlot.ts';

test('the slot shows the latest content and tells its listeners', () => {
  const slot = createOverlaySlot<string>();
  const owner = {};
  let calls = 0;
  const unsubscribe = slot.subscribe(() => calls++);
  assert.equal(slot.current(), null);
  slot.show(owner, 'a');
  slot.show(owner, 'ab');
  assert.equal(slot.current(), 'ab');
  assert.equal(calls, 2);
  slot.hide(owner);
  assert.equal(slot.current(), null);
  unsubscribe();
  slot.show(owner, 'x');
  assert.equal(calls, 3);
});

test('a late hide from a replaced owner leaves the new content alone', () => {
  const slot = createOverlaySlot<string>();
  const old = {};
  const next = {};
  slot.show(old, 'old');
  slot.show(next, 'new');
  slot.hide(old);
  assert.equal(slot.current(), 'new');
  slot.hide(next);
  assert.equal(slot.current(), null);
});

test('with the bar at the top, the backdrop fills the layer below the bar and the list hangs from it', () => {
  const frame = omniboxOverlayFrame(false, 52);
  assert.deepEqual(frame.backdrop, { top: 52, bottom: 0 });
  assert.deepEqual(frame.list, { top: 52 });
});

test('with the bar at the bottom, the backdrop fills the layer above the bar and the list stands on it', () => {
  const frame = omniboxOverlayFrame(true, 48);
  assert.deepEqual(frame.backdrop, { top: 0, bottom: 48 });
  assert.deepEqual(frame.list, { bottom: 48 });
});

test('the backdrop never has a fixed height that could run past the layer', () => {
  for (const bottom of [false, true]) {
    const { backdrop } = omniboxOverlayFrame(bottom, 48);
    assert.ok(backdrop.top !== undefined && backdrop.bottom !== undefined);
  }
});
