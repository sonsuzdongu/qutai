// The page menu (src/components/menuFrame.ts) always fits the screen: under the address bar at the top, above it at
// the bottom, never under the system bars or the keyboard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { menuFrame } from '../../src/components/menuFrame.ts';

test('address bar at the top: starts under it, stops above the navigation bar', () => {
  assert.deepEqual(menuFrame(800, 40, 24, 0, 'top'), { top: 88, bottom: undefined, maxHeight: 800 - 88 - 24 - 8 });
});

test('address bar at the bottom: opens above it, stops under the status bar', () => {
  assert.deepEqual(menuFrame(800, 40, 24, 0, 'bottom'), { top: undefined, bottom: 72, maxHeight: 800 - 72 - 40 - 8 });
});

test('the keyboard takes the place of the navigation bar when it is open', () => {
  assert.equal(menuFrame(800, 40, 24, 300, 'top').maxHeight, 800 - 88 - 300 - 8);
  assert.equal(menuFrame(800, 40, 24, 300, 'bottom').bottom, 348);
});

test('never a negative height on a tiny window', () => {
  assert.equal(menuFrame(100, 40, 24, 300, 'top').maxHeight, 0);
  assert.equal(menuFrame(100, 40, 24, 300, 'bottom').maxHeight, 0);
});
