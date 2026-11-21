// Blocking state saved by an earlier run (src/content/blocking.ts): catalogue lists keep their switches with the
// catalogue's current names and addresses, custom lists come back, starting parses nothing. Then Android: the
// compiled domains go to the native matcher as a file.
import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error the harness's stand-in (./loader.mjs) exports the test handle
import { __fs } from 'expo-file-system';
// @ts-expect-error the harness's stand-in (./loader.mjs) exports the test handle
import { __native } from '../../src/device/contentBlocker.ts';

process.env.QUTAI_TEST_OS = 'android';
__fs.dirs.add('/doc/content-blocking');
__fs.files.set(
  '/doc/content-blocking/state.json',
  JSON.stringify({
    version: 1,
    lists: [
      { id: 'easylist', name: 'Old name', url: 'https://old.example/easylist.txt', kind: 'ads', enabled: false },
      { id: 'adguard-german', name: 'x', url: 'x', kind: 'regional', enabled: true, fetchedAt: 1, domains: 1 },
      { id: 'custom-1', name: 'mine', url: 'https://lists.example.org/mine.txt', kind: 'custom', enabled: true, fetchedAt: 1, domains: 1 },
      { id: 'gone', name: 'removed from the catalogue', url: 'https://x', kind: 'ads', enabled: true },
    ],
    compiled: { key: 'adguard-german@1,custom-1@1', domains: 2, ruleLists: [], at: 1 },
  }),
);
__fs.files.set('/doc/content-blocking/list-adguard-german.json', JSON.stringify({ block: ['werbung.example.de'], blockThirdParty: [], allow: [] }));
__fs.files.set('/doc/content-blocking/list-custom-1.json', JSON.stringify({ block: ['mine.example.com'], blockThirdParty: [], allow: [] }));
__fs.files.set('/doc/content-blocking/blocker.txt', 'qutai-content-blocker 1\nb mine.example.com\nb werbung.example.de\n');

const { CATALOGUE, contentBlocking } = await import('../../src/content/blocking.ts');

test('saved switches come back with the catalogue\'s names and addresses; custom lists too; unknown ones dropped', async () => {
  await contentBlocking.load();
  const easylist = contentBlocking.lists.find((l) => l.id === 'easylist')!;
  assert.equal(easylist.enabled, false);
  assert.equal(easylist.url, CATALOGUE[0].url);
  assert.notEqual(easylist.name, 'Old name');
  assert.equal(contentBlocking.lists.find((l) => l.id === 'easyprivacy')?.enabled, true, 'not saved: its default');
  assert.equal(contentBlocking.lists.find((l) => l.id === 'custom-1')?.kind, 'custom');
  assert.equal(contentBlocking.lists.some((l) => l.id === 'gone'), false);
  assert.equal(contentBlocking.compiled?.domains, 2);
});

test('Android, master off: the native matcher gets nothing; on: the saved domain file, without compiling again', async () => {
  assert.deepEqual(__native.calls.at(-1), ['loadAndroidBlocker', '']);
  await contentBlocking.setMaster(true);
  assert.deepEqual(__native.calls.at(-1), ['loadAndroidBlocker', 'file:///doc/content-blocking/blocker.txt']);
  assert.equal(contentBlocking.active, true);
  assert.equal(__native.calls.filter((c: unknown[]) => c[0] === 'compileIosRuleList').length, 0);
});

test('Android compile: the merged domains written as the native file, swapped in whole', async () => {
  await contentBlocking.setUserDomains(['own.example.net']);
  assert.equal(
    __fs.files.get('/doc/content-blocking/blocker.txt'),
    'qutai-content-blocker 1\nb mine.example.com\nb own.example.net\nb werbung.example.de\n',
  );
  assert.equal(__fs.files.has('/doc/content-blocking/blocker.tmp'), false);
  assert.equal(contentBlocking.compiled?.domains, 3);
});

test('a list file gone missing: compiled without it and marked for download again', async () => {
  __fs.files.delete('/doc/content-blocking/list-custom-1.json');
  await contentBlocking.setUserDomains([]);
  assert.equal(contentBlocking.lists.find((l) => l.id === 'custom-1')?.fetchedAt, undefined);
  assert.equal(__fs.files.get('/doc/content-blocking/blocker.txt'), 'qutai-content-blocker 1\nb werbung.example.de\n');
});
