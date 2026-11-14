/** What "Clear browsing data" removes. */
export type ClearRange = 'hour' | 'day' | 'week' | 'all';

export type ClearOptions = {
  range: ClearRange;
  history: boolean;
  cache: boolean;
  recentlyClosed: boolean;
  chats: boolean;
  activity: boolean;
  downloads: boolean;
  offlinePages: boolean;
};

const RANGE_MS: Record<ClearRange, number> = { hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, all: Infinity };

/** Start of the time range to clear (0 for everything). */
export function rangeStart(range: ClearRange, now = Date.now()): number {
  return range === 'all' ? 0 : now - RANGE_MS[range];
}
