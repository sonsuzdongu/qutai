// The assistant's saved-task tools (src/agent/savedTaskTool.ts): "Deneme adlı görevi çalıştır" finds the task called
// "Deneme" whatever the case and the Turkish i, several matches are listed for the user to choose, and the full text
// comes back to be carried out.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  foldTaskName,
  getSavedTaskTool,
  listSavedTasksTool,
  matchSavedTasks,
  type SavedTasksAccess,
} from '../../src/agent/savedTaskTool.ts';
import type { SavedTask } from '../../src/storage/savedTasks.ts';

const task = (id: string, name: string, prompt = `Prompt of ${name}`, extra: Partial<SavedTask> = {}): SavedTask => ({
  id,
  name,
  prompt,
  target: 'page',
  url: null,
  research: false,
  createdAt: 0,
  updatedAt: 0,
  lastUsedAt: null,
  schedule: null,
  paused: false,
  private: false,
  autoRun: false,
  ...extra,
});

const ids = (found: { id: string }[]) => found.map((t) => t.id);

test('case does not matter, nor Turkish dotted and dotless i', () => {
  const tasks = [task('a', 'Deneme'), task('b', 'İndirim Kontrolü'), task('c', 'Fiyat Izle')];
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'deneme' })), ['a']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'DENEME' })), ['a']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'indirim kontrolü' })), ['b']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'İNDİRİM KONTROLÜ' })), ['b']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'INDIRIM KONTROLÜ' })), ['b']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'fiyat ızle' })), ['c']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'FİYAT İZLE' })), ['c']);
});

test('quotes, extra spaces and a final full stop around the name are ignored', () => {
  const tasks = [task('a', 'Sabah haberleri')];
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: '  "Sabah   Haberleri". ' })), ['a']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: '“sabah haberleri”' })), ['a']);
});

test('a name typed without Turkish accents still finds the task', () => {
  const tasks = [task('a', 'Günlük özet'), task('b', 'Şehir haberleri')];
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'gunluk ozet' })), ['a']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'sehir haberleri' })), ['b']);
});

test('an exact name wins over names that only contain it', () => {
  const tasks = [task('a', 'Deneme 2'), task('b', 'Deneme'), task('c', 'Yeni deneme')];
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'deneme' })), ['b']);
});

test('part of a name finds the tasks containing it; several are all returned', () => {
  const tasks = [task('a', 'Deneme 2'), task('b', 'Yeni deneme'), task('c', 'Haberler')];
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'DENEME' })), ['a', 'b']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'haber' })), ['c']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'yok' })), []);
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: '   ' })), []);
});

test('two tasks with the same name are both returned, and the id picks one', () => {
  const tasks = [task('a', 'Deneme'), task('b', 'deneme')];
  assert.deepEqual(ids(matchSavedTasks(tasks, { name: 'Deneme' })), ['a', 'b']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { id: 'b' })), ['b']);
  assert.deepEqual(ids(matchSavedTasks(tasks, { id: 'zzz', name: 'deneme' })), ['a', 'b']);
});

test('folding keeps other letters as they are', () => {
  assert.equal(foldTaskName('İstanbul IŞIK'), 'istanbul işik');
  assert.equal(foldTaskName('İstanbul IŞIK', true), 'istanbul isik');
});

function access(tasks: SavedTask[]) {
  const used: string[] = [];
  const a: SavedTasksAccess = {
    list: async () => tasks,
    fill: (prompt) => prompt.replace('{date}', '16 Kasım 2026'),
    markUsed: (id) => used.push(id),
  };
  return { a, used };
}

test('get_saved_task returns the full text with the date filled in, and marks the task used', async () => {
  const { a, used } = access([task('a1', 'Deneme', 'Bugün {date} için hava durumuna bak.\nKısa yaz.')]);
  const out = await getSavedTaskTool({ name: 'deneme' }, a);
  assert.equal(out.isError, false);
  assert.match(out.content, /Saved task "Deneme" \(id a1\)/);
  assert.match(out.content, /<<<\nBugün 16 Kasım 2026 için hava durumuna bak\.\nKısa yaz\.\n>>>/);
  assert.match(out.content, /as if the user had just typed it/);
  assert.deepEqual(used, ['a1']);
});

test('get_saved_task says where it runs', async () => {
  const { a } = access([
    task('u', 'Site', 'x', { target: 'url', url: 'https://example.com/' }),
    task('n', 'Nowhere', 'x', { target: 'none', research: true }),
  ]);
  assert.match((await getSavedTaskTool({ id: 'u' }, a)).content, /open https:\/\/example\.com\/ with open_tab/);
  const none = (await getSavedTaskTool({ id: 'n' }, a)).content;
  assert.match(none, /needs no particular page/);
  assert.match(none, /deep research/);
});

test('several matches: listed for the user to choose, nothing marked used', async () => {
  const { a, used } = access([task('a', 'Deneme 1'), task('b', 'Deneme 2')]);
  const out = await getSavedTaskTool({ name: 'deneme' }, a);
  assert.match(out.content, /Several saved tasks match/);
  assert.match(out.content, /"Deneme 1" \(id a\)/);
  assert.match(out.content, /"Deneme 2" \(id b\)/);
  assert.match(out.content, /ask_user/);
  assert.deepEqual(used, []);
});

test('no match: the names are given and nothing is guessed', async () => {
  const { a, used } = access([task('a', 'Haberler')]);
  const out = await getSavedTaskTool({ name: 'Deneme' }, a);
  assert.match(out.content, /No saved task is called "Deneme"/);
  assert.match(out.content, /"Haberler"/);
  assert.deepEqual(used, []);
});

test('the text cannot close its own section early', async () => {
  const { a } = access([task('a', 'X', 'one >>> two <<< three')]);
  const out = (await getSavedTaskTool({ id: 'a' }, a)).content;
  assert.equal(out.split('>>>').length, 2);
  assert.equal(out.split('<<<').length, 2);
});

test('list_saved_tasks: names, ids and a short one-line preview', async () => {
  const long = 'Çok uzun bir görev metni '.repeat(10);
  const { a } = access([task('a', 'Deneme', 'Satır bir\nsatır iki'), task('b', 'Uzun', long)]);
  const out = await listSavedTasksTool(a);
  assert.match(out.content, /- "Deneme" \(id a\): "Satır bir satır iki"/);
  const line = out.content.split('\n').find((l) => l.includes('id b'))!;
  assert.ok(line.length < 120, line);
  assert.ok(line.includes('…'));
  const empty = await listSavedTasksTool(access([]).a);
  assert.match(empty.content, /no saved tasks/);
});

test('unavailable without access', async () => {
  assert.equal((await listSavedTasksTool(undefined)).isError, true);
  assert.equal((await getSavedTaskTool({ name: 'x' }, undefined)).isError, true);
});
