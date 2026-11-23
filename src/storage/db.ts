import { openDatabaseAsync } from 'expo-sqlite';
import { looksLikeIdNumber } from '../agent/memory';
import { APPS_SCHEMA_V1 } from '../apps/store';
import { reportStorageFailure, type StorageFailureLevel } from './failures';

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
export const MIGRATIONS: readonly (string | ((db: Db) => Promise<void>))[] = [
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
  // Sites where network ad and tracker blocking is off ("Don't block on this site"); no row means it's on.
  `CREATE TABLE site_blocking (
     host TEXT PRIMARY KEY,
     updated_at INTEGER NOT NULL
   );`,
  // Saved tasks: messages the user saved to run again (storage/savedTasks.ts). target: 'page', 'url' or 'none'.
  `CREATE TABLE saved_tasks (
     id TEXT PRIMARY KEY NOT NULL,
     name TEXT NOT NULL,
     prompt TEXT NOT NULL,
     target TEXT NOT NULL,
     url TEXT,
     research INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     last_used_at INTEGER
   );`,
  // A saved task's reminder (JSON, see storage/savedTasks.ts: once / daily / weekly), paused or not, whether its
  // notification hides the prompt, and whether tapping it runs the task instead of only showing it ready.
  `ALTER TABLE saved_tasks ADD COLUMN schedule TEXT;
   ALTER TABLE saved_tasks ADD COLUMN schedule_paused INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE saved_tasks ADD COLUMN private INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE saved_tasks ADD COLUMN auto_run INTEGER NOT NULL DEFAULT 0;`,
  // Each memory's category (agent/memory.ts MEMORY_CATEGORIES); memories saved before categories are 'general'.
  `ALTER TABLE memories ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
   CREATE INDEX memories_category ON memories (category);`,
  // Whether the assistant may type the user's remembered personal details on a site ('allow' or 'block'; no row
  // means ask first). Unlike site_location and site_media this is about the assistant, not the site itself.
  `CREATE TABLE site_personal (
     host TEXT PRIMARY KEY NOT NULL,
     setting TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
  // The custom endpoint's host for requests sent there ("What was sent to the AI"); null for the other providers.
  `ALTER TABLE ai_requests ADD COLUMN endpoint TEXT;`,
  // Memories hidden from the AI provider (agent/hiddenValues.ts) and the user's short label for them.
  `ALTER TABLE memories ADD COLUMN sensitive INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE memories ADD COLUMN label TEXT;`,
  markIdNumbersHidden,
  // "What was sent to the AI": the tokens each request used and its approximate cost (JSON numbers, ai/cost.ts).
  `ALTER TABLE ai_requests ADD COLUMN cost TEXT;`,
  // The user's own site rules (content/siteRules.ts): a filter line each, the site it is listed under and the page it
  // was made on. source: 'assistant' or 'manual'.
  `CREATE TABLE site_rules (
     id TEXT PRIMARY KEY NOT NULL,
     line TEXT NOT NULL,
     enabled INTEGER NOT NULL DEFAULT 1,
     source TEXT NOT NULL,
     site TEXT NOT NULL,
     url TEXT,
     created_at INTEGER NOT NULL
   );`,
  // Rule kinds (docs/page-customisation.md): 'filter' (the rows above: a filter line), 'style' (line: the scope, body:
  // the sanitised CSS, name: its name); 'script' is for a later version. meta: JSON for kinds that need more.
  `ALTER TABLE site_rules ADD COLUMN kind TEXT NOT NULL DEFAULT 'filter';
   ALTER TABLE site_rules ADD COLUMN name TEXT;
   ALTER TABLE site_rules ADD COLUMN body TEXT;
   ALTER TABLE site_rules ADD COLUMN meta TEXT;`,
  // Apps inside Qutai (docs/mini-apps.md): the apps, their kept versions, and each app's key-value and document data.
  APPS_SCHEMA_V1,
  // Address bar suggestions (storage/omnibox.ts) group history by address and match title or address: with all three
  // in one index SQLite reads only the index, about half the time of the plain address index (measured at 10,000
  // visits). It also serves every lookup by address, so the old index goes.
  `CREATE INDEX history_url_title_visited ON history (url, title, visited_at);
   DROP INDEX IF EXISTS history_url;`,
  // Sites where the user ticked "Post on {site} without asking" in the publish dialog (PAY-29): the assistant's posts
  // there skip the dialog (the app's checks still run). No row means the dialog is shown. Not in backups.
  `CREATE TABLE site_posting (
     host TEXT PRIMARY KEY NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
];

/**
 * National ID and passport numbers saved before hidden memories existed become hidden, as new ones are.
 * Uses the same detector as saving a memory (agent/memory.ts looksLikeIdNumber).
 */
async function markIdNumbersHidden(db: Db): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; text: string }>('SELECT id, text FROM memories', []);
  for (const row of rows) {
    if (looksLikeIdNumber(row.text)) await db.runAsync('UPDATE memories SET sensitive = 1 WHERE id = ?', [row.id]);
  }
}

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

