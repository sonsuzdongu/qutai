// The 20 Nov 2026 reports as permanent scenarios: the app's real Browser and Tab classes, a stand-in WebView per tab
// that loads from the local slow server (scripts/slow-server/server.mjs) and reports events in each platform's order,
// and the user's actions in between (tap a link, open or switch tabs, stop). No device; the server runs in-process.
//
// What the stand-in WebView reports, per platform (react-native-webview as patched here, see src/browser/loadState.ts):
// - Android: a tap reaches onShouldStartLoadWithRequest; the load start (onPageStarted) comes once the site answers;
//   progress; load end. A source change (the app's own navigation) starts without onShouldStartLoadWithRequest.
// - iOS: onShouldStartLoadWithRequest with navigationType "click"; the load start at once (when the navigation is
//   decided); progress 0.1 until the answer, more after it; load end.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { Browser } from '../../src/browser/Browser';
import { noteUserGesture, touchedRecently } from '../../src/browser/externalGuard';
import { isUserTap, windowOpensInFront } from '../../src/browser/pendingNavigation';
import { NEW_TAB_URL, type Tab } from '../../src/browser/Tab';
// @ts-expect-error plain JavaScript module without types
import { createSlowServer } from '../slow-server/server.mjs';

type OS = 'android' | 'ios';
let base = '';
let server: ReturnType<typeof createSlowServer>;

