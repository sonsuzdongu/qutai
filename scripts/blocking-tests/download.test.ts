// Downloading lists (src/content/blocking.ts) when servers misbehave: the publisher's mirror after a timeout, a
// refusal or a server error; the 15-second "no answer yet" limit; requests to one host spaced out; automatic retries
// after 1 hour, 4 hours, then a day; and what each row shows (queued, downloading, cancelled, back off after a
// failure, try again). Fetches are mocked: nothing here reaches a real server. One store per process, so the tests
// run in order as one story.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BACKOFF_MS,
  backoffDelay,
  BlockingError,
  CATALOGUE,
  contentBlocking,
  TIMING,
} from '../../src/content/blocking.ts';

TIMING.responseTimeoutMs = 40;
TIMING.bodyTimeoutMs = 200;
TIMING.hostSpacingMs = 0;

/** "ok" answers with a list, "hang" never answers (until aborted), a number answers with that status. */
type Answer = 'ok' | 'hang' | number | { gate: Promise<void> };
const server = new Map<string, Answer>();
const requests: { url: string; at: number; headers: Record<string, string> }[] = [];
const realNow = Date.now.bind(Date);
let offset = 0;
Date.now = () => realNow() + offset;

globalThis.fetch = (async (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => {
  requests.push({ url, at: realNow(), headers: init?.headers ?? {} });
  const answer = server.get(url);
  const aborted = () => new DOMException('aborted', 'AbortError');
  if (answer === undefined) throw new TypeError('network down');
  if (answer === 'hang' || typeof answer === 'object') {
    await new Promise<void>((resolve, reject) => {
      if (init?.signal?.aborted) return reject(aborted());
      init?.signal?.addEventListener('abort', () => reject(aborted()));
      if (typeof answer === 'object') answer.gate.then(resolve);
    });
  }
  if (typeof answer === 'number') return new Response(answer === 304 ? null : '', { status: answer });
  const host = new URL(url).hostname.replace(/\W/g, '');
  return new Response(`||ads-${host}.example.com^\n`, { status: 200, headers: { etag: `"${host}"` } });
}) as typeof fetch;

const entry = (id: string) => CATALOGUE.find((c) => c.id === id)!;
const list = (id: string) => contentBlocking.lists.find((l) => l.id === id)!;
const mirror = (id: string) => entry(id).mirrors![0];
const sent = () => requests.map((r) => r.url);

async function rejects(p: Promise<unknown>, check: (e: BlockingError) => boolean) {
  await assert.rejects(p, (e: unknown) => e instanceof BlockingError && check(e));
}

test('every AdGuard list has its FiltersRegistry mirror on GitHub; the others have none', () => {
  for (const c of CATALOGUE) {
    if (c.url.startsWith('https://filters.adtidy.org/')) {
      const n = c.url.match(/filters\/(\d+)\.txt$/)![1];
      assert.deepEqual(c.mirrors, [
        `https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/platforms/extension/ublock/filters/${n}.txt`,
      ]);
    } else assert.equal(c.mirrors, undefined, c.id);
  }
});

test('backoff schedule: 1 hour, 4 hours, then a day from the third failure on', () => {
  assert.deepEqual(BACKOFF_MS, [3_600_000, 14_400_000, 86_400_000]);
  assert.deepEqual([1, 2, 3, 4, 10].map(backoffDelay), [3_600_000, 14_400_000, 86_400_000, 86_400_000, 86_400_000]);
});

test('setup: the default lists download from their own addresses', async () => {
  await contentBlocking.load();
  await contentBlocking.setMaster(true);
  server.set(entry('easylist').url, 'ok');
  server.set(entry('easyprivacy').url, 'ok');
  await contentBlocking.autoUpdate(true);
  assert.deepEqual(sent(), [entry('easylist').url, entry('easyprivacy').url]);
  assert.equal(list('easylist').source, entry('easylist').url);
});

test('a refusal (403) from the main address: the mirror is tried and its copy kept, with its address', async () => {
  requests.length = 0;
  server.set(entry('adguard-german').url, 403);
  server.set(mirror('adguard-german'), 'ok');
  await contentBlocking.setEnabled('adguard-german', true, true);
  assert.deepEqual(sent(), [entry('adguard-german').url, mirror('adguard-german')]);
  assert.equal(list('adguard-german').enabled, true);
  assert.equal(list('adguard-german').source, mirror('adguard-german'));
  assert.equal(list('adguard-german').error, undefined);
  assert.equal(list('adguard-german').failures, 0);
});

test('conditional headers go only to the address the saved copy came from', async () => {
  requests.length = 0;
  server.set(entry('adguard-german').url, 503);
  server.set(mirror('adguard-german'), 304);
  await contentBlocking.retry('adguard-german', true);
  assert.deepEqual(sent(), [entry('adguard-german').url, mirror('adguard-german')]);
  assert.equal(requests[0].headers['If-None-Match'], undefined);
  assert.equal(requests[1].headers['If-None-Match'], '"rawgithubusercontentcom"');
});

test('no answer within the response timeout: given up quickly, then the mirror', async () => {
  requests.length = 0;
  server.set(entry('adguard-french').url, 'hang');
  server.set(mirror('adguard-french'), 'ok');
  const started = realNow();
  await contentBlocking.setEnabled('adguard-french', true, true);
  assert.ok(realNow() - started < 1000, 'gave up after the response timeout, not the body timeout');
  assert.deepEqual(sent(), [entry('adguard-french').url, mirror('adguard-french')]);
  assert.equal(list('adguard-french').source, mirror('adguard-french'));
});

test('429 and 5xx also try the mirror; 404 does not (the address is wrong, not busy)', async () => {
  for (const status of [429, 500, 502]) {
    requests.length = 0;
    server.set(entry('adguard-french').url, status);
    await contentBlocking.retry('adguard-french', true);
    assert.deepEqual(sent(), [entry('adguard-french').url, mirror('adguard-french')], String(status));
  }
  requests.length = 0;
  server.set(entry('adguard-french').url, 404);
  await rejects(contentBlocking.retry('adguard-french', true), (e) => e.code === 'http' && e.status === 404);
  assert.deepEqual(sent(), [entry('adguard-french').url]);
});

test('both addresses fail: the main address\'s reason is reported, naming the list; an earlier copy stays on', async () => {
  requests.length = 0;
  server.set(entry('adguard-french').url, 'hang');
  server.set(mirror('adguard-french'), 500);
  const fetchedAt = list('adguard-french').fetchedAt;
  await rejects(
    contentBlocking.retry('adguard-french', true),
    (e) =>
      e.code === 'timeout' &&
      e.lists?.length === 1 &&
      e.lists[0].name === 'AdGuard French filter' &&
      e.lists[0].code === 'timeout',
  );
  assert.equal(list('adguard-french').enabled, true, 'it has an earlier copy, so it stays on');
  assert.equal(list('adguard-french').fetchedAt, fetchedAt);
  assert.equal(list('adguard-french').error, 'timeout');
  assert.ok((list('adguard-french').failures ?? 0) >= 1);
});

test('a list never downloaded that fails switches back off, with the reason kept for its row', async () => {
  server.set(entry('adguard-japanese').url, 'hang');
  server.set(mirror('adguard-japanese'), 'hang');
  await rejects(contentBlocking.setEnabled('adguard-japanese', true, true), (e) => e.code === 'timeout');
  assert.equal(list('adguard-japanese').enabled, false);
  assert.equal(list('adguard-japanese').error, 'timeout');
  assert.equal(contentBlocking.progressOf('adguard-japanese'), undefined);
  // "Try again" switches it on and downloads it.
  server.set(entry('adguard-japanese').url, 'ok');
  await contentBlocking.retry('adguard-japanese', true);
  assert.equal(list('adguard-japanese').enabled, true);
  assert.equal(list('adguard-japanese').error, undefined);
});

test('several lists: queued, then downloading one at a time, then nothing; failures are named together', async () => {
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  server.set(entry('easylist').url, { gate });
  server.set(entry('easyprivacy').url, 404);
  server.set(entry('adguard-german').url, 404);
  server.set(entry('adguard-french').url, 'ok');
  server.set(entry('adguard-japanese').url, 'ok');
  const seen: string[] = [];
  const unsubscribe = contentBlocking.subscribe(() => {
    const state = `${contentBlocking.progressOf('easylist') ?? '-'}/${contentBlocking.progressOf('easyprivacy') ?? '-'}`;
    if (seen.at(-1) !== state) seen.push(state);
  });
  const run = contentBlocking.updateNow();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(contentBlocking.progressOf('easylist'), 'downloading');
  assert.equal(contentBlocking.progressOf('easyprivacy'), 'queued');
  open();
  await rejects(
    run,
    (e) => JSON.stringify(e.lists?.map((l) => l.name)) === '["EasyPrivacy","AdGuard German filter"]',
  );
  unsubscribe();
  assert.deepEqual(seen.slice(0, 5), ['queued/queued', 'downloading/queued', '-/queued', '-/downloading', '-/-']);
  for (const l of contentBlocking.lists) assert.equal(contentBlocking.progressOf(l.id), undefined);
});

test('switching a list off while it downloads cancels it: no error, no alert, nothing kept', async () => {
  server.set(entry('adguard-russian').url, 'hang');
  const run = contentBlocking.setEnabled('adguard-russian', true, true);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(contentBlocking.progressOf('adguard-russian'), 'downloading');
  await contentBlocking.setEnabled('adguard-russian', false, true);
  await run; // resolves: a cancel is not a failure
  assert.equal(list('adguard-russian').enabled, false);
  assert.equal(list('adguard-russian').error, undefined);
  assert.equal(list('adguard-russian').fetchedAt, undefined);
  assert.equal(contentBlocking.progressOf('adguard-russian'), undefined);
});

test('switching off a list still waiting takes it out of the queue before it is asked for', async () => {
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  server.set(entry('abpindo').url, { gate });
  server.set(entry('adguard-spanish-portuguese').url, 'ok');
  const first = contentBlocking.setEnabled('abpindo', true, true);
  await new Promise((r) => setTimeout(r, 10));
  const second = contentBlocking.setEnabled('adguard-spanish-portuguese', true, true);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(contentBlocking.progressOf('adguard-spanish-portuguese'), 'queued');
  requests.length = 0;
  await Promise.all([contentBlocking.setEnabled('adguard-spanish-portuguese', false, true), (open(), first), second]);
  assert.equal(sent().includes(entry('adguard-spanish-portuguese').url), false);
  assert.equal(list('adguard-spanish-portuguese').enabled, false);
  assert.equal(list('abpindo').enabled, true);
});

test('requests to the same host wait the host spacing; other hosts don\'t', async () => {
  TIMING.hostSpacingMs = 120;
  requests.length = 0;
  server.set(entry('easylist').url, 304);
  server.set(entry('easyprivacy').url, 304);
  server.set(entry('adguard-german').url, 304);
  await contentBlocking.updateNow().catch(() => {});
  const at = (u: string) => requests.find((r) => r.url === u)!.at;
  assert.ok(at(entry('easyprivacy').url) - at(entry('easylist').url) >= 110, 'easylist.to twice: spaced');
  TIMING.hostSpacingMs = 0;
});

test('automatic updates after failures wait 1 hour, then 4 hours, then a day', async () => {
  // Only EasyList on, failing every time.
  for (const l of contentBlocking.lists) if (l.id !== 'easylist' && l.enabled) await contentBlocking.setEnabled(l.id, false, true);
  server.set(entry('easylist').url, 500);
  offset += 5 * 24 * 3_600_000; // due for its regular update
  requests.length = 0;
  await contentBlocking.autoUpdate(true);
  assert.equal(requests.length, 1);
  const failures = list('easylist').failures!;
  const tryAt = (hours: number) => {
    offset += hours * 3_600_000;
    requests.length = 0;
    return contentBlocking.autoUpdate(true).then(() => requests.length);
  };
  const wait = backoffDelay(failures) / 3_600_000;
  assert.equal(await tryAt(wait - 0.1), 0, 'not before the backoff');
  assert.equal(await tryAt(0.2), 1, 'after it');
  const next = backoffDelay(failures + 1) / 3_600_000;
  assert.ok(next > wait || next === 24);
  assert.equal(await tryAt(next - 0.1), 0);
  assert.equal(await tryAt(0.2), 1);
  // A success resets the count: the regular 4-day interval again.
  server.set(entry('easylist').url, 'ok');
  assert.equal(await tryAt(24.1), 1);
  assert.equal(list('easylist').failures, 0);
  assert.equal(await tryAt(24.1), 0);
});

test('a list already queued or downloading is not asked for twice', async () => {
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  server.set(entry('easylist').url, { gate });
  requests.length = 0;
  const a = contentBlocking.updateNow();
  await new Promise((r) => setTimeout(r, 10));
  const b = contentBlocking.updateNow();
  open();
  await Promise.all([a, b]);
  assert.equal(sent().filter((u) => u === entry('easylist').url).length, 1);
});
