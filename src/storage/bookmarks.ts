import type { Db } from './db';

export type Bookmark = { url: string; title: string; createdAt: number };

type Row = { url: string; title: string; created_at: number };
const toBookmark = (r: Row): Bookmark => ({ url: r.url, title: r.title, createdAt: r.created_at });

/** Adding an existing URL refreshes its title but keeps its original position. */
export async function addBookmark(db: Db, url: string, title: string, now = Date.now()): Promise<void> {
  await db.runAsync(
    `INSERT INTO bookmarks (url, title, created_at) VALUES (?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET title = excluded.title`,
    [url, title, now],
  );
}

export async function removeBookmark(db: Db, url: string): Promise<void> {
  await db.runAsync('DELETE FROM bookmarks WHERE url = ?', [url]);
}

export async function isBookmarked(db: Db, url: string): Promise<boolean> {
  return !!(await db.getFirstAsync<{ url: string }>('SELECT url FROM bookmarks WHERE url = ?', [url]));
}

/** Newest first; `query` matches title or URL. */
export async function listBookmarks(db: Db, { query = '' }: { query?: string } = {}): Promise<Bookmark[]> {
  const like = `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM bookmarks WHERE title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\' ORDER BY created_at DESC`,
    [like, like],
  );
  return rows.map(toBookmark);
}