before(async () => {
  server = createSlowServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.closeAllConnections?.();
  server.close();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One tab's WebView: loads one address at a time (a new load cancels the one in flight, like a real WebView). */
class FakeWebView {
  private abort: AbortController | null = null;
  current = '';
  destroyed = false;
  constructor(
    private tab: Tab,
    private os: OS,
  ) {
    tab.setWebView(this.handle as never);
  }

  /** What Tab calls on its WebView. */
  handle = {
    stopLoading: () => this.abort?.abort(),
    reload: () => void this.load(this.tab.url),
    goBack: () => {},
    goForward: () => {},
    injectJavaScript: () => {},
  };

  /** The user taps a link on the page (the WebView asks the app first). */
  tap(url: string) {
    noteUserGesture(this.tab);
    const type = this.os === 'ios' ? 'click' : undefined;
    this.tab.noteNavigationRequest(url, isUserTap(this.os, type, touchedRecently(this.tab)));
    void this.load(url);
  }

  async load(url: string) {
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    const tab = this.tab;
    const nav = (u: string, loading: boolean) =>
      tab.handleNavigationStateChange({ url: u, title: '', loading, canGoBack: true, canGoForward: false } as never);
    if (this.os === 'ios') {
      tab.handleLoadStart(url, undefined);
      nav(url, true);
      tab.handleLoadProgress(0.1);
    }
    let res: Response;
    try {
      res = await fetch(url, { signal: abort.signal, redirect: 'follow' });
    } catch {
      if (abort.signal.aborted || this.destroyed) return;
      tab.handleError({ code: -1009, description: 'net::ERR_INTERNET_DISCONNECTED', url });
      // react-native-webview calls onLoadEnd after onError (useWebViewLogic's onLoadingError).
      tab.handleWebViewLoadEnd(url);
      return;
    }
    if (abort.signal.aborted || this.destroyed) return;
    const final = res.url || url;
    if (this.os === 'android') {
      tab.handleLoadStart(final, true);
      nav(final, true);
      tab.handleLoadProgress(0.1);
    } else {
      tab.handleLoadProgress(0.5);
      if (final !== url) nav(final, true);
    }
    try {
      await res.text();
    } catch {
      return;
    }
    if (abort.signal.aborted || this.destroyed) return;
    this.current = final;
    tab.handleLoadProgress(0.9);
    if (this.os === 'android') tab.handleLoadProgress(1);
    tab.handleWebViewLoadEnd(final);
    nav(final, false);
  }

  destroy() {
    this.destroyed = true;
    this.abort?.abort();
  }
}

/** What BrowserView does: a WebView for every awake tab that isn't the new tab page; a new source loads it. */
function mountViews(browser: Browser, os: OS) {
  const views = new Map<string, { view: FakeWebView; source: object }>();
  const reconcile = () => {
    for (const tab of browser.tabs) {
      const live = !tab.asleep && !tab.isNewTab;
      const existing = views.get(tab.id);
      if (!live) {
        if (existing) {
          existing.view.destroy();
          views.delete(tab.id);
        }
        continue;
      }
      if (!existing) {
        const view = new FakeWebView(tab, os);
        views.set(tab.id, { view, source: tab.source });
        void view.load(tab.source.uri);
      } else if (existing.source !== tab.source) {
        existing.source = tab.source;
        void existing.view.load(tab.source.uri);
      }
    }
    for (const [id, v] of views) {
      if (!browser.getTab(id)) {
        v.view.destroy();
        views.delete(id);
      }
    }
  };
  const unsubscribe = browser.subscribe(reconcile);
  reconcile();
  return {
    view: (tab: Tab) => views.get(tab.id)!.view,
    done: () => {
      unsubscribe();
      views.forEach((v) => v.view.destroy());
      browser.tabs.forEach((t) => t.dispose());
    },
  };
}

async function until(check: () => boolean, ms = 8000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await wait(20);
  }
}

/** A browser whose first tab shows the results page (loaded). */
async function start(os: OS) {
  process.env.QUTAI_TEST_OS = os;
  const browser = new Browser();
  const views = mountViews(browser, os);
  const a = browser.active;
  a.loadUrl(`${base}/`);
  await until(() => !a.busy && a.url === `${base}/`);
  return { browser, views, a };
}

for (const os of ['android', 'ios'] as const) {
  test(`${os}: a tap on a slow result shows at once, and the page stays in its own tab when another tab is opened`, async () => {
    const { browser, views, a } = await start(os);
    const target = `${base}/slow?first=1.2&label=result`;
    views.view(a).tap(target);

    // Report (1): something is visible at once, before the site answers.
    assert.ok(a.busy, 'the progress line runs at once');
    assert.equal(a.nav.pending?.origin, 'page');
    assert.equal(a.nav.pending?.responded, false);
    assert.equal(a.address.url, `${base}/`, 'the bar keeps the page on screen (Chrome rule)');
    assert.equal(a.address.opening, '127.0.0.1');

    // Report (2): the user opens another tab while the load waits.
    const b = browser.openTab();
    assert.equal(browser.activeId, b.id);
    await until(() => !a.busy);

    assert.equal(browser.activeId, b.id, 'the tab the user opened stays in front');
    assert.ok(b.isNewTab && b.url === NEW_TAB_URL, 'the new tab still shows the new tab page');
    assert.equal(b.busy, false);
    assert.equal(b.nav.current, 0, 'no navigation ever reached the new tab');
    assert.equal(a.url, target, 'the page loaded in the tab it was tapped in');
    assert.equal(a.address.url, target);
    assert.equal(a.nav.lastEnd?.reason, 'loaded');
    views.done();
  });

  test(`${os}: switching to a sleeping tab while a load waits; each tab keeps its own page`, async () => {
    const { browser, views, a } = await start(os);
    const c = browser.openTab(`${base}/slow?first=0&label=c`, { activate: false, asleep: true });
    browser.switchTab(a.id);
    const target = `${base}/slow?first=1&label=a`;
    views.view(a).tap(target);
    browser.switchTab(c.id);
    assert.equal(c.cover, null, 'no thumbnail yet, nothing to cover with');
    assert.equal(c.nav.pending?.origin, 'app', 'the woken tab loads as the app asked');
    await until(() => !a.busy && !c.busy);
    assert.equal(browser.activeId, c.id);
    assert.equal(c.url, `${base}/slow?first=0&label=c`);
    assert.equal(a.url, target);
    views.done();
  });

  test(`${os}: a tab whose load waits is never put to sleep (memory pressure), so its load isn't lost`, async () => {
    const { browser, views, a } = await start(os);
    const target = `${base}/slow?first=1&label=kept`;
    views.view(a).tap(target);
    browser.openTab();
    browser.sleepInactive(0);
    assert.equal(a.asleep, false);
    await until(() => !a.busy);
    assert.equal(a.url, target);
    browser.sleepInactive(0);
    assert.equal(a.asleep, true, 'once loaded it may sleep as before');
    views.done();
  });

  test(`${os}: a window the page opens after the user left goes behind and never takes the screen`, async () => {
    const { browser, views, a } = await start(os);
    views.view(a).tap(`${base}/slow?first=0.5&label=opener`);
    const b = browser.openTab();
    await until(() => !a.busy);
    // The page opens a window now (as BrowserView's onOpenWindow does).
    const front = windowOpensInFront(browser.activeId === a.id, touchedRecently(a));
    const opened = browser.openTab(`${base}/slow?first=0&label=window`, { openerId: a.id, group: true, activate: front });
    assert.equal(front, false);
    assert.equal(browser.activeId, b.id);
    assert.ok(b.isNewTab);
    await until(() => !opened.busy);
    assert.equal(browser.activeId, b.id);
    views.done();
  });

  test(`${os}: stop puts the committed page back; try again asks for the same address again`, async () => {
    const { views, a } = await start(os);
    views.view(a).tap(`${base}/hang`);
    assert.ok(a.busy);
    a.stop();
    assert.equal(a.busy, false);
    assert.equal(a.address.url, `${base}/`);
    assert.equal(a.nav.lastEnd?.reason, 'stopped');

    const target = `${base}/slow?first=0.3&label=again`;
    views.view(a).tap(target);
    const first = a.nav.current;
    a.retryNavigation();
    assert.ok(a.nav.current > first, 'a new navigation');
    assert.equal(a.address.url, target, 'asked for by the app: its address shows');
    await until(() => !a.busy);
    assert.equal(a.url, target);
    views.done();
  });

  test(`${os}: a redirect stays one navigation and ends on its final page`, async () => {
    const { views, a } = await start(os);
    const final = `${base}/slow?first=0.2&label=redirected`;
    views.view(a).tap(`${base}/redirect?first=0.3&to=${encodeURIComponent('/slow?first=0.2&label=redirected')}`);
    const id = a.nav.current;
    await until(() => !a.busy);
    assert.equal(a.nav.current, id);
    assert.equal(a.url, final);
    assert.equal(a.committedUrl, final);
    views.done();
  });

  test(`${os}: the new tab page stays until its first address answers, which the bar shows at once`, async () => {
    process.env.QUTAI_TEST_OS = os;
    const browser = new Browser();
    const views = mountViews(browser, os);
    const tab = browser.active;
    const target = `${base}/slow?first=0.8&label=first`;
    tab.loadUrl(target);
    assert.equal(tab.cover, 'newTab');
    assert.equal(tab.address.url, target);
    assert.equal(tab.openedFromNewTab, true);
    await until(() => tab.nav.pending?.responded === true || !tab.busy);
    assert.equal(tab.cover, null, 'the page answered: the new tab page goes');
    await until(() => !tab.busy);
    assert.equal(tab.url, target);
    views.done();
  });

  test(`${os}: a load that fails offline ends the navigation and marks the tab for one reload when back online`, async () => {
    const { views, a } = await start(os);
    views.view(a).tap('http://127.0.0.1:9/unreachable');
    await until(() => !a.busy);
    assert.equal(a.nav.lastEnd?.reason, 'error');
    assert.equal(a.loadError?.kind, 'offline');
    assert.equal(a.offlineErrorUrl, 'http://127.0.0.1:9/unreachable');
    views.done();
  });
}
