// Phase 2 (docs/mini-apps.md › Phase 2): the .qutaiapp file (with and without data, tampered, wrong hash, oversized,
// newer format, not an app, a backup), import (arrives off and unsealed, ids, keep both, replace with versions kept and
// data never lost silently), and the export → delete → import → approve round trip.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APP_FILE_MAX_BYTES,
  AppFileError,
  appDataHash,
  appFileName,
  buildAppFile,
  codeFlags,
  findClash,
  readAppFile,
  uniqueAppName,
  type AppData,
} from '../../src/apps/appFile.ts';
import { packageHash } from '../../src/apps/manifest.ts';
import { AppStore } from '../../src/apps/store.ts';
import { nodeDb } from './nodeDb.ts';
import { notesFiles } from './notesApp.mjs';
import { breakoutFiles } from './breakoutApp.mjs';

const KEY = new Uint8Array(32).fill(5);
const OTHER_KEY = new Uint8Array(32).fill(9);

function setup(key: Uint8Array | null = KEY) {
  const db = nodeDb();
  let n = 7;
  let clock = 1_000_000;
  const store = new AppStore({
    db: async () => db,
    key: async () => key,
    now: () => clock++,
    random: (len) => Uint8Array.from({ length: len }, () => (n = (n * 1103515245 + 12345) % 2147483648) % 256),
  });
  return { db, store };
}

const NOTES = { name: 'Notes', description: 'My notes', icon: { name: 'notes' as const }, permissions: [], language: 'en', files: notesFiles() };
const enc = (text: string) => new TextEncoder().encode(text);

async function notesWithData() {
  const s = setup();
  const pkg = await s.store.create(NOTES);
  const id = pkg.manifest.id;
  await s.store.batch(id, [
    { op: 'add', collection: 'notes', doc: { title: 'Alışveriş', body: 'süt, ekmek' } },
    { op: 'add', collection: 'notes', doc: { title: 'İstanbul', body: 'trip 🚆' } },
    { op: 'set', key: 'settings', value: { sort: 'new' } },
  ]);
  return { ...s, id };
}

async function exportText(store: AppStore, id: string, withData: boolean) {
  const app = (await store.load(id))!;
  return buildAppFile({ pkg: app.pkg, data: withData ? await store.exportData(id) : null, exportedAt: '2026-11-19T10:00:00.000Z', exportedBy: 'Qutai test' });
}

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof AppFileError, String(e));
    return e.code;
  }
  return 'ok';
}

test('export without data: the code only, readable JSON, the hash of the package', async () => {
  const { store, id } = await notesWithData();
  const text = await exportText(store, id, false);
  const raw = JSON.parse(text);
  assert.equal(raw.format, 'qutai-app-file');
  assert.equal(raw.fileVersion, 1);
  assert.equal(raw.data, undefined);
  assert.equal(raw.package.sha256, packageHash({ manifest: raw.package.manifest, files: raw.package.files }));
  const file = readAppFile(enc(text));
  assert.equal(file.data, null);
  assert.equal(file.pkg.manifest.name, 'Notes');
  assert.deepEqual(file.pkg.files, notesFiles());
});

test('export with data: every entry and document, counted as the quota counts them', async () => {
  const { store, id } = await notesWithData();
  const file = readAppFile(enc(await exportText(store, id, true)));
  assert.equal(file.data?.kv.length, 1);
  assert.equal(file.data?.docs.length, 2);
  assert.equal(file.dataBytes, await store.usage(id));
});

test('file names: safe characters, and "(with data)" when it has data', () => {
  assert.equal(appFileName('Notes', false), 'Notes.qutaiapp');
  assert.equal(appFileName('A/B: C?', true, 'verilerle'), 'A-B- C-.qutaiapp'.replace('.qutaiapp', ' (verilerle).qutaiapp'));
  assert.equal(appFileName('...', false), 'app.qutaiapp');
});

test('a changed file is refused: package, data, and a recount that does not match', async () => {
  const { store, id } = await notesWithData();
  const text = await exportText(store, id, true);
  const raw = JSON.parse(text);

  const files = structuredClone(raw);
  files.package.files['app.js'] += '\nfetch("https://evil.example")';
  assert.equal(code(() => readAppFile(enc(JSON.stringify(files)))), 'damaged');

  const name = structuredClone(raw);
  name.package.manifest.permissions = ['clipboard-read'];
  assert.equal(code(() => readAppFile(enc(JSON.stringify(name)))), 'damaged');

  const data = structuredClone(raw);
  data.data.docs[0].doc.title = 'changed';
  assert.equal(code(() => readAppFile(enc(JSON.stringify(data)))), 'damaged');

  const bytes = structuredClone(raw);
  bytes.data.bytes += 1;
  assert.equal(code(() => readAppFile(enc(JSON.stringify(bytes)))), 'damaged');

  const wrongHash = structuredClone(raw);
  wrongHash.package.sha256 = '0'.repeat(64);
  assert.equal(code(() => readAppFile(enc(JSON.stringify(wrongHash)))), 'damaged');

  // Times and the version number are not part of the package: changing them is not damage.
  const times = structuredClone(raw);
  times.package.manifest.updatedAt = '2030-01-01T00:00:00.000Z';
  times.package.manifest.version = 9;
  assert.equal(code(() => readAppFile(enc(JSON.stringify(times)))), 'ok');
});

