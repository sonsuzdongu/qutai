import { Db } from './db';

export type OfflinePage = { id: string; url: string; title: string; uri: string; size: number | null; savedAt: number };

type Row = { id: string; url: string; title: string; uri: string; size: number | null; saved_at: number };

export async function listOfflinePages(db: Db): Promise<OfflinePage[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM offline_pages ORDER BY saved_at DESC', []);
  return rows.map((r) => ({ id: r.id, url: r.url, title: r.title, uri: r.uri, size: r.size, savedAt: r.saved_at }));
}

export async function addOfflinePage(db: Db, p: OfflinePage): Promise<void> {
  await db.runAsync('INSERT INTO offline_pages (id, url, title, uri, size, saved_at) VALUES (?, ?, ?, ?, ?, ?)', [
    p.id,
    p.url,
    p.title,
    p.uri,
    p.size,
    p.savedAt,
  ]);
}

export async function removeOfflinePage(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM offline_pages WHERE id = ?', [id]);
}
