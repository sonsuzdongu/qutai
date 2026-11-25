/**
 * Moving through the address bar's suggestions with the arrow keys (UI-88 in docs/design/27-interface.md), as in a
 * desktop browser's address bar. Pure: tested with node:test (scripts/navigation-tests/omniboxSelection.test.ts).
 *
 * Rows are numbered in the order the list shows them, top to bottom; null is "no row": the field with what was typed.
 * The keys move the highlight the way they point on screen. With the list under the address bar, ↓ goes from the
 * field into the list (its first row) and on down, and ↑ goes back up to the field. With the address bar at the bottom
 * the list opens above it, so ↑ goes from the field into the list (its last row, the one next to the bar) and on up,
 * and ↓ comes back down to the field. The highlight stops at the far end of the list (no wrapping).
 */

export type ArrowKey = 'up' | 'down';

export function moveHighlight(current: number | null, count: number, key: ArrowKey, listAbove: boolean): number | null {
  if (count <= 0) return null;
  // A highlight past the end (the list got shorter) counts as none.
  const at = current !== null && current >= 0 && current < count ? current : null;
  const intoList = listAbove ? 'up' : 'down';
  if (at === null) {
    if (key !== intoList) return null;
    return listAbove ? count - 1 : 0;
  }
  // Away from the bar: further into the list, stopping at its far end.
  if (key === intoList) return listAbove ? Math.max(0, at - 1) : Math.min(count - 1, at + 1);
  // Towards the bar: the row next to the bar goes back to the field.
  const nearBar = listAbove ? count - 1 : 0;
  if (at === nearBar) return null;
  return listAbove ? at + 1 : at - 1;
}

/** One row as the keys see it: what the field shows while it is highlighted. */
export type SuggestionRowText = { fill: string };

/** What the field shows: the highlighted row's text (as Chrome does), or what was typed. */
export function fieldText(typed: string, rows: SuggestionRowText[], highlight: number | null): string {
  if (highlight === null || highlight < 0 || highlight >= rows.length) return typed;
  return rows[highlight].fill;
}
