import type { Db, SqlValue } from '../storage/db';
import { BridgeError, COLLECTION, KEY, LIMITS } from './contract';
import {
  CONTRACT_VERSION,
  PACKAGE_FORMAT,
  PACKAGE_FORMAT_VERSION,
  PACKAGE_LIMITS,
  checkPackage,
  cleanAppName,
  describeProblems,
  packageHash,
  packageSeal,
  packageSealMatches,
  packageSize,
  utf8Length,
  type AppFiles,
  type AppIcon,
  type AppManifest,
  type AppPackage,
  type AppPermission,
} from './manifest';
import type { Grant, Grants } from './contract';
import { checkQuery, runQuery, type Doc, type Query } from './query';

/**
 * Apps and their data on the phone (docs/mini-apps.md): the apps, their kept versions, and each app's key-value and
 * document storage with its quota. Works on the app's SQLite database and on Node's in the tests.
 */

/** The tables, created by migration 20 in src/storage/db.ts (never edit: append a migration). */
export const APPS_SCHEMA_V1 = `CREATE TABLE apps (
     id TEXT PRIMARY KEY NOT NULL,
     name TEXT NOT NULL,
     current_version INTEGER NOT NULL,
     state TEXT NOT NULL DEFAULT 'active',
     grants TEXT NOT NULL DEFAULT '{}',
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     opened_at INTEGER
   );
   CREATE TABLE app_versions (
     app_id TEXT NOT NULL,
     version INTEGER NOT NULL,
     manifest TEXT NOT NULL,
     files TEXT NOT NULL,
     size INTEGER NOT NULL,
     hash TEXT NOT NULL,
     seal TEXT,
     source TEXT NOT NULL,
     note TEXT,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (app_id, version)
   );
   CREATE TABLE app_kv (
     app_id TEXT NOT NULL,
     key TEXT NOT NULL,
     value TEXT NOT NULL,
     size INTEGER NOT NULL,
     PRIMARY KEY (app_id, key)
   );
   CREATE TABLE app_docs (
     app_id TEXT NOT NULL,
     collection TEXT NOT NULL,
     id TEXT NOT NULL,
     data TEXT NOT NULL,
     size INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (app_id, collection, id)
   );`;

export type VersionSource = 'assistant' | 'undo' | 'restore' | 'rename' | 'import';

export type AppSummary = {
  id: string;
  name: string;
  description: string;
  icon: AppIcon;
  version: number;
  state: 'active' | 'disabled';
  createdAt: number;
  updatedAt: number;
  openedAt: number | null;
};

export type VersionInfo = { version: number; createdAt: number; source: VersionSource; note: string | null; size: number };

export type LoadedApp = AppSummary & {
  pkg: AppPackage;
  /** The current version's seal verifies with this phone's key: it may run. */
  sealed: boolean;
  grants: Grants;
  /** Versions kept, newest first. */
  versions: VersionInfo[];
};

/** What the assistant gives to create an app; Qutai fills in the rest of the manifest. */
export type NewApp = {
  name: string;
  description: string;
  icon: AppIcon;
  permissions: AppPermission[];
  language: string;
  files: AppFiles;
};

export type AppChange = {
  name?: string;
  description?: string;
  icon?: AppIcon;
  permissions?: AppPermission[];
  /** Whole files; null deletes one. */
  files?: Record<string, string | null>;
  /** Small edits: `find` must occur exactly once in the file. */
  edits?: { file: string; find: string; replace: string }[];
};

export type StoreDeps = {
  db: () => Promise<Db>;
  /** This install's seal key, null when secure storage can't be used (nothing is then runnable). */
  key: () => Promise<Uint8Array | null>;
  now?: () => number;
  /** Random bytes for ids. */
  random: (n: number) => Uint8Array;
  collate?: (a: string, b: string) => number;
};

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

