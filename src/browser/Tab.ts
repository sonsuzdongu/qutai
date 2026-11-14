import type { ComponentRef } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { Conversation } from '../chat/Conversation';
import {
  backgroundGoBack,
  backgroundPageState,
  BackgroundPageState,
  evaluateInPage,
  isRunningInBackground,
  NeedsForegroundError,
} from '../device/backgroundTask';
import { sleep } from '../utils/sleep';
import { siteKey } from '../agent/sitePolicy';
import { PageGeolocation } from './geolocation';
import { PageMediaCapture } from './mediaCapture';
import { PagePlayback } from './playback';
import { classifyLoadError, LoadError } from './navigation';
import { PAGE_SCRIPT } from './pageScript';
import { pageKey, READER_MIN_CHARS, READER_MIN_PARAGRAPHS, ReaderArticle } from './reader';

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Internal address of the app's own new tab page; never handed to a WebView. */
export const NEW_TAB_URL = 'qutai://newtab';

export type PageCommand =
  | 'readPage'
  | 'readSource'
  | 'click'
  | 'clickAt'
  | 'type'
  | 'select'
  | 'scroll'
  | 'scrollTo'
  | 'formReport'
  | 'linkHref'
  | 'snapshotHtml'
  | 'readableText'
  | 'readerArticle'
  | 'readerProbe'
  | 'findInPage'
  | 'findStep'
  | 'clearFind'
  | 'imageData'
  | 'fileData'
  | 'captureBegin'
  | 'captureStep'
  | 'captureEnd'
  | 'fileTarget'
  | 'fileBegin'
  | 'fileChunk'
  | 'fileAbort'
  | 'fileAssign'
  | 'fieldLabel'
  | 'screenFields'
  | 'maskFields'
  | 'maskEnd';

/** Commands that search the text on screen: in reader mode they run in the reader view. */
const READER_COMMANDS = new Set<PageCommand>(['findInPage', 'findStep', 'clearFind']);
/** Commands that act on the page itself: reader mode closes first, so the user sees what happens. */
const PAGE_ACTIONS = new Set<PageCommand>(['click', 'clickAt', 'type', 'select', 'scroll', 'scrollTo', 'captureBegin', 'fileAssign']);

/** Reader mode for the page on screen: its extracted article, shown over the (untouched) page. */
export type ReaderState = { article: ReaderArticle; pageKey: string };

/**
 * One browser tab: owns its WebView, injects the page script, sends commands,
 * matches the replies coming back through onMessage, and tracks page loads.
 */
