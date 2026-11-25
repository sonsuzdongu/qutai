// The arrow keys in the address bar's suggestions (UI-88): src/browser/omniboxSelection.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fieldText, moveHighlight } from '../../src/browser/omniboxSelection';

test('list under the bar: ↓ enters at the first row and goes down, stopping at the last', () => {
  assert.equal(moveHighlight(null, 4, 'down', false), 0);
  assert.equal(moveHighlight(0, 4, 'down', false), 1);
  assert.equal(moveHighlight(3, 4, 'down', false), 3);
});

test('list under the bar: ↑ goes back up, and from the first row back to the field', () => {
  assert.equal(moveHighlight(2, 4, 'up', false), 1);
  assert.equal(moveHighlight(0, 4, 'up', false), null);
  assert.equal(moveHighlight(null, 4, 'up', false), null);
});

test('list above the bar (bar at the bottom): ↑ enters at the row next to the bar and goes up', () => {
  assert.equal(moveHighlight(null, 4, 'up', true), 3);
  assert.equal(moveHighlight(3, 4, 'up', true), 2);
  assert.equal(moveHighlight(0, 4, 'up', true), 0);
});

test('list above the bar: ↓ comes back down, and from the row next to the bar back to the field', () => {
  assert.equal(moveHighlight(1, 4, 'down', true), 2);
  assert.equal(moveHighlight(3, 4, 'down', true), null);
  assert.equal(moveHighlight(null, 4, 'down', true), null);
});

test('no rows: no highlight; a highlight past a shorter list counts as none', () => {
  assert.equal(moveHighlight(null, 0, 'down', false), null);
  assert.equal(moveHighlight(2, 0, 'up', true), null);
  assert.equal(moveHighlight(5, 3, 'down', false), 0);
  assert.equal(moveHighlight(5, 3, 'up', true), 2);
});

test('the field shows the highlighted row, else what was typed', () => {
  const rows = [{ fill: 'ask words' }, { fill: 'words' }, { fill: 'https://example.com/' }];
  assert.equal(fieldText('words', rows, null), 'words');
  assert.equal(fieldText('words', rows, 2), 'https://example.com/');
  assert.equal(fieldText('words', rows, 7), 'words');
});
