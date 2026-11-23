// Ad and tracker blocking from downloaded lists (src/content/blocking.ts), on iOS, with an in-memory file system, a
// stand-in server and a recording native blocker (./fakes.mjs). The store is one instance per process, so the tests
// run in order as one story: first use, updates, failures that keep the old data, custom lists, the master switch,
// the user's own domains, reset.
import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error the harness's stand-in (./loader.mjs) exports the test handle
import { __fs } from 'expo-file-system';
// @ts-expect-error the harness's stand-in (./loader.mjs) exports the test handle
import { __native } from '../../src/device/contentBlocker.ts';
import { BlockingError, CATALOGUE, contentBlocking, MAX_CUSTOM_LISTS, MAX_LIST_BYTES, TIMING } from '../../src/content/blocking.ts';

// Host spacing and timeouts are covered in download.test.ts.
TIMING.hostSpacingMs = 0;

type Answer = { status?: number; body?: string; headers?: Record<string, string> };
const server = new Map<string, Answer>();
const requests: { url: string; headers: Record<string, string> }[] = [];
globalThis.fetch = (async (url: string, init?: { headers?: Record<string, string> }) => {
  requests.push({ url, headers: init?.headers ?? {} });
  const a = server.get(url);
  if (!a) throw new TypeError('network down');
  const status = a.status ?? 200;
  return new Response(status === 304 ? null : (a.body ?? ''), { status, headers: a.headers });
}) as typeof fetch;

const url = (id: string) => CATALOGUE.find((c) => c.id === id)!.url;
const list = (id: string) => contentBlocking.lists.find((l) => l.id === id)!;
const nativeCalls = (name: string) => __native.calls.filter((c: unknown[]) => c[0] === name);

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof BlockingError && e.code === code);
}

test('first start: the default lists (EasyList, EasyPrivacy; regional ones off in English), nothing active', async () => {
  await contentBlocking.load();
  const on = contentBlocking.lists.filter((l) => l.enabled).map((l) => l.id);
  assert.deepEqual(on, ['easylist', 'easyprivacy']);
  assert.equal(contentBlocking.active, false);
  assert.deepEqual(contentBlocking.ruleLists, []);
});

test('nothing downloads before the terms are accepted (allowed = false)', async () => {
  await contentBlocking.autoUpdate(false);
  assert.equal(requests.length, 0);
});

test('accepted and on: the due lists download, compile to rule lists, and the tabs get them', async () => {
  server.set(url('easylist'), { body: '[Adblock Plus 2.0]\n||ads.example.com^\n', headers: { etag: '"e1"' } });
  server.set(url('easyprivacy'), { body: '||track.example.net^$third-party\n', headers: { 'last-modified': 'Mon, 01 Jan 2026 00:00:00 GMT' } });
  await contentBlocking.setMaster(true);
  await contentBlocking.autoUpdate(true);
  assert.deepEqual(requests.map((r) => r.url), [url('easylist'), url('easyprivacy')]);
  assert.equal(list('easylist').domains, 1);
  assert.equal(list('easylist').etag, '"e1"');
  assert.ok(list('easylist').fetchedAt);
  assert.equal(nativeCalls('compileIosRuleList').length, 1);
  assert.equal(contentBlocking.ruleLists.length, 1);
  assert.match(contentBlocking.ruleLists[0], /^qutai-cb-[0-9a-f]{8}-/);
  assert.equal(contentBlocking.active, true);
  assert.equal(contentBlocking.status.phase, 'idle');
  // Saved: the state and each list's domains, nothing in the cache folder.
  const saved = JSON.parse(__fs.files.get('/doc/content-blocking/state.json'));
  assert.equal(saved.version, 1);
  assert.ok(__fs.files.has('/doc/content-blocking/list-easylist.json'));
  assert.deepEqual([...__fs.files.keys()].filter((k: string) => k.startsWith('/cache/')), []);
});

test('not due yet: nothing downloads again', async () => {
  requests.length = 0;
  await contentBlocking.autoUpdate(true);
  assert.equal(requests.length, 0);
});

test('"Update now" with unchanged lists: conditional requests, 304, nothing compiled again', async () => {
  requests.length = 0;
  server.set(url('easylist'), { status: 304 });
  server.set(url('easyprivacy'), { status: 304 });
  const compiles = nativeCalls('compileIosRuleList').length;
  await contentBlocking.updateNow();
  assert.equal(requests[0].headers['If-None-Match'], '"e1"');
  assert.equal(requests[1].headers['If-Modified-Since'], 'Mon, 01 Jan 2026 00:00:00 GMT');
  assert.equal(nativeCalls('compileIosRuleList').length, compiles);
});

test('a failed download keeps the previous version and records why', async () => {
  const before = list('easylist').fetchedAt;
  const rules = contentBlocking.ruleLists;
  server.set(url('easylist'), { status: 500 });
  await rejects(contentBlocking.updateNow(), 'http');
  assert.equal(list('easylist').error, 'http');
  assert.equal(list('easylist').fetchedAt, before);
  assert.deepEqual(contentBlocking.ruleLists, rules);
  server.delete(url('easylist'));
  await rejects(contentBlocking.updateNow(), 'network');
  assert.equal(list('easylist').error, 'network');
  server.set(url('easylist'), { body: '! only comments\n' });
  await rejects(contentBlocking.updateNow(), 'noRules');
  server.set(url('easylist'), { body: '||x.com^', headers: { 'content-length': String(MAX_LIST_BYTES + 1) } });
  await rejects(contentBlocking.updateNow(), 'tooBig');
  server.set(url('easylist'), { status: 304 });
  await contentBlocking.updateNow();
  assert.equal(list('easylist').error, undefined, 'a success clears the error');
});

