// Filled icons stay filled on Android (src/ui/iconNames.ts): Material Symbols draws outlined unless the filled font is
// used, so exactly the icons whose SF Symbol is a `.fill` one get it, and the outlined ones keep their look.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ICONS, iconFilled, type IconName } from '../../src/ui/iconNames.ts';

const names = Object.keys(ICONS) as IconName[];

test('the stop button and a saved bookmark are filled; the unsaved bookmark is not', () => {
  assert.equal(iconFilled('stop'), true);
  assert.equal(iconFilled('bookmarked'), true);
  assert.equal(iconFilled('bookmark'), false);
});

test('every icon filled on iOS is filled on Android, and no other', () => {
  for (const name of names) assert.equal(iconFilled(name), ICONS[name].ios.endsWith('.fill'), name);
  assert.ok(names.filter(iconFilled).length > 5);
});

test('outlined icons stay outlined', () => {
  for (const name of ['back', 'more', 'close', 'settings', 'trash', 'stopReading'] as IconName[])
    assert.equal(iconFilled(name), false, name);
});
