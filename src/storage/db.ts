import { openDatabaseAsync } from 'expo-sqlite';

export type SqlValue = string | number | null;

/** The subset of expo-sqlite used by the app; kept small so storage code can be tested against other SQLite drivers. */
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
}

/** Each entry upgrades the schema by one version. Never edit a shipped migration; append a new one. */
const MIGRATIONS: string[] = [
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
];

export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    await db.execAsync(MIGRATIONS[version]);
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}

let opening: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  opening ??= (async () => {
    const db = await openDatabaseAsync('alpai.db');
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
