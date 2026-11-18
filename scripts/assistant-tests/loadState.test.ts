// 18 Nov 2026: the loading line above the address bar stayed up for good (and Stop didn't clear it). Reproduced on
// Android: react.dev's client-side navigation (pushState) and a Wikipedia redirect page (/wiki/Bosphorus, which
// corrects its address with replaceState) each sent a load start that no load end followed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startsLoading } from '../../src/browser/loadState.ts';

const here = 'https://en.wikipedia.org/wiki/Bosporus';

test('Android: a same-document history update (the event says not loading) is not a load', () => {
  assert.equal(startsLoading({ url: here, currentUrl: 'https://en.wikipedia.org/wiki/Bosphorus', os: 'android', nativeLoading: false }), false);
  assert.equal(startsLoading({ url: 'https://react.dev/', currentUrl: 'https://react.dev/learn', os: 'android', nativeLoading: false }), false);
});

test('Android: a real navigation (the WebView is loading) is', () => {
  assert.equal(startsLoading({ url: 'https://example.com/', currentUrl: here, os: 'android', nativeLoading: true }), true);
  // An older event without the flag counts as a load, as before.
  assert.equal(startsLoading({ url: 'https://example.com/', currentUrl: here, os: 'android', nativeLoading: undefined }), true);
});

test('iOS: a jump to a #fragment of the page on screen is not a load; anything else is', () => {
  assert.equal(startsLoading({ url: `${here}#History`, currentUrl: here, os: 'ios', nativeLoading: false }), false);
  assert.equal(startsLoading({ url: `${here}#Geography`, currentUrl: `${here}#History`, os: 'ios', nativeLoading: false }), false);
  assert.equal(startsLoading({ url: 'https://en.wikipedia.org/wiki/Istanbul#History', currentUrl: here, os: 'ios', nativeLoading: false }), true);
  assert.equal(startsLoading({ url: 'https://example.com/', currentUrl: here, os: 'ios', nativeLoading: false }), true);
  assert.equal(startsLoading({ url: undefined, currentUrl: here, os: 'ios', nativeLoading: undefined }), true);
});
