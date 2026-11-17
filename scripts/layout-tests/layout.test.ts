// Layout decisions by window size (src/ui/layout.ts, docs/landscape.md), and the rule that every Modal allows all
// orientations on iOS (src/ui/AppModal.tsx).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  answerCardMaxHeight,
  isShort,
  panelHeaderHeight,
  panelWidth,
  previewRatio,
  qrFrameSize,
  screenshotStillValid,
  tabCardWidth,
  tabColumns,
  windowKey,
} from '../../src/ui/layout.ts';

const PHONE = { width: 360, height: 640 };
const PHONE_SIDE = { width: 640, height: 360 };
const LONG_PHONE_SIDE = { width: 800, height: 360 };
const IPHONE_SIDE = { width: 852, height: 393 };
const TABLET = { width: 834, height: 1194 };
const TABLET_SIDE = { width: 1194, height: 834 };
const SPLIT_NARROW = { width: 320, height: 1024 };

test('panel upright is as before: 88 % of the width up to 420', () => {
  assert.equal(panelWidth(PHONE), 317);
  assert.equal(panelWidth({ width: 430, height: 932 }), 378);
  assert.equal(panelWidth(TABLET), 420);
  assert.equal(panelWidth(SPLIT_NARROW), 282);
});

test('panel on a phone on its side covers about half, leaving the page beside it', () => {
  for (const w of [PHONE_SIDE, LONG_PHONE_SIDE, IPHONE_SIDE]) {
    const width = panelWidth(w);
    assert.ok(width >= 320 && width <= 420, `${width}`);
    assert.ok(w.width - width >= w.width * 0.45, `page keeps ${w.width - width} of ${w.width}`);
  }
  assert.equal(panelWidth(PHONE_SIDE), 320);
  assert.equal(panelWidth(LONG_PHONE_SIDE), 400);
  assert.equal(panelWidth(TABLET_SIDE), 420);
});

test('panel never wider than 88 % in a small wide window', () => {
  assert.equal(panelWidth({ width: 340, height: 300 }), 299);
});

test('short windows get the compact panel header', () => {
  assert.equal(isShort(PHONE_SIDE), true);
  assert.equal(isShort(PHONE), false);
  assert.equal(panelHeaderHeight(PHONE_SIDE), 44);
  assert.equal(panelHeaderHeight(TABLET_SIDE), 56);
});

test('tab columns follow the width', () => {
  assert.equal(tabColumns(360), 2);
  assert.equal(tabColumns(599), 2);
  assert.equal(tabColumns(640), 3);
  assert.equal(tabColumns(834), 3);
  assert.equal(tabColumns(1194), 4);
  // Upright phone cards are as wide as before: (360 - 24 - 12) / 2.
  assert.equal(tabCardWidth(360, 2, 12, 12), 162);
  const three = tabCardWidth(640, 3, 12, 12);
  assert.ok(three * 3 + 12 * 2 + 12 * 2 <= 640);
});

test('preview shape follows the window, within bounds', () => {
  assert.equal(previewRatio(PHONE), 1.25);
  assert.equal(previewRatio(PHONE_SIDE), 0.6);
  assert.ok(Math.abs(previewRatio(TABLET_SIDE) - 834 / 1194) < 1e-9);
  assert.equal(previewRatio({ width: 0, height: 0 }), 1.25);
});

test('answer card fits a phone on its side', () => {
  assert.equal(answerCardMaxHeight(640, 12, 24), 360);
  const h = answerCardMaxHeight(360, 12, 24);
  assert.ok(h + 12 + 24 <= 360, `${h}`);
  assert.equal(answerCardMaxHeight(200, 100, 24), 120);
});

test('QR frame leaves room for the hint and Close on a short screen', () => {
  assert.equal(qrFrameSize(PHONE), 180);
  assert.equal(qrFrameSize({ width: 430, height: 932 }), 215);
  assert.equal(qrFrameSize(TABLET), 240);
  assert.equal(qrFrameSize(PHONE_SIDE), 180);
});

test('a screenshot taken before the window turned no longer maps onto the page', () => {
  const taken = windowKey(PHONE);
  assert.equal(screenshotStillValid(taken, PHONE), true);
  assert.equal(screenshotStillValid(taken, { width: 360.2, height: 639.8 }), true);
  assert.equal(screenshotStillValid(taken, PHONE_SIDE), false);
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test('no Modal from react-native outside AppModal (iOS would force portrait)', () => {
  const root = new URL('../../', import.meta.url).pathname;
  const offenders = [...sources(join(root, 'src')), join(root, 'App.tsx')].filter((file) => {
    if (file.endsWith('src/ui/AppModal.tsx')) return false;
    const text = readFileSync(file, 'utf8');
    const imports = text.match(/import\s*\{[^}]*\}\s*from\s*'react-native'/g) ?? [];
    return imports.some((line) => /[{,\s]Modal[,\s}]/.test(line));
  });
  assert.deepEqual(offenders, []);
});