function parse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export class AppStore {
  private queues = new Map<string, Promise<unknown>>();
  constructor(private deps: StoreDeps) {}

  private now() {
    return (this.deps.now ?? Date.now)();
  }

  private randomId(prefix: string, length: number): string {
    const bytes = this.deps.random(length);
    let id = prefix;
    for (let i = 0; i < length; i++) id += ID_CHARS[bytes[i] % ID_CHARS.length];
    return id;
  }

  /** Runs `task` after every earlier task of the same app (writes never interleave). */
  private serial<T>(appId: string, task: () => Promise<T>): Promise<T> {
    const before = this.queues.get(appId) ?? Promise.resolve();
    const run = before.then(task, task);
    const tail = run.catch(() => {});
    this.queues.set(appId, tail);
    void tail.then(() => {
      if (this.queues.get(appId) === tail) this.queues.delete(appId);
    });
    return run;
  }

  // ---------- Apps and versions ----------

  async list(): Promise<AppSummary[]> {
    const db = await this.deps.db();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      current_version: number;
      state: string;
      created_at: number;
      updated_at: number;
      opened_at: number | null;
      manifest: string;
    }>(
      `SELECT a.id, a.name, a.current_version, a.state, a.created_at, a.updated_at, a.opened_at, v.manifest
       FROM apps a JOIN app_versions v ON v.app_id = a.id AND v.version = a.current_version
       ORDER BY COALESCE(a.opened_at, a.updated_at) DESC`,
      [],
    );
    return rows.map((r) => {
      const m = parse<Partial<AppManifest>>(r.manifest, {});
      return {
        id: r.id,
        name: r.name,
        description: m.description ?? '',
        icon: m.icon ?? { name: 'tool' },
        version: r.current_version,
        state: r.state === 'disabled' ? 'disabled' : 'active',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        openedAt: r.opened_at,
      };
    });
  }

  async load(id: string): Promise<LoadedApp | null> {
    const db = await this.deps.db();
    const app = await db.getFirstAsync<{
      id: string;
      name: string;
      current_version: number;
      state: string;
      grants: string;
      created_at: number;
      updated_at: number;
      opened_at: number | null;
    }>('SELECT * FROM apps WHERE id = ?', [id]);
    if (!app) return null;
    const v = await db.getFirstAsync<{ manifest: string; files: string; seal: string | null }>(
      'SELECT manifest, files, seal FROM app_versions WHERE app_id = ? AND version = ?',
      [id, app.current_version],
    );
    if (!v) return null;
    const pkg: AppPackage = { manifest: parse(v.manifest, {} as AppManifest), files: parse(v.files, {}) };
    const key = await this.deps.key();
    const versions = await this.versions(id);
    return {
      id,
      name: app.name,
      description: pkg.manifest.description ?? '',
      icon: pkg.manifest.icon,
      version: app.current_version,
      state: app.state === 'disabled' ? 'disabled' : 'active',
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      openedAt: app.opened_at,
      pkg,
      sealed: packageSealMatches(pkg, v.seal, key) && checkPackage(pkg).length === 0,
      grants: parse(app.grants, {}),
      versions,
    };
  }

  async versions(id: string): Promise<VersionInfo[]> {
    const db = await this.deps.db();
    const rows = await db.getAllAsync<{ version: number; created_at: number; source: VersionSource; note: string | null; size: number }>(
      'SELECT version, created_at, source, note, size FROM app_versions WHERE app_id = ? ORDER BY version DESC',
      [id],
    );
    return rows.map((r) => ({ version: r.version, createdAt: r.created_at, source: r.source, note: r.note, size: r.size }));
  }

  async versionPackage(id: string, version: number): Promise<AppPackage | null> {
    const db = await this.deps.db();
    const v = await db.getFirstAsync<{ manifest: string; files: string }>(
      'SELECT manifest, files FROM app_versions WHERE app_id = ? AND version = ?',
      [id, version],
    );
    return v ? { manifest: parse(v.manifest, {} as AppManifest), files: parse(v.files, {}) } : null;
  }

  /** Writes a checked, sealed version and makes it current (and prunes old ones), in one transaction. */
  private async saveVersion(pkg: AppPackage, source: VersionSource, note: string | null, isNew: boolean): Promise<void> {
    const key = await this.deps.key();
    if (!key) throw new BridgeError('E_INTERNAL', "Secure storage isn't available on this phone, so apps can't be saved.");
    const hash = packageHash(pkg);
    const seal = packageSeal(hash, key);
    const now = this.now();
    const db = await this.deps.db();
    const m = pkg.manifest;
    await db.withTransactionAsync(async () => {
      if (isNew)
        await db.runAsync('INSERT INTO apps (id, name, current_version, state, grants, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
          m.id,
          m.name,
          m.version,
          'active',
          '{}',
          now,
          now,
        ]);
      else
        await db.runAsync('UPDATE apps SET name = ?, current_version = ?, updated_at = ? WHERE id = ?', [m.name, m.version, now, m.id]);
      await db.runAsync(
        'INSERT INTO app_versions (app_id, version, manifest, files, size, hash, seal, source, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [m.id, m.version, JSON.stringify(m), JSON.stringify(pkg.files), packageSize(pkg.files), hash, seal, source, note, now],
      );
      // Keep the newest versions and the current one.
      await db.runAsync(
        `DELETE FROM app_versions WHERE app_id = ? AND version <> ? AND version NOT IN
           (SELECT version FROM app_versions WHERE app_id = ? ORDER BY version DESC LIMIT ?)`,
        [m.id, m.version, m.id, PACKAGE_LIMITS.keptVersions],
      );
    });
  }

  async create(app: NewApp): Promise<AppPackage> {
    const now = this.now();
    const manifest: AppManifest = {
      format: PACKAGE_FORMAT,
      formatVersion: PACKAGE_FORMAT_VERSION,
      id: this.randomId('app-', 12),
      name: cleanAppName(app.name),
      description: typeof app.description === 'string' ? app.description.trim() : '',
      icon: app.icon,
      version: 1,
      contract: CONTRACT_VERSION,
      permissions: app.permissions ?? [],
      entry: 'index.html',
      language: app.language,
      createdAt: iso(now),
      updatedAt: iso(now),
      author: { kind: 'local' },
    };
    const pkg = { manifest, files: app.files };
    const problems = checkPackage(pkg, { forWriting: true });
    if (problems.length) throw new BridgeError('E_BAD_ARGS', describeProblems(problems));
    await this.saveVersion(pkg, 'assistant', null, true);
    return pkg;
  }

  /** The next version from the current one with the changes applied; the reason when they can't be. */
  async change(id: string, change: AppChange, source: VersionSource, note: string | null): Promise<AppPackage> {
    return this.serial(id, async () => {
      const app = await this.load(id);
      if (!app) throw new BridgeError('E_NOT_FOUND', `There is no app ${id}.`);
      const files: AppFiles = { ...app.pkg.files };
      for (const [name, text] of Object.entries(change.files ?? {})) {
        if (text === null) delete files[name];
        else files[name] = text;
      }
      for (const [i, edit] of (change.edits ?? []).entries()) {
        const text = files[edit?.file];
        if (typeof text !== 'string') throw new BridgeError('E_BAD_ARGS', `edits[${i}]: there is no file ${String(edit?.file)}`);
        if (typeof edit.find !== 'string' || !edit.find || typeof edit.replace !== 'string')
          throw new BridgeError('E_BAD_ARGS', `edits[${i}]: find and replace must be text`);
        const at = text.indexOf(edit.find);
        if (at < 0) throw new BridgeError('E_BAD_ARGS', `edits[${i}]: the find text is not in ${edit.file} (read the file again)`);
        if (text.indexOf(edit.find, at + 1) >= 0)
          throw new BridgeError('E_BAD_ARGS', `edits[${i}]: the find text occurs more than once in ${edit.file}; include more around it`);
        files[edit.file] = text.slice(0, at) + edit.replace + text.slice(at + edit.find.length);
      }
      const latest = Math.max(app.version, ...app.versions.map((v) => v.version));
      const manifest: AppManifest = {
        ...app.pkg.manifest,
        name: change.name !== undefined ? cleanAppName(change.name) : app.pkg.manifest.name,
        description: change.description !== undefined ? String(change.description).trim() : app.pkg.manifest.description,
        icon: change.icon ?? app.pkg.manifest.icon,
        permissions: change.permissions ?? app.pkg.manifest.permissions,
        version: latest + 1,
        updatedAt: iso(this.now()),
      };
      const pkg = { manifest, files };
      const problems = checkPackage(pkg, { forWriting: true });
      if (problems.length) throw new BridgeError('E_BAD_ARGS', describeProblems(problems));
      await this.saveVersion(pkg, source, note, false);
      return pkg;
    });
  }

  /** Makes a kept version the current one (Versions › Use this version). */
  async setCurrent(id: string, version: number): Promise<boolean> {
    const db = await this.deps.db();
    const row = await db.getFirstAsync<{ manifest: string }>('SELECT manifest FROM app_versions WHERE app_id = ? AND version = ?', [id, version]);
    if (!row) return false;
    const name = parse<Partial<AppManifest>>(row.manifest, {}).name ?? '';
    const result = await db.runAsync('UPDATE apps SET current_version = ?, name = ?, updated_at = ? WHERE id = ?', [version, name, this.now(), id]);
    return result.changes > 0;
  }

  /** Back to the newest kept version below the current one; the version now current, or null when there is none. */
  async undo(id: string): Promise<number | null> {
    const db = await this.deps.db();
    const app = await db.getFirstAsync<{ current_version: number }>('SELECT current_version FROM apps WHERE id = ?', [id]);
    if (!app) return null;
    const prev = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM app_versions WHERE app_id = ? AND version < ? ORDER BY version DESC LIMIT 1',
      [id, app.current_version],
    );
    if (!prev) return null;
    await this.setCurrent(id, prev.version);
    return prev.version;
  }

  async rename(id: string, name: string): Promise<AppPackage> {
    const clean = cleanAppName(name);
    if (!clean) throw new BridgeError('E_BAD_ARGS', 'The name is empty.');
    return this.change(id, { name: clean }, 'rename', null);
  }

  /** Deletes the app, every version and all of its data. */
  async remove(id: string): Promise<void> {
    await this.serial(id, async () => {
      const db = await this.deps.db();
      await db.withTransactionAsync(async () => {
        for (const table of ['app_docs', 'app_kv', 'app_versions']) await db.runAsync(`DELETE FROM ${table} WHERE app_id = ?`, [id]);
        await db.runAsync('DELETE FROM apps WHERE id = ?', [id]);
      });
    });
  }

  async markOpened(id: string): Promise<void> {
    const db = await this.deps.db();
    await db.runAsync('UPDATE apps SET opened_at = ? WHERE id = ?', [this.now(), id]);
  }

  async grants(id: string): Promise<Grants> {
    const db = await this.deps.db();
    const row = await db.getFirstAsync<{ grants: string }>('SELECT grants FROM apps WHERE id = ?', [id]);
    return parse(row?.grants, {});
  }

  /** Records the user's answer; null resets it to "ask next time". */
  async setGrant(id: string, permission: AppPermission, grant: Grant | null): Promise<Grants> {
    return this.serial(`${id}:grants`, async () => {
      const grants = { ...(await this.grants(id)) };
      if (grant) grants[permission] = grant;
      else delete grants[permission];
      const db = await this.deps.db();
      await db.runAsync('UPDATE apps SET grants = ? WHERE id = ?', [JSON.stringify(grants), id]);
      return grants;
    });
  }

  // ---------- Data ----------

  async usage(appId: string): Promise<number> {
    const db = await this.deps.db();
    const kv = await db.getFirstAsync<{ s: number | null }>('SELECT SUM(size) AS s FROM app_kv WHERE app_id = ?', [appId]);
    const docs = await db.getFirstAsync<{ s: number | null }>('SELECT SUM(size) AS s FROM app_docs WHERE app_id = ?', [appId]);
    return (kv?.s ?? 0) + (docs?.s ?? 0);
  }

  /** Bytes of data per app, for "My apps" and the delete confirmation. */
  async dataSize(appId: string): Promise<number> {
    return this.usage(appId);
  }

  private static checkKey(key: unknown, what = 'key'): string {
    if (typeof key !== 'string' || !KEY.test(key)) throw new BridgeError('E_BAD_ARGS', `${what} must be 1 to 100 letters, digits or _ . : -`);
    return key;
  }

  private static checkCollection(name: unknown): string {
    if (typeof name !== 'string' || !COLLECTION.test(name))
      throw new BridgeError('E_BAD_ARGS', 'collection must be 1 to 64 letters, digits, _ or -');
    return name;
  }

  private static encode(value: unknown, what: string): string {
    if (value === undefined) throw new BridgeError('E_BAD_ARGS', `${what} is missing`);
    const text = JSON.stringify(value);
    if (utf8Length(text) > LIMITS.valueBytes) throw new BridgeError('E_TOO_LARGE', `${what} is larger than ${LIMITS.valueBytes / 1024} KB`);
    return text;
  }

  async kvGet(appId: string, key: unknown): Promise<unknown> {
    const k = AppStore.checkKey(key);
    const db = await this.deps.db();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_kv WHERE app_id = ? AND key = ?', [appId, k]);
    return row ? parse(row.value, null) : null;
  }

  async kvGetMany(appId: string, keys: unknown): Promise<Record<string, unknown>> {
    if (!Array.isArray(keys) || keys.length > LIMITS.batchOps) throw new BridgeError('E_BAD_ARGS', `keys: a list of up to ${LIMITS.batchOps}`);
    const out: Record<string, unknown> = {};
    for (const key of keys) out[AppStore.checkKey(key)] = await this.kvGet(appId, key);
    return out;
  }

  async kvKeys(appId: string, prefix: unknown): Promise<string[]> {
    const db = await this.deps.db();
    const rows = await db.getAllAsync<{ key: string }>('SELECT key FROM app_kv WHERE app_id = ? ORDER BY key', [appId]);
    const p = typeof prefix === 'string' ? prefix : '';
    return rows.map((r) => r.key).filter((k) => k.startsWith(p));
  }

  async kvSet(appId: string, key: unknown, value: unknown): Promise<true> {
    await this.batch(appId, [{ op: 'set', key, value }]);
    return true;
  }

  async kvSetMany(appId: string, entries: unknown): Promise<true> {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new BridgeError('E_BAD_ARGS', 'entries: an object of key: value');
    const list = Object.entries(entries as Record<string, unknown>);
    await this.batch(appId, list.map(([key, value]) => ({ op: 'set', key, value })));
    return true;
  }

  async kvRemove(appId: string, key: unknown): Promise<true> {
    await this.batch(appId, [{ op: 'remove', key }]);
    return true;
  }

  async docGet(appId: string, collection: unknown, id: unknown): Promise<Doc | null> {
    const c = AppStore.checkCollection(collection);
    const i = AppStore.checkKey(id, 'id');
    const db = await this.deps.db();
    const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM app_docs WHERE app_id = ? AND collection = ? AND id = ?', [appId, c, i]);
    return row ? parse<Doc | null>(row.data, null) : null;
  }

  private async allDocs(appId: string, collection: string): Promise<Doc[]> {
    const db = await this.deps.db();
    const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM app_docs WHERE app_id = ? AND collection = ?', [appId, collection]);
    return rows.map((r) => parse<Doc | null>(r.data, null)).filter((d): d is Doc => !!d);
  }

  async docQuery(appId: string, collection: unknown, query: unknown): Promise<{ docs: Doc[]; total: number }> {
    const c = AppStore.checkCollection(collection);
    const problem = checkQuery(query);
    if (problem) throw new BridgeError('E_BAD_ARGS', problem);
    return runQuery(await this.allDocs(appId, c), (query ?? {}) as Query, this.deps.collate);
  }

  async docCount(appId: string, collection: unknown, query: unknown): Promise<number> {
    const q = { ...((query as object) ?? {}), limit: undefined, offset: undefined } as Query;
    const problem = checkQuery(q);
    if (problem) throw new BridgeError('E_BAD_ARGS', problem);
    return runQuery(await this.allDocs(appId, AppStore.checkCollection(collection)), { ...q, limit: Number.MAX_SAFE_INTEGER }).total;
  }

  async collections(appId: string): Promise<{ name: string; count: number }[]> {
    const db = await this.deps.db();
    const rows = await db.getAllAsync<{ collection: string; n: number }>(
      'SELECT collection, COUNT(*) AS n FROM app_docs WHERE app_id = ? GROUP BY collection ORDER BY collection',
      [appId],
    );
    return rows.map((r) => ({ name: r.collection, count: r.n }));
  }

  async docClear(appId: string, collection: unknown): Promise<number> {
    const c = AppStore.checkCollection(collection);
    return this.serial(appId, async () => {
      const db = await this.deps.db();
      const result = await db.runAsync('DELETE FROM app_docs WHERE app_id = ? AND collection = ?', [appId, c]);
      return result.changes;
    });
  }

  /**
   * Writes as one unit (storage.batch, setMany and every single write): every operation is checked and the quota
   * worked out from the stored sizes before anything is written; then all rows are written in one transaction.
   * Results are in the operations' order (a document for add/put/update, true/false for delete, true for set/remove).
   */
  async batch(appId: string, ops: unknown): Promise<unknown[]> {
    if (!Array.isArray(ops) || ops.length > LIMITS.batchOps)
      throw new BridgeError(Array.isArray(ops) ? 'E_TOO_LARGE' : 'E_BAD_ARGS', `ops: a list of up to ${LIMITS.batchOps} operations`);
    return this.serial(appId, async () => {
      const db = await this.deps.db();
      const now = this.now();
      // The state each touched row will have: size (0 = gone) and the SQL that writes it.
      type Row = { size: number; write: [string, SqlValue[]] | null; value?: unknown };
      const kv = new Map<string, Row>();
      const docs = new Map<string, Row & { doc: Doc | null }>();
      const sizeBefore = new Map<string, number>();
      const results: unknown[] = [];

      const currentDoc = async (c: string, id: string): Promise<{ doc: Doc | null; size: number }> => {
        const k = `${c}\u0000${id}`;
        const pending = docs.get(k);
        if (pending) return { doc: pending.doc, size: pending.size };
        const row = await db.getFirstAsync<{ data: string; size: number }>(
          'SELECT data, size FROM app_docs WHERE app_id = ? AND collection = ? AND id = ?',
          [appId, c, id],
        );
        sizeBefore.set(`d${k}`, row?.size ?? 0);
        return { doc: row ? parse<Doc | null>(row.data, null) : null, size: row?.size ?? 0 };
      };
      const putDoc = (c: string, doc: Doc) => {
        const data = AppStore.encode(doc, 'the document');
        const size = utf8Length(c) + utf8Length(doc.id) + utf8Length(data);
        docs.set(`${c}\u0000${doc.id}`, {
          doc,
          size,
          write: [
            'INSERT OR REPLACE INTO app_docs (app_id, collection, id, data, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [appId, c, doc.id, data, size, doc.createdAt, doc.updatedAt],
          ],
        });
      };
      const clean = (value: unknown, what: string): Record<string, unknown> => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BridgeError('E_BAD_ARGS', `${what} must be an object`);
        const out = { ...(value as Record<string, unknown>) };
        delete out.id;
        delete out.createdAt;
        delete out.updatedAt;
        return out;
      };

      for (const [i, raw] of (ops as unknown[]).entries()) {
        if (!raw || typeof raw !== 'object') throw new BridgeError('E_BAD_ARGS', `ops[${i}] must be an object`);
        const o = raw as Record<string, unknown>;
        if (o.op === 'set' || o.op === 'remove') {
          const key = AppStore.checkKey(o.key);
          if (!kv.has(key) && !sizeBefore.has(`k${key}`)) {
            const row = await db.getFirstAsync<{ size: number }>('SELECT size FROM app_kv WHERE app_id = ? AND key = ?', [appId, key]);
            sizeBefore.set(`k${key}`, row?.size ?? 0);
          }
          if (o.op === 'set') {
            const value = AppStore.encode(o.value, `the value of ${key}`);
            const size = utf8Length(key) + utf8Length(value);
            kv.set(key, { size, write: ['INSERT OR REPLACE INTO app_kv (app_id, key, value, size) VALUES (?, ?, ?, ?)', [appId, key, value, size]] });
          } else kv.set(key, { size: 0, write: ['DELETE FROM app_kv WHERE app_id = ? AND key = ?', [appId, key]] });
          results.push(true);
        } else if (o.op === 'add' || o.op === 'put' || o.op === 'update') {
          const c = AppStore.checkCollection(o.collection);
          if (o.op === 'add') {
            const fields = clean(o.doc, 'doc');
            let id = this.randomId('', 16);
            while ((await currentDoc(c, id)).doc) id = this.randomId('', 16);
            const doc = { ...fields, id, createdAt: now, updatedAt: now } as Doc;
            putDoc(c, doc);
            results.push(doc);
          } else if (o.op === 'put') {
            const id = AppStore.checkKey(o.id, 'id');
            const fields = clean(o.doc, 'doc');
            const before = await currentDoc(c, id);
            const doc = { ...fields, id, createdAt: before.doc?.createdAt ?? now, updatedAt: now } as Doc;
            putDoc(c, doc);
            results.push(doc);
          } else {
            const id = AppStore.checkKey(o.id, 'id');
            const patch = clean(o.patch, 'patch');
            const before = await currentDoc(c, id);
            if (!before.doc) throw new BridgeError('E_NOT_FOUND', `There is no document ${id} in ${c}.`);
            const doc = { ...before.doc } as Record<string, unknown>;
            for (const [field, value] of Object.entries(patch)) {
              if (value === null) delete doc[field];
              else doc[field] = value;
            }
            doc.updatedAt = now;
            putDoc(c, doc as Doc);
            results.push(doc);
          }
        } else if (o.op === 'delete') {
          const c = AppStore.checkCollection(o.collection);
          const id = AppStore.checkKey(o.id, 'id');
          const before = await currentDoc(c, id);
          docs.set(`${c}\u0000${id}`, {
            doc: null,
            size: 0,
            write: ['DELETE FROM app_docs WHERE app_id = ? AND collection = ? AND id = ?', [appId, c, id]],
          });
          results.push(!!before.doc);
        } else throw new BridgeError('E_BAD_ARGS', `ops[${i}].op must be set, remove, add, put, update or delete`);
      }

      let delta = 0;
      for (const [key, row] of kv) delta += row.size - (sizeBefore.get(`k${key}`) ?? 0);
      for (const [key, row] of docs) delta += row.size - (sizeBefore.get(`d${key}`) ?? 0);
      if (delta > 0) {
        const used = await this.usage(appId);
        if (used + delta > LIMITS.quotaBytes)
          throw new BridgeError('E_QUOTA', `The app's storage is full (${Math.round(used / 1024)} KB of ${LIMITS.quotaBytes / 1024} KB used).`);
      }
      const writes = [...kv.values(), ...docs.values()].map((r) => r.write).filter((w): w is [string, SqlValue[]] => !!w);
      if (writes.length)
        await db.withTransactionAsync(async () => {
          for (const [sql, params] of writes) await db.runAsync(sql, params);
        });
      return results;
    });
  }
}
