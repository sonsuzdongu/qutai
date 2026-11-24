// The long-press menu script (src/browser/contextMenu.ts) run against a fake page: a real press opens the menu once
// (timer or Android's contextmenu, whichever is first), and nothing that means scrolling opens it — a move, a
// cancelled touch (Android handing the drag to a scroller or to pull to refresh), any scroll, or a touch that stops
// a fling.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTEXT_MENU_SCRIPT } from '../../src/browser/contextMenu';

type Listener = (e: Record<string, unknown>) => void;

function fakePage() {
  const listeners: Record<string, Listener[]> = {};
  const posted: string[] = [];
  let now = 1_000_000;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const link = { closest: (sel: string) => (sel === 'a[href]' ? { href: 'https://example.com/a', innerText: 'A link' } : null) };
  const window: Record<string, unknown> = {
    ReactNativeWebView: { postMessage: (m: string) => posted.push(m) },
  };
  const document = {
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
    createElement: () => ({ textContent: '' }),
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
  };
  const setTimeout = (fn: () => void, ms: number) => {
    const id = nextId++;
    timers.push({ at: now + ms, fn, id });
    return id;
  };
  const clearTimeout = (id: number) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  };
  const DateFake = { now: () => now };
  new Function('window', 'document', 'setTimeout', 'clearTimeout', 'Date', CONTEXT_MENU_SCRIPT)(
    window,
    document,
    setTimeout,
    clearTimeout,
    DateFake,
  );
  const fire = (type: string, extra: Record<string, unknown> = {}) => {
    let prevented = false;
    const e = { target: link, preventDefault: () => (prevented = true), ...extra };
    for (const fn of listeners[type] ?? []) fn(e);
    return prevented;
  };
  const wait = (ms: number) => {
    now += ms;
    for (const t of [...timers].sort((a, b) => a.at - b.at)) {
      if (t.at <= now) {
        clearTimeout(t.id);
        t.fn();
      }
    }
  };
  const touch = (x = 50, y = 50) => ({ touches: [{ clientX: x, clientY: y }] });
  return { fire, wait, touch, posted };
}

test('holding still on a link opens the menu once and swallows the click', () => {
  const p = fakePage();
  p.fire('touchstart', p.touch());
  p.wait(499);
  assert.equal(p.posted.length, 0);
  p.wait(1);
  assert.equal(p.posted.length, 1);
  assert.equal(JSON.parse(p.posted[0]).__qutaiContextMenu, true);
  // Android's own long press after the timer: no second menu, its default menu is still prevented.
  assert.equal(p.fire('contextmenu'), true);
  assert.equal(p.fire('touchend'), true);
  assert.equal(p.posted.length, 1);
});

test("Android's contextmenu before the timer opens the menu at once, and the timer doesn't open it again", () => {
  const p = fakePage();
  p.fire('touchstart', p.touch());
  p.wait(400);
  assert.equal(p.fire('contextmenu'), true);
  assert.equal(p.posted.length, 1);
  p.wait(500);
  assert.equal(p.posted.length, 1);
});

test('a cancelled touch (Android took the drag for scrolling or pull to refresh) never opens the menu', () => {
  for (const cancel of ['touchcancel', 'pointercancel']) {
    const p = fakePage();
    p.fire('touchstart', p.touch());
    p.wait(100);
    p.fire(cancel);
    p.wait(1000);
    assert.equal(p.posted.length, 0, cancel);
  }
});

test('any scroll after the touch starts (also inner scroll areas, seen in capture) cancels the press', () => {
  const p = fakePage();
  p.fire('touchstart', p.touch());
  p.wait(100);
  p.fire('scroll');
  p.wait(1000);
  assert.equal(p.posted.length, 0);
  // contextmenu after a cancelled press: the default menu is still prevented, no app menu.
  assert.equal(p.fire('contextmenu'), true);
  assert.equal(p.posted.length, 0);
});

test('moving the finger cancels; a small wobble does not', () => {
  const p = fakePage();
  p.fire('touchstart', p.touch(50, 50));
  p.fire('touchmove', p.touch(55, 58));
  p.wait(500);
  assert.equal(p.posted.length, 1);
  p.fire('touchend');
  p.fire('touchstart', p.touch(50, 50));
  p.fire('touchmove', p.touch(50, 70));
  p.wait(500);
  assert.equal(p.posted.length, 1);
});

test('a touch that stops a fling (the page scrolled just before) does not start a press', () => {
  const p = fakePage();
  p.fire('scroll');
  p.wait(50);
  p.fire('touchstart', p.touch());
  p.wait(1000);
  assert.equal(p.posted.length, 0);
  p.fire('touchend');
  // Later, with the page still, a press works again.
  p.fire('touchstart', p.touch());
  p.wait(500);
  assert.equal(p.posted.length, 1);
});
