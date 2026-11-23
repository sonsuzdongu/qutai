// A toast never sits under another bar (src/components/toastPlacement.ts, UI-48): the owner saw "Sekme kapatıldı ·
// Geri al" half behind the tab switcher's toolbar (0.1.16).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toastBottom } from '../../src/components/toastPlacement.ts';

test('with no bar: just above the navigation bar', () => {
  assert.equal(toastBottom(24, 0, 0), 24 + 16);
});

test('above the address bar at the bottom, whatever its measured height', () => {
  assert.equal(toastBottom(24, 0, 56), 24 + 56 + 16);
  // Large text makes the bar taller: the toast moves up with it.
  assert.equal(toastBottom(24, 0, 92), 24 + 92 + 16);
});

test('with the keyboard open: above the keyboard, and above the bar that rose with it', () => {
  assert.equal(toastBottom(24, 320, 0), 320 + 16);
  assert.equal(toastBottom(24, 320, 56), 320 + 56 + 16);
});

test('a negative or missing bar height counts as none', () => {
  assert.equal(toastBottom(24, 0, -5), 24 + 16);
});
