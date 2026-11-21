// A site setting changed while the stored settings are still loading wins over what was on disk, also when the change
// is back to the default, which leaves nothing in memory to show it (SITE-26; before, only blocking was protected, so
// a removed permission came back when the load finished).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db } from '../../src/storage/db.ts';
import { SitePermissionStore } from '../../src/storage/sitePermissions.ts';

function slowDb() {
  let open!: () => void;
  const opened = new Promise<void>((r) => (open = r));
  const rows: Record<string, unknown[]> = {
    site_permissions: [
      { host: 'a.example', level: 'blocked', updated_at: 1 },
      { host: 'b.example', level: 'blocked', updated_at: 1 },
    ],
    site_location: [{ host: 'a.example', setting: 'allow' }],
    site_media: [{ host: 'a.example', kind: 'camera', setting: 'allow' }],
    site_personal: [{ host: 'a.example', setting: 'allow' }],
    site_blocking: [{ host: 'a.example' }],
  };
  const db = {
    // The lists wait until the test lets them through; writes go through at once.
    async getAllAsync(sql: string) {
      await opened;
      return rows[/FROM (\w+)/.exec(sql)![1]] ?? [];
    },
    async runAsync() {},
  } as unknown as Db;
  return { db, open };
}

test('a reset made while loading is not undone by what was on disk', async () => {
  const { db, open } = slowDb();
  const store = new SitePermissionStore(async () => db);
  const loading = store.load();
  await store.reset('a.example');
  open();
  await loading;
  assert.equal(store.levelFor('a.example'), 'default');
  assert.equal(store.locationFor('a.example'), 'ask');
  assert.equal(store.mediaFor('a.example', 'camera'), 'ask');
  assert.equal(store.personalFor('a.example'), 'ask');
  assert.equal(store.blockingFor('a.example'), true);
  // A site nobody touched gets its stored setting.
  assert.equal(store.levelFor('b.example'), 'blocked');
});

test('without a change while loading, the stored settings are read as before', async () => {
  const { db, open } = slowDb();
  const store = new SitePermissionStore(async () => db);
  open();
  await store.load();
  assert.equal(store.levelFor('a.example'), 'blocked');
  assert.equal(store.locationFor('a.example'), 'allow');
  assert.equal(store.mediaFor('a.example', 'camera'), 'allow');
  assert.equal(store.personalFor('a.example'), 'allow');
  assert.equal(store.blockingFor('a.example'), false);
});