test('a re-hashed edit passes the hash: the hash is not a signature (the trust rules are what protect)', async () => {
  const { store, id } = await notesWithData();
  const raw = JSON.parse(await exportText(store, id, false));
  raw.package.files['app.js'] += '\n// edited';
  raw.package.sha256 = packageHash({ manifest: raw.package.manifest, files: raw.package.files });
  assert.equal(code(() => readAppFile(enc(JSON.stringify(raw)))), 'ok');
});

test('oversized, newer, not an app, a backup, broken data: each its own plain error', async () => {
  const { store, id } = await notesWithData();
  const raw = JSON.parse(await exportText(store, id, true));
  assert.equal(code(() => readAppFile(new Uint8Array(APP_FILE_MAX_BYTES + 1))), 'too-large');
  assert.equal(code(() => readAppFile(enc(JSON.stringify({ ...raw, fileVersion: 2 })))), 'newer');
  const newerPackage = structuredClone(raw);
  newerPackage.package.manifest.formatVersion = 2;
  assert.equal(code(() => readAppFile(enc(JSON.stringify(newerPackage)))), 'newer');
  assert.equal(code(() => readAppFile(enc('{"format":"something"}'))), 'not-app');
  assert.equal(code(() => readAppFile(enc('<html>'))), 'not-app');
  assert.equal(code(() => readAppFile(Uint8Array.from([0xff, 0xfe, 0x00]))), 'not-app');
  assert.equal(code(() => readAppFile(enc('QUTAIBAK\u0001rest'))), 'backup');
  // A package that is too large or has a bad file name is "invalid" with the reason.
  const big = structuredClone(raw);
  big.package.files['app.js'] = 'x'.repeat(300 * 1024);
  big.package.sha256 = packageHash({ manifest: big.package.manifest, files: big.package.files });
  assert.equal(code(() => readAppFile(enc(JSON.stringify(big)))), 'invalid');
  const path = structuredClone(raw);
  path.package.files['../evil.js'] = '1';
  assert.equal(code(() => readAppFile(enc(JSON.stringify(path)))), 'invalid');
  // Data over the quota, a bad key, a document twice.
  const fat = structuredClone(raw);
  fat.data.kv = Array.from({ length: 22 }, (_, i) => ({ key: `k${i}`, value: 'x'.repeat(250 * 1024) }));
  fat.data.sha256 = appDataHash(fat.data as AppData);
  delete fat.data.bytes;
  assert.match((() => { try { readAppFile(enc(JSON.stringify(fat))); } catch (e) { return (e as AppFileError).code + ' ' + (e as Error).message; } return 'ok'; })(), /^invalid .*MB an app may keep/);
  const badKey = structuredClone(raw);
  badKey.data.kv[0].key = 'no spaces';
  assert.equal(code(() => readAppFile(enc(JSON.stringify(badKey)))), 'invalid');
  const twice = structuredClone(raw);
  twice.data.docs.push(twice.data.docs[0]);
  assert.equal(code(() => readAppFile(enc(JSON.stringify(twice)))), 'invalid');
});

test('a newer contract is accepted (listed as needing a newer Qutai); later-phase permissions are accepted', async () => {
  const { store, id } = await notesWithData();
  const raw = JSON.parse(await exportText(store, id, false));
  raw.package.manifest.contract = 2;
  raw.package.manifest.permissions = ['location', 'network'];
  raw.package.manifest.network = { hosts: ['api.example.com'] };
  raw.package.sha256 = packageHash({ manifest: raw.package.manifest, files: raw.package.files });
  const file = readAppFile(enc(JSON.stringify(raw)));
  assert.equal(file.pkg.manifest.contract, 2);
});

test('import arrives switched off and unsealed, author imported, no grants; data only when asked', async () => {
  const a = await notesWithData();
  await a.store.setGrant(a.id, 'clipboard-read', 'granted');
  const file = readAppFile(enc(await exportText(a.store, a.id, true)));

  const b = setup(OTHER_KEY);
  const id = await b.store.importApp({ pkg: file.pkg, mode: 'new', fileName: '/x/Notes (with data).qutaiapp' });
  assert.equal(id, a.id, 'a free id is kept');
  const app = (await b.store.load(id))!;
  assert.equal(app.state, 'disabled');
  assert.equal(app.sealed, false);
  assert.deepEqual(app.grants, {});
  assert.deepEqual(app.pkg.manifest.author, { kind: 'imported', file: 'Notes (with data).qutaiapp', importedAt: app.pkg.manifest.author.kind === 'imported' ? app.pkg.manifest.author.importedAt : '' });
  assert.equal(app.version, 1);
  assert.equal(app.versions[0].source, 'import');
  assert.equal(await b.store.usage(id), 0, 'no data without consent');

  // Turn on seals it with this phone's key.
  assert.ok(await b.store.approveCurrent(id));
  const on = (await b.store.load(id))!;
  assert.equal(on.sealed, true);
  assert.equal(on.state, 'active');
});

