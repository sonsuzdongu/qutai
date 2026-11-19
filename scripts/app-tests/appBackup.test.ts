// Apps in the encrypted and server backup (docs/mini-apps.md › Backup and restore): collect with and without data,
// the payload round trip, restore on the same phone (as it was) and on another (off, unsealed, no grants, data intact),
// merge and replace, an old backup without apps, an older build reading a backup with apps, size accounting.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appsDataBytes, collectBackupApps, readBackupApps, restoreApps } from '../../src/apps/appBackup.ts';
import { AppStore } from '../../src/apps/store.ts';
import { parseBackup, serializeBackup, summarize, type BackupPayload } from '../../src/backup/payload.ts';
import { nodeDb } from './nodeDb.ts';
import { notesFiles } from './notesApp.mjs';

/** What applyBackup (src/backup/database.ts) does with the section, inside its transaction. */
async function applyBackup(db: ReturnType<typeof nodeDb>, p: BackupPayload, mode: 'merge' | 'replace', now: number, key: Uint8Array | null) {
  await db.withTransactionAsync(async () => {
    if (p.apps) await restoreApps(db, p.apps, mode, key, now);
  });
}

const PHONE_A = new Uint8Array(32).fill(5);
const PHONE_B = new Uint8Array(32).fill(9);

function phone(key: Uint8Array) {
  const db = nodeDb();
  let n = 3;
  let clock = 2_000_000;
  const store = new AppStore({
    db: async () => db,
    key: async () => key,
    now: () => clock++,
    random: (len) => Uint8Array.from({ length: len }, () => (n = (n * 1103515245 + 12345) % 2147483648) % 256),
  });
  return { db, store, key };
}

const NOTES = { name: 'Notes', description: '', icon: { name: 'notes' as const }, permissions: ['clipboard-read' as const], language: 'tr', files: notesFiles() };

async function phoneWithApps() {
  const p = phone(PHONE_A);
  const notes = (await p.store.create(NOTES)).manifest.id;
  await p.store.batch(notes, [
    { op: 'add', collection: 'notes', doc: { title: 'Bir', body: 'iki' } },
    { op: 'set', key: 'settings', value: { sort: 'new' } },
  ]);
  await p.store.setGrant(notes, 'clipboard-read', 'granted');
  const tasks = (await p.store.create({ ...NOTES, name: 'Tasks', permissions: [] })).manifest.id;
  await p.store.change(tasks, { description: 'v2' }, 'assistant', null);
  return { ...p, notes, tasks };
}

/** What the backup file carries, through the same serialise and parse the app uses. */
async function backupOf(db: Awaited<ReturnType<typeof phoneWithApps>>['db'], withData: boolean): Promise<BackupPayload> {
  const payload: BackupPayload = { app: 'qutai', payloadVersion: 1, createdAt: 1, appVersion: '0.1.1', schemaVersion: 20, apps: await collectBackupApps(db, withData) };
  return parseBackup(serializeBackup(payload));
}

test('collect: the current version of each app, seal, state and grants; data only with the switch', async () => {
  const a = await phoneWithApps();
  const without = await collectBackupApps(a.db, false);
  assert.equal(without.items.length, 2);
  assert.ok(without.items.every((i) => i.data === undefined));
  const tasks = without.items.find((i) => i.manifest.id === a.tasks)!;
  assert.equal(tasks.manifest.version, 2, 'only the current version');
  const withData = await collectBackupApps(a.db, true);
  const notes = withData.items.find((i) => i.manifest.id === a.notes)!;
  assert.equal(notes.data?.docs.length, 1);
  assert.deepEqual(notes.grants, { 'clipboard-read': 'granted' });
  assert.equal(await appsDataBytes(a.db), (await a.store.usage(a.notes)) + (await a.store.usage(a.tasks)));
  const s = summarize(await backupOf(a.db, true));
  assert.equal(s.apps, 2);
  assert.equal(s.appsWithData, true);
});

test('same phone: after deleting, the apps come back as they were (on, sealed, grants, data)', async () => {
  const a = await phoneWithApps();
  const backup = await backupOf(a.db, true);
  await a.store.remove(a.notes);
  await applyBackup(a.db, backup, 'merge', 3_000_000, a.key);
  const notes = (await a.store.load(a.notes))!;
  assert.equal(notes.state, 'active');
  assert.equal(notes.sealed, true);
  assert.deepEqual(notes.grants, { 'clipboard-read': 'granted' });
  assert.equal((await a.store.docQuery(a.notes, 'notes', {})).total, 1);
  assert.deepEqual(await a.store.kvGet(a.notes, 'settings'), { sort: 'new' });
});

test('another phone: switched off, unsealed, no grants, data intact; Turn on seals it there', async () => {
  const a = await phoneWithApps();
  const backup = await backupOf(a.db, true);
  const b = phone(PHONE_B);
  await applyBackup(b.db, backup, 'merge', 3_000_000, b.key);
  const notes = (await b.store.load(a.notes))!;
  assert.equal(notes.state, 'disabled');
  assert.equal(notes.sealed, false);
  assert.deepEqual(notes.grants, {});
  assert.equal((await b.store.docQuery(a.notes, 'notes', {})).total, 1);
  assert.ok(await b.store.approveCurrent(a.notes));
  assert.equal((await b.store.load(a.notes))!.sealed, true);
  // No key at all (secure storage unavailable): never sealed.
  const c = phone(PHONE_B);
  await applyBackup(c.db, backup, 'merge', 3_000_000, null);
  assert.equal((await c.store.load(a.notes))!.state, 'disabled');
});

