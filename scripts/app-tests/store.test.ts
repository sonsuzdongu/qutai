// Apps on the phone (src/apps/store.ts, query.ts, bridge.ts, contract.ts): versions and undo, the seal, deleting,
// the key-value and document store with its quota and atomic writes, queries, and the permission checks of every
// bridge call. Runs against Node's SQLite with the same Db interface as the app.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bridge, type BridgeHost } from '../../src/apps/bridge.ts';
import { CALLS, checkCall, IMPLEMENTED_PHASE, LIMITS, parseBridgeRequest } from '../../src/apps/contract.ts';
import { AVAILABLE_PERMISSIONS, PACKAGE_LIMITS, type AppPermission } from '../../src/apps/manifest.ts';
import { foldText, runQuery, type Doc } from '../../src/apps/query.ts';
import { AppStore } from '../../src/apps/store.ts';
import { nodeDb } from './nodeDb.ts';
import { BREAK_EDIT, notesFiles } from './notesApp.mjs';

const KEY = new Uint8Array(32).fill(5);

function setup(options: { key?: Uint8Array | null } = {}) {
  const db = nodeDb();
  let n = 0;
  let clock = 1_000_000;
  const store = new AppStore({
    db: async () => db,
    key: async () => (options.key === undefined ? KEY : options.key),
    now: () => clock++,
    random: (len) => Uint8Array.from({ length: len }, () => (n = (n * 1103515245 + 12345) % 2147483648) % 256),
  });
  return { db, store };
}

const NOTES = { name: 'Notes', description: 'My notes', icon: { name: 'notes' as const }, permissions: [], language: 'tr', files: notesFiles() };

test('create, load, list: version 1, sealed, local author', async () => {
  const { store } = setup();
  const pkg = await store.create(NOTES);
  assert.match(pkg.manifest.id, /^app-[a-z0-9]{12}$/);
  assert.equal(pkg.manifest.version, 1);
  assert.deepEqual(pkg.manifest.author, { kind: 'local' });
  const app = await store.load(pkg.manifest.id);
  assert.ok(app?.sealed);
  assert.equal(app?.state, 'active');
  assert.deepEqual((await store.list()).map((a) => a.name), ['Notes']);
});

test('create refuses a bad package with the reason', async () => {
  const { store } = setup();
  await assert.rejects(store.create({ ...NOTES, files: { 'app.js': '' } }), /index\.html is missing/);
  await assert.rejects(store.create({ ...NOTES, permissions: ['location'] as AppPermission[] }), /not available yet/);
  assert.equal((await store.list()).length, 0);
});

test('without the device key nothing is saved', async () => {
  const { store } = setup({ key: null });
  await assert.rejects(store.create(NOTES), /Secure storage/);
});

test('a version changed behind Qutai\'s back is not sealed any more', async () => {
  const { store, db } = setup();
  const { manifest } = await store.create(NOTES);
  db.raw.prepare('UPDATE app_versions SET files = ? WHERE app_id = ?').run(JSON.stringify({ ...notesFiles(), 'app.js': 'evil()' }), manifest.id);
  assert.equal((await store.load(manifest.id))?.sealed, false);
});

test('changes make new versions; undo goes back and a later change gets the next number', async () => {
  const { store } = setup();
  const { manifest } = await store.create(NOTES);
  const id = manifest.id;
  const v2 = await store.change(id, { edits: [BREAK_EDIT] }, 'assistant', 'broke it');
  assert.equal(v2.manifest.version, 2);
  assert.ok(v2.files['app.js'].includes('rendr();'));
  assert.equal(await store.undo(id), 1);
  const back = await store.load(id);
  assert.equal(back?.version, 1);
  assert.ok(!back?.pkg.files['app.js'].includes('rendr();'));
  assert.deepEqual(back?.versions.map((v) => v.version), [2, 1]);
  const v3 = await store.change(id, { name: 'Notlar' }, 'assistant', null);
  assert.equal(v3.manifest.version, 3);
  assert.equal((await store.list())[0].name, 'Notlar');
  assert.equal(await store.undo(id), 2);
  assert.equal(await store.undo(id), 1);
  assert.equal(await store.undo(id), null);
  assert.ok(await store.setCurrent(id, 3));
  assert.equal((await store.load(id))?.version, 3);
});

