// Pending navigation, progress curve, slowness thresholds and the address bar's anti-spoofing rule
// (src/browser/pendingNavigation.ts), the offline reload rule and the connectivity rule. No server, no device.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hostOf,
  isUserTap,
  lineTarget,
  NavigationTracker,
  nextSlownessChange,
  shownAddress,
  SLOW_AFTER_MS,
  slowness,
  VERY_SLOW_AFTER_MS,
  WAIT_HOLD,
  WAIT_START,
  waitingProgress,
  windowOpensInFront,
} from '../../src/browser/pendingNavigation';
import { tabsToReloadOnReconnect } from '../../src/browser/offlineReload';
import { isOfflineState } from '../../src/device/connectivity';
import { parseScrollMessage } from '../../src/browser/scrollMemory';

/** A tracker on a hand-driven clock and timer list. */
function tracker() {
  let now = 1000;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let ids = 0;
  let changes = 0;
  const nav = new NavigationTracker(
    () => changes++,
    () => now,
    (fn, ms) => {
      const id = ++ids;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    (h) => {
      const i = timers.findIndex((t) => t.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
  );
  const advance = (ms: number) => {
    now += ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers.splice(timers.indexOf(due), 1);
      due.fn();
    }
  };
  return { nav, advance, now: () => now, changes: () => changes, timers };
}

test('the line starts at about 10 %, creeps ever more slowly and holds below 30 %', () => {
  assert.equal(waitingProgress(0), WAIT_START);
  let last = 0;
  let lastStep = Infinity;
  for (let t = 0; t <= 60000; t += 500) {
    const p = waitingProgress(t);
    assert.ok(p >= last, `never backwards at ${t}`);
    assert.ok(p <= WAIT_HOLD);
    if (t > 0) {
      assert.ok(p - last <= lastStep + 1e-12, `slows down at ${t}`);
      lastStep = p - last;
    }
    last = p;
  }
  assert.ok(waitingProgress(20000) > 0.29);
  assert.ok(waitingProgress(1000) > 0.14 && waitingProgress(1000) < 0.2);
});

test('after the answer the line follows the real progress, never backwards, and fills only at the end', () => {
  const nav = { startedAt: 0, responded: true, progress: 0.1 };
  const atAnswer = lineTarget(nav, 2000);
  assert.ok(atAnswer >= waitingProgress(2000));
  assert.ok(lineTarget({ ...nav, progress: 0.55 }, 2000) > atAnswer);
  // The WebView's progress may jump back (a redirect); the line doesn't.
  const high = lineTarget({ ...nav, progress: 0.8 }, 3000);
  assert.equal(lineTarget({ ...nav, progress: 0.2 }, 3000, high), high);
  assert.ok(lineTarget({ ...nav, progress: 1 }, 3000) < 1, 'filled only when it ends as loaded');
});

test('slowness: nothing for 4 s, "not answering" until 25 s, then "very slow"; never once answered or offline', () => {
  const nav = { startedAt: 0, responded: false };
  assert.equal(slowness(nav, SLOW_AFTER_MS - 1), 'none');
  assert.equal(slowness(nav, SLOW_AFTER_MS), 'slow');
  assert.equal(slowness(nav, VERY_SLOW_AFTER_MS - 1), 'slow');
  assert.equal(slowness(nav, VERY_SLOW_AFTER_MS), 'verySlow');
  assert.equal(slowness({ ...nav, responded: true }, 60000), 'none');
  assert.equal(slowness(nav, 60000, false), 'none', 'offline says so instead');
  assert.equal(slowness(null, 60000), 'none');
  assert.equal(nextSlownessChange(nav, 0), SLOW_AFTER_MS);
  assert.equal(nextSlownessChange(nav, 5000), VERY_SLOW_AFTER_MS);
  assert.equal(nextSlownessChange(nav, 30000), null);
  assert.equal(nextSlownessChange({ ...nav, responded: true }, 0), null);
});

test("address bar: a page-started navigation keeps the committed page until it commits (Chrome's rule)", () => {
  const committed = 'https://www.google.com/search?q=x';
  const page = { url: 'https://evil.example/login', origin: 'page' as const, responded: false };
  assert.deepEqual(shownAddress(committed, page), { url: committed, opening: 'evil.example' });
  assert.deepEqual(shownAddress(committed, { ...page, responded: true }), { url: committed, opening: null });
  // The user's own navigation may show at once; back and forward (no address yet) keep the page on screen.
  assert.deepEqual(shownAddress(committed, { ...page, origin: 'app' }), { url: page.url, opening: null });
  assert.deepEqual(shownAddress(committed, { url: '', origin: 'app', responded: false }), { url: committed, opening: null });
  // Stopped or failed: no pending navigation, the committed page again.
  assert.deepEqual(shownAddress(committed, null), { url: committed, opening: null });
  assert.equal(hostOf('https://user:pw@www.Example.com:8443/a'), 'example.com:8443');
  assert.equal(hostOf('https://www.Example.com:443/a'), 'example.com');
  assert.equal(hostOf('https://evil.example\\@named.example/'), 'evil.example');
  assert.equal(hostOf('about:blank'), null);
});

test('navigation numbers: an end, progress or answer meant for an older navigation changes nothing', () => {
  const { nav } = tracker();
  const first = nav.begin('https://a.test/', 'app');
  const second = nav.begin('https://b.test/', 'app');
  assert.equal(second, first + 1);
  assert.deepEqual(nav.lastEnd, { id: first, reason: 'replaced' });
  nav.end('loaded', first);
  nav.respond(undefined, first);
  nav.progress(0.9, first);
  assert.equal(nav.pending?.id, second);
  assert.equal(nav.pending?.responded, false);
  nav.respond();
  nav.progress(0.5);
  nav.progress(0.3);
  assert.equal(nav.pending?.progress, 0.5, 'progress never goes back');
  nav.end('loaded');
  assert.equal(nav.pending, null);
  assert.deepEqual(nav.lastEnd, { id: second, reason: 'loaded' });
});

test('a redirect or a second hop keeps the navigation; a new tap after the answer starts a new one', () => {
  const { nav } = tracker();
  const id = nav.begin('https://google.com/url?q=x', 'page');
  assert.equal(nav.redirect('https://x.test/'), true);
  assert.equal(nav.begin('https://x.test/landing', 'page'), id, 'still waiting: the same navigation');
  assert.equal(nav.pending?.url, 'https://x.test/landing');
  nav.respond();
  assert.equal(nav.redirect('https://y.test/'), false, 'answered: not a redirect of it');
  assert.notEqual(nav.begin('https://y.test/', 'page'), id);
});

test('an answer with nothing pending starts an answered navigation (a page that navigated on its own)', () => {
  const { nav } = tracker();
  nav.respond('https://self.test/');
  assert.equal(nav.pending?.responded, true);
  assert.equal(nav.pending?.url, 'https://self.test/');
  nav.respond();
  assert.equal(nav.current, 1);
});

test('the slowness timers wake the UI at 4 s and 25 s, only for the navigation they were set for', () => {
  const t = tracker();
  t.nav.begin('https://slow.test/', 'page');
  const base = t.changes();
  t.advance(SLOW_AFTER_MS + 50);
  assert.equal(t.changes(), base + 1);
  t.advance(VERY_SLOW_AFTER_MS);
  assert.equal(t.changes(), base + 2);
  assert.equal(t.timers.length, 0);
  // A newer navigation replaces the timers; the old one's never fire for it.
  t.nav.begin('https://other.test/', 'app');
  t.nav.respond();
  assert.equal(t.timers.length, 0, 'answered: nothing left to wake for');
  t.nav.dispose();
  assert.equal(t.nav.pending, null);
  assert.equal(t.nav.lastEnd?.reason, 'closed');
});

test('user taps: iOS names them, Android counts a recent touch on the page', () => {
  assert.equal(isUserTap('ios', 'click', false), true);
  assert.equal(isUserTap('ios', 'formsubmit', false), true);
  assert.equal(isUserTap('ios', 'other', true), false, 'a script, even after a touch');
  assert.equal(isUserTap('android', undefined, true), true);
  assert.equal(isUserTap('android', undefined, false), false);
});

test('a window a page opens comes to the front only from the page on screen right after a touch', () => {
  assert.equal(windowOpensInFront(true, true), true);
  assert.equal(windowOpensInFront(false, true), false, 'the user went to another tab meanwhile');
  assert.equal(windowOpensInFront(true, false), false, 'no touch: the page opened it on its own');
});

test('offline: reloads once only tabs still showing the offline error; offline means no connection at all', () => {
  const tabs = [
    { id: 1, asleep: false, offlineErrorUrl: 'https://a.test/', loadError: { kind: 'offline' } },
    { id: 2, asleep: false, offlineErrorUrl: null, loadError: { kind: 'offline' } },
    { id: 3, asleep: false, offlineErrorUrl: 'https://c.test/', loadError: null },
    { id: 4, asleep: true, offlineErrorUrl: 'https://d.test/', loadError: { kind: 'offline' } },
    { id: 5, asleep: false, offlineErrorUrl: 'https://e.test/', loadError: { kind: 'dns' } },
  ];
  assert.deepEqual(
    tabsToReloadOnReconnect(tabs).map((t) => t.id),
    [1],
  );
  assert.equal(isOfflineState({ isConnected: false }), true);
  assert.equal(isOfflineState({ type: 'NONE' }), true);
  assert.equal(isOfflineState({ isConnected: true, type: 'WIFI' }), false);
  assert.equal(isOfflineState({}), false, 'unknown is never called offline');
});

test('scroll memory messages', () => {
  assert.equal(parseScrollMessage('{"__qutaiScroll":420}'), 420);
  assert.equal(parseScrollMessage('{"__qutaiScroll":-3}'), null);
  assert.equal(parseScrollMessage('{"other":1}'), null);
  assert.equal(parseScrollMessage('{"__qutaiScroll":'), null);
});
