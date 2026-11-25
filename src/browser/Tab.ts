import type { ComponentRef } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { Conversation } from '../chat/Conversation';
import {
  backgroundGoBack,
  backgroundPageState,
  type BackgroundPageState,
  evaluateInPage,
  isRunningInBackground,
  NeedsForegroundError,
} from '../device/backgroundTask';
import { sleep, StoppedError, throwIfStopped } from '../utils/sleep';
import { wellFormedJsonText } from '../utils/wellFormed';
import { siteKey } from '../agent/sitePolicy';
import { PageGeolocation } from './geolocation';
import { PageMediaCapture } from './mediaCapture';
import { PagePlayback } from './playback';
import { isAppLinkError, type LoadError, toLoadError } from './navigation';
import { addCertificateException } from './certificateExceptions';
import { agentCommandScript, agentInstallScript, MISSING_REPLY, newAgentName } from './agentScript';
import { type PageSignals, parsePageSignals, samePageSignals } from './pageKind';
import { pageKey, READER_MIN_CHARS, READER_MIN_PARAGRAPHS, type ReaderArticle } from './reader';
import { startsLoading } from './loadState';
import { NavigationTracker, shownAddress } from './pendingNavigation';
import { crashPage, PAGE_GONE_ERROR, type ProcessEnd, processGoneAction } from './crashPolicy';
import { newId, newNonce } from '../utils/ids';

/** iOS: WebKit's progress starts at 0.1 when a navigation begins and passes it only once the site answers. */
const IOS_ANSWERED_PROGRESS = 0.12;

/** Same page for "did this load end belong to the waiting navigation": no fragment, no trailing slash, any case. */
function samePage(a: string, b: string): boolean {
  const norm = (u: string) => (u.split('#')[0] ?? '').replace(/\/$/, '').toLowerCase();
  return norm(a) === norm(b);
}

/** What a command's reply resolves to when the page script is not in the document. */
const MISSING = Symbol('missing');

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Internal address of the app's own new tab page; never handed to a WebView. */
export const NEW_TAB_URL = 'qutai://newtab';

/** How long Back waits for the page script's answer (back-button traps, backTrap.ts) before the WebView goes back. */
const BACK_ANSWER_MS = 400;

