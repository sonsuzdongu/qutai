/**
 * A tab whose page failed because the phone was offline reloads by itself when the connection returns: once per
 * return, and only while it still shows that error (docs/design/14-tabs-and-conversations.md). Pure, tested in
 * scripts/navigation-tests/.
 */
export type OfflineCandidate = {
  asleep: boolean;
  offlineErrorUrl: string | null;
  loadError: { kind: string } | null;
};

export function tabsToReloadOnReconnect<T extends OfflineCandidate>(tabs: T[]): T[] {
  return tabs.filter((t) => !t.asleep && t.offlineErrorUrl !== null && t.loadError?.kind === 'offline');
}