test('custom lists: https only, no duplicates, must have rules; a good one is added and compiled in', async () => {
  await rejects(contentBlocking.addCustom('not a url'), 'https');
  await rejects(contentBlocking.addCustom('http://lists.example.org/a.txt'), 'https');
  await rejects(contentBlocking.addCustom(url('easylist')), 'duplicate');
  server.set('https://lists.example.org/empty.txt', { body: '# nothing\n' });
  await rejects(contentBlocking.addCustom('https://lists.example.org/empty.txt'), 'noRules');
  server.set('https://lists.example.org/mine.txt', { body: '0.0.0.0 mine.example.com\n' });
  const before = contentBlocking.ruleLists;
  const added = await contentBlocking.addCustom('  https://lists.example.org/mine.txt ');
  assert.equal(added.kind, 'custom');
  assert.equal(added.name, 'lists.example.org/mine.txt');
  assert.equal(added.domains, 1);
  assert.notDeepEqual(contentBlocking.ruleLists, before);
  assert.ok(__native.compiled.size >= 1);
  assert.deepEqual(nativeCalls('removeIosRuleLists').at(-1)?.[2], contentBlocking.ruleLists, 'old rule lists removed');
});

test(`at most ${MAX_CUSTOM_LISTS} custom lists`, async () => {
  const have = contentBlocking.lists.filter((l) => l.kind === 'custom').length;
  for (let i = have; i < MAX_CUSTOM_LISTS; i++) {
    const u = `https://lists.example.org/more-${i}.txt`;
    server.set(u, { body: `||more${i}.example.com^\n` });
    await contentBlocking.addCustom(u);
    // Ids come from the time: one per millisecond.
    await new Promise((r) => setTimeout(r, 2));
  }
  await rejects(contentBlocking.addCustom('https://lists.example.org/one-too-many.txt'), 'tooManyLists');
});

test('turning a list off compiles without it; removing a custom list deletes its file', async () => {
  const before = contentBlocking.ruleLists;
  await contentBlocking.setEnabled('easyprivacy', false, true);
  assert.notDeepEqual(contentBlocking.ruleLists, before);
  const custom = contentBlocking.lists.find((l) => l.kind === 'custom')!;
  await contentBlocking.removeCustom(custom.id);
  assert.equal(contentBlocking.lists.some((l) => l.id === custom.id), false);
  assert.equal(__fs.files.has(`/doc/content-blocking/list-${custom.id}.json`), false);
  await contentBlocking.removeCustom('easylist'); // not custom: nothing happens
  assert.ok(list('easylist'));
});

test('turning on a list never downloaded downloads it only when allowed', async () => {
  server.set(url('adguard-german'), { body: '||werbung.example.de^\n' });
  requests.length = 0;
  await contentBlocking.setEnabled('adguard-german', true, false);
  assert.equal(requests.length, 0);
  await contentBlocking.setEnabled('adguard-german', true, true);
  assert.deepEqual(requests.map((r) => r.url), [url('adguard-german')]);
  assert.equal(list('adguard-german').domains, 1);
});

test('the user\'s own blocked domains are compiled in; the same set again changes nothing', async () => {
  const before = contentBlocking.ruleLists;
  await contentBlocking.setUserDomains(['mine.example.org', 'mine.example.org']);
  const withUser = contentBlocking.ruleLists;
  assert.notDeepEqual(withUser, before);
  const compiles = nativeCalls('compileIosRuleList').length;
  await contentBlocking.setUserDomains(['mine.example.org']);
  assert.equal(nativeCalls('compileIosRuleList').length, compiles);
});

test('the master switch off: the tabs get no rule lists, the compiled ones stay for later', async () => {
  await contentBlocking.setMaster(false);
  assert.deepEqual(contentBlocking.ruleLists, []);
  assert.equal(contentBlocking.active, false);
  await contentBlocking.setMaster(true);
  assert.ok(contentBlocking.ruleLists.length > 0);
  assert.equal(contentBlocking.active, true);
});

test('a lost compiled rule list is compiled again at the next start check', async () => {
  const lost = contentBlocking.ruleLists[0];
  __native.compiled.delete(lost);
  // Not due for download; the compiled set is checked only when its key changes, so it is forced through a change.
  await contentBlocking.setUserDomains([]);
  assert.ok(__native.compiled.has(contentBlocking.ruleLists[0]));
});

test('without native blocking (an old build) nothing downloads', async () => {
  __native.available = false;
  requests.length = 0;
  for (const l of contentBlocking.lists) l.checkedAt = 0;
  await contentBlocking.autoUpdate(true);
  assert.equal(requests.length, 0);
  __native.available = true;
});

test('reset: the default lists only, files and compiled lists gone; downloaded again only when allowed', async () => {
  requests.length = 0;
  await contentBlocking.reset(false);
  assert.equal(contentBlocking.lists.some((l) => l.kind === 'custom'), false);
  assert.equal(list('adguard-german').enabled, false);
  assert.equal(contentBlocking.compiled, null);
  assert.deepEqual(contentBlocking.ruleLists, []);
  assert.equal(requests.length, 0);
  assert.deepEqual(nativeCalls('removeIosRuleLists').at(-1), ['removeIosRuleLists', 'qutai-cb-', []]);
  assert.equal(__fs.files.has('/doc/content-blocking/list-easylist.json'), false);
});
