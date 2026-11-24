// Android pull to refresh (src/browser/pullToRefresh.ts): the page's rule for "would a finger-down drag from here
// refresh?", run as the page runs it, against fake elements: normal, reversed (column-reverse, negative scrollTop)
// and flipped scroll areas, overscroll-behavior, touch-action, a scrolled or zoomed page, and shadow DOM.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PULL_RULE, PULL_STATE_SCRIPT } from '../../src/browser/pullToRefresh';

type Style = Partial<{
  overflowY: string;
  flexDirection: string;
  transform: string;
  overscrollBehaviorY: string;
  touchAction: string;
}>;
type Fake = {
  nodeType: number;
  parentElement: Fake | null;
  parentNode?: unknown;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  style: Style;
};

const canPull = new Function(`${PULL_RULE}; return qutaiCanPull;`)() as (target: Fake, win: unknown) => boolean;

function el(parent: Fake | null, style: Style = {}, scroll: Partial<Fake> = {}): Fake {
  return { nodeType: 1, parentElement: parent, scrollTop: 0, scrollHeight: 100, clientHeight: 100, style, ...scroll };
}

function page(opts: { scrollY?: number; zoomTop?: number; root?: Style } = {}) {
  const html = el(null, opts.root ?? {}, { scrollHeight: 3000, clientHeight: 800 });
  const body = el(html);
  const win = {
    scrollY: opts.scrollY ?? 0,
    visualViewport: { offsetTop: opts.zoomTop ?? 0 },
    document: { documentElement: html, scrollingElement: html },
    getComputedStyle: (e: Fake) => ({
      overflowY: 'visible',
      flexDirection: 'row',
      transform: 'none',
      overscrollBehaviorY: 'auto',
      touchAction: 'auto',
      ...e.style,
    }),
  };
  return { html, body, win };
}

/** A scroll area 1000 tall showing 400, with `top` as its scrollTop. */
const scroller = (parent: Fake, top: number, style: Style = {}) =>
  el(parent, { overflowY: 'auto', ...style }, { scrollTop: top, scrollHeight: 1000, clientHeight: 400 });

test('a page at its top refreshes; scrolled or pinch-zoomed down it does not', () => {
  const { body, win } = page();
  assert.equal(canPull(el(body), win), true);
  const scrolled = page({ scrollY: 120 });
  assert.equal(canPull(el(scrolled.body), scrolled.win), false);
  const zoomed = page({ zoomTop: 80 });
  assert.equal(canPull(el(zoomed.body), zoomed.win), false);
});

test('an ordinary inner scroll area: refreshes only at its own top', () => {
  const { body, win } = page();
  assert.equal(canPull(el(scroller(body, 0)), win), true);
  assert.equal(canPull(el(scroller(body, 250)), win), false);
  // Not scrollable (hidden overflow, or content that fits) doesn't count.
  assert.equal(canPull(el(scroller(body, 250, { overflowY: 'hidden' })), win), true);
  assert.equal(canPull(el(el(body, { overflowY: 'auto' }, { scrollTop: 0, scrollHeight: 400, clientHeight: 400 })), win), true);
  // A scroll area at its top inside one that is scrolled: the outer one takes the drag.
  assert.equal(canPull(el(scroller(scroller(body, 300), 0)), win), false);
});

test('a reversed chat list (column-reverse): newest at the bottom is scrollTop 0 and older messages are above', () => {
  const { body, win } = page();
  const reversed = { flexDirection: 'column-reverse' };
  // At the newest messages: dragging down reads older ones, never refreshes (the Instagram messages case).
  assert.equal(canPull(el(scroller(body, 0, reversed)), win), false);
  // Part way up: negative scrollTop.
  assert.equal(canPull(el(scroller(body, -300, reversed)), win), false);
  // At the oldest message (scrollTop = -(1000 - 400)): the drag goes on to the page, which refreshes.
  assert.equal(canPull(el(scroller(body, -600, reversed)), win), true);
  // Negative scrollTop without column-reverse on the area itself (a reversed writing direction elsewhere).
  assert.equal(canPull(el(scroller(body, -10)), win), false);
});

test('a flipped list (scaleY(-1)): content start is at the bottom of its scroll range', () => {
  const { body, win } = page();
  const flipped = { transform: 'matrix(1, 0, 0, -1, 0, 0)' };
  assert.equal(canPull(el(scroller(body, 0, flipped)), win), false);
  assert.equal(canPull(el(scroller(body, 600, flipped)), win), true);
  // Flipped by an ancestor (matrix3d), the area itself unflipped.
  const outer = el(body, { transform: 'matrix3d(1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)' });
  assert.equal(canPull(el(scroller(outer, 0)), win), false);
  // Two flips cancel.
  assert.equal(canPull(el(scroller(outer, 0, flipped)), win), true);
});

test('overscroll-behavior-y contain or none stops the drag at the area or the root (no refresh)', () => {
  const { body, win } = page();
  assert.equal(canPull(el(scroller(body, 0, { overscrollBehaviorY: 'contain' })), win), false);
  assert.equal(canPull(el(scroller(body, 0, { overscrollBehaviorY: 'none' })), win), false);
  // On an area that can't scroll it doesn't matter (Chrome: only scroll containers).
  assert.equal(canPull(el(el(body, { overscrollBehaviorY: 'none' })), win), true);
  for (const value of ['none', 'contain']) {
    const root = page({ root: { overscrollBehaviorY: value } });
    assert.equal(canPull(el(root.body), root.win), false, value);
  }
});

test('touch-action without vertical panning (maps, canvases, sliders) never refreshes', () => {
  const { body, win } = page();
  assert.equal(canPull(el(body, { touchAction: 'none' }), win), false);
  assert.equal(canPull(el(el(body, { touchAction: 'pan-x' })), win), false);
  assert.equal(canPull(el(body, { touchAction: 'pinch-zoom' }), win), false);
  assert.equal(canPull(el(body, { touchAction: 'pan-x pan-y' }), win), true);
  assert.equal(canPull(el(body, { touchAction: 'manipulation' }), win), true);
});

test('shadow DOM: the walk crosses from a shadow root to its host', () => {
  const { body, win } = page();
  const host = scroller(body, 200);
  const inner = el(null);
  inner.parentNode = { host };
  assert.equal(canPull(inner, win), false);
});

test('the page script reports in the form the patched WebView picks out', () => {
  assert.ok(PULL_STATE_SCRIPT.includes(`'{"__qutaiPull":true,'`));
  // Must match RNCWebViewPull.PREFIX in patches/react-native-webview+14.0.1.patch.
  assert.ok(PULL_STATE_SCRIPT.includes('window.top !== window'));
  assert.doesNotThrow(() => new Function(PULL_STATE_SCRIPT));
});
