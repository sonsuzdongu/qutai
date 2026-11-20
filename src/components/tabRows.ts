/**
 * The tab switcher's list, as the rows a virtualised list draws (design record UI-32): tabs outside a group come in
 * rows of `columns` cards, so only the rows on screen (and a few around them) are mounted; a group stays one item with
 * its header, border and cards, because it is drawn as one bordered box and groups are short. Pure, so it is tested
 * without React Native.
 */
export type RowSection<T> = { key: string; groupId: string | null; tabs: T[] };

export type TabListRow<T> =
  | { kind: 'cards'; key: string; tabs: T[] }
  | { kind: 'group'; key: string; section: RowSection<T> };

export function tabListRows<T extends { id: string }>(sections: RowSection<T>[], columns: number): TabListRow<T>[] {
  const per = Math.max(1, Math.floor(columns));
  const rows: TabListRow<T>[] = [];
  for (const section of sections) {
    if (section.groupId) {
      rows.push({ kind: 'group', key: `group-${section.groupId}`, section });
      continue;
    }
    for (let i = 0; i < section.tabs.length; i += per) {
      const tabs = section.tabs.slice(i, i + per);
      // Keyed by the row's first tab, so a row keeps its cell while tabs after it change.
      rows.push({ kind: 'cards', key: `row-${tabs[0].id}`, tabs });
    }
  }
  return rows;
}

/** The row that holds this tab (the dragged card's row is drawn above the others). */
export function rowIndexOf<T extends { id: string }>(rows: TabListRow<T>[], tabId: string | null): number {
  if (!tabId) return -1;
  return rows.findIndex((row) =>
    row.kind === 'cards' ? row.tabs.some((tab) => tab.id === tabId) : row.section.tabs.some((tab) => tab.id === tabId),
  );
}
