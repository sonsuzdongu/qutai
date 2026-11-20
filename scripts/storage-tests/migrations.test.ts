// Storage that can't half-migrate or fail silently (DATA-25, DATA-26; 20 Nov 2026 code review; src/storage/db.ts):
// every earlier schema version reaches the current one with its data; a step an older app left half done recovers;
// a step that fails now rolls back whole and the next start finishes it; a failed open is tried again; an unreadable
// saved value is kept aside, never overwritten as "nothing saved"; withDb reports failures in one place. Runs on
// Node's built-in SQLite through the app's Db interface.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, test } from 'node:test';
import {
  getDb,
  getJson,
  migrate,
  migrationStatements,
  MIGRATIONS,
  SCHEMA_VERSION,
  setDatabaseOpenerForTests,
  setJson,
  UNREADABLE_PREFIX,
  withDb,
  type Db,
  type SqlValue,
} from '../../src/storage/db';
import { recentStorageFailures, resetStorageFailures, setStorageNotice } from '../../src/storage/failures';

type TestDb = Db & { raw: DatabaseSync; failOnExec?: (sql: string) => boolean };

function nodeDb(raw = new DatabaseSync(':memory:')): TestDb {
  let depth = 0;
  const db: TestDb = {
    raw,
    async execAsync(sql: string) {
      if (db.failOnExec?.(sql)) throw new Error(`disk I/O error (test) in ${sql.slice(0, 40)}`);
      raw.exec(sql);
    },
    async runAsync(sql: string, params: SqlValue[]) {
      const r = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[]) {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      if (depth++ === 0) raw.exec('BEGIN');
      try {
        await task();
        if (--depth === 0) raw.exec('COMMIT');
      } catch (e) {
        if (--depth === 0) raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db;
}

/** What an app before 20 Nov 2026 did: each step, then the version, with no transaction around them. */
async function oldMigrateTo(db: TestDb, version: number) {
  for (let v = 0; v < version; v++) {
    const m = MIGRATIONS[v];
    if (typeof m === 'string') await db.execAsync(m);
    else await m(db);
    await db.execAsync(`PRAGMA user_version = ${v + 1}`);
  }
}

/** The schema as SQLite keeps it, without whitespace differences. */
function schema(db: TestDb): string[] {
  const rows = db.raw.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all() as {
    type: string;
    name: string;
    sql: string | null;
  }[];
  return rows.map((r) => `${r.type} ${r.name}: ${String(r.sql).replace(/\s+/g, ' ')}`);
}
const version = (db: TestDb) => (db.raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

let fresh: string[] = [];
beforeEach(async () => {
  resetStorageFailures();
  if (!fresh.length) {
    const db = nodeDb();
    await migrate(db);
    fresh = schema(db);
  }
});

test('every earlier schema version migrates to the current one, keeping the data', async () => {
  for (let from = 0; from <= SCHEMA_VERSION; from++) {
    const db = nodeDb();
    await oldMigrateTo(db, from);
    if (from >= 1) {
      db.raw.prepare("INSERT INTO history (url, title, visited_at) VALUES ('https://a.test/', 'A', 1)").run();
      db.raw.prepare(`INSERT INTO kv (key, value) VALUES ('settings', '{"theme":"dark"}')`).run();
    }
    if (from >= 2) db.raw.prepare("INSERT INTO memories (id, text, created_at, updated_at) VALUES ('m1', 'Passport number U28813047', 1, 1)").run();
    await migrate(db);
    assert.equal(version(db), SCHEMA_VERSION, `from ${from}`);
    assert.deepEqual(schema(db), fresh, `schema from ${from}`);
    if (from >= 1) {
      assert.equal((db.raw.prepare('SELECT COUNT(*) AS n FROM history').get() as { n: number }).n, 1);
      assert.deepEqual(await getJson(db, 'settings'), { theme: 'dark' });
    }
    if (from >= 2) {
      const m = db.raw.prepare("SELECT category, sensitive FROM memories WHERE id = 'm1'").get() as { category: string; sensitive: number };
      // Steps after the row was written ran on it: a category, and an ID number made hidden (markIdNumbersHidden).
      assert.equal(m.category, 'general');
      assert.equal(m.sensitive, from <= MIGRATIONS.findIndex((x) => typeof x === 'function' && x.name === 'markIdNumbersHidden') ? 1 : 0);
    }
    // Running again changes nothing.
    await migrate(db);
    assert.deepEqual(schema(db), fresh);
  }
});

test('a step an older app left half done (killed between statements) recovers instead of failing forever', async () => {
  let checked = 0;
  for (let v = 0; v < MIGRATIONS.length; v++) {
    const m = MIGRATIONS[v];
    if (typeof m !== 'string') continue;
    const statements = migrationStatements(m);
    for (let done = 1; done < statements.length; done++) {
      const db = nodeDb();
      await oldMigrateTo(db, v);
      for (const s of statements.slice(0, done)) await db.execAsync(s);
      assert.equal(version(db), v, 'the version was never bumped');
      await migrate(db);
      assert.equal(version(db), SCHEMA_VERSION, `step ${v} after ${done} statements`);
      assert.deepEqual(schema(db), fresh, `step ${v} after ${done} statements`);
      checked++;
    }
  }
  assert.ok(checked >= 10, `checked ${checked} half-done steps`);
});

test('a step that fails now rolls back whole; the next start finishes it', async () => {
  // The step with four ALTERs on saved_tasks: the third one fails.
  const step = MIGRATIONS.findIndex((m) => typeof m === 'string' && m.includes('ADD COLUMN schedule_paused'));
  assert.ok(step > 0);
  const db = nodeDb();
  await oldMigrateTo(db, step);
  db.failOnExec = (sql) => sql.includes('ADD COLUMN private');
  await assert.rejects(migrate(db), /disk I\/O error/);
  assert.equal(version(db), step, 'not counted');
  const columns = (db.raw.prepare('PRAGMA table_info(saved_tasks)').all() as { name: string }[]).map((c) => c.name);
  assert.ok(!columns.includes('schedule'), 'the statements before the failure were rolled back');
  db.failOnExec = undefined;
  await migrate(db);
  assert.equal(version(db), SCHEMA_VERSION);
  assert.deepEqual(schema(db), fresh);
});

test('the statement splitter keeps every statement of every step', () => {
  for (const m of MIGRATIONS) {
    if (typeof m !== 'string') continue;
    const statements = migrationStatements(m);
    assert.equal(statements.join('\n').replace(/\s+/g, ''), m.replace(/\s+/g, ''));
    for (const s of statements) assert.ok(/;\s*$/.test(s) || !s.includes(';'), s);
  }
});

test('a failed open is not kept: the next getDb tries again, and the user is told once', async () => {
  const told: string[] = [];
  setStorageNotice((m) => told.push(m));
  let attempts = 0;
  setDatabaseOpenerForTests(async () => {
    attempts++;
    if (attempts === 1) throw new Error('unable to open database file');
    return nodeDb();
  });
  await assert.rejects(getDb(), /unable to open/);
  await new Promise((r) => setTimeout(r, 0));
  const db = await getDb();
  assert.equal(attempts, 2);
  assert.equal(version(db as TestDb), SCHEMA_VERSION);
  assert.equal(told.length, 1);
  assert.equal(recentStorageFailures().at(-1)?.label, 'db.open');
});

test('an unreadable saved value is kept aside, not lost when the caller saves again', async () => {
  const db = nodeDb();
  await migrate(db);
  db.raw.prepare("INSERT INTO kv (key, value) VALUES ('session', '{\"tabs\":[{\"url\":\"https://a.test/\"')").run();
  assert.equal(await getJson(db, 'session'), null);
  assert.equal(await getJson(db, 'session'), null);
  const aside = db.raw.prepare('SELECT key, value FROM kv WHERE key LIKE ?').all(`${UNREADABLE_PREFIX}session:%`) as { key: string; value: string }[];
  assert.equal(aside.length, 1, 'kept once');
  assert.match(aside[0].value, /a\.test/);
  await setJson(db, 'session', { tabs: [] });
  assert.equal((db.raw.prepare('SELECT COUNT(*) AS n FROM kv WHERE key LIKE ?').get(`${UNREADABLE_PREFIX}%`) as { n: number }).n, 1);
  assert.equal(recentStorageFailures().at(-1)?.level, 'record');
});

test('withDb reports a failure in one place and gives the caller undefined', async () => {
  const told: string[] = [];
  setStorageNotice((m) => told.push(m));
  setDatabaseOpenerForTests(async () => nodeDb());
  assert.equal(await withDb('test.read', async () => 7), 7);
  assert.equal(await withDb('test.write', async () => Promise.reject(new Error('database is locked'))), undefined);
  assert.equal(await withDb('test.save', async () => Promise.reject(new Error('database is full')), 'user'), undefined);
  assert.equal(await withDb('test.save', async () => Promise.reject(new Error('database is full')), 'user'), undefined);
  const labels = recentStorageFailures().map((f) => `${f.label} ${f.level}`);
  assert.deepEqual(labels, ['test.write record', 'test.save user', 'test.save user']);
  assert.equal(told.length, 1, 'told once per kind');
});
