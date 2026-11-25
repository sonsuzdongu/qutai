// History › Select (UI-71): deleting the chosen visits removes exactly those, all or none, and tells the new tab page;
// a new search keeps only the chosen visits still on screen. Runs on Node's built-in SQLite through the app's Db
// interface.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { Db, SqlValue } from '../../src/storage/db';
import { deleteHistoryEntries, onHistoryRemoved } from '../../src/storage/history';
import { keepShown } from '../../src/components/historySelection';

function nodeDb(failOn?: (sql: string, params: SqlValue[]) => boolean): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('CREATE TABLE history (id INTEGER PRIMARY KEY, url TEXT, title TEXT, visited_at INTEGER)');
  let depth = 0;
  const db = {
    raw,
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, params: SqlValue[]) {
      if (failOn?.(sql, params)) throw new Error('disk I/O error (test)');
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
  return db as unknown as Db & { raw: DatabaseSync };
}

function fill(db: { raw: DatabaseSync }, n: number) {
  const insert = db.raw.prepare('INSERT INTO history (id, url, title, visited_at) VALUES (?, ?, ?, ?)');
  for (let i = 1; i <= n; i++) insert.run(i, `https://example.com/${i}`, `Page ${i}`, i);
}
const ids = (db: { raw: DatabaseSync }) => (db.raw.prepare('SELECT id FROM history ORDER BY id').all() as { id: number }[]).map((r) => r.id);

test('deletes exactly the chosen visits and tells listeners once', async () => {
  const db = nodeDb();
  fill(db, 6);
  let told = 0;
  const off = onHistoryRemoved(() => told++);
  await deleteHistoryEntries(db, [2, 4, 5]);
  off();
  assert.deepEqual(ids(db), [1, 3, 6]);
  assert.equal(told, 1);
});

test('more visits than one batch are all deleted', async () => {
  const db = nodeDb();
  fill(db, 1203);
  await deleteHistoryEntries(db, Array.from({ length: 1200 }, (_, i) => i + 1));
  assert.deepEqual(ids(db), [1201, 1202, 1203]);
});

test('a failure part way deletes nothing and tells nobody', async () => {
  let batches = 0;
  const db = nodeDb((sql) => sql.startsWith('DELETE') && ++batches === 2);
  fill(db, 700);
  let told = 0;
  const off = onHistoryRemoved(() => told++);
  await assert.rejects(deleteHistoryEntries(db, Array.from({ length: 700 }, (_, i) => i + 1)));
  off();
  assert.equal(ids(db).length, 700);
  assert.equal(told, 0);
});

test('nothing chosen: no query, no notice', async () => {
  const db = nodeDb(() => true);
  let told = 0;
  const off = onHistoryRemoved(() => told++);
  await deleteHistoryEntries(db, []);
  off();
  assert.equal(told, 0);
});

test('a new search keeps only the chosen visits still on screen', () => {
  const chosen = new Set([1, 2, 3]);
  assert.deepEqual([...keepShown(chosen, [{ id: 2 }, { id: 3 }, { id: 9 }])], [2, 3]);
  assert.equal(keepShown(chosen, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]), chosen, 'unchanged: same set');
  const none = new Set<number>();
  assert.equal(keepShown(none, []), none);
  assert.deepEqual([...keepShown(chosen, [])], []);
});
