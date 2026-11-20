// The tab switcher mounts only the rows on screen (UI-32): tabs outside a group in rows of `columns` cards, each group
// one item. Before, every card and thumbnail of every tab was mounted at once.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rowIndexOf, tabListRows } from '../../src/components/tabRows.ts';

const tabs = (...ids: string[]) => ids.map((id) => ({ id }));

test('ungrouped tabs come in rows of the column count; a group is one item', () => {
  const rows = tabListRows(
    [
      { key: 'tab-1', groupId: null, tabs: tabs('1', '2', '3', '4', '5') },
      { key: 'g', groupId: 'g', tabs: tabs('6', '7', '8') },
      { key: 'tab-9', groupId: null, tabs: tabs('9') },
    ],
    2,
  );
  assert.deepEqual(
    rows.map((r) => (r.kind === 'cards' ? r.tabs.map((x) => x.id).join(',') : `group:${r.section.tabs.length}`)),
    ['1,2', '3,4', '5', 'group:3', '9'],
  );
  assert.deepEqual(rows.map((r) => r.key), ['row-1', 'row-3', 'row-5', 'group-g', 'row-9']);
});

test('three columns on a phone on its side; at least one column whatever the width', () => {
  assert.equal(tabListRows([{ key: 'a', groupId: null, tabs: tabs('1', '2', '3', '4') }], 3).length, 2);
  assert.equal(tabListRows([{ key: 'a', groupId: null, tabs: tabs('1', '2') }], 0).length, 2);
});

test('the dragged tab is found in its row or its group', () => {
  const rows = tabListRows(
    [
      { key: 'tab-1', groupId: null, tabs: tabs('1', '2', '3') },
      { key: 'g', groupId: 'g', tabs: tabs('4') },
    ],
    2,
  );
  assert.equal(rowIndexOf(rows, '3'), 1);
  assert.equal(rowIndexOf(rows, '4'), 2);
  assert.equal(rowIndexOf(rows, null), -1);
});
