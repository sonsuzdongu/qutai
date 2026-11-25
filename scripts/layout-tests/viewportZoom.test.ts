// Page zoom through the viewport (UI-84): src/browser/viewportZoom.ts, run against a small stand-in for the page.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewportWidthFor } from '../../src/browser/pageZoom';
import { viewportZoomScript } from '../../src/browser/viewportZoom';

type Meta = { nodeName: 'META'; attrs: Map<string, string>; removed?: boolean } & Record<string, unknown>;

function meta(content: string | null): Meta {
  const attrs = new Map<string, string>([['name', 'viewport']]);
  if (content !== null) attrs.set('content', content);
  return {
    nodeName: 'META',
    attrs,
    getAttribute: (k: string) => attrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  } as Meta;
}

/** A page `viewWidth` points wide with these viewport tags; runs the script and returns the page. */
function page(viewWidth: number, contents: (string | null)[]) {
  const metas: Meta[] = contents.map(meta);
  const listeners: Record<string, () => void> = {};
  const head = {
    appendChild(m: Meta) {
      metas.push(m);
      m.remove = () => metas.splice(metas.indexOf(m), 1);
    },
  };
  const window: Record<string, unknown> = {
    innerWidth: viewWidth,
    visualViewport: { width: viewWidth, scale: 1 },
    addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
  };
  const document = {
    head,
    documentElement: head,
    querySelectorAll: () => metas.filter((m) => !m.removed),
    createElement: () => meta(null),
    addEventListener: () => {},
  };
  const run = (script: string) => new Function('window', 'document', 'MutationObserver', script)(window, document, undefined);
  return { metas, window, listeners, run, contents: () => metas.map((m) => m.attrs.get('content') ?? null) };
}

test('the page lays out at the view width divided by the zoom', () => {
  assert.equal(viewportWidthFor(1910, 1.299), 1470);
  assert.equal(viewportWidthFor(1910, 1), 1910);
  assert.equal(viewportWidthFor(1910, 1.299 * 1.5), 980);
  assert.equal(viewportWidthFor(400, 3), 320);
  assert.equal(viewportWidthFor(1000, 0), 1000);
});

test("a Mac page's own viewport tags all become width=<view ÷ zoom>, as desktop Safari ignores them", () => {
  const p = page(1910, ['width=device-width, initial-scale=1', 'width=1120']);
  p.run(viewportZoomScript(1.299, 'z'));
  assert.deepEqual(p.contents(), ['width=1470', 'width=1470']);
});

test('a page without a viewport tag gets one', () => {
  const p = page(1910, []);
  p.run(viewportZoomScript(1.299, 'z'));
  assert.deepEqual(p.contents(), ['width=1470']);
});

test('running it again only changes the zoom; at zoom 1 the page gets its own tags back', () => {
  const p = page(1910, ['width=device-width, initial-scale=1']);
  p.run(viewportZoomScript(1.299, 'z'));
  p.run(viewportZoomScript(1.299 * 1.5, 'z'));
  assert.deepEqual(p.contents(), ['width=980']);
  p.run(viewportZoomScript(1, 'z'));
  assert.deepEqual(p.contents(), ['width=device-width, initial-scale=1']);
  const bare = page(1910, []);
  bare.run(viewportZoomScript(1.5, 'z'));
  bare.run(viewportZoomScript(1, 'z'));
  assert.deepEqual(bare.contents(), []);
});

test('at zoom 1 (an iPad not zoomed) nothing on the page changes', () => {
  const p = page(1024, ['width=device-width']);
  p.run(viewportZoomScript(1, 'z'));
  assert.deepEqual(p.contents(), ['width=device-width']);
});

test('a resized window lays out again at its new width', () => {
  const p = page(1910, ['width=device-width']);
  p.run(viewportZoomScript(1.299, 'z'));
  // WebKit fitted 1470 CSS px into a window now 1300 points wide.
  p.window.visualViewport = { width: 1470, scale: 1300 / 1470 };
  p.listeners.resize();
  assert.deepEqual(p.contents(), ['width=1001']);
});
