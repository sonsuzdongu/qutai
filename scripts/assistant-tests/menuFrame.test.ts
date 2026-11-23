// The page menu (src/components/menuFrame.ts) always fits the screen: under the address bar at the top, above it at
// the bottom, never under the system bars or the keyboard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { menuFrame, menuMaxWidth, menuScrolls, menuWidth } from '../../src/components/menuFrame.ts';

test('address bar at the top: the room starts under it and stops above the navigation bar', () => {
  assert.deepEqual(menuFrame(40, 24, 0, 'top'), { top: 88, bottom: 24 + 8, justify: 'flex-start' });
});

test('address bar at the bottom: the room ends above it and reaches up to the status bar', () => {
  assert.deepEqual(menuFrame(40, 24, 0, 'bottom'), { top: 40 + 8, bottom: 72, justify: 'flex-end' });
});

test('the keyboard takes the place of the navigation bar when it is open', () => {
  assert.equal(menuFrame(40, 24, 300, 'top').bottom, 300 + 8);
  assert.equal(menuFrame(40, 24, 300, 'bottom').bottom, 348);
  // A closed keyboard (0) leaves the navigation bar's inset.
  assert.equal(menuFrame(40, 24, 0, 'bottom').bottom, 72);
});

test('the menu has a fixed width, so its rows are measured at the width they are drawn at (UI-47)', () => {
  // Sized to its content, the menu took no width from its list (a ScrollView) and React Native measured the rows as
  // single lines; labels that then wrapped at the real width were taller than measured: the last row was cut and the
  // list scrolled with free page above (the owner's ColorOS phone, 0.1.16). A number, the same on every screen that
  // has room for it, never "as wide as the content".
  assert.equal(menuWidth(411, 0, 0), 230);
  assert.equal(menuWidth(1280, 0, 0), 230);
  assert.equal(typeof menuWidth(360, 0, 0), 'number');
  // A narrow window, or a phone on its side with the camera cut-out: never past the side edges.
  assert.equal(menuWidth(240, 0, 0), 240 - 16);
  assert.equal(menuWidth(300, 47, 47), 300 - 94 - 16);
});

test('the room reaches up to the status bar whatever height the window reports (UI-47)', () => {
  // Only distances from the modal's edges go in: no window or modal height can make it shorter.
  assert.equal(menuFrame.length, 4);
  // Owner's phone: status bar ~43 dp, navigation bar ~50 dp, bar at the bottom, 913 dp screen.
  const { top, bottom } = menuFrame(43, 50, 0, 'bottom');
  assert.equal(913 - top - bottom, 913 - (43 + 8) - (50 + 48));
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