export type PageCommand =
  | 'resourceHosts'
  | 'readPage'
  | 'readSource'
  | 'click'
  | 'clickAt'
  | 'type'
  | 'select'
  | 'scroll'
  | 'scrollTo'
  | 'actionRect'
  | 'formReport'
  | 'linkHref'
  | 'optionDetails'
  | 'snapshotHtml'
  | 'readableText'
  | 'readerArticle'
  | 'readerProbe'
  | 'pageSignals'
  | 'siteIcons'
  | 'findInPage'
  | 'findStep'
  | 'clearFind'
  | 'imageData'
  | 'fileData'
  | 'blobInfo'
  | 'blobChunk'
  | 'blobRelease'
  | 'downloadName'
  | 'captureBegin'
  | 'captureStep'
  | 'captureEnd'
  | 'fileTarget'
  | 'fileBegin'
  | 'fileChunk'
  | 'fileAbort'
  | 'fileAssign'
  | 'fieldLabel'
  | 'targetInfo'
  | 'screenFields'
  | 'maskFields'
  | 'hideFind'
  | 'hideMeasure'
  | 'hideTry'
  | 'hideUndo'
  | 'maskEnd'
  | 'fieldText'
  | 'secretField'
  | 'secretFieldIndices'
  | 'pressContext'
  | 'changeInfo'
  | 'formValues'
  | 'findText'
  | 'textOf'
  | 'pressInfo'
  | 'pressComposed'
  | 'enterFacts'
  | 'scriptFacts'
  | 'scriptSnapshot'
  | 'back';

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
  return newId(8);
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
  /** The user agent the tab's WebView sends (set by BrowserView), for Qutai's own downloads from this tab. */
  userAgent: string | undefined;

  setUserAgent(userAgent: string | undefined) {
    this.userAgent = userAgent;
  }
  /** The tab whose link opened this one; back returns there once this tab has no history. */
  readonly openerId: string | undefined;
  /**
   * A page's pop-up window (src/browser/popups.ts): the id of the new-window request the tab's first WebView takes
   * over, so the page keeps window.opener. Never saved; a WebView made later (woken, after a crash) loads the URL.
   */
  popupId: string | undefined;
  /** The pop-up's first page finished loading (an ad refused before that closes the tab, popups.ts). */
  popupLoaded = false;
  webview: ComponentRef<typeof WebView> | null = null;
  /** The reader mode WebView, while reader mode is on. */
  readerWebview: ComponentRef<typeof WebView> | null = null;
  /** Reader mode for the current page (per tab and page, never saved). */
  reader: ReaderState | null = null;
  /** The page looks like an article (quick check after it loads), for the address bar indicator. */
  readerAvailable = false;
  /**
   * What kind of page this is (markup flags from the page script, see pageKind.ts), for the suggestions in the empty
   * assistant panel. Memory only, never logged or saved; null until the page has been looked at.
   */
  pageSignals: PageSignals | null = null;
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
  /** The WebView reports a page load in progress (since its load start). See `busy` for what the user sees. */
  loading = false;
  /**
   * The navigation in progress, from the tap or the app's own request until the page arrives
   * (src/browser/pendingNavigation.ts); this tab's only, so another tab's events never reach it.
   */
  readonly nav: NavigationTracker;
  /** The address of the page on screen (committed), which the address bar shows while a page-started load waits. */
  committedUrl: string;
  /**
   * What covers the WebView until the new page arrives, so the screen is never a blank white page: the new tab page
   * (its first address was just opened) or the tab's last thumbnail (a woken tab).
   */
  cover: 'newTab' | 'thumbnail' | null = null;
  /** The page's last scroll position (main frame), restored when a woken tab's same page loads again. */
  private scrollMemory: { url: string; y: number } | null = null;
  /** The address whose scroll position waits to be restored after its load ends. */
  private scrollRestore: { url: string; y: number } | null = null;
  /** iOS: the user agreed to send a form again; the next form resubmission until then goes through. */
  allowResubmitUntil = 0;
  /** The app's last own navigation, to repeat it once the user agreed to send a form again. */
  lastAppAction: 'reload' | 'back' | 'forward' | null = null;
  /**
   * The page's web process ended twice in a short time while on screen: "This page stopped working" shows instead of
   * the page, and nothing reloads by itself (crashPolicy.ts).
   */
  crashed: { url: string } | null = null;
  /** The last time this tab's page process ended, for "the same page again shortly after". */
  private lastProcessEnd: ProcessEnd | null = null;
  /** iOS: the page's process ended while the tab wasn't on screen; it reloads when the tab is shown. */
  private reloadOnShow = false;
  /**
   * Android: a new value gives the tab a new WebView (the old one is unusable after its process ended). BrowserView
   * keys the WebView by it.
   */
  webviewKey = 0;
  /** The address of an error page shown because the phone was offline, reloaded once when the connection returns. */
  offlineErrorUrl: string | null = null;
  canGoBack = false;
  canGoForward = false;
  /** The http:// address this tab was upgraded from (HTTPS-only), until the https:// page loads. */
  httpsUpgradedFrom: string | null = null;
  /** Why the last page failed to load; cleared when the next load starts. */
  loadError: LoadError | null = null;
  /** The address and time of that failure. */
  private loadErrorUrl: string | null = null;
  private loadErrorAt = 0;
  /** Data URI kept in memory only, so nothing from incognito tabs touches the disk. */
  thumbnail: string | null = null;
  /**
   * Pixel size of the last screenshot shown to the model, so click_at can map its coordinates, and the window's size
   * then (windowKey): once the screen turns, the coordinates no longer match the page.
   */
  modelScreenshotSize: { width: number; height: number; window: string } | null = null;
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
  private nonce = newNonce();
  private counter = 0;
  /** The page script's secret name on window (browser/agentScript.ts), one per tab. */
  private agentNameValue = newAgentName();
  private installCache: { name: string; script: string } | null = null;

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
    this.committedUrl = url;
    this.incognito = incognito;
    this.openerId = openerId;
    this.source = { uri: url };
    this.nav = new NavigationTracker(() => this.navChanged());
  }

  /** A navigation is waiting or loading: the progress line shows and the reload control is Stop. */
  get busy(): boolean {
    return this.loading || this.nav.pending !== null;
  }

  /** What the address bar shows, with the destination host while a page-started navigation waits (Chrome's rule). */
  get address(): { url: string; opening: string | null } {
    return shownAddress(this.committedUrl, this.nav.pending);
  }

  private navChanged() {
    const p = this.nav.pending;
    if (this.cover && (!p || p.responded)) this.cover = null;
    this.onChange();
  }

  /** The site answered: the new page commits and the address bar may show it. */
  private commit(url?: string) {
    this.nav.respond(url);
    this.committedUrl = this.url;
  }

  /**
   * The WebView let a top-frame navigation through (onShouldStartLoadWithRequest returned true). A redirect of the
   * waiting navigation only changes where it goes; a new one begins only for the user's tap on the page.
   */
  noteNavigationRequest(url: string, userTap: boolean, origin: 'page' | 'app' = 'page') {
    if (!/^https?:/i.test(url)) return;
    if (this.nav.redirect(url)) return;
    // iOS back and forward swipes are the user's own (the address may show at once).
    if (userTap || origin === 'app') this.nav.begin(url, origin);
  }

  /** Creates the WebView for a sleeping tab; the page loads from its saved URL. */
  wake() {
    if (!this.asleep) return;
    this.asleep = false;
    this.source = { uri: this.url };
    this.committedUrl = this.url;
    // Its last picture stays until the page is back, and the scroll position comes back with the same page.
    this.cover = this.thumbnail ? 'thumbnail' : null;
    if (this.scrollMemory && this.scrollMemory.url === this.url) this.scrollRestore = this.scrollMemory;
    this.nav.begin(this.url, 'app');
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
    this.cover = null;
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
    this.pageSignals = null;
    this.dispose();
    this.webview = null;
    this.url = NEW_TAB_URL;
    this.source = { uri: NEW_TAB_URL };
    this.title = '';
    this.canGoBack = false;
    this.canGoForward = false;
    this.loadError = null;
    this.offlineErrorUrl = null;
    this.openedFromNewTab = false;
    this.committedUrl = NEW_TAB_URL;
    this.cover = null;
    this.onChange();
  }

  /** The app's own navigation to an address (address bar, bookmark, history, the new tab page, the assistant). */
  loadUrl(url: string) {
    this.lastAppAction = null;
    this.nav.begin(url, 'app');
    if (this.crashed) {
      // Leaving the "stopped working" screen for another address: a fresh WebView opens it.
      this.crashed = null;
      const same = this.source.uri === url;
      this.url = url;
      this.source = { uri: url };
      if (Platform.OS === 'android') this.webviewKey++;
      else if (same) this.webview?.reload();
      this.onChange();
      return;
    }
    if (this.isNewTab) {
      // Leaving the new tab page mounts a WebView with this URL; the new tab page stays until the site answers.
      this.cover = 'newTab';
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
    // A link for another app that the WebView cancelled (a redirect to whatsapp:, market:, myapp: …; Android reports
    // its address after the cancel) is never the tab's address (DL-18).
    if (isAppLinkError(nav.url)) return;
    // Location, camera and microphone given to one site never carry over to the next (same-document changes stay).
    if (siteKey(nav.url) !== siteKey(this.url)) {
      this.geolocation.reset();
      this.media.reset();
    }
    // Another page (also one a script switched to without loading): reader mode belongs to the old one.
    if (pageKey(nav.url) !== pageKey(this.url)) {
      if (this.reader && pageKey(nav.url) !== this.reader.pageKey) this.reader = null;
      this.readerAvailable = false;
      this.pageSignals = null;
      // Also while "loading": Android reports a page's own pushState as a load with no load end after it. A real
      // load's end probes again (and the debounce drops this one).
      this.probeReaderSoon();
    }
    this.url = nav.url;
    // A page-started navigation that hasn't been answered yet (iOS reports its address at once) isn't on screen.
    if (!this.nav.pending || this.nav.pending.responded) this.committedUrl = nav.url;
    this.title = nav.title;
    this.canGoBack = nav.canGoBack;
    this.canGoForward = nav.canGoForward;
    this.onChange();
  }

  /** Reload (menu, pull to refresh, error page, Try again on a page that had loaded). */
  reload() {
    this.lastAppAction = 'reload';
    this.nav.begin(this.url, 'app');
    this.webview?.reload();
  }

  /**
   * Back in the page's history (the address isn't known until the WebView says it). iOS: the page script goes back
   * itself, past entries the page added without the user (back-button traps, backTrap.ts); when it doesn't answer
   * quickly (no script on this page, no Navigation API), the WebView goes back one entry.
   */
  historyBack() {
    this.lastAppAction = 'back';
    this.nav.begin('', 'app');
    const webview = this.webview;
    if (!webview) return;
    // Android: the WebView's own back already skips them (Chromium's history manipulation intervention reaches
    // WebView.goBack; checked on Android 16's WebView, 24 Nov 2026).
    if (Platform.OS === 'android' || this.isNewTab || this.loadError || this.crashed || isRunningInBackground()) {
      webview.goBack();
      return;
    }
    // The deadline: a page too busy to run the command in time doesn't go back after the WebView already has.
    this.run<number>('back', [Date.now() + BACK_ANSWER_MS - 100], BACK_ANSWER_MS).then(
      (steps) => {
        if (!(typeof steps === 'number' && steps > 0) && this.webview === webview) webview.goBack();
      },
      () => {
        if (this.webview === webview) webview.goBack();
      },
    );
  }

  historyForward() {
    this.lastAppAction = 'forward';
    this.nav.begin('', 'app');
    this.webview?.goForward();
  }

  /**
   * "Try again" on the very slow line: the waiting navigation is asked for again (the WebView would otherwise reload
   * the page still on screen).
   */
  retryNavigation() {
    const target = this.nav.pending?.url || this.url;
    this.webview?.stopLoading();
    if (this.loading) this.handleLoadEnd();
    this.nav.end('stopped');
    if (target && target !== this.committedUrl) this.loadUrl(target);
    else this.reload();
  }

  /** The page's scroll position (main frame, sent by the page after scrolling stops). */
  noteScroll(y: number) {
    if (!Number.isFinite(y) || y < 0) return;
    this.scrollMemory = { url: this.url, y: Math.round(y) };
  }

  /** After a load end: the scroll position to restore for this page (once), if the tab was woken on it. */
  takeScrollRestore(url: string): number | null {
    const r = this.scrollRestore;
    if (!r || !samePage(r.url, url)) return null;
    this.scrollRestore = null;
    return r.y > 0 ? r.y : null;
  }

  handleMessage(data: string): boolean {
    let msg: { __qutai?: string; id?: string; ok?: boolean; result?: unknown; error?: string };
    try {
      // Page text may hold half an emoji (a site's own cut, or ours in an older page script): made well-formed here,
      // before it can reach a model (utils/wellFormed.ts).
      msg = JSON.parse(wellFormedJsonText(data));
    } catch {
      return false;
    }
    if (msg.__qutai !== this.nonce || !msg.id) return false;
    const p = this.pending.get(msg.id);
    if (!p) return true;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.result);
    else if ((msg as Record<string, unknown>)[MISSING_REPLY] === true) p.resolve(MISSING);
    else p.reject(new Error(msg.error || 'Unknown page error'));
    return true;
  }

  /** `nativeLoading`: the event's own `loading` (Android: false for a page's pushState / replaceState). */
  handleLoadStart(url?: string, nativeLoading?: boolean) {
    if (isAppLinkError(url)) return;
    // Android starts its own error document for the address that just failed (a load start with no load end): the
    // error stays, and the tab isn't loading.
    if (this.loadError && url && url === this.loadErrorUrl && Date.now() - this.loadErrorAt < 2000) return;
    // A page changing its own address (history API, a #fragment) loads nothing and never reports an end: not a load,
    // and the page's location, camera and playback state carry on (loadState.ts).
    if (!startsLoading({ url, currentUrl: this.url, os: Platform.OS, nativeLoading })) return;
    if (Platform.OS === 'android') {
      // Android reports the start once the site has answered: the new page commits now.
      this.commit(url);
    } else if (!this.nav.redirect(url ?? this.url)) {
      // iOS reports it when the navigation is decided, before any answer: a navigation the page started on its own.
      this.nav.begin(url ?? this.url, 'page');
    }
    this.documents++;
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
      this.pageSignals = null;
    }
    this.loading = true;
    this.loadError = null;
    this.onChange();
  }

  handleError(error: { code: number; description: string; url?: string }) {
    this.loadError = toLoadError(error.code, error.description);
    this.loadErrorUrl = error.url ?? null;
    this.loadErrorAt = Date.now();
    this.offlineErrorUrl = this.loadError.kind === 'offline' ? (error.url ?? this.url) : null;
    this.cover = null;
    this.nav.end('error');
    this.onChange();
  }

  /**
   * The user chose "Continue anyway" on this tab's certificate error page (Android): this certificate is allowed on
   * this host for the session (certificateExceptions.ts), and the WebView loads the page again.
   */
  continuePastCertificate(url: string, fingerprint: string) {
    addCertificateException(url, fingerprint, this);
    // The WebView loads the refused page again itself once it receives the new list (patched react-native-webview).
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

  /**
   * Stop (the page menu): the WebView stops, and the tab is no longer loading whatever the WebView reports (it sends
   * nothing when it wasn't loading, and iOS reports a stopped navigation as a cancel it doesn't pass on).
   */
  stop() {
    this.webview?.stopLoading();
    if (this.loading) this.handleLoadEnd();
    // The page on screen stays, and so does its address.
    this.nav.end('stopped');
  }

  /** The WebView's load progress (0-1): at 1 the load is over, whether or not a load end follows. */
  handleLoadProgress(progress: number) {
    const p = this.nav.pending;
    if (p && !p.responded && Platform.OS === 'ios' && progress >= IOS_ANSWERED_PROGRESS && progress < 1) this.commit();
    this.nav.progress(progress);
    if (progress >= 1 && this.loading) {
      this.handleLoadEnd();
      if (this.nav.pending?.responded) this.nav.end('loaded');
    }
  }

  /**
   * The WebView's load end. One that comes before the waiting navigation was answered belongs to the page still on
   * screen (Android) unless it is for the address being opened; on iOS it means the WebView went idle (the waiting
   * navigation finished from cache, or was cancelled).
   */
  handleWebViewLoadEnd(url?: string) {
    this.handleLoadEnd();
    if (url && url !== 'about:blank') this.popupLoaded = true;
    const p = this.nav.pending;
    if (!p) return;
    // The navigation ended in a link for another app (cancelled, handed off): nothing new is on screen (DL-18).
    if (isAppLinkError(url)) return this.nav.end('stopped');
    if (p.responded) return this.nav.end('loaded');
    if (Platform.OS === 'ios') {
      if (url && samePage(url, this.url) && url !== this.committedUrl) this.commit();
      return this.nav.end(this.nav.pending?.responded ? 'loaded' : 'stopped');
    }
    if (!p.url || (url && samePage(url, p.url))) {
      this.commit(url);
      this.nav.end('loaded');
    }
  }

  /** The navigation turned out to be a file: the page on screen stays, and nothing is loading any more. */
  handleDownloadStart() {
    if (this.loading) this.handleLoadEnd();
    this.nav.end('download');
  }

  /**
   * The page's web process ended (Android: crashed or killed for memory; iOS: terminated). No load end comes: the
   * loading state ends here and the page comes back, iOS in the same WebView, Android in a new one (the old one is
   * unusable).
   */
  handleProcessGone(onScreen: boolean, now = Date.now()) {
    if (this.loading) this.handleLoadEnd();
    this.nav.end('gone');
    // Commands waiting for the page get a clear answer now instead of timing out.
    this.rejectPending(PAGE_GONE_ERROR);
    if (this.asleep || this.isNewTab) return;
    const page = crashPage(this.url);
    const action = processGoneAction(this.lastProcessEnd, page, now, onScreen);
    this.lastProcessEnd = { page, at: now };
    if (action === 'reloadOnReturn') {
      if (Platform.OS === 'ios') {
        this.reloadOnShow = true;
      } else {
        // Like a sleeping tab: the WebView goes, and the page loads again when the user comes back (Browser.switchTab).
        this.dispose();
        this.webview = null;
        this.asleep = true;
      }
      this.onChange();
      return;
    }
    if (action === 'screen') {
      this.crashed = { url: this.url };
      this.cover = null;
      if (Platform.OS === 'android') this.webview = null;
      this.onChange();
      return;
    }
    this.restartPage();
  }

  /** The page loads again after its process ended: iOS in the same WebView, Android in a new one. */
  private restartPage() {
    this.nav.begin(this.url, 'app');
    if (Platform.OS === 'ios') {
      this.webview?.reload();
    } else {
      this.webview = null;
      this.webviewKey++;
      this.source = { uri: this.url };
    }
    this.onChange();
  }

  /** "Reload" on the "This page stopped working" screen. */
  recoverFromCrash() {
    if (!this.crashed) return;
    this.crashed = null;
    this.restartPage();
  }

  /** The tab came on screen (Browser.setActive): a page whose process ended meanwhile loads again (iOS). */
  shown() {
    if (!this.reloadOnShow) return;
    this.reloadOnShow = false;
    this.restartPage();
  }

  private rejectPending(message: string) {
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error(message));
    });
    this.pending.clear();
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

  /**
   * Resolves on the next load end, or after the timeout; never rejects, except when the task's `signal` aborts
   * (StoppedError, at once).
   */
  waitForNextLoad(timeoutMs = 15000, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new StoppedError());
      let done = false;
      const end = () => {
        if (done) return false;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.loadWaiters = this.loadWaiters.filter((w) => w !== finish);
        return true;
      };
      const finish = () => {
        if (end()) resolve();
      };
      const onAbort = () => {
        if (end()) reject(new StoppedError());
      };
      const timer = setTimeout(finish, timeoutMs);
      this.loadWaiters.push(finish);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** Gives a click or submit a moment to start navigating, then waits for it to finish (Stop ends it at once). */
  async settle(signal?: AbortSignal): Promise<void> {
    if (isRunningInBackground()) return this.settleInBackground(signal);
    await sleep(600, signal);
    if (this.loading) await this.waitForNextLoad(undefined, signal);
    await sleep(300, signal);
  }

  async navigate(url: string, signal?: AbortSignal): Promise<void> {
    throwIfStopped(signal);
    if (isRunningInBackground()) {
      if (this.isNewTab || !this.webview || this.asleep) throw new NeedsForegroundError();
      this.loadError = null;
      this.loadUrl(url);
      return this.settleInBackground(signal);
    }
    const wait = this.waitForNextLoad(undefined, signal);
    this.loadUrl(url);
    await wait;
    await sleep(300, signal);
  }

  async goBack(signal?: AbortSignal): Promise<void> {
    throwIfStopped(signal);
    if (isRunningInBackground()) {
      if (!this.webview || this.asleep) throw new NeedsForegroundError();
      await backgroundGoBack(this.playback.nonce);
      return this.settleInBackground(signal);
    }
    this.webview?.goBack();
    await this.settle(signal);
  }

  /**
   * In the background, page load events may not reach the app: waits until the WebView reports the page loaded
   * (or 15 s), then takes the address and title from the WebView itself.
   */
  private async settleInBackground(signal?: AbortSignal): Promise<void> {
    await sleep(600, signal);
    const deadline = Date.now() + 15000;
    let state: BackgroundPageState | null = null;
    while (Date.now() < deadline) {
      state = await backgroundPageState(this.playback.nonce);
      if (!state || state.progress >= 100) break;
      await sleep(300, signal);
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
    await sleep(300, signal);
  }

  /**
   * Checks (shortly, once the page has settled) whether the page looks like an article, and what kind of page it is.
   * Repeated calls within the delay run once (a load end and a script's own address change come together). Pages
   * that fill in their content later are checked again a little after.
   */
  probeReaderSoon(delayMs = 600) {
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      void this.probeSignals();
      this.probeReader().then((found) => {
        if (delayMs < 2000 && (!found || !this.pageSignals?.kinds.length)) this.probeReaderSoon(2500);
      });
    }, delayMs);
  }

  /** Reads the page-kind flags (pageKind.ts); stays null when the page doesn't answer. */
  async probeSignals(): Promise<void> {
    if (this.isNewTab || !this.webview || this.asleep || isRunningInBackground()) return;
    const url = this.url;
    const raw = await this.run<unknown>('pageSignals', [], 3000).catch(() => null);
    if (this.url !== url) return;
    const signals = parsePageSignals(raw);
    if (!signals || samePageSignals(signals, this.pageSignals)) return;
    this.pageSignals = signals;
    this.onChange();
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
    this.rejectPending('The tab was closed.');
    this.handleLoadEnd();
    this.nav.dispose();
  }

  /** How many documents have started loading in this tab (kept scripts run once per document, browser/keptScripts.ts). */
  documents = 0;

  /** The page script's current secret name on window. */
  get agentName(): string {
    return this.agentNameValue;
  }

  /** The page script installed under the current name (for the WebView's early and after-load scripts). */
  get agentInstallScript(): string {
    if (this.installCache?.name !== this.agentNameValue)
      this.installCache = { name: this.agentNameValue, script: agentInstallScript(this.agentNameValue) };
    return this.installCache.script;
  }

  /**
   * Runs one page command and resolves with its result. Only the call is sent; when the page script is not in the
   * document yet (Android's early script came too late or not at all, a page loaded in another way), the command
   * is sent once more together with the script.
   */
  async run<T = unknown>(command: PageCommand, args: unknown[] = [], timeoutMs = 10000, signal?: AbortSignal): Promise<T> {
    throwIfStopped(signal);
    if (PAGE_ACTIONS.has(command)) this.closeReader();
    if (this.crashed) throw new Error(PAGE_GONE_ERROR);
    if (isRunningInBackground()) return this.runInBackground<T>(command, args, timeoutMs);
    const webview = this.reader && READER_COMMANDS.has(command) && this.readerWebview ? this.readerWebview : this.webview;
    if (!webview) throw new Error('The tab is not ready');
    const deliver = 'window.ReactNativeWebView.postMessage(JSON.stringify(payload));';
    const send = (install: boolean) => {
      const id = `${this.nonce}-${++this.counter}`;
      const code = (install ? this.agentInstallScript : '') + agentCommandScript(this.agentNameValue, command, args, this.nonce, id, deliver);
      return new Promise<unknown>((resolve, reject) => {
        const onAbort = () => {
          const pending = this.pending.get(id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(id);
          reject(new StoppedError());
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          this.pending.delete(id);
          reject(new Error('The page did not respond (it may still be loading).'));
        }, timeoutMs);
        // A Stop ends the wait for the page's answer at once (the command may still run on the page).
        const done = (fn: (v: unknown) => void) => (v: unknown) => {
          signal?.removeEventListener('abort', onAbort);
          fn(v);
        };
        this.pending.set(id, { resolve: done(resolve), reject: done(reject as (v: unknown) => void), timer });
        signal?.addEventListener('abort', onAbort, { once: true });
        webview.injectJavaScript(code);
      });
    };
    let reply = await send(false);
    throwIfStopped(signal);
    if (reply === MISSING) reply = await send(true);
    if (reply === MISSING) throw new Error("Qutai's page script could not be set up on this page.");
    return reply as T;
  }

  /** Bytes the WebView receives for one command now, and what it received before 20 Nov 2026 (for the payload test). */
  commandSize(command: PageCommand, args: unknown[] = []): { now: number; withScript: number } {
    const deliver = 'window.ReactNativeWebView.postMessage(JSON.stringify(payload));';
    const call = agentCommandScript(this.agentNameValue, command, args, this.nonce, `${this.nonce}-0`, deliver);
    const bytes = (text: string) => new TextEncoder().encode(text).length;
    return { now: bytes(call), withScript: bytes(this.agentInstallScript + call) };
  }

  /**
   * Runs a script the user approved (run_script, docs/page-customisation.md › Scripts): `build` makes the wrapped code
   * from this tab's message nonce and the reply's id (content/userScripts.ts wrapScript); resolves with the reply.
   * Not while the app is in the background (the approval needs the screen anyway).
   */
  runScript<T = unknown>(build: (nonce: string, id: string) => string, timeoutMs: number): Promise<T> {
    const webview = this.webview;
    if (!webview || this.isNewTab) return Promise.reject(new Error('The tab is not ready'));
    this.closeReader();
    const id = `${this.nonce}-${++this.counter}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('timeout'));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      webview.injectJavaScript(build(this.nonce, id));
    });
  }

  /** The nonce this tab's page messages carry (kept scripts' messages, browser/keptScripts.ts). */
  get messageNonce(): string {
    return this.nonce;
  }

  /**
   * The same command while the assistant works with the app in the background: view commands and WebView events
   * wait for the app to come back, so the script goes to the WebView natively and leaves its reply in the page,
   * where the native side picks it up (src/device/backgroundTask.ts). Throws NeedsForegroundError, before anything
   * runs on the page, when the tab has no live WebView.
   */
  private async runInBackground<T>(command: PageCommand, args: unknown[], timeoutMs: number): Promise<T> {
    if (!this.webview || this.asleep || this.isNewTab) throw new NeedsForegroundError();
    const box = JSON.stringify(`__qutaiReplies_${this.nonce}`);
    const send = async (install: boolean) => {
      const id = `${this.nonce}-${++this.counter}`;
      const code =
        (install ? this.agentInstallScript : '') +
        agentCommandScript(this.agentNameValue, command, args, this.nonce, id, `(window[${box}] = window[${box}] || {})[${JSON.stringify(id)}] = payload;`);
      const poll =
        `(function () { var b = window[${box}]; var k = ${JSON.stringify(id)}; if (!b || !(k in b)) return null; ` +
        'var r = b[k]; delete b[k]; return JSON.stringify(r); })()';
      const raw = await evaluateInPage(this.playback.nonce, code, poll, timeoutMs);
      if (raw == null) throw new Error('The page did not respond (it may still be loading).');
      // The WebView returns the poll's value JSON-encoded: a string holding the reply's JSON.
      return JSON.parse(wellFormedJsonText(JSON.parse(raw))) as Record<string, unknown> & {
        __qutai?: string;
        ok?: boolean;
        result?: unknown;
        error?: string;
      };
    };
    let msg = await send(false);
    if (msg.__qutai === this.nonce && msg[MISSING_REPLY] === true) msg = await send(true);
    if (msg.__qutai !== this.nonce) throw new Error('Unknown page error');
    if (msg.ok) return msg.result as T;
    if (msg[MISSING_REPLY] === true) throw new Error("Qutai's page script could not be set up on this page.");
    throw new Error(msg.error || 'Unknown page error');
  }
}
