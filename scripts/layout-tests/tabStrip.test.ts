// The address bar's default place on a Mac or an iPad (UI-73) and the desktop-style tab strip (UI-74): src/ui/tabStrip.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addressBarPositionFor,
  offersTabStrip,
  showTabStrip,
  STRIP_TAB_MAX,
  STRIP_TAB_MIN,
  stripItems,
  stripTabWidth,
  TAB_STRIP_MIN_WIDTH,
} from '../../src/ui/tabStrip';

test('a fresh install puts the bar at the top on a Mac or an iPad and at the bottom elsewhere', () => {
  assert.equal(addressBarPositionFor(null, true), 'top');
  assert.equal(addressBarPositionFor(undefined, true), 'top');
  assert.equal(addressBarPositionFor(null, false), 'bottom');
  assert.equal(addressBarPositionFor(null, offersTabStrip('mac')), 'top');
  assert.equal(addressBarPositionFor(null, offersTabStrip('tablet')), 'top');
  assert.equal(addressBarPositionFor(null, offersTabStrip('phone')), 'bottom');
  assert.equal(addressBarPositionFor(null, offersTabStrip('android')), 'bottom');
});

test('a stored choice is never changed, on a Mac, an iPad or a phone', () => {
  assert.equal(addressBarPositionFor('bottom', true), 'bottom');
  assert.equal(addressBarPositionFor('top', false), 'top');
  assert.equal(addressBarPositionFor('top', true), 'top');
});

test('an unknown stored value falls back to the device default', () => {
  assert.equal(addressBarPositionFor('auto', true), 'top');
  assert.equal(addressBarPositionFor('', false), 'bottom');
});

test('only a Mac or an iPad offers the strip, decided by the device, not the width', () => {
  assert.ok(offersTabStrip('mac'));
  assert.ok(offersTabStrip('tablet'));
  assert.ok(!offersTabStrip('phone'));
  assert.ok(!offersTabStrip('android'));
});

test('the strip shows on a wide Mac or iPad window with the bar at the top and the setting on', () => {
  assert.equal(TAB_STRIP_MIN_WIDTH, 700);
  assert.ok(showTabStrip({ width: 1200, height: 800 }, 'mac', 'top', true));
  assert.ok(showTabStrip({ width: 700, height: 600 }, 'mac', 'top', true));
  assert.ok(showTabStrip({ width: 834, height: 1194 }, 'tablet', 'top', true));
  assert.ok(showTabStrip({ width: 744, height: 1133 }, 'tablet', 'top', true));
});

test('the strip hides with the setting off, the bar at the bottom or a narrow window', () => {
  assert.ok(!showTabStrip({ width: 1200, height: 800 }, 'mac', 'top', false));
  assert.ok(!showTabStrip({ width: 1200, height: 800 }, 'mac', 'bottom', true));
  assert.ok(!showTabStrip({ width: 699, height: 800 }, 'mac', 'top', true));
  // iPad Split View half.
  assert.ok(!showTabStrip({ width: 507, height: 1024 }, 'tablet', 'top', true));
});

test('a phone or an Android device never gets the strip, whatever the width', () => {
  assert.ok(!showTabStrip({ width: 932, height: 430 }, 'phone', 'top', true));
  assert.ok(!showTabStrip({ width: 915, height: 412 }, 'android', 'top', true));
  assert.ok(!showTabStrip({ width: 1280, height: 800 }, 'android', 'top', true));
});

test('tabs share the room between the minimum and maximum width', () => {
  assert.equal(stripTabWidth(1000, 2), STRIP_TAB_MAX);
  assert.equal(stripTabWidth(1000, 6), 166);
  assert.equal(stripTabWidth(1000, 30), STRIP_TAB_MIN);
  assert.equal(stripTabWidth(1000, 0), STRIP_TAB_MAX);
});

const groups = [
  { id: 'g1', name: 'Work', color: '#1a73e8' },
  { id: 'g2', name: 'Trip', color: '#e8710a', collapsed: true },
];

test('plain tabs come in order, the active one marked', () => {
  const items = stripItems([{ id: 'a' }, { id: 'b' }], [], 'b');
  assert.deepEqual(
    items.map((i) => (i.kind === 'tab' ? `${i.tabId}${i.active ? '*' : ''}` : i.kind)),
    ['a', 'b*'],
  );
});

test("a group's label comes before its tabs, which keep its colour", () => {
  const items = stripItems(
    [{ id: 'a' }, { id: 'b', groupId: 'g1' }, { id: 'c', groupId: 'g1' }, { id: 'd' }],
    groups,
    'a',
  );
  assert.deepEqual(
    items.map((i) => (i.kind === 'tab' ? i.tabId : `[${i.name} ${i.count}]`)),
    ['a', '[Work 2]', 'b', 'c', 'd'],
  );
  const b = items.find((i) => i.kind === 'tab' && i.tabId === 'b');
  assert.equal(b?.kind === 'tab' && b.groupColor, '#1a73e8');
  const d = items.find((i) => i.kind === 'tab' && i.tabId === 'd');
  assert.equal(d?.kind === 'tab' && d.groupColor, null);
});

test('a collapsed group shows only its label, and the active tab if it is in it', () => {
  const tabs = [{ id: 'a' }, { id: 'x', groupId: 'g2' }, { id: 'y', groupId: 'g2' }];
  const names = (active: string) =>
    stripItems(tabs, groups, active).map((i) => (i.kind === 'tab' ? i.tabId : `[${i.name}${i.collapsed ? '-' : ''}]`));
  assert.deepEqual(names('a'), ['a', '[Trip-]']);
  assert.deepEqual(names('y'), ['a', '[Trip-]', 'y']);
});

test('a tab whose group is gone is a plain tab', () => {
  const items = stripItems([{ id: 'a', groupId: 'missing' }], groups, 'a');
  assert.equal(items.length, 1);
  assert.equal(items[0].kind === 'tab' && items[0].groupColor, null);
});

test('keys stay unique when a group is split in two runs', () => {
  const items = stripItems([{ id: 'a', groupId: 'g1' }, { id: 'b' }, { id: 'c', groupId: 'g1' }], groups, 'a');
  const keys = items.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length);
});
