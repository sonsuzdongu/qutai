import { foldForSearch } from '../browser/tabSearch';
import { hostOf } from '../i18n/format';
import type { Db } from './db';
import { hiddenTopSites } from './topSites';

export type HistoryEntry = { id: number; url: string; title: string; visitedAt: number };

/** Reloads and late title updates within this window update the latest entry instead of adding one. */
const MERGE_WINDOW_MS = 30 * 60 * 1000;
const KEEP_DAYS = 90;

type Row = { id: number; url: string; title: string; visited_at: number };
const toEntry = (r: Row): HistoryEntry => ({ id: r.id, url: r.url, title: r.title, visitedAt: r.visited_at });

export function isRecordable(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function recordVisit(db: Db, url: string, title: string, now = Date.now()): Promise<void> {
  if (!isRecordable(url)) return;
  const last = await db.getFirstAsync<Row>('SELECT * FROM history ORDER BY visited_at DESC, id DESC LIMIT 1', []);
  if (last && last.url === url && now - last.visited_at < MERGE_WINDOW_MS) {
    await db.runAsync('UPDATE history SET title = ?, visited_at = ? WHERE id = ?', [title || last.title, now, last.id]);
    return;
  }
  await db.runAsync('INSERT INTO history (url, title, visited_at) VALUES (?, ?, ?)', [url, title, now]);
}

/** Newest first. `query` matches title or URL; `before` pages through older entries. */
export async function listHistory(
  db: Db,
  { query = '', limit = 50, before }: { query?: string; limit?: number; before?: number } = {},
): Promise<HistoryEntry[]> {
  const like = `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM history
     WHERE (title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\') AND visited_at < ?
     ORDER BY visited_at DESC, id DESC LIMIT ?`,
    [like, like, before ?? Number.MAX_SAFE_INTEGER, limit],
  );
  return rows.map(toEntry);
}

export async function deleteHistoryEntry(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM history WHERE id = ?', [id]);
}

export async function clearHistory(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM history', []);
}

export async function pruneHistory(db: Db, now = Date.now()): Promise<void> {
  await db.runAsync('DELETE FROM history WHERE visited_at < ?', [now - KEEP_DAYS * 24 * 60 * 60 * 1000]);
}

export type HistoryMatch = { url: string; title: string; lastVisit: number; visits: number };

const SEARCH_SCAN_ROWS = 5000;

/**
 * Pages in a time range whose title or address contains every word of the query (any case,
 * Turkish İ/ı folded), one entry per address with its visit count, most recent first. SQLite's
 * LIKE only folds ASCII letters, so matching happens here.
 */
export async function searchHistory(
  db: Db,
  {
    query,
    from = 0,
    to = Number.MAX_SAFE_INTEGER,
    limit = 20,
  }: { query: string; from?: number; to?: number; limit?: number },
): Promise<HistoryMatch[]> {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM history WHERE visited_at >= ? AND visited_at <= ? ORDER BY visited_at DESC, id DESC LIMIT ?',
    [from, to, SEARCH_SCAN_ROWS],
  );
  const byUrl = new Map<string, HistoryMatch>();
  for (const row of rows) {
    const text = foldForSearch(`${row.title} ${row.url}`);
    if (!words.every((w) => text.includes(w))) continue;
    const seen = byUrl.get(row.url);
    if (seen) seen.visits++;
    else byUrl.set(row.url, { url: row.url, title: row.title, lastVisit: row.visited_at, visits: 1 });
  }
  return [...byUrl.values()].slice(0, limit);
}

export type SiteVisits = { host: string; visits: number; lastVisit: number; url: string; title: string };

/**
 * Sites (hosts, without "www.") in a time range ranked by visits, with each site's latest page, counting only
 * visits whose title or address contains every word of the query. Hosts the user removed from the new tab page's
 * most visited sites are left out here too.
 */
export async function mostVisitedSites(
  db: Db,
  { query, from = 0, to = Number.MAX_SAFE_INTEGER, limit = 15 }: { query: string; from?: number; to?: number; limit?: number },
): Promise<SiteVisits[]> {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  const hidden = new Set(await hiddenTopSites(db));
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM history WHERE visited_at >= ? AND visited_at <= ? ORDER BY visited_at DESC, id DESC LIMIT ?',
    [from, to, SEARCH_SCAN_ROWS],
  );
  const byHost = new Map<string, SiteVisits>();
  for (const row of rows) {
    const host = hostOf(row.url);
    if (!host || hidden.has(host)) continue;
    if (words.length && !words.every((w) => foldForSearch(`${row.title} ${row.url}`).includes(w))) continue;
    const site = byHost.get(host);
    // Rows are newest first, so the first one seen for a host is its latest page.
    if (site) site.visits++;
    else byHost.set(host, { host, visits: 1, lastVisit: row.visited_at, url: row.url, title: row.title });
  }
  return [...byHost.values()].sort((a, b) => b.visits - a.visits || b.lastVisit - a.lastVisit).slice(0, limit);
}

/** Deletes visits from `from` on (0 deletes everything). */
export async function deleteHistorySince(db: Db, from: number): Promise<void> {
  await db.runAsync('DELETE FROM history WHERE visited_at >= ?', [from]);
}
