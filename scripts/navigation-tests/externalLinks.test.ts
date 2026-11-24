// Links for other apps (DL-15, DL-18): when a page may hand off to another app (src/browser/externalGuard.ts), which
// links are Google Play's (opened without asking), and how intent:// links are read (src/browser/navigation.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  declineExternal,
  endLaunchChain,
  mayOfferExternal,
  noteOpenedFromApp,
  noteUserGesture,
} from '../../src/browser/externalGuard';
import { isAppLinkError, linkTarget, parseIntentUrl, playStoreUrl } from '../../src/browser/navigation';
import type { Tab } from '../../src/browser/Tab';

const tab = () => ({}) as Tab;
const MARKET = 'market://details?id=com.example.app';

test('a page on its own (no touch, not opened from another app) may not hand off', () => {
  assert.equal(mayOfferExternal(tab(), MARKET, false, 1000), false);
});

test('a touch allows one hand-off within 3 seconds', () => {
  const t = tab();
  noteUserGesture(t, 1000);
  assert.equal(mayOfferExternal(t, MARKET, false, 3900), true);
  // Used up: the redirect chain can't ask twice.
  assert.equal(mayOfferExternal(t, 'whatsapp://send', false, 3950), false);
  const late = tab();
  noteUserGesture(late, 1000);
  assert.equal(mayOfferExternal(late, MARKET, false, 4001), false);
});

test("a tab opened from another app: its first load's redirect to Play counts as the user's tap", () => {
  const t = tab();
  noteOpenedFromApp(t, 1000);
  // A slow redirector still counts (no touch on the tab at all).
  assert.equal(mayOfferExternal(t, MARKET, false, 9000), true);
  // One hand-off per opening.
  assert.equal(mayOfferExternal(t, MARKET, false, 9100), false);
});

test('the launch chain covers every app scheme, not only Play (whatsapp:, tg:, tel:, a made-up myapp:)', () => {
  for (const url of ['whatsapp://send?text=hi', 'tg://resolve?domain=x', 'tel:+905551112233', 'mailto:a@b.c', 'sms:+90555', 'fb://page/1', 'myapp://open/42']) {
    const t = tab();
    noteOpenedFromApp(t, 1000);
    assert.equal(mayOfferExternal(t, url, false, 2000), true, url);
    // Not Play: these still get the question (openExternal), never a direct open.
    assert.equal(playStoreUrl(url), null, url);
  }
});

test('the launch chain ends when the first page has loaded', () => {
  const t = tab();
  noteOpenedFromApp(t, 1000);
  endLaunchChain(t);
  // The loaded page redirecting to an app later on its own: today's rule (refused without a touch).
  assert.equal(mayOfferExternal(t, MARKET, false, 2000), false);
  noteUserGesture(t, 3000);
  assert.equal(mayOfferExternal(t, MARKET, false, 3500), true);
});

test('the launch chain expires after 15 seconds even without a load end', () => {
  const t = tab();
  noteOpenedFromApp(t, 1000);
  assert.equal(mayOfferExternal(t, MARKET, false, 16_001), false);
  const ok = tab();
  noteOpenedFromApp(ok, 1000);
  assert.equal(mayOfferExternal(ok, MARKET, false, 16_000), true);
});

test('a declined link is never offered again in that tab, even from a new opening or a tap', () => {
  const t = tab();
  declineExternal(t, 'whatsapp://send?text=hi');
  noteOpenedFromApp(t, 1000);
  assert.equal(mayOfferExternal(t, 'whatsapp://send?text=hi', true, 1100), false);
  // Another link in the same chain is still allowed.
  assert.equal(mayOfferExternal(t, MARKET, false, 1200), true);
});

test('Google Play links: market://, Play intents, Play web pages inside a Play intent', () => {
  assert.equal(playStoreUrl(MARKET), MARKET);
  assert.equal(playStoreUrl('MARKET://search?q=maps'), 'MARKET://search?q=maps');
  assert.equal(
    playStoreUrl('intent://details?id=com.example.app#Intent;scheme=market;package=com.android.vending;end'),
    MARKET,
  );
  assert.equal(playStoreUrl('intent://details?id=com.example.app#Intent;scheme=market;end'), MARKET);
  assert.equal(
    playStoreUrl(
      'intent://play.google.com/store/apps/details?id=com.example.app&hl=tr#Intent;scheme=https;package=com.android.vending;end',
    ),
    'market://details?id=com.example.app&hl=tr',
  );
});

test('not Play: other apps, web pages, Play web pages without the Play package, odd Play paths', () => {
  assert.equal(playStoreUrl('whatsapp://send?text=hi'), null);
  assert.equal(playStoreUrl('tel:+905551112233'), null);
  assert.equal(playStoreUrl('https://play.google.com/store/apps/details?id=com.example.app'), null);
  assert.equal(playStoreUrl('intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;end'), null);
  assert.equal(
    playStoreUrl('intent://play.google.com/store/apps/details?id=x#Intent;scheme=https;package=com.evil.app;end'),
    null,
  );
  assert.equal(
    playStoreUrl('intent://play.google.com/store/apps/dev?id=123#Intent;scheme=https;package=com.android.vending;end'),
    null,
  );
  assert.equal(playStoreUrl('intent://#Intent;package=com.android.vending;end'), null);
});

test('intent parsing: app URL, page fallback, package and its Play page', () => {
  const fallback = encodeURIComponent('https://example.com/get?x=1');
  assert.deepEqual(
    parseIntentUrl(`intent://open/item/42#Intent;scheme=exampleapp;package=com.example.app;S.browser_fallback_url=${fallback};end`),
    {
      appUrl: 'exampleapp://open/item/42',
      fallbackUrl: 'https://example.com/get?x=1',
      packageName: 'com.example.app',
      marketUrl: 'market://details?id=com.example.app',
    },
  );
  // No scheme: nothing to open directly; the package's Play page is the fallback.
  assert.deepEqual(parseIntentUrl('intent://#Intent;package=com.whatsapp;end'), {
    appUrl: undefined,
    fallbackUrl: undefined,
    packageName: 'com.whatsapp',
    marketUrl: 'market://details?id=com.whatsapp',
  });
  // A fallback that isn't a web page is dropped; a malformed package is ignored.
  assert.deepEqual(parseIntentUrl('intent://x#Intent;scheme=y;package=../evil;S.browser_fallback_url=javascript%3Aalert(1);end'), {
    appUrl: 'y://x',
    fallbackUrl: undefined,
    packageName: undefined,
    marketUrl: undefined,
  });
  // The Play Store's own package needs no Play fallback.
  assert.equal(parseIntentUrl('intent://details?id=a.b#Intent;scheme=market;package=com.android.vending;end').marketUrl, undefined);
  assert.deepEqual(parseIntentUrl('https://example.com'), {});
});

test('a load error for any app scheme is never shown as a page; web and in-page errors are', () => {
  for (const url of ['market://details?id=a.b', 'intent://x#Intent;scheme=y;end', 'whatsapp://send', 'tg://resolve', 'tel:1', 'mailto:a@b.c', 'myapp://open/42', 'file:///sdcard/x.html']) {
    assert.equal(linkTarget(url), 'external', url);
    assert.equal(isAppLinkError(url), true, url);
  }
  for (const url of ['https://example.com', 'http://10.0.2.2:8799/', 'about:blank', 'data:text/html,x', 'blob:https://a/b']) {
    assert.equal(isAppLinkError(url), false, url);
  }
  assert.equal(isAppLinkError(undefined), false);
  assert.equal(isAppLinkError(''), false);
});
