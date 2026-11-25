// The address bar's suggestion list while typing (src/browser/omniboxResults.ts) and its history lookup
// (src/storage/omnibox.ts). Run: npm run test:omnibox
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { keepOrder, LOOKUP_DEBOUNCE_MS, OmniboxResults, REMOTE_DEBOUNCE_MS, withoutQuery } from '../../src/browser/omniboxResults.ts';
import type { LocalItem, Shown } from '../../src/browser/omniboxResults.ts';
import { localSuggestions } from '../../src/storage/omnibox.ts';
import { fakeTimers, flush, seedHistory } from './seed.ts';

const item = (url: string): LocalItem => ({ url, title: url, bookmarked: false, visits: 1 });

/** Lookups the test answers by hand, in any order. */
function harness({ remote = false } = {}) {
  const timers = fakeTimers();
  const local: { query: string; resolve: (items: LocalItem[]) => void }[] = [];
  const remotes: { query: string; signal: AbortSignal; resolve: (items: string[]) => void }[] = [];
  const shown: Shown[] = [];
  const results = new OmniboxResults({
    timers,
    lookupLocal: (query) => new Promise((resolve) => local.push({ query, resolve })),
    lookupRemote: (query, signal) =>
      remote ? new Promise((resolve) => remotes.push({ query, signal, resolve })) : null,
    onChange: (s) => shown.push(s),
  });
  const last = () => shown[shown.length - 1];
  return { timers, local, remotes, shown, results, last };
}

test('the first letter after a pause is looked up at once', () => {
  const h = harness();
  h.results.setQuery('g');
  assert.deepEqual(h.results.launches, ['g']);
});

test('fast typing skips the letters in between and looks up the last one', () => {
  const h = harness();
  for (const q of ['g', 'ga', 'gal', 'gala']) {
    h.results.setQuery(q);
    h.timers.advance(50);
  }
  assert.deepEqual(h.results.launches, ['g']);
  h.timers.advance(LOOKUP_DEBOUNCE_MS);
  assert.deepEqual(h.results.launches, ['g', 'gala']);
});

test('long fast typing still refreshes now and then', () => {
  const h = harness();
  const word = 'galatasaray';
  for (let k = 1; k <= word.length; k++) {
    h.results.setQuery(word.slice(0, k));
    h.timers.advance(60);
  }
  h.timers.advance(500);
  assert.ok(h.results.launches.length >= 3 && h.results.launches.length < word.length, String(h.results.launches));
  assert.equal(h.results.launches.at(-1), word);
});

test('clearing the field empties the list at once, without a lookup', async () => {
  const h = harness();
  h.results.setQuery('gal');
  h.local[0].resolve([item('https://a')]);
  await flush();
  h.timers.advance(20);
  h.results.setQuery('');
  assert.deepEqual(h.last(), { query: '', local: [], remote: [] });
  assert.equal(h.local.length, 1);
});

test('the list is never emptied between letters: the old rows stay until the new answer lands', async () => {
  const h = harness();
  h.results.setQuery('ga');
  h.local[0].resolve([item('https://a'), item('https://b')]);
  await flush();
  const before = h.shown.length;
  h.timers.advance(500);
  h.results.setQuery('gal');
  assert.equal(h.shown.length, before, 'nothing shown changes while the lookup runs');
  assert.deepEqual(h.results.value.local.map((i) => i.url), ['https://a', 'https://b']);
  h.local[1].resolve([item('https://c')]);
  await flush();
  assert.deepEqual(h.last().local.map((i) => i.url), ['https://c'], 'rows that no longer match go when the answer lands');
  assert.equal(h.last().query, 'gal');
});

test('an older answer arriving late never replaces a newer one', async () => {
  const h = harness();
  h.results.setQuery('g');
  h.timers.advance(500);
  h.results.setQuery('ga');
  h.local[1].resolve([item('https://new')]);
  await flush();
  h.local[0].resolve([item('https://old')]);
  await flush();
  assert.equal(h.last().query, 'ga');
  assert.deepEqual(h.last().local.map((i) => i.url), ['https://new']);
});

