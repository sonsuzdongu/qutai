import type { ComponentRef } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { sleep } from '../utils/sleep';
import { PAGE_SCRIPT } from './pageScript';

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type PageCommand = 'readPage' | 'click' | 'type' | 'select' | 'scroll' | 'scrollTo' | 'snapshotHtml';

/**
 * One browser tab: owns its WebView, injects the page script, sends commands,
 * matches the replies coming back through onMessage, and tracks page loads.
 */
export class Tab {
  readonly id: string;
  readonly incognito: boolean;
  /** The tab whose link opened this one; back returns there once this tab has no history. */
  readonly openerId: string | undefined;
  webview: ComponentRef<typeof WebView> | null = null;
  /** The view wrapping the WebView, used for tab switcher thumbnails. */
  container: ComponentRef<typeof View> | null = null;
  /** The source prop given to the WebView. Changing it loads a new page. */
  source: { uri: string };

  url: string;
  title = '';
  loading = false;
  canGoBack = false;
  /** Data URI kept in memory only, so nothing from incognito tabs touches the disk. */
  thumbnail: string | null = null;
  /** Width / height of the captured view, so cards can show the top of the page. */
  thumbnailAspect = 0.6;

  private pending = new Map<string, Pending>();
  private loadWaiters: (() => void)[] = [];
  // A random prefix makes it hard for page scripts to forge command replies.
  private nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  private counter = 0;

  constructor(
    id: string,
    url: string,
    incognito: boolean,
    openerId: string | undefined,
    private onChange: () => void,
  ) {
    this.id = id;
    this.url = url;
    this.incognito = incognito;
    this.openerId = openerId;
    this.source = { uri: url };
  }

  /** Stable ref callback for the tab's WebView. */
  setWebView = (ref: ComponentRef<typeof WebView> | null) => {
    this.webview = ref;
  };

  setContainer = (ref: ComponentRef<typeof View> | null) => {
    this.container = ref;
  };

  /** Captures a small screenshot for the tab switcher. Only works while the tab is visible. */
  async captureThumbnail(): Promise<void> {
    const container = this.container;
    if (!container) return;
    container.measure((_x, _y, width, height) => {
      if (width > 0 && height > 0) this.thumbnailAspect = width / height;
    });
    try {
      this.thumbnail = await captureRef(container, {
        format: 'jpg',
        quality: 0.6,
        width: 360,
        result: 'data-uri',
      });
      this.onChange();
    } catch {
      // A failed thumbnail just falls back to the placeholder card.
    }
  }

  loadUrl(url: string) {
    if (url === this.source.uri && this.webview) {
      this.webview.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
    } else {
      this.source = { uri: url };
      this.onChange();
    }
  }

  handleNavigationStateChange(nav: WebViewNavigation) {
    this.url = nav.url;
    this.title = nav.title;
    this.canGoBack = nav.canGoBack;
    this.onChange();
  }

  handleMessage(data: string): boolean {
    let msg: { __alpai?: string; id?: string; ok?: boolean; result?: unknown; error?: string };
    try {
      msg = JSON.parse(data);
    } catch {
      return false;
    }
    if (msg.__alpai !== this.nonce || !msg.id) return false;
    const p = this.pending.get(msg.id);
    if (!p) return true;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error || 'Unknown page error'));
    return true;
  }

  handleLoadStart() {
    this.loading = true;
    this.onChange();
  }

  handleLoadEnd() {
    this.loading = false;
    const waiters = this.loadWaiters;
    this.loadWaiters = [];
    waiters.forEach((w) => w());
    this.onChange();
  }

  /** Resolves on the next load end, or after the timeout (never rejects). */
  waitForNextLoad(timeoutMs = 15000): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.loadWaiters.push(finish);
    });
  }

  /** Gives a click or submit a moment to start navigating, then waits for it to finish. */
  async settle(): Promise<void> {
    await sleep(600);
    if (this.loading) await this.waitForNextLoad();
    await sleep(300);
  }

  async navigate(url: string): Promise<void> {
    const wait = this.waitForNextLoad();
    this.loadUrl(url);
    await wait;
    await sleep(300);
  }

  async goBack(): Promise<void> {
    this.webview?.goBack();
    await this.settle();
  }

  dispose() {
    this.thumbnail = null;
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('The tab was closed.'));
    });
    this.pending.clear();
    this.handleLoadEnd();
  }

  run<T = unknown>(command: PageCommand, args: unknown[] = [], timeoutMs = 10000): Promise<T> {
    const webview = this.webview;
    if (!webview) return Promise.reject(new Error('The tab is not ready'));

    const id = `${this.nonce}-${++this.counter}`;
    const code = `
${PAGE_SCRIPT}
(function () {
  var send = function (payload) {
    payload.__alpai = ${JSON.stringify(this.nonce)};
    payload.id = ${JSON.stringify(id)};
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  };
  var fail = function (e) { send({ ok: false, error: String((e && e.message) || e) }); };
  try {
    var result = window.__alpaiAgent[${JSON.stringify(command)}].apply(null, ${JSON.stringify(args)});
    // Commands may return a promise (e.g. snapshots that fetch images).
    Promise.resolve(result).then(function (value) { send({ ok: true, result: value }); }, fail);
  } catch (e) {
    fail(e);
  }
})();
true;`;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The page did not respond (it may still be loading).'));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      webview.injectJavaScript(code);
    });
  }
}
