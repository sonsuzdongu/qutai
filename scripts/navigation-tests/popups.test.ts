// Pop-up windows that keep their opener (src/browser/popups.ts): what the app does with a page's new window, when a
// page's window.close() closes its tab, and the tab rules around it (the waiting request's id on the new tab, the
// opener kept awake while its pop-up is on screen, closing returns to the opener).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Browser } from '../../src/browser/Browser';
import {
  closesOnWindowClose,
  closesRefusedPopup,
  planPopupOpen,
  POPUP_BLANK_URL,
  popupOpenerToKeep,
} from '../../src/browser/popups';

const ads = (url: string) => url.includes('ads.example');

test('a new window with a waiting request opens a tab that takes it over', () => {
  assert.deepEqual(planPopupOpen('https://accounts.example/o/oauth2', 'a1', ads), {
    kind: 'open',
    url: 'https://accounts.example/o/oauth2',
    popupId: 'a1',
  });
});

test('Android window.open: no address yet, the tab starts blank and learns it from its own WebView', () => {
  assert.deepEqual(planPopupOpen('', 'a2', ads), { kind: 'open', url: POPUP_BLANK_URL, popupId: 'a2' });
});

test('the old event (no request id) still opens a plain tab at the address', () => {
  assert.deepEqual(planPopupOpen('https://site.example/', undefined, ads), {
    kind: 'open',
    url: 'https://site.example/',
    popupId: undefined,
  });
  assert.deepEqual(planPopupOpen('https://site.example/', '', ads), {
    kind: 'open',
    url: 'https://site.example/',
    popupId: undefined,
  });
});

test('an ad window is refused and its waiting request let go', () => {
  assert.deepEqual(planPopupOpen('https://ads.example/x', 'i3', ads), { kind: 'refuse', release: 'i3' });
  assert.deepEqual(planPopupOpen('https://ads.example/x', undefined, ads), { kind: 'refuse', release: null });
});

test("window.close() closes only a tab a page opened", () => {
  assert.equal(closesOnWindowClose({ openerId: '1' }), true);
  assert.equal(closesOnWindowClose({ openerId: undefined }), false);
});

test("an ad as a pop-up's first page closes the pop-up; later, or in frames, it is only refused", () => {
  assert.equal(closesRefusedPopup({ popupId: 'a1', popupLoaded: false }, true), true);
  assert.equal(closesRefusedPopup({ popupId: 'a1', popupLoaded: true }, true), false);
  assert.equal(closesRefusedPopup({ popupId: 'a1', popupLoaded: false }, false), false);
  assert.equal(closesRefusedPopup({ popupId: undefined, popupLoaded: false }, true), false);
});

test('only the opener of a pop-up on screen is kept awake', () => {
  assert.equal(popupOpenerToKeep({ popupId: 'a1', openerId: '4' }), '4');
  assert.equal(popupOpenerToKeep({ popupId: undefined, openerId: '4' }), undefined);
  assert.equal(popupOpenerToKeep(undefined), undefined);
});

test('the pop-up tab joins the opener group, keeps the request id, and closing it returns to the opener', () => {
  const browser = new Browser();
  const opener = browser.active;
  opener.loadUrl('https://site.example/login');
  browser.openTab('https://other.example/'); // another tab in between
  browser.switchTab(opener.id);
  const plan = planPopupOpen('', 'a7', ads);
  assert.equal(plan.kind, 'open');
  if (plan.kind !== 'open') return;
  const popup = browser.openTab(plan.url, { openerId: opener.id, group: true, activate: true, popupId: plan.popupId });
  assert.equal(popup.popupId, 'a7');
  assert.equal(popup.url, POPUP_BLANK_URL);
  assert.equal(popup.isNewTab, false, 'a pop-up gets a WebView, never the new tab page');
  assert.ok(popup.groupId && popup.groupId === opener.groupId);
  assert.equal(browser.activeId, popup.id);
  // The page closes its window when it is done: back to the opener, not to the tab in between.
  assert.ok(closesOnWindowClose(popup));
  browser.closeTab(popup.id);
  assert.equal(browser.activeId, opener.id);
});

test('incognito pop-ups stay incognito, in the incognito session profile', () => {
  const browser = new Browser();
  const opener = browser.openTab('https://site.example/', { incognito: true });
  const popup = browser.openTab(POPUP_BLANK_URL, { incognito: true, openerId: opener.id, group: true, popupId: 'a9' });
  assert.equal(popup.incognito, true);
  assert.equal(popup.profile, opener.profile);
});

test('the opener stays awake while its pop-up is on screen, even when it would be the next to sleep', () => {
  const browser = new Browser();
  const opener = browser.openTab('https://site.example/');
  const other = browser.openTab('https://other.example/', { activate: false });
  const popup = browser.openTab(POPUP_BLANK_URL, { openerId: opener.id, group: true, activate: true, popupId: 'a5' });
  // Only one tab may stay awake besides the kept ones.
  browser.sleepInactive(1);
  assert.equal(opener.asleep, false);
  assert.equal(popup.asleep, false);
  assert.equal(other.asleep, true);
  // A plain tab on screen keeps no such tab awake.
  browser.switchTab(other.id);
  browser.sleepInactive(1);
  assert.equal(opener.asleep, true);
});
