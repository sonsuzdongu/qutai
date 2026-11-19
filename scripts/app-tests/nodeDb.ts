// The app's Db interface (src/storage/db.ts) over Node's built-in SQLite, so the apps store runs in tests as on the phone.
import { DatabaseSync } from 'node:sqlite';
import type { Db, SqlValue } from '../../src/storage/db.ts';
import { APPS_SCHEMA_V1 } from '../../src/apps/store.ts';

export function nodeDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(APPS_SCHEMA_V1);
  let depth = 0;
  return {
    raw,
    async execAsync(sql: string) {
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
}