/** Random id that survives restarts, used to store the tab's conversation. */
export function newTabUid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export class Tab {
  readonly id: string;
  /** Stable across restarts and reopening (unlike id); the tab's conversation is saved under it. */
  readonly uid: string;
  /**
   * This tab's own conversation with the assistant. While the tab is in a group, the group's
   * conversation is shown instead (use `Browser.conversationOf`); this one waits for the tab to leave.
   */
  conversation: Conversation;
  readonly incognito: boolean;
  /**
   * Android: the WebView profile (own cookies and site data) of an incognito tab, shared by the incognito session's
   * tabs; set when the tab opens, before its WebView exists. Undefined: the default profile.
   */
  profile: string | undefined;
  /** The tab whose link opened this one; back returns there once this tab has no history. */
  readonly openerId: string | undefined;
  webview: ComponentRef<typeof WebView> | null = null;
  /** The reader mode WebView, while reader mode is on. */
  readerWebview: ComponentRef<typeof WebView> | null = null;
  /** Reader mode for the current page (per tab and page, never saved). */
  reader: ReaderState | null = null;
  /** The page looks like an article (quick check after it loads), for the address bar indicator. */
  readerAvailable = false;
  /** The view wrapping the WebView, used for tab switcher thumbnails. */
  container: ComponentRef<typeof View> | null = null;
  /** The source prop given to the WebView. Changing it loads a new page. */
  source: { uri: string };

  url: string;
  title = '';
  /**
   * A sleeping tab has no WebView: it keeps only its URL and title until it is shown.
   * Restored tabs start asleep so a long session doesn't load every page at launch.
   */
  asleep = false;
  /** When the tab was last on screen; the least recently used tabs are put to sleep first. */
  lastActiveAt = Date.now();
  /** The tab group this tab belongs to, if any. */
  groupId: string | undefined;
  /** Ask sites for their desktop layout (per tab, like "Request desktop site"). */
  desktop = false;
  /** The first page was opened from the new tab page, so back can return there. */
  openedFromNewTab = false;
  loading = false;
  canGoBack = false;
  canGoForward = false;
  /** The http:// address this tab was upgraded from (HTTPS-only), until the https:// page loads. */
  httpsUpgradedFrom: string | null = null;
  /** Why the last page failed to load; cleared when the next load starts. */
  loadError: LoadError | null = null;
  /** Data URI kept in memory only, so nothing from incognito tabs touches the disk. */
  thumbnail: string | null = null;
  /** Pixel size of the last screenshot shown to the model, so click_at can map its coordinates. */
  modelScreenshotSize: { width: number; height: number } | null = null;
  /** A full-page capture is scrolling this tab: touches, pull to refresh and scrollbars are off. */
  capturing = false;
  /** Width / height of the captured view, so cards can show the top of the page. */
  thumbnailAspect = 0.6;

  /** The page's navigator.geolocation, answered by the app with the user's per-site permission. */
  readonly geolocation: PageGeolocation = new PageGeolocation(this);
  /** The page's camera and microphone (getUserMedia), gated by the user's per-site permission. */
  readonly media: PageMediaCapture = new PageMediaCapture(this);
  /** Media playing in the page (audible tabs never sleep; speaker in the tab switcher). */
  readonly playback: PagePlayback = new PagePlayback(this);
  /**
   * Android: requests the network blocker stopped on the page on screen (the WebView counts them and reports the
   * total in batches; it starts again at 0 when a new page loads in the tab). Kept in memory only, also in incognito.
   */
  blockedCount = 0;

  private pending = new Map<string, Pending>();
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
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
    uid: string = newTabUid(),
  ) {
    this.id = id;
    this.uid = uid;
    this.conversation = new Conversation(onChange, uid, incognito);
    // Incognito conversations are never saved, so there is nothing to load.
    this.conversation.loaded = incognito;
    this.url = url;
    this.incognito = incognito;
    this.openerId = openerId;
    this.source = { uri: url };
  }

  /** Creates the WebView for a sleeping tab; the page loads from its saved URL. */
  wake() {
    if (!this.asleep) return;
    this.asleep = false;
    this.source = { uri: this.url };
    this.onChange();
  }

  /**
   * Frees the tab's WebView to save memory; it reloads from its URL when shown again.
   * Incognito tabs never sleep: on iOS their cookies and site data live only in their WebView (Android keeps them in
   * the incognito session's profile, see webviewProfile.ts, but a reload would still lose the page's state).
   */
  sleep() {
    // A tab using the camera or microphone, or playing sound, stays awake (capture or playback would end without the
    // user stopping it).
    if (this.asleep || this.incognito || this.isNewTab || this.media.capturing || this.playback.audible) return;
    this.reader = null;
    const thumbnail = this.thumbnail;
    this.dispose();
    this.thumbnail = thumbnail;
    this.webview = null;
    this.blockedCount = 0;
    this.asleep = true;
    this.onChange();
  }

  /** The WebView's count of blocked requests for its current page (Android). */
  handleContentBlocked(count: number) {
    if (count === this.blockedCount) return;
    this.blockedCount = count;
    this.onChange();
  }

  /** The page started or stopped using the location (address bar indicator). */
  notifyLocationUse() {
    this.onChange();
  }

  /** The camera / microphone grant, playback rule or live capture changed (WebView props, address bar). */
  notifyMediaChange() {
    this.onChange();
  }

  /** The page started or stopped playing media (tab switcher speaker, sleep rule). */
  notifyPlaybackChange() {
    this.onChange();
  }

  /** Stable ref callback for the tab's WebView. */
  setWebView = (ref: ComponentRef<typeof WebView> | null) => {
    this.webview = ref;
  };

  setReaderWebView = (ref: ComponentRef<typeof WebView> | null) => {
    this.readerWebview = ref;
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

  setCapturing(on: boolean) {
    this.capturing = on;
    this.onChange();
  }

  /** Switches between the mobile and desktop site and reloads, so the site sees the new identity. */
  toggleDesktop() {
    this.desktop = !this.desktop;
    this.onChange();
    // Give the WebView a moment to receive the new user agent before reloading.
    setTimeout(() => this.webview?.reload(), 50);
  }

  get isNewTab(): boolean {
    return this.url === NEW_TAB_URL;
  }

  /** Shows the new tab page again (back from the first page opened from it). */
  showNewTab() {
    this.reader = null;
    this.readerAvailable = false;
    this.dispose();
    this.webview = null;
    this.url = NEW_TAB_URL;
    this.source = { uri: NEW_TAB_URL };
    this.title = '';
    this.canGoBack = false;
    this.canGoForward = false;
    this.loadError = null;
    this.openedFromNewTab = false;
    this.onChange();
  }

  loadUrl(url: string) {
    if (this.isNewTab) {
      // Leaving the new tab page mounts a WebView with this URL.
      this.url = url;
      this.title = '';
      this.openedFromNewTab = true;
      this.source = { uri: url };
      this.onChange();
      return;
    }
    if (isRunningInBackground()) {
      // Prop changes and view commands wait for the app to come back; the page itself can still be sent elsewhere.
      if (!this.webview || this.asleep) throw new NeedsForegroundError();
      evaluateInPage(this.playback.nonce, `window.location.href = ${JSON.stringify(url)}; void 0;`, null, 0).catch(
        () => {},
      );
      return;
    }
    if (url === this.source.uri && this.webview) {
      this.webview.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
    } else {
      this.source = { uri: url };
      this.onChange();
    }
  }

  handleNavigationStateChange(nav: WebViewNavigation) {
    // Location, camera and microphone given to one site never carry over to the next (same-document changes stay).
    if (siteKey(nav.url) !== siteKey(this.url)) {
      this.geolocation.reset();
      this.media.reset();
    }
    // Another page (also one a script switched to without loading): reader mode belongs to the old one.
    if (pageKey(nav.url) !== pageKey(this.url)) {
      if (this.reader && pageKey(nav.url) !== this.reader.pageKey) this.reader = null;
      this.readerAvailable = false;
      if (!nav.loading) this.probeReaderSoon();
    }
    this.url = nav.url;
    this.title = nav.title;
    this.canGoBack = nav.canGoBack;
    this.canGoForward = nav.canGoForward;
    this.onChange();
  }

  handleMessage(data: string): boolean {
    let msg: { __qutai?: string; id?: string; ok?: boolean; result?: unknown; error?: string };
    try {
      msg = JSON.parse(data);
    } catch {
      return false;
    }
    if (msg.__qutai !== this.nonce || !msg.id) return false;
    const p = this.pending.get(msg.id);
    if (!p) return true;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error || 'Unknown page error'));
    return true;
  }

  handleLoadStart(url?: string) {
    // A new document: its watches, capture and "allow once" answers start over.
    this.geolocation.reset();
    this.media.reset();
    this.playback.reset();
    // Reader mode and the article check end only when another page starts. Android reports every history update
    // (a page's own replaceState / pushState) as a load start, and iOS a jump to a #fragment, with no load end
    // after them; those would otherwise turn reader mode off and hide it on almost every page.
    if (!url || pageKey(url) !== pageKey(this.url)) {
      this.reader = null;
      this.readerAvailable = false;
    }
    this.loading = true;
    this.loadError = null;
    this.onChange();
  }

  handleError(error: { code: number; description: string }) {
    this.loadError = { kind: classifyLoadError(error.code, error.description), ...error };
    this.onChange();
  }

  /** HTTPS-only opened this http:// address over https:// instead. */
  markHttpsUpgrade(from: string) {
    this.httpsUpgradedFrom = from;
  }

  /** After a failed load: the http:// address the failed https:// page was upgraded from, if any (once). */
  takeHttpsUpgrade(): string | null {
    const from = this.httpsUpgradedFrom;
    this.httpsUpgradedFrom = null;
    return from;
  }

  handleLoadEnd() {
    // The upgraded page loaded fine, so there is nothing to fall back to.
    if (!this.loadError) this.httpsUpgradedFrom = null;
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
    if (isRunningInBackground()) return this.settleInBackground();
    await sleep(600);
    if (this.loading) await this.waitForNextLoad();
    await sleep(300);
  }

  async navigate(url: string): Promise<void> {
    if (isRunningInBackground()) {
      if (this.isNewTab || !this.webview || this.asleep) throw new NeedsForegroundError();
      this.loadError = null;
      this.loadUrl(url);
      return this.settleInBackground();
    }
    const wait = this.waitForNextLoad();
    this.loadUrl(url);
    await wait;
    await sleep(300);
  }

  async goBack(): Promise<void> {
    if (isRunningInBackground()) {
      if (!this.webview || this.asleep) throw new NeedsForegroundError();
      await backgroundGoBack(this.playback.nonce);
      return this.settleInBackground();
    }
    this.webview?.goBack();
    await this.settle();
  }

  /**
   * In the background, page load events may not reach the app: waits until the WebView reports the page loaded
   * (or 15 s), then takes the address and title from the WebView itself.
   */
  private async settleInBackground(): Promise<void> {
    await sleep(600);
    const deadline = Date.now() + 15000;
    let state: BackgroundPageState | null = null;
    while (Date.now() < deadline) {
      state = await backgroundPageState(this.playback.nonce);
      if (!state || state.progress >= 100) break;
      await sleep(300);
    }
    if (state) {
      this.loading = false;
      this.handleNavigationStateChange({
        url: state.url || this.url,
        title: state.title,
        loading: false,
        canGoBack: state.canGoBack,
        canGoForward: state.canGoForward,
      } as WebViewNavigation);
    }
    await sleep(300);
  }

  /**
   * Checks (shortly, once the page has settled) whether the page looks like an article. Pages that
   * fill in their content later are checked again a little after.
   */
  probeReaderSoon(delayMs = 600) {
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      this.probeReader().then((found) => {
        if (!found && delayMs < 2000) this.probeReaderSoon(2500);
      });
    }, delayMs);
  }

  /** Quick article check; resolves with the result (false when the page doesn't answer). */
  async probeReader(): Promise<boolean> {
    if (this.isNewTab || !this.webview) return false;
    const url = this.url;
    const found = await this.run<boolean>('readerProbe', [], 3000).catch(() => false);
    if (this.url !== url) return false;
    if (found !== this.readerAvailable) {
      this.readerAvailable = found;
      this.onChange();
    }
    return found;
  }

  /**
   * Extracts the page's article and shows reader mode. Resolves false (and leaves the page as it is)
   * when the page has too little article-like content.
   */
  async openReader(): Promise<boolean> {
    if (this.reader) return true;
    if (this.isNewTab) return false;
    const url = this.url;
    const article = await this.run<ReaderArticle | null>(
      'readerArticle',
      [READER_MIN_CHARS, READER_MIN_PARAGRAPHS],
      15000,
    );
    if (!article || !article.ok || this.url !== url) {
      if (this.url === url && this.readerAvailable) {
        this.readerAvailable = false;
        this.onChange();
      }
      return false;
    }
    // Find in page highlights in the page itself would be left behind under the reader.
    this.run('clearFind').catch(() => {});
    this.reader = { article, pageKey: pageKey(url) };
    this.readerAvailable = true;
    this.onChange();
    return true;
  }

  closeReader() {
    if (!this.reader) return;
    this.reader = null;
    this.readerWebview = null;
    this.onChange();
  }

  /** Leaves reader mode and gives the page a moment to be on screen again (before screenshots). */
  async leaveReader(): Promise<void> {
    if (!this.reader) return;
    this.closeReader();
    await sleep(150);
  }

  dispose() {
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
    this.reader = null;
    this.geolocation.reset();
    this.media.reset();
    this.playback.reset();
    this.thumbnail = null;
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('The tab was closed.'));
    });
    this.pending.clear();
    this.handleLoadEnd();
  }

  run<T = unknown>(command: PageCommand, args: unknown[] = [], timeoutMs = 10000): Promise<T> {
    if (PAGE_ACTIONS.has(command)) this.closeReader();
    if (isRunningInBackground()) return this.runInBackground<T>(command, args, timeoutMs);
    const webview = this.reader && READER_COMMANDS.has(command) && this.readerWebview ? this.readerWebview : this.webview;
    if (!webview) return Promise.reject(new Error('The tab is not ready'));

    const id = `${this.nonce}-${++this.counter}`;
    const code = this.commandScript(command, args, id, 'window.ReactNativeWebView.postMessage(JSON.stringify(payload));');

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The page did not respond (it may still be loading).'));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      webview.injectJavaScript(code);
    });
  }

  /**
   * The same command while the assistant works with the app in the background: view commands and WebView events
   * wait for the app to come back, so the script goes to the WebView natively and leaves its reply in the page,
   * where the native side picks it up (src/device/backgroundTask.ts). Throws NeedsForegroundError, before anything
   * runs on the page, when the tab has no live WebView.
   */
  private async runInBackground<T>(command: PageCommand, args: unknown[], timeoutMs: number): Promise<T> {
    if (!this.webview || this.asleep || this.isNewTab) throw new NeedsForegroundError();
    const id = `${this.nonce}-${++this.counter}`;
    const box = JSON.stringify(`__qutaiReplies_${this.nonce}`);
    const code = this.commandScript(
      command,
      args,
      id,
      `(window[${box}] = window[${box}] || {})[${JSON.stringify(id)}] = payload;`,
    );
    const poll =
      `(function () { var b = window[${box}]; var k = ${JSON.stringify(id)}; if (!b || !(k in b)) return null; ` +
      'var r = b[k]; delete b[k]; return JSON.stringify(r); })()';
    const raw = await evaluateInPage(this.playback.nonce, code, poll, timeoutMs);
    if (raw == null) throw new Error('The page did not respond (it may still be loading).');
    // The WebView returns the poll's value JSON-encoded: a string holding the reply's JSON.
    const msg = JSON.parse(JSON.parse(raw)) as { __qutai?: string; ok?: boolean; result?: unknown; error?: string };
    if (msg.__qutai !== this.nonce) throw new Error('Unknown page error');
    if (msg.ok) return msg.result as T;
    throw new Error(msg.error || 'Unknown page error');
  }

  /** The page script plus a call of one of its commands; `deliver` hands `payload` (the reply) back. */
  private commandScript(command: PageCommand, args: unknown[], id: string, deliver: string): string {
    return `
${PAGE_SCRIPT}
(function () {
  var send = function (payload) {
    payload.__qutai = ${JSON.stringify(this.nonce)};
    payload.id = ${JSON.stringify(id)};
    ${deliver}
  };
  var fail = function (e) { send({ ok: false, error: String((e && e.message) || e) }); };
  try {
    var result = window.__qutaiAgent[${JSON.stringify(command)}].apply(null, ${JSON.stringify(args)});
    // Commands may return a promise (e.g. snapshots that fetch images).
    Promise.resolve(result).then(function (value) { send({ ok: true, result: value }); }, fail);
  } catch (e) {
    fail(e);
  }
})();
true;`;
  }
}