/**
 * One statement of a migration as it would apply now: null when its change is already there (a column, table, index,
 * trigger or view of that name), so a step an older version left half done is finished instead of failing forever.
 */
async function alreadyApplied(db: Db, statement: string): Promise<boolean> {
  const alter = /^ALTER\s+TABLE\s+(\w+)\s+ADD\s+(?:COLUMN\s+)?(\w+)/i.exec(statement);
  if (alter) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${alter[1]})`, []);
    return columns.some((c) => c.name.toLowerCase() === alter[2].toLowerCase());
  }
  const create = /^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX|TRIGGER|VIEW)\s+(?!IF\s+NOT\s+EXISTS)(\w+)/i.exec(statement);
  if (create) {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sqlite_master WHERE type = ? AND name = ?', [
      create[1].toLowerCase(),
      create[2],
    ]);
    return (row?.n ?? 0) > 0;
  }
  return false;
}

/**
 * A migration's statements, split at semicolons that end a line (the migrations write one statement per line group
 * and never put a semicolon at a line's end inside one; a trigger's BEGIN … END is kept whole).
 */
export function migrationStatements(sql: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  for (const line of sql.split('\n')) {
    current += `${line}\n`;
    if (/\bBEGIN\b/i.test(line) && /\bTRIGGER\b/i.test(current)) depth++;
    if (/^\s*END\s*;\s*$/i.test(line)) depth = Math.max(0, depth - 1);
    if (depth === 0 && /;\s*$/.test(line)) {
      if (current.trim()) out.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Brings the schema to the latest version (`DATA-25`). Each step and its version bump run in one transaction, so a
 * step is either done and counted or not done at all; each statement whose change is already there (left by a
 * version before 20 Nov 2026, which ran steps outside a transaction) is skipped, so such a database recovers. The
 * function steps are written to be safe to run again.
 */
export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    const migration = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      if (typeof migration === 'string') {
        for (const statement of migrationStatements(migration)) {
          if (!(await alreadyApplied(db, statement))) await db.execAsync(statement);
        }
      } else {
        await migration(db);
      }
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** How many schema versions there are (for the migration tests). */
export const SCHEMA_VERSION = MIGRATIONS.length;

let opening: Promise<Db> | null = null;
let openDatabase: () => Promise<Db & { execAsync(sql: string): Promise<void> }> = () => openDatabaseAsync('qutai.db');

/** For tests: how getDb opens the database (and forgets an open one). */
export function setDatabaseOpenerForTests(open: () => Promise<Db>) {
  openDatabase = open;
  opening = null;
}
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
  if (!opening) {
    const attempt = (async () => {
      const db = await openDatabase();
      await db.execAsync('PRAGMA journal_mode = WAL');
      await migrate(db);
      return db;
    })();
    opening = attempt;
    // A failed open is not kept for the life of the app: the next call tries again.
    attempt.catch((e) => {
      if (opening === attempt) opening = null;
      reportStorageFailure('db.open', e, 'user');
    });
  }
  return opening;
}

/**
 * Runs `fn` with the database and reports a failure in one place (storage/failures.ts) instead of each caller
 * swallowing it: 'record' keeps it for diagnostics, 'user' also tells the user once. Resolves with `fn`'s result, or
 * undefined after a failure (callers that need a value give their own fallback with ??).
 */
export async function withDb<T>(label: string, fn: (db: Db) => Promise<T>, level: StorageFailureLevel = 'record'): Promise<T | undefined> {
  try {
    return await fn(await getDb());
  } catch (e) {
    reportStorageFailure(label, e, level);
    return undefined;
  }
}

// ---------- Small JSON key-value store for session, recently closed tabs and chat ----------

/**
 * A saved JSON value, or null when there is none. A value that can't be read is not treated as "nothing saved" and
 * then overwritten: it is first copied aside to `unreadable:<key>:<time>` (kept on the phone, never read by the app, not in
 * backups) and the failure is recorded; then the caller starts empty.
 */
export async function getJson<T>(db: Db, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch (e) {
    await keepAside(db, key, row.value).catch(() => {
      // Copying failed too: the read failure below is still recorded.
    });
    reportStorageFailure(`kv.read ${key.split(':')[0]}`, e, 'record');
    return null;
  }
}

/** Copies an unreadable kv value aside, once per value. */
async function keepAside(db: Db, key: string, value: string): Promise<void> {
  const prefix = `${UNREADABLE_PREFIX}${key}:`;
  const same = await db.getFirstAsync<{ key: string }>('SELECT key FROM kv WHERE key >= ? AND key < ? AND value = ?', [
    prefix,
    `${prefix}\uffff`,
    value,
  ]);
  if (!same) await db.runAsync('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)', [`${prefix}${Date.now()}`, value]);
}

/** Where unreadable kv values are kept (getJson). */
export const UNREADABLE_PREFIX = 'unreadable:';

export async function setJson(db: Db, key: string, value: unknown): Promise<void> {
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    JSON.stringify(value),
  ]);
}

export async function deleteKey(db: Db, key: string): Promise<void> {
  await db.runAsync('DELETE FROM kv WHERE key = ?', [key]);
}