test('a word typed without a pause sends exactly one engine request, with the finished text', () => {
  const h = harness({ remote: true });
  const word = 'galatasaray';
  for (let k = 1; k <= word.length; k++) {
    h.results.setQuery(word.slice(0, k));
    h.timers.advance(90);
  }
  h.timers.advance(1000);
  assert.deepEqual(h.results.remoteRequests, [word]);
  assert.ok(h.results.launches.length > 1, 'history still refreshes while typing');
});

test('a pause over 200 ms in the middle of a word sends two engine requests', () => {
  const h = harness({ remote: true });
  for (const q of ['g', 'ga', 'gal']) {
    h.results.setQuery(q);
    h.timers.advance(80);
  }
  h.timers.advance(REMOTE_DEBOUNCE_MS);
  for (const q of ['gala', 'galat']) {
    h.results.setQuery(q);
    h.timers.advance(80);
  }
  h.timers.advance(1000);
  assert.deepEqual(h.results.remoteRequests, ['gal', 'galat']);
});

test('no engine request before the pause, and none after the field is cleared', () => {
  const h = harness({ remote: true });
  h.results.setQuery('g');
  h.timers.advance(REMOTE_DEBOUNCE_MS - 1);
  assert.deepEqual(h.results.remoteRequests, []);
  h.results.setQuery('');
  h.timers.advance(1000);
  assert.deepEqual(h.results.remoteRequests, []);
});

test('history shows at once; the engine rows join when they land, without emptying the list', async () => {
  const h = harness({ remote: true });
  h.results.setQuery('gal');
  h.local[0].resolve([item('https://a')]);
  await flush();
  assert.deepEqual(h.last(), { query: 'gal', local: [item('https://a')], remote: [] });
  h.timers.advance(REMOTE_DEBOUNCE_MS);
  h.remotes[0].resolve(['galatasaray', 'gal']);
  await flush();
  assert.deepEqual(h.last(), { query: 'gal', local: [item('https://a')], remote: ['galatasaray'] });
});

test('engine rows that still contain the text stay while history changes; the others go', async () => {
  const h = harness({ remote: true });
  h.results.setQuery('gal');
  h.local[0].resolve([]);
  h.timers.advance(REMOTE_DEBOUNCE_MS);
  h.remotes[0].resolve(['galatasaray', 'galata', 'gala dinner']);
  await flush();
  h.timers.advance(500);
  h.results.setQuery('galat');
  h.local[1].resolve([]);
  await flush();
  assert.deepEqual(h.last().remote, ['galatasaray', 'galata']);
});

test('an engine answer for older text is dropped, even if it lands after the text changed', async () => {
  const h = harness({ remote: true });
  h.results.setQuery('gal');
  h.local[0].resolve([]);
  await flush();
  h.timers.advance(REMOTE_DEBOUNCE_MS);
  h.results.setQuery('galx');
  assert.equal(h.remotes[0].signal.aborted, true);
  h.remotes[0].resolve(['galatasaray']);
  await flush();
  assert.deepEqual(h.results.value.remote, []);
});

test('nothing changes under a finger; the latest answer shows when it lifts', async () => {
  const h = harness();
  h.results.setQuery('ga');
  h.local[0].resolve([item('https://a')]);
  await flush();
  h.results.touchStart();
  h.timers.advance(500);
  h.results.setQuery('gal');
  h.local[1].resolve([item('https://b')]);
  await flush();
  assert.deepEqual(h.results.value.local, [item('https://a')]);
  h.results.touchEnd();
  assert.deepEqual(h.results.value.local, [item('https://b')]);
});

test('a touch whose end never arrives stops holding the list after a while', async () => {
  const h = harness();
  h.results.touchStart();
  h.results.setQuery('ga');
  h.local[0].resolve([item('https://a')]);
  await flush();
  assert.equal(h.shown.length, 0);
  h.timers.advance(5000);
  assert.deepEqual(h.results.value.local, [item('https://a')]);
});

