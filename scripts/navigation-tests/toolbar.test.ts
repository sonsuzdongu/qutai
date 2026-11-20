// The address bar sliding away on scroll (src/browser/toolbarScroll.ts): the page script's reports for a stream of
// scroll positions (run here against a stand-in window), and the app's rule for when the bar may hide.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { barHidden, type BarHolds, parseBarMessage, TOOLBAR_SCROLL_SCRIPT } from '../../src/browser/toolbarScroll';

/** Runs the page script in a stand-in page and returns a scroll function plus the reports it posted. */
function page({ height = 4000, viewport = 800, top = true } = {}) {
  const listeners: Record<string, (() => void)[]> = {};
  const posted: string[] = [];
  const win: Record<string, unknown> = {
    scrollY: 0,
    innerHeight: viewport,
    addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
    ReactNativeWebView: { postMessage: (m: string) => posted.push(m) },
  };
  win.top = top ? win : {};
  const doc = { scrollingElement: { scrollHeight: height }, documentElement: { scrollHeight: height } };
  new Function('window', 'document', TOOLBAR_SCROLL_SCRIPT)(win, doc);
  const reports = () => posted.map((m) => parseBarMessage(m));
  return {
    scroll(...ys: number[]) {
      for (const y of ys) {
        win.scrollY = y;
        listeners.scroll?.forEach((f) => f());
      }
    },
    resize(h: number) {
      doc.scrollingElement.scrollHeight = h;
      listeners.resize?.forEach((f) => f());
    },
    reports,
    last: () => reports().at(-1),
  };
}

test('down past 48 px hides, a small scroll up (8 px) shows, the top always shows', () => {
  const p = page();
  assert.equal(p.last(), 'top');
  p.scroll(10, 30, 45);
  assert.equal(p.last(), 'up', 'left the top but not 48 px yet');
  p.scroll(70, 120);
  assert.equal(p.last(), 'down');
  p.scroll(118, 116);
  assert.equal(p.last(), 'down', 'a 4 px wobble keeps it hidden');
  p.scroll(110);
  assert.equal(p.last(), 'up');
  p.scroll(130, 150, 200);
  assert.equal(p.last(), 'down');
  p.scroll(-20);
  assert.equal(p.last(), 'top', 'iOS bounce above the top counts as top');
});

test('only changes are posted: a long fling sends one message, not one per frame', () => {
  const p = page({ height: 40000 });
  p.scroll(...Array.from({ length: 300 }, (_, i) => 20 + i * 50));
  assert.deepEqual(p.reports(), ['top', 'up', 'down']);
});

test('a short page reports short (the bar stays), also after it grows or shrinks', () => {
  const p = page({ height: 900, viewport: 800 });
  assert.equal(p.last(), 'short');
  p.scroll(60, 100);
  assert.equal(p.last(), 'short');
  p.resize(5000);
  p.scroll(200, 300);
  assert.equal(p.last(), 'down');
  p.resize(850);
  assert.equal(p.last(), 'short');
});

test('frames never report (main frame only)', () => {
  const p = page({ top: false });
  p.scroll(500);
  assert.deepEqual(p.reports(), []);
});

const NONE: BarHolds = {
  alwaysVisible: false,
  loading: false,
  editing: false,
  keyboard: false,
  findBar: false,
  panel: false,
  strip: false,
  dialog: false,
  assistantWorking: false,
  selection: false,
  noPage: false,
};

test('the bar hides only for "down" with nothing holding it', () => {
  assert.equal(barHidden('down', NONE), true);
  for (const s of ['up', 'top', 'short', null] as const) assert.equal(barHidden(s, NONE), false, String(s));
  for (const key of Object.keys(NONE) as (keyof BarHolds)[]) {
    assert.equal(barHidden('down', { ...NONE, [key]: true }), false, `${key} keeps it`);
  }
});

test('messages from the page: only the four states', () => {
  assert.equal(parseBarMessage('{"__qutaiBar":"down"}'), 'down');
  assert.equal(parseBarMessage('{"__qutaiBar":"sideways"}'), null);
  assert.equal(parseBarMessage('{"__qutaiScroll":3}'), null);
});
