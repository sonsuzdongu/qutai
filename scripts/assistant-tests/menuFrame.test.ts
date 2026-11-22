// The page menu (src/components/menuFrame.ts) always fits the screen: under the address bar at the top, above it at
// the bottom, never under the system bars or the keyboard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { menuFrame, menuMaxWidth, menuScrolls } from '../../src/components/menuFrame.ts';

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

test('the menu keeps clear of both side edges and the cut-out on a phone on its side', () => {
  assert.equal(menuMaxWidth(375, 0, 0), 375 - 16);
  assert.equal(menuMaxWidth(844, 47, 47), 844 - 94 - 16);
  assert.equal(menuMaxWidth(10, 0, 0), 0);
});

test('a menu that fits does not scroll, a pixel or two of rounding included', () => {
  assert.equal(menuScrolls(400, 400), false);
  assert.equal(menuScrolls(300, 400), false);
  assert.equal(menuScrolls(401.5, 400), false);
  assert.equal(menuScrolls(402, 400), false);
});

test('a menu taller than its room scrolls (long menu, large text, short screen)', () => {
  assert.equal(menuScrolls(403, 400), true);
  assert.equal(menuScrolls(900, 320), true);
});

test('until both sizes are measured it scrolls, so a long menu is never stuck', () => {
  assert.equal(menuScrolls(null, 400), true);
  assert.equal(menuScrolls(900, null), true);
  assert.equal(menuScrolls(null, null), true);
});
