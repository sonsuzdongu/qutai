import { openDatabaseAsync } from 'expo-sqlite';

export type SqlValue = string | number | null;

/** The subset of expo-sqlite used by the app; kept small so storage code can be tested against other SQLite drivers. */
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
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

export function getDb(): Promise<Db> {
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