test('export with data → delete → import with data → approve: the notes are back', async () => {
  const { store, id } = await notesWithData();
  const before = await store.docQuery(id, 'notes', {});
  const file = readAppFile(enc(await exportText(store, id, true)));
  await store.remove(id);
  assert.equal((await store.list()).length, 0);
  const back = await store.importApp({ pkg: file.pkg, mode: 'new', fileName: 'Notes.qutaiapp', data: file.data });
  assert.equal(back, id);
  assert.equal((await store.load(back))!.sealed, false, 'even on the same phone an import needs approval');
  assert.ok(await store.approveCurrent(back));
  const after = await store.docQuery(back, 'notes', {});
  assert.deepEqual(after.docs.map((d) => d.title).sort(), before.docs.map((d) => d.title).sort());
  assert.deepEqual(await store.kvGet(back, 'settings'), { sort: 'new' });
  assert.equal(await store.usage(back), file.dataBytes);
  // The quota keeps working after an import.
  await assert.rejects(
    (async () => {
      for (let i = 0; i < 30; i++) await store.kvSet(back, `fill${i}`, 'x'.repeat(250 * 1024));
    })(),
    /storage is full/,
  );
});

test('id clash: keep both makes a new id and name, data apart; new mode refuses a taken id', async () => {
  const { store, id } = await notesWithData();
  const file = readAppFile(enc(await exportText(store, id, true)));
  const existing = (await store.list()).map((a) => ({ id: a.id, name: a.name }));
  assert.deepEqual(findClash(file.pkg.manifest, existing), { kind: 'id', app: { id, name: 'Notes' } });
  await assert.rejects(store.importApp({ pkg: file.pkg, mode: 'new', fileName: 'n.qutaiapp' }), /already here/);
  const copy = await store.importApp({ pkg: file.pkg, mode: 'keepBoth', fileName: 'n.qutaiapp', data: file.data });
  assert.notEqual(copy, id);
  assert.equal((await store.load(copy))!.name, 'Notes 2');
  await store.batch(copy, [{ op: 'set', key: 'only-copy', value: 1 }]);
  assert.equal(await store.kvGet(id, 'only-copy'), null, 'two copies never share data');
  assert.equal(uniqueAppName('Notes', [{ id: 'a', name: 'notes' }, { id: 'b', name: 'Notes 2' }]), 'Notes 3');
  assert.equal(findClash({ ...file.pkg.manifest, id: 'app-zzzzzzzzzzzz', name: 'NOTES' }, existing)?.kind, 'name');
});

test('replace: the next version, the old one kept, switched off, grants dropped, phone data kept unless confirmed', async () => {
  const { store, id } = await notesWithData();
  await store.setGrant(id, 'clipboard-read', 'granted');
  const raw = JSON.parse(await exportText(store, id, true));
  raw.package.files['app.js'] += '\n// v2 from a friend';
  raw.package.sha256 = packageHash({ manifest: raw.package.manifest, files: raw.package.files });
  raw.data = { kv: [{ key: 'friend', value: true }], docs: [] };
  raw.data.sha256 = appDataHash(raw.data);
  const file = readAppFile(enc(JSON.stringify(raw)));
  const usage = await store.usage(id);

  await store.importApp({ pkg: file.pkg, mode: 'replace', targetId: id, fileName: 'n.qutaiapp', data: file.data });
  let app = (await store.load(id))!;
  assert.equal(app.version, 2);
  assert.deepEqual(app.versions.map((v) => v.version), [2, 1]);
  assert.equal(app.state, 'disabled');
  assert.equal(app.sealed, false);
  assert.deepEqual(app.grants, {});
  assert.equal(await store.usage(id), usage, "the phone's data stays without the user's confirmation");
  assert.equal(await store.kvGet(id, 'friend'), null);
  // Going back to the old version is one choice in Versions; it is still sealed and runs.
  assert.ok(await store.setCurrent(id, 1));
  assert.equal((await store.load(id))!.sealed, true);
  assert.ok(await store.setCurrent(id, 2));

  await store.importApp({ pkg: file.pkg, mode: 'replace', targetId: id, fileName: 'n.qutaiapp', data: file.data, replaceData: true });
  app = (await store.load(id))!;
  assert.equal(app.version, 3);
  assert.equal(await store.kvGet(id, 'friend'), true);
  assert.equal(await store.kvGet(id, 'settings'), null);
});

test('flags name the code an app normally does not need', () => {
  assert.deepEqual(codeFlags(notesFiles()), []);
  assert.deepEqual(codeFlags(breakoutFiles()), ['RTCPeerConnection', 'iframe', 'frames[', 'eval', 'WebAssembly']);
});
