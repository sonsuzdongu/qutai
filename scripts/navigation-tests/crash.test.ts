// A page whose web process ends (src/browser/crashPolicy.ts and Tab.handleProcessGone): one reload by itself, then
// the "stopped working" screen; a tab in the background reloads when shown; the assistant gets a clear error.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Browser } from '../../src/browser/Browser';
import { CRASH_WINDOW_MS, PAGE_GONE_ERROR, processGoneAction } from '../../src/browser/crashPolicy';

test('the rule: on screen once reloads, the same page again within a minute shows the screen', () => {
  const at = 1_000_000;
  assert.equal(processGoneAction(null, 'https://a.test/', at, true), 'reload');
  const prev = { page: 'https://a.test/', at };
  assert.equal(processGoneAction(prev, 'https://a.test/', at + 5000, true), 'screen');
  assert.equal(processGoneAction(prev, 'https://a.test/', at + CRASH_WINDOW_MS, true), 'reload', 'a minute later: once more');
  assert.equal(processGoneAction(prev, 'https://b.test/', at + 5000, true), 'reload', 'another page');
  assert.equal(processGoneAction(prev, 'https://a.test/', at + 5000, false), 'reloadOnReturn');
});

function webviewSpy() {
  const calls: string[] = [];
  return {
    calls,
    view: {
      reload: () => calls.push('reload'),
      stopLoading: () => {},
      goBack: () => {},
      goForward: () => {},
      injectJavaScript: () => calls.push('inject'),
    },
  };
}

for (const os of ['android', 'ios'] as const) {
  test(`${os}: reload once, then the screen; Reload leaves it; the assistant gets a clear error`, async () => {
    process.env.QUTAI_TEST_OS = os;
    const browser = new Browser();
    const tab = browser.openTab('https://crash.test/page');
    const spy = webviewSpy();
    tab.setWebView(spy.view as never);
    const key = tab.webviewKey;

    tab.handleProcessGone(true, 1000);
    assert.equal(tab.crashed, null);
    if (os === 'ios') assert.deepEqual(spy.calls, ['reload']);
    else assert.equal(tab.webviewKey, key + 1, 'Android: a new WebView');

    tab.setWebView(spy.view as never);
    tab.handleProcessGone(true, 1000 + 10_000);
    assert.deepEqual(tab.crashed, { url: 'https://crash.test/page' });
    await assert.rejects(tab.run('readPage'), new RegExp(PAGE_GONE_ERROR.slice(0, 30)));

    tab.recoverFromCrash();
    assert.equal(tab.crashed, null);
    assert.equal(tab.nav.pending?.origin, 'app', 'the reload shows as the app\'s navigation');
    browser.tabs.forEach((t) => t.dispose());
  });

  test(`${os}: a tab in the background whose page died loads again when it is shown`, () => {
    process.env.QUTAI_TEST_OS = os;
    const browser = new Browser();
    const background = browser.openTab('https://bg.test/');
    const spy = webviewSpy();
    background.setWebView(spy.view as never);
    const front = browser.openTab();
    assert.equal(browser.activeId, front.id);

    background.handleProcessGone(false, 1000);
    assert.equal(background.crashed, null);
    assert.deepEqual(spy.calls, [], 'nothing loads while it is behind');
    if (os === 'android') assert.equal(background.asleep, true);

    browser.switchTab(background.id);
    if (os === 'ios') assert.deepEqual(spy.calls, ['reload']);
    else assert.equal(background.asleep, false);
    assert.equal(background.nav.pending?.url, 'https://bg.test/');
    browser.tabs.forEach((t) => t.dispose());
  });

  test(`${os}: commands waiting when the page died fail at once with the clear error`, async () => {
    process.env.QUTAI_TEST_OS = os;
    const browser = new Browser();
    const tab = browser.openTab('https://wait.test/');
    tab.setWebView(webviewSpy().view as never);
    const waiting = tab.run('readPage', [], 60_000);
    tab.handleProcessGone(true, 5000);
    await assert.rejects(waiting, new RegExp(PAGE_GONE_ERROR.slice(0, 30)));
    browser.tabs.forEach((t) => t.dispose());
  });
}
