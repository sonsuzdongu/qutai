import { openDatabaseAsync } from 'expo-sqlite';

export type SqlValue = string | number | null;

/** The subset of expo-sqlite used by the app; kept small so storage code can be tested against other SQLite drivers. */
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  /** Commits if `task` resolves, rolls back if it throws. Not exclusive: queries started meanwhile join it. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * Each entry upgrades the schema (or the data) by one version: SQL, or a function for changes SQL can't
 * express safely. Never edit a shipped migration; append a new one.
 */
const MIGRATIONS: (string | ((db: Db) => Promise<void>))[] = [
  `CREATE TABLE history (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     url TEXT NOT NULL,
     title TEXT NOT NULL DEFAULT '',
     visited_at INTEGER NOT NULL
   );
   CREATE INDEX history_visited_at ON history (visited_at DESC);
   CREATE INDEX history_url ON history (url);
   CREATE TABLE bookmarks (
     url TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL DEFAULT '',
     created_at INTEGER NOT NULL
   );
   CREATE TABLE kv (
     key TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );`,
  // Ids are random strings and rows carry updated_at, so memories can later sync with a server.
  `CREATE TABLE memories (
     id TEXT PRIMARY KEY NOT NULL,
     text TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
  `CREATE TABLE site_permissions (
     host TEXT PRIMARY KEY NOT NULL,
     level TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE TABLE agent_actions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     at INTEGER NOT NULL,
     host TEXT,
     url TEXT,
     tool TEXT NOT NULL,
     description TEXT NOT NULL,
     ok INTEGER NOT NULL
   );
   CREATE INDEX agent_actions_at ON agent_actions (at DESC);`,
  `CREATE TABLE downloads (
     id TEXT PRIMARY KEY NOT NULL,
     url TEXT NOT NULL,
     name TEXT NOT NULL,
     uri TEXT NOT NULL,
     size INTEGER,
     created_at INTEGER NOT NULL
   );`,
  `CREATE TABLE offline_pages (
     id TEXT PRIMARY KEY NOT NULL,
     url TEXT NOT NULL,
     title TEXT NOT NULL,
     uri TEXT NOT NULL,
     size INTEGER,
     saved_at INTEGER NOT NULL
   );`,
  moveGroupedTabChatsToGroups,
  // Bookmark folders, nested through parent_id (NULL: top level). A URL is still bookmarked at most once
  // (bookmarks.url stays the key), so it lives in exactly one folder; existing bookmarks stay at the top.
  `CREATE TABLE bookmark_folders (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     parent_id INTEGER,
     title TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX bookmark_folders_parent ON bookmark_folders (parent_id);
   ALTER TABLE bookmarks ADD COLUMN folder_id INTEGER;
   CREATE INDEX bookmarks_folder ON bookmarks (folder_id);`,
  // Whether a site itself may use the user's location ('allow' or 'block'; no row means ask).
  // Kept apart from site_permissions, which say what the assistant may do on a site.
  `CREATE TABLE site_location (
     host TEXT PRIMARY KEY NOT NULL,
     setting TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
  // "What was sent to the AI": the outline of each request (no content, see storage/sentLog.ts).
  `CREATE TABLE ai_requests (
     id TEXT PRIMARY KEY NOT NULL,
     at INTEGER NOT NULL,
     provider TEXT NOT NULL,
     model TEXT NOT NULL,
     host TEXT,
     conversation TEXT NOT NULL,
     items TEXT NOT NULL,
     total_chars INTEGER NOT NULL,
     images INTEGER NOT NULL,
     resent_turns INTEGER NOT NULL,
     resent_chars INTEGER NOT NULL,
     web_search INTEGER NOT NULL,
     research INTEGER NOT NULL
   );
   CREATE INDEX ai_requests_at ON ai_requests (at DESC);
   CREATE INDEX ai_requests_conversation ON ai_requests (conversation);`,
  // Whether a site itself may use the camera or the microphone (kind 'camera' or 'microphone'; setting
  // 'allow' or 'block'; no row means ask). Like site_location, apart from what the assistant may do.
  `CREATE TABLE site_media (
     host TEXT NOT NULL,
     kind TEXT NOT NULL,
     setting TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (host, kind)
   );`,
];

/**
 * Version 6: the assistant's conversation belongs to the tab group. Chats were saved per tab
 * (`chat:<uid>`); for each group in the saved session, the chat of one of its tabs becomes the
 * group's (`chat:group:<id>`). Chats have no timestamp, so "most recently updated" is the one with
 * the highest message id (ids only grow while the app runs). The other tabs keep their own chats,
 * which come back if they leave the group. Keys are spelled out here on purpose: this must not
 * change if the storage code does.
 */
async function moveGroupedTabChatsToGroups(db: Db): Promise<void> {
  const session = await getJson<{ tabs?: { uid?: unknown; groupId?: unknown }[] }>(db, 'session');
  const members = new Map<string, string[]>();
  for (const tab of Array.isArray(session?.tabs) ? session.tabs : []) {
    if (typeof tab?.uid !== 'string' || typeof tab.groupId !== 'string') continue;
    members.set(tab.groupId, [...(members.get(tab.groupId) ?? []), tab.uid]);
  }
  for (const [groupId, uids] of members) {
    let best: { uid: string; lastId: number } | null = null;
    for (const uid of uids) {
      const chat = await getJson<{ items?: unknown; turns?: unknown }>(db, `chat:${uid}`);
      if (!chat || !Array.isArray(chat.items) || !Array.isArray(chat.turns)) continue;
      const lastId = chat.items.reduce<number>((max, item) => Math.max(max, Number(item?.id) || 0), 0);
      if (!best || lastId > best.lastId) best = { uid, lastId };
    }
    if (best) {
      await db.runAsync('UPDATE OR REPLACE kv SET key = ? WHERE key = ?', [`chat:group:${groupId}`, `chat:${best.uid}`]);
    }
  }
}

export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    const migration = MIGRATIONS[version];
    if (typeof migration === 'string') await db.execAsync(migration);
    else await migration(db);
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}

let opening: Promise<Db> | null = null;
let held: Promise<void> | null = null;

/**
 * Makes everyone else's getDb() wait, so nothing in the running app writes while a backup is restored
 * (an old session saved over the restored one, say). Take the database first, then hold it. Returns
 * the release; after a successful restore the app reloads instead.
 */
export function holdDb(): () => void {
  let release = () => {};
  held = new Promise<void>((resolve) => {
    release = () => {
      held = null;
      resolve();
    };
  });
  return release;
}

export function getDb(): Promise<Db> {
  if (held) return held.then(getDb);
  opening ??= (async () => {
    const db = await openDatabaseAsync('qutai.db');
    await db.execAsync('PRAGMA journal_mode = WAL');
    await migrate(db);
    return db;
  })();
  return opening;
}

// ---------- Small JSON key-value store for session, recently closed tabs and chat ----------

export async function getJson<T>(db: Db, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setJson(db: Db, key: string, value: unknown): Promise<void> {
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    JSON.stringify(value),
  ]);
}

export async function deleteKey(db: Db, key: string): Promise<void> {
  await db.runAsync('DELETE FROM kv WHERE key = ?', [key]);
}