test('an app switched off before the backup stays off on the same phone', async () => {
  const a = await phoneWithApps();
  a.db.raw.prepare("UPDATE apps SET state = 'disabled' WHERE id = ?").run(a.tasks);
  const backup = await backupOf(a.db, false);
  await a.store.remove(a.tasks);
  await applyBackup(a.db, backup, 'merge', 3_000_000, a.key);
  assert.equal((await a.store.load(a.tasks))!.state, 'disabled');
});

test("merge: an app already here is kept as it is (the phone's copy and data win)", async () => {
  const a = await phoneWithApps();
  const backup = await backupOf(a.db, true);
  await a.store.batch(a.notes, [{ op: 'set', key: 'settings', value: { sort: 'old' } }]);
  await a.store.change(a.notes, { description: 'newer here' }, 'assistant', null);
  await applyBackup(a.db, backup, 'merge', 3_000_000, a.key);
  const notes = (await a.store.load(a.notes))!;
  assert.equal(notes.version, 2);
  assert.deepEqual(await a.store.kvGet(a.notes, 'settings'), { sort: 'old' });
});

test('replace: apps not in the backup go; with data the backup wins; without data the phone keeps its data', async () => {
  const a = await phoneWithApps();
  const withData = await backupOf(a.db, true);
  const withoutData = await backupOf(a.db, false);
  const extra = (await a.store.create({ ...NOTES, name: 'Extra', permissions: [] })).manifest.id;
  await a.store.batch(a.notes, [{ op: 'set', key: 'settings', value: { sort: 'phone' } }]);

  await applyBackup(a.db, withoutData, 'replace', 3_000_000, a.key);
  assert.equal(await a.store.load(extra), null);
  assert.deepEqual(await a.store.kvGet(a.notes, 'settings'), { sort: 'phone' }, 'a backup without data never empties an app');
  assert.equal((await a.store.load(a.notes))!.sealed, true);

  await applyBackup(a.db, withData, 'replace', 3_000_000, a.key);
  assert.deepEqual(await a.store.kvGet(a.notes, 'settings'), { sort: 'new' });
  assert.deepEqual((await a.store.list()).map((x) => x.name).sort(), ['Notes', 'Tasks']);
});

test('a changed app in a backup is skipped, the rest restores; broken data leaves the app without data', async () => {
  const a = await phoneWithApps();
  const raw = JSON.parse(serializeBackup({ app: 'qutai', payloadVersion: 1, createdAt: 1, appVersion: '0.1.1', schemaVersion: 20, apps: await collectBackupApps(a.db, true) }));
  raw.apps.items[0].files['app.js'] += '\nevil()';
  raw.apps.items[1].data = { kv: [{ key: 'bad key', value: 1 }], docs: [] };
  const parsed = parseBackup(JSON.stringify(raw));
  assert.equal(parsed.apps?.items.length, 1);
  assert.equal(parsed.apps?.items[0].data, undefined);
  assert.equal(readBackupApps({ items: 'x' }), undefined);
});

test('an old backup without apps restores fine and leaves the apps alone', async () => {
  const a = await phoneWithApps();
  const old = parseBackup(JSON.stringify({ app: 'qutai', payloadVersion: 1, createdAt: 1, appVersion: '0.1.0', schemaVersion: 19 }));
  assert.equal(old.apps, undefined);
  await applyBackup(a.db, old, 'replace', 3_000_000, a.key);
  assert.equal((await a.store.list()).length, 2);
});

test('restoreApps on its own: replace with no apps in the backup empties the apps', async () => {
  const a = await phoneWithApps();
  await restoreApps(a.db, { withData: false, items: [] }, 'replace', a.key, 1);
  assert.equal((await a.store.list()).length, 0);
  assert.equal(await appsDataBytes(a.db), 0);
});

// The payload code of the last build before phase 2 (commit 441b6d1), loaded next to the current one so its relative
// imports resolve; skipped where git or that commit is not available.
const OLD_COMMIT = '441b6d1';
const oldPath = fileURLToPath(new URL('../../src/backup/payload.before-apps.tmp.ts', import.meta.url));
after(() => rmSync(oldPath, { force: true }));

test('an older build reads a backup with apps: it ignores the section, keeps the rest, does not crash', async (t) => {
  let source: string;
  try {
    source = execFileSync('git', ['show', `${OLD_COMMIT}:src/backup/payload.ts`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    t.skip('git or the old commit is not available');
    return;
  }
  assert.ok(!source.includes('apps'), 'the old payload code knows nothing of apps');
  // Node can't tell a type from a value in a plain import: the old file's type-only names get `type` (Metro erases
  // them anyway), nothing else changes.
  for (const name of ['SiteLevel', 'CustomHeader', 'MemoryCategory', 'TaskSchedule', 'TaskTarget'])
    source = source.replace(new RegExp(`([{,]\\s*)${name}(\\s*[,}])`), `$1type ${name}$2`);
  writeFileSync(oldPath, source);
  const old = (await import(oldPath)) as typeof import('../../src/backup/payload.ts');
  const a = await phoneWithApps();
  const json = serializeBackup({
    app: 'qutai',
    payloadVersion: 1,
    createdAt: 1,
    appVersion: '0.1.1',
    schemaVersion: 20,
    memories: [{ text: 'likes tea', category: 'general', createdAt: 1, updatedAt: 1 }],
    apps: await collectBackupApps(a.db, true),
  });
  const parsed = old.parseBackup(json);
  assert.equal((parsed as Record<string, unknown>).apps, undefined);
  assert.equal(parsed.memories?.length, 1);
  assert.equal(old.summarize(parsed).memories, 1);
});