test('rows that stay keep their order; new rows take the places the ranking gives them', () => {
  const key = (s: string) => s;
  assert.deepEqual(keepOrder(['a', 'b', 'c'], ['c', 'x', 'a'], key), ['a', 'x', 'c']);
  assert.deepEqual(keepOrder([], ['c', 'x'], key), ['c', 'x']);
  assert.deepEqual(keepOrder(['a', 'b'], ['y', 'x'], key), ['y', 'x']);
});

test('the typed text is not repeated among the engine suggestions, nor are duplicates', () => {
  assert.deepEqual(withoutQuery('Gal', ['gal', 'galata', 'Galata', ' ', 'gala']), ['galata', 'gala']);
});

test('after dispose, late answers are ignored', async () => {
  const h = harness();
  h.results.setQuery('ga');
  h.results.dispose();
  h.local[0].resolve([item('https://a')]);
  await flush();
  assert.equal(h.shown.length, 0);
});

test('history lookup: same answers with the covering index, prefix matches first, bookmarks merged', async () => {
  const run = async (covering: boolean) => {
    const raw = new DatabaseSync(':memory:');
    seedHistory(raw, 3000, covering);
    raw.prepare('INSERT INTO bookmarks (url, title, created_at) VALUES (?, ?, ?)').run('https://github.com/galatasaray/x-1', 'Saved', 1);
    const db = { getAllAsync: async (sql: string, p: (string | number)[]) => raw.prepare(sql).all(...p) };
    return {
      words: await localSuggestions(db as never, 'galatasa'),
      host: await localSuggestions(db as never, 'githu'),
      plan: raw
        .prepare(`EXPLAIN QUERY PLAN SELECT url, MAX(title), COUNT(*) FROM history WHERE title LIKE ? OR url LIKE ? GROUP BY url`)
        .all('%a%', '%a%')
        .map((r) => (r as { detail: string }).detail)
        .join(' '),
    };
  };
  const before = await run(false);
  const after = await run(true);
  assert.deepEqual(after.words, before.words);
  assert.deepEqual(after.host, before.host);
  assert.equal(after.words.length, 5);
  assert.ok(after.host.every((s) => s.url.startsWith('https://github.com/')));
  assert.match(after.plan, /COVERING INDEX history_url_title_visited/);
});

test('turning suggestions on or switching engine reports a change, so the same text is looked up again', () => {
  const h = harness();
  assert.equal(h.results.setRemote('false|google', () => null), false, 'the first settings are not a change');
  assert.equal(h.results.setRemote('false|google', () => null), false);
  assert.equal(h.results.setRemote('true|google', () => null), true);
  h.results.setQuery('gal');
  h.timers.advance(10);
  h.results.setQuery('gal', { force: true });
  assert.deepEqual(h.results.launches, ['gal', 'gal']);
});

test('the address bar waits for a 350 ms pause: no lookup per key press, one of each after the pause (UI-82)', async () => {
  const { ADDRESS_BAR_TIMING } = await import('../../src/browser/omniboxResults.ts');
  const timers = fakeTimers();
  const remoteSent: string[] = [];
  const results = new OmniboxResults({
    ...ADDRESS_BAR_TIMING,
    timers,
    lookupLocal: () => new Promise(() => {}),
    lookupRemote: (query) => {
      remoteSent.push(query);
      return new Promise(() => {});
    },
    onChange: () => {},
  });
  // Slow typing, 300 ms per letter: still no lookup while the letters keep coming.
  for (const q of ['g', 'ga', 'gal', 'gala']) {
    results.setQuery(q);
    timers.advance(300);
  }
  assert.deepEqual(results.launches, []);
  assert.deepEqual(remoteSent, []);
  timers.advance(60);
  assert.deepEqual(results.launches, ['gala']);
  assert.deepEqual(remoteSent, ['gala']);
});
