import type { ExportBookmark, ExportFolder, ImportPlan } from './bookmarkHtml';
import type { Db, SqlValue } from './db';

/** `folderId` null: top level. A URL is bookmarked at most once, so it is in exactly one folder. */
export type Bookmark = { url: string; title: string; createdAt: number; folderId: number | null };
export type BookmarkFolder = { id: number; parentId: number | null; title: string; createdAt: number };
/** A folder as listed inside its parent, with how many things are directly in it. */
export type FolderEntry = BookmarkFolder & { items: number };

type Row = { url: string; title: string; created_at: number; folder_id: number | null };
const toBookmark = (r: Row): Bookmark => ({
  url: r.url,
  title: r.title,
  createdAt: r.created_at,
  folderId: r.folder_id ?? null,
});
type FolderRow = { id: number; parent_id: number | null; title: string; created_at: number };
const toFolder = (r: FolderRow): BookmarkFolder => ({
  id: r.id,
  parentId: r.parent_id ?? null,
  title: r.title,
  createdAt: r.created_at,
});

const like = (query: string) => `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Adding an existing URL refreshes its title but keeps its original position and folder; a new one goes to
 * the top level (the page menu's one-tap bookmark).
 */
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

export async function updateBookmark(
  db: Db,
  url: string,
  { title, folderId }: { title?: string; folderId?: number | null },
): Promise<void> {
  if (title !== undefined) await db.runAsync('UPDATE bookmarks SET title = ? WHERE url = ?', [title, url]);
  if (folderId !== undefined) await db.runAsync('UPDATE bookmarks SET folder_id = ? WHERE url = ?', [folderId, url]);
}

/**
 * Newest first. With a `query`, title or URL matches in every folder; otherwise `folderId` picks one
 * folder (null: the top level) or, left out, all bookmarks.
 */
export async function listBookmarks(
  db: Db,
  { query = '', folderId }: { query?: string; folderId?: number | null } = {},
): Promise<Bookmark[]> {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (query.trim()) {
    where.push(`(title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\')`);
    params.push(like(query), like(query));
  } else if (folderId === null) {
    where.push('folder_id IS NULL');
  } else if (folderId !== undefined) {
    where.push('folder_id = ?');
    params.push(folderId);
  }
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM bookmarks ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`,
    params,
  );
  return rows.map(toBookmark);
}

// ---------- Folders ----------

/** Every folder, for the folder picker, paths and export. */
export async function allFolders(db: Db): Promise<BookmarkFolder[]> {
  const rows = await db.getAllAsync<FolderRow>('SELECT * FROM bookmark_folders ORDER BY title COLLATE NOCASE', []);
  return rows.map(toFolder);
}

/** The folders directly inside `parentId` (null: top level), alphabetically, with their item counts. */
export async function listFolders(db: Db, parentId: number | null): Promise<FolderEntry[]> {
  const rows = await db.getAllAsync<FolderRow & { items: number }>(
    `SELECT f.*,
       (SELECT COUNT(*) FROM bookmarks b WHERE b.folder_id = f.id) +
       (SELECT COUNT(*) FROM bookmark_folders c WHERE c.parent_id = f.id) AS items
     FROM bookmark_folders f WHERE f.parent_id IS ? ORDER BY f.title COLLATE NOCASE`,
    [parentId],
  );
  return rows.map((r) => ({ ...toFolder(r), items: r.items }));
}

export async function createFolder(db: Db, title: string, parentId: number | null, now = Date.now()): Promise<number> {
  const result = await db.runAsync('INSERT INTO bookmark_folders (parent_id, title, created_at) VALUES (?, ?, ?)', [
    parentId,
    title,
    now,
  ]);
  return result.lastInsertRowId;
}

export async function renameFolder(db: Db, id: number, title: string): Promise<void> {
  await db.runAsync('UPDATE bookmark_folders SET title = ? WHERE id = ?', [title, id]);
}

/** Moves a folder; moving it into itself or one of its own subfolders is refused (returns false). */
export async function moveFolder(db: Db, id: number, parentId: number | null): Promise<boolean> {
  if (parentId !== null && (await subtreeIds(db, id)).includes(parentId)) return false;
  await db.runAsync('UPDATE bookmark_folders SET parent_id = ? WHERE id = ?', [parentId, id]);
  return true;
}

const SUBTREE = `WITH RECURSIVE subtree(id) AS (
  SELECT ? UNION SELECT f.id FROM bookmark_folders f JOIN subtree s ON f.parent_id = s.id
)`;

async function subtreeIds(db: Db, id: number): Promise<number[]> {
  const rows = await db.getAllAsync<{ id: number }>(`${SUBTREE} SELECT id FROM subtree`, [id]);
  return rows.map((r) => r.id);
}

/** What deleting a folder would take with it: bookmarks and subfolders at any depth. */
export async function folderContents(db: Db, id: number): Promise<{ bookmarks: number; folders: number }> {
  const row = await db.getFirstAsync<{ bookmarks: number; folders: number }>(
    `${SUBTREE} SELECT
       (SELECT COUNT(*) FROM bookmarks WHERE folder_id IN (SELECT id FROM subtree)) AS bookmarks,
       (SELECT COUNT(*) FROM subtree) - 1 AS folders`,
    [id],
  );
  return { bookmarks: row?.bookmarks ?? 0, folders: row?.folders ?? 0 };
}

/** Deletes a folder with everything in it. */
export async function deleteFolder(db: Db, id: number): Promise<void> {
  const ids = await subtreeIds(db, id);
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const marks = chunk.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM bookmarks WHERE folder_id IN (${marks})`, chunk);
      await db.runAsync(`DELETE FROM bookmark_folders WHERE id IN (${marks})`, chunk);
    }
  });
}

// ---------- Import and export ----------

export async function bookmarkedUrls(db: Db): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ url: string }>('SELECT url FROM bookmarks', []);
  return new Set(rows.map((r) => r.url));
}

const BATCH = 200;

/**
 * Writes an import plan under one new top-level folder, all in one transaction (folders one by one, since
 * their ids are needed, bookmarks in multi-row batches); nothing is written if any step fails.
 * Returns the new folder's id.
 */
export async function importBookmarks(db: Db, plan: ImportPlan, title: string, now = Date.now()): Promise<number> {
  let topId = 0;
  await db.withTransactionAsync(async () => {
    topId = await createFolder(db, title, null, now);
    const ids: number[] = [];
    for (const folder of plan.folders) {
      ids.push(await createFolder(db, folder.title, folder.parent < 0 ? topId : ids[folder.parent], folder.createdAt));
    }
    for (let i = 0; i < plan.bookmarks.length; i += BATCH) {
      const batch = plan.bookmarks.slice(i, i + BATCH);
      const rows = batch.map(() => '(?, ?, ?, ?)').join(', ');
      await db.runAsync(
        `INSERT OR IGNORE INTO bookmarks (url, title, created_at, folder_id) VALUES ${rows}`,
        batch.flatMap((b) => [b.url, b.title, b.createdAt, b.folder < 0 ? topId : ids[b.folder]]),
      );
    }
  });
  return topId;
}

export async function exportData(db: Db): Promise<{ folders: ExportFolder[]; bookmarks: ExportBookmark[] }> {
  const [folders, bookmarks] = await Promise.all([
    db.getAllAsync<FolderRow>('SELECT * FROM bookmark_folders ORDER BY created_at, id', []),
    db.getAllAsync<Row>('SELECT * FROM bookmarks ORDER BY created_at', []),
  ]);
  return { folders: folders.map(toFolder), bookmarks: bookmarks.map(toBookmark) };
}