test('edits must match exactly once; whole files can be replaced or deleted', async () => {
  const { store } = setup();
  const { manifest } = await store.create(NOTES);
  await assert.rejects(store.change(manifest.id, { edits: [{ file: 'app.js', find: 'not there', replace: 'x' }] }, 'assistant', null), /not in app\.js/);
  await assert.rejects(store.change(manifest.id, { edits: [{ file: 'app.js', find: 'const', replace: 'let' }] }, 'assistant', null), /more than once/);
  await assert.rejects(store.change(manifest.id, { edits: [{ file: 'x.js', find: 'a', replace: 'b' }] }, 'assistant', null), /no file x\.js/);
  await assert.rejects(store.change(manifest.id, { files: { 'index.html': null } }, 'assistant', null), /entry file/);
  const v = await store.change(manifest.id, { files: { 'style.css': null, 'extra.js': '1;' } }, 'assistant', null);
  assert.deepEqual(Object.keys(v.files).sort(), ['app.js', 'extra.js', 'index.html']);
});

test(`only the ${PACKAGE_LIMITS.keptVersions} newest versions and the current one are kept`, async () => {
  const { store } = setup();
  const { manifest } = await store.create(NOTES);
  for (let i = 0; i < 25; i++) await store.change(manifest.id, { description: `v${i + 2}` }, 'assistant', null);
  const versions = (await store.versions(manifest.id)).map((v) => v.version);
  assert.equal(versions.length, PACKAGE_LIMITS.keptVersions);
  assert.equal(versions[0], 26);
  // The current version survives pruning even when it is old.
  await store.setCurrent(manifest.id, 7);
  for (let i = 0; i < 25; i++) await store.change(manifest.id, { description: `w${i}` }, 'assistant', null);
  assert.equal((await store.load(manifest.id))?.version, 51);
});

