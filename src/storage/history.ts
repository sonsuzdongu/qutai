import type { Db } from './db';

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