test('deleting an app deletes its versions and data, not other apps\'', async () => {
  const { store, db } = setup();
  const a = (await store.create(NOTES)).manifest.id;
  const b = (await store.create({ ...NOTES, name: 'Other' })).manifest.id;
  await store.kvSet(a, 'k', 1);
  await store.batch(a, [{ op: 'add', collection: 'notes', doc: { title: 'x' } }]);
  await store.kvSet(b, 'k', 2);
  await store.remove(a);
  for (const table of ['apps', 'app_versions', 'app_kv', 'app_docs'])
    assert.equal((db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'apps' ? 'id' : 'app_id'} = ?`).get(a) as { n: number }).n, 0, table);
  assert.equal(await store.kvGet(b, 'k'), 2);
});

test('key-value: set, get, keys, many, remove; names checked', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  await store.kvSet(id, 'settings', { sort: 'new' });
  await store.kvSetMany(id, { 'a.1': 1, 'a.2': [2] });
  assert.deepEqual(await store.kvGet(id, 'settings'), { sort: 'new' });
  assert.equal(await store.kvGet(id, 'nope'), null);
  assert.deepEqual(await store.kvKeys(id, 'a.'), ['a.1', 'a.2']);
  assert.deepEqual(await store.kvGetMany(id, ['a.1', 'nope']), { 'a.1': 1, nope: null });
  await store.kvRemove(id, 'a.1');
  assert.deepEqual(await store.kvKeys(id, ''), ['a.2', 'settings']);
  await assert.rejects(store.kvSet(id, '', 1), /key must be/);
  await assert.rejects(store.kvSet(id, 'a b', 1), /key must be/);
  await assert.rejects(store.kvSet(id, 'k', undefined), /missing/);
});

test('quota: a write over 5 MB fails with E_QUOTA and writes nothing; one value over 256 KB with E_TOO_LARGE', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  const big = 'x'.repeat(250 * 1024);
  for (let i = 0; i < 20; i++) await store.kvSet(id, `k${i}`, big);
  const used = await store.usage(id);
  assert.ok(used > 4.8 * 1024 * 1024 && used <= LIMITS.quotaBytes);
  await assert.rejects(store.kvSet(id, 'one-more', big), (e: { code?: string }) => e.code === 'E_QUOTA');
  assert.equal(await store.kvGet(id, 'one-more'), null);
  // Replacing a value with a smaller one is always allowed, and frees space.
  await store.kvSet(id, 'k0', 'small');
  assert.ok((await store.usage(id)) < used);
  await assert.rejects(store.kvSet(id, 'huge', 'x'.repeat(LIMITS.valueBytes + 1)), (e: { code?: string }) => e.code === 'E_TOO_LARGE');
  // Another app's quota is its own.
  const other = (await store.create({ ...NOTES, name: 'B' })).manifest.id;
  await store.kvSet(other, 'k', big);
});

test('batch is all or nothing', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  await store.kvSet(id, 'keep', 1);
  await assert.rejects(
    store.batch(id, [
      { op: 'set', key: 'a', value: 1 },
      { op: 'add', collection: 'notes', doc: { title: 'x' } },
      { op: 'update', collection: 'notes', id: 'missing', patch: { x: 1 } },
    ]),
    (e: { code?: string }) => e.code === 'E_NOT_FOUND',
  );
  assert.equal(await store.kvGet(id, 'a'), null);
  assert.equal((await store.docQuery(id, 'notes', {})).total, 0);
  await assert.rejects(store.batch(id, [{ op: 'set', key: 'a', value: 1 }, { op: 'explode' }]), /ops\[1\]/);
  assert.equal(await store.kvGet(id, 'a'), null);
  await assert.rejects(store.batch(id, Array.from({ length: 101 }, () => ({ op: 'remove', key: 'x' }))), (e: { code?: string }) => e.code === 'E_TOO_LARGE');
  // Operations see each other: add then update in one batch.
  const [added] = (await store.batch(id, [{ op: 'put', collection: 'c', id: 'n1', doc: { a: 1 } }, { op: 'update', collection: 'c', id: 'n1', patch: { b: 2 } }])) as Doc[];
  assert.equal(added.a, 1);
  assert.deepEqual({ ...(await store.docGet(id, 'c', 'n1')), createdAt: 0, updatedAt: 0 }, { id: 'n1', a: 1, b: 2, createdAt: 0, updatedAt: 0 });
});

test('concurrent writes of one app do not interleave or lose updates', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  await store.batch(id, [{ op: 'put', collection: 'c', id: 'x', doc: { n: 0 } }]);
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => store.batch(id, [{ op: 'update', collection: 'c', id: 'x', patch: { [`f${i}`]: i } }])),
  );
  const doc = await store.docGet(id, 'c', 'x');
  for (let i = 0; i < 20; i++) assert.equal(doc?.[`f${i}`], i);
});

test('documents: add, get, put, update (null removes), delete, collections, clear; reserved fields are Qutai\'s', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  const [doc] = (await store.batch(id, [{ op: 'add', collection: 'notes', doc: { title: 'A', id: 'mine', createdAt: 1 } }])) as Doc[];
  assert.notEqual(doc.id, 'mine');
  assert.ok(doc.createdAt > 1);
  const [updated] = (await store.batch(id, [{ op: 'update', collection: 'notes', id: doc.id, patch: { title: null, body: 'b' } }])) as Doc[];
  assert.equal('title' in updated, false);
  assert.equal(updated.body, 'b');
  assert.equal(updated.createdAt, doc.createdAt);
  assert.deepEqual(await store.collections(id), [{ name: 'notes', count: 1 }]);
  assert.deepEqual(await store.batch(id, [{ op: 'delete', collection: 'notes', id: doc.id }]), [true]);
  assert.deepEqual(await store.batch(id, [{ op: 'delete', collection: 'notes', id: doc.id }]), [false]);
  await store.batch(id, [{ op: 'add', collection: 'notes', doc: {} }, { op: 'add', collection: 'notes', doc: {} }]);
  assert.equal(await store.docClear(id, 'notes'), 2);
  await assert.rejects(store.docQuery(id, 'bad name', {}), /collection/);
  await assert.rejects(store.batch(id, [{ op: 'add', collection: 'notes', doc: [1] }]), /must be an object/);
});

const DOCS: Doc[] = [
  { id: 'a', createdAt: 1, updatedAt: 5, title: 'İstanbul gezisi', body: 'Boğaz turu', done: false, tags: ['travel'], prio: 2, meta: { pinned: true } },
  { id: 'b', createdAt: 2, updatedAt: 4, title: 'Alışveriş', body: 'süt, ekmek', done: true, tags: ['home'], prio: 1 },
  { id: 'c', createdAt: 3, updatedAt: 3, title: 'ışık faturası', body: 'Ödendi', done: false, tags: ['home', 'bills'], prio: 3 },
  { id: 'd', createdAt: 4, updatedAt: 6, title: 'Café notes', body: 'crème brûlée', prio: null },
];
const QUERY_CASES: [string, Record<string, unknown>, string[]][] = [
  ['everything, in creation order', {}, ['a', 'b', 'c', 'd']],
  ['equality', { where: { done: true } }, ['b']],
  ['ne', { where: { done: { ne: true } } }, ['a', 'c', 'd']],
  ['lt / gte', { where: { prio: { gte: 2, lt: 3 } } }, ['a']],
  ['in', { where: { prio: { in: [1, 3] } } }, ['b', 'c']],
  ['array contains', { where: { tags: { contains: 'home' } } }, ['b', 'c']],
  ['string contains folds case and accents', { where: { body: { contains: 'BOGAZ' } } }, ['a']],
  ['startsWith', { where: { title: { startsWith: 'al' } } }, ['b']],
  ['exists false', { where: { tags: { exists: false } } }, ['d']],
  ['dotted field', { where: { 'meta.pinned': true } }, ['a']],
  ['search: Turkish dotted capital İ', { search: { text: 'istanbul' } }, ['a']],
  ['search: dotless ı and I', { search: { text: 'ISIK' } }, ['c']],
  ['search: accents', { search: { text: 'creme brulee' } }, ['d']],
  ['search: every word must match', { search: { text: 'süt ekmek' } }, ['b']],
  ['search: only the given fields', { search: { text: 'ödendi', fields: ['title'] } }, []],
  ['search: tags are searched without fields', { search: { text: 'bills' } }, ['c']],
  ['order desc', { orderBy: [{ field: 'updatedAt', dir: 'desc' }] }, ['d', 'a', 'b', 'c']],
  ['order by a string field, missing last', { orderBy: 'prio' }, ['b', 'a', 'c', 'd']],
  ['limit and offset', { orderBy: 'createdAt', limit: 2, offset: 1 }, ['b', 'c']],
];
for (const [name, query, ids] of QUERY_CASES) {
  test(`query: ${name}`, () => {
    assert.deepEqual(runQuery(DOCS, query as never).docs.map((d) => d.id), ids);
  });
}

test('query: total counts all matches, not the page', () => {
  assert.equal(runQuery(DOCS, { limit: 1 }).total, 4);
});

test('query: bad queries are refused by the store', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  for (const q of [{ where: [] }, { where: { x: { regex: 'a' } } }, { limit: 501 }, { limit: 0 }, { offset: -1 }, { orderBy: [{ field: 'a', dir: 'up' }] }, { search: 'x' }, { select: ['a'] }])
    await assert.rejects(store.docQuery(id, 'notes', q), (e: { code?: string }) => e.code === 'E_BAD_ARGS', JSON.stringify(q));
});

test('foldText', () => {
  assert.equal(foldText('İSTANBUL Işık ĞÜŞÖÇ'), 'istanbul isik gusoc');
});

// ---------- The bridge ----------

function host(store: AppStore, appId: string, permissions: AppPermission[], answers: Partial<Record<string, unknown>> = {}) {
  const calls: string[] = [];
  const h: BridgeHost = {
    appId,
    manifest: () => ({ permissions, name: 'Notes', version: 1, language: 'tr' }) as never,
    store,
    uiLanguage: () => 'tr',
    platform: 'ios',
    theme: () => ({ dark: false, colors: {} as never, fontScale: 1 }),
    insets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    toast: (text) => calls.push(`toast:${text}`),
    alert: async () => void calls.push('alert'),
    confirm: async () => (answers.confirm as boolean | null) ?? true,
    prompt: async () => (answers.prompt as string | null) ?? 'typed',
    askPermission: async (p) => {
      calls.push(`ask:${p}`);
      return ('permission' in answers ? answers.permission : 'granted') as 'granted' | 'denied' | null;
    },
    haptic: (k) => calls.push(`haptic:${k}`),
    setTitle: (t) => calls.push(`title:${t}`),
    setBackHandler: (b) => calls.push(`back:${b}`),
    close: () => calls.push('close'),
    clipboardWrite: async (t) => void calls.push(`copy:${t}`),
    clipboardRead: async () => 'pasted',
  };
  return { bridge: new Bridge(h), calls };
}

test('every call of the contract: unknown, later phase, undeclared and implicit calls answer as the contract says', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  const { bridge } = host(store, id, []);
  for (const [call, spec] of Object.entries(CALLS)) {
    const answer = await bridge.handle({ id: 1, call, args: {} });
    if (spec.phase > IMPLEMENTED_PHASE) assert.ok(!answer.ok && answer.error.code === 'E_NOT_AVAILABLE', call);
    else if (spec.need !== 'implicit') assert.ok(!answer.ok && answer.error.code === 'E_NOT_DECLARED', call);
    else if (!answer.ok) assert.ok(!['E_NOT_DECLARED', 'E_NOT_AVAILABLE', 'E_UNKNOWN_CALL', 'E_INTERNAL'].includes(answer.error.code), `${call}: ${answer.error.code}`);
  }
  for (const call of ['storage.drop', '__proto__', 'constructor', 'toString', 'network.fetch']) {
    const answer = await bridge.handle({ id: 1, call, args: {} });
    assert.ok(!answer.ok, call);
  }
});

test('checkCall: declared later-phase permissions are still not available; asked ones ask; denied ones fail', () => {
  assert.equal((checkCall('location.current', ['location'], {}) as { code: string }).code, 'E_NOT_AVAILABLE');
  assert.deepEqual(checkCall('clipboard.read', ['clipboard-read'], {}), { ok: 'ask', permission: 'clipboard-read' });
  assert.equal((checkCall('clipboard.read', ['clipboard-read'], { 'clipboard-read': 'denied' }) as { code: string }).code, 'E_DENIED');
  assert.deepEqual(checkCall('clipboard.read', ['clipboard-read'], { 'clipboard-read': 'granted' }), { ok: true });
  assert.deepEqual(checkCall('clipboard.write', ['clipboard-write'], {}), { ok: true });
  for (const p of AVAILABLE_PERMISSIONS) assert.ok(Object.values(CALLS).some((c) => c.need === p && c.phase === 1), p);
});

test('clipboard: write needs the declaration only; read asks once, remembers, and a revoke asks again', async () => {
  const { store } = setup();
  const id = (await store.create({ ...NOTES, permissions: ['clipboard-read', 'clipboard-write'] })).manifest.id;
  const { bridge, calls } = host(store, id, ['clipboard-read', 'clipboard-write']);
  assert.deepEqual(await bridge.handle({ id: 1, call: 'clipboard.write', args: { text: 'hi' } }), { id: 1, ok: true, value: true });
  assert.deepEqual(await bridge.handle({ id: 2, call: 'clipboard.read', args: {} }), { id: 2, ok: true, value: 'pasted' });
  await bridge.handle({ id: 3, call: 'clipboard.read', args: {} });
  assert.deepEqual(calls.filter((c) => c.startsWith('ask:')), ['ask:clipboard-read']);
  await store.setGrant(id, 'clipboard-read', null);
  await bridge.handle({ id: 4, call: 'clipboard.read', args: {} });
  assert.equal(calls.filter((c) => c.startsWith('ask:')).length, 2);
});

test('clipboard: a no is remembered; dismissing is not an answer', async () => {
  const { store } = setup();
  const id = (await store.create({ ...NOTES, permissions: ['clipboard-read'] })).manifest.id;
  const denied = host(store, id, ['clipboard-read'], { permission: 'denied' });
  const a = await denied.bridge.handle({ id: 1, call: 'clipboard.read', args: {} });
  assert.ok(!a.ok && a.error.code === 'E_DENIED');
  assert.equal((await store.grants(id))['clipboard-read'], 'denied');
  const b = await denied.bridge.handle({ id: 2, call: 'clipboard.read', args: {} });
  assert.ok(!b.ok && b.error.code === 'E_DENIED');
  assert.equal(denied.calls.filter((c) => c.startsWith('ask:')).length, 1);

  const id2 = (await store.create({ ...NOTES, name: 'B', permissions: ['clipboard-read'] })).manifest.id;
  const dismissed = host(store, id2, ['clipboard-read'], { permission: null });
  const c = await dismissed.bridge.handle({ id: 1, call: 'clipboard.read', args: {} });
  assert.ok(!c.ok && c.error.code === 'E_CANCELLED');
  assert.equal((await store.grants(id2))['clipboard-read'], undefined);
});

test('app.requestPermission: only declared ones; app.permissions lists states', async () => {
  const { store } = setup();
  const id = (await store.create({ ...NOTES, permissions: ['clipboard-read', 'clipboard-write'] })).manifest.id;
  const { bridge } = host(store, id, ['clipboard-read', 'clipboard-write']);
  const undeclared = await bridge.handle({ id: 1, call: 'app.requestPermission', args: { permission: 'location' } });
  assert.ok(!undeclared.ok && undeclared.error.code === 'E_NOT_DECLARED');
  assert.deepEqual(await bridge.handle({ id: 2, call: 'app.permissions', args: {} }), {
    id: 2,
    ok: true,
    value: { declared: ['clipboard-read', 'clipboard-write'], granted: { 'clipboard-read': 'ask', 'clipboard-write': 'granted' } },
  });
  assert.deepEqual(await bridge.handle({ id: 3, call: 'app.requestPermission', args: { permission: 'clipboard-read' } }), { id: 3, ok: true, value: 'granted' });
});

test('ui calls check their arguments; one dialog at a time', async () => {
  const { store } = setup();
  const id = (await store.create(NOTES)).manifest.id;
  const { bridge, calls } = host(store, id, []);
  const long = await bridge.handle({ id: 1, call: 'ui.toast', args: { text: 'x'.repeat(121) } });
  assert.ok(!long.ok && long.error.code === 'E_TOO_LARGE');
  const bad = await bridge.handle({ id: 2, call: 'ui.haptic', args: { kind: 'explode' } });
  assert.ok(!bad.ok && bad.error.code === 'E_BAD_ARGS');
  await bridge.handle({ id: 3, call: 'ui.setTitle', args: { title: 'a\nb' } });
  assert.ok(calls.includes('title:a b'));
  // Two confirms at once: the second is refused while the first is open.
  let release: (v: boolean) => void = () => {};
  const slow = host(store, id, []);
  (slow.bridge as unknown as { host: BridgeHost }).host.confirm = () => new Promise((r) => (release = r));
  const first = slow.bridge.handle({ id: 1, call: 'ui.confirm', args: { title: 'A?' } });
  const second = await slow.bridge.handle({ id: 2, call: 'ui.confirm', args: { title: 'B?' } });
  assert.ok(!second.ok && second.error.code === 'E_BUSY');
  release(true);
  assert.deepEqual(await first, { id: 1, ok: true, value: true });
});

test('the bridge only touches its own app\'s rows, whatever the message says', async () => {
  const { store } = setup();
  const a = (await store.create(NOTES)).manifest.id;
  const b = (await store.create({ ...NOTES, name: 'B' })).manifest.id;
  await store.kvSet(b, 'secret', 'b-data');
  const { bridge } = host(store, a, []);
  const read = await bridge.handle({ id: 1, call: 'storage.get', args: { key: 'secret', appId: b, app_id: b } });
  assert.deepEqual(read, { id: 1, ok: true, value: null });
  await bridge.handle({ id: 2, call: 'storage.set', args: { key: 'secret', value: 'a-data', appId: b } });
  assert.equal(await store.kvGet(b, 'secret'), 'b-data');
});

test('parseBridgeRequest drops what is not a request', () => {
  assert.deepEqual(parseBridgeRequest('{"qutai":1,"id":3,"call":"storage.get","args":{"key":"a"}}'), { id: 3, call: 'storage.get', args: { key: 'a' } });
  for (const raw of ['', 'nope', '{"id":1,"call":"x"}', '{"qutai":2,"id":1,"call":"x"}', '{"qutai":1,"id":-1,"call":"x"}', '{"qutai":1,"id":1,"call":"x","args":[1]}', `{"qutai":1,"id":1,"call":"${'x'.repeat(65)}"}`])
    assert.equal(parseBridgeRequest(raw), null, raw);
  assert.equal(parseBridgeRequest(`{"qutai":1,"id":1,"call":"x","args":{"v":"${'x'.repeat(LIMITS.messageBytes)}"}}`), null);
});
