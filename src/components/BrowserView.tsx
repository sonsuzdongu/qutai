import { BLOB_KEEP_SCRIPT } from '../browser/pageScript';
import { PageDownload, pageDownloadFrom } from '../browser/downloadRequests';
import { ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Browser } from '../browser/Browser';
import type { SearchEngineId } from '../browser/search';
import { CONTEXT_MENU_SCRIPT, ContextTarget, parseContextTarget } from '../browser/contextMenu';
import { parseSelection, SELECTION_SCRIPT } from '../browser/selection';
import { adBlockScript, COOKIE_BANNER_SCRIPT, isAdUrl, isHostIn } from '../content';
import { AD_HOSTS } from '../content/adBlock';
import { PageRule, siteRulesScript } from '../content/siteRules';
import { VIDEO_AD_RULES, videoAdScript } from '../content/videoAds';
import { PageStyle, userStylesScript } from '../content/userStyles';
import { keptScriptsReadyScript } from '../content/userScripts';
import { keptScripts } from '../browser/keptScripts';
import { pageStyleState } from '../browser/pageStyleState';
import { iosStoreKey } from '../device/cookieStore';
import { siteKey } from '../agent/sitePolicy';
import { allowInsecure, upgradeToHttps } from '../browser/httpsOnly';
import { DESKTOP_USER_AGENT, DESKTOP_VIEWPORT_SCRIPT, textZoomScript } from '../browser/desktopMode';
import { linkTarget, toLoadError } from '../browser/navigation';
import { certificateExceptionsFor, mayBypassCertificate, noteValidCertificate } from '../browser/certificateExceptions';
import { isLocalUrl } from '../browser/localNetwork';
import { endLaunchChain, mayOfferExternal, noteUserGesture, touchedRecently } from '../browser/externalGuard';
import { isUserTap, windowOpensInFront } from '../browser/pendingNavigation';
import { FORM_ANSWER_IDLE, formAnswer } from '../browser/formResubmission';
import { parseBarMessage, TOOLBAR_SCROLL_SCRIPT } from '../browser/toolbarScroll';
import { parseScrollMessage, restoreScrollScript, SCROLL_MEMORY_SCRIPT } from '../browser/scrollMemory';
import { FORCE_ZOOM_SCRIPT } from '../browser/forceZoom';
import { geolocationScript } from '../browser/geolocation';
import { FILE_CAPTURE_SCRIPT, handleFileCaptureMessage } from '../browser/fileCapture';
import { mediaCaptureScript } from '../browser/mediaCapture';
import { playbackScript } from '../browser/playback';
import { openExternal } from '../browser/openExternal';
import { takeSignInLink } from './AccountLinks';
import { PULL_STATE_SCRIPT } from '../browser/pullToRefresh';
import { handleUserAgentMessage, USER_AGENT_SCRIPT, useChromeUserAgent } from '../browser/userAgent';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { usePalette } from '../ui/theme';
import { dialog } from './Dialog';
import { CrashPage, ErrorPage } from './ErrorPage';
import type { LibraryTab } from './LibraryScreen';
import { NewTabPage } from './NewTabPage';
import { ReaderPrefs, ReaderView } from './ReaderView';

/**
 * Renders every tab's WebView stacked on top of each other. Hidden tabs stay
 * mounted and laid out (only made invisible) so they keep their state and the
 * agent can still read and click in a tab the user isn't looking at.
 */
export type TabActions = {
  /** Open http:// pages over https:// (asking before falling back). */
  httpsOnly: boolean;
  /** Android: block third-party cookies (iOS always does). */
  blockThirdPartyCookies: boolean;
  /** Dark theme is on. */
  darkMode: boolean;
  blockAds: boolean;
  /**
   * Sites where ad and tracker blocking is off ("Don't block on this site"), with their subdomains; read natively
   * on every request (Android) or navigation (iOS), so a change applies from the next load.
   */
  blockingOffSites: string[];
  /** iOS: the compiled WebKit content rule lists to attach (see blocking.ts); empty until lists are compiled. */
  contentRuleLists: string[];
  hideCookieBanners: boolean;
  /** "Block video ads" (content/videoAds.ts): off by default; not on "Block ads and trackers here" off sites. */
  blockVideoAds: boolean;
  /**
   * The user's own hiding rules (content/siteRules.ts), enabled ones only; each page applies those that match its
   * address. Not on "Don't block on this site" sites, and none while blockAds is off.
   */
  siteRules: PageRule[];
  /** Domains the user blocks with their own rules, also caught by the page script blocker. */
  userBlockedHosts: string[];
  /**
   * The user's kept styles (content/userStyles.ts), enabled ones only; each page applies those whose scope matches.
   * Not ad blocking: they apply whatever the blocking switches say, in incognito tabs too (as hide rules do).
   */
  userStyles: PageStyle[];
  /**
   * Whether kept scripts may run (the setting is on and some are switched on): normal tabs then get the small "ready"
   * script, and browser/keptScripts.ts decides which scripts run on each page (docs/page-customisation.md).
   */
  keptScripts: boolean;
  /** A link or image was long-pressed in this tab. */
  onContextMenu: (tab: Tab, target: ContextTarget) => void;
  /** The text selection in this tab changed ("" when cleared). */
  onSelection: (tab: Tab, text: string) => void;
  /** The page offered a file the WebView can't show (a download; on Android with what the WebView knows). */
  onDownload: (tab: Tab, download: PageDownload) => void;
  /** Page text size in percent. */
  textZoom: number;
  /** Pinch-zoom pages that turn zooming off. */
  forceZoom: boolean;
  /** "Keep playing in the background" (iOS: videos paused by WebKit on leaving the app play on as sound). */
  backgroundPlayback: boolean;
  /** Short notice for the user, e.g. when no app can open a link. */
  onNotice: (message: string) => void;
  /**
   * A page opened a window while the user wasn't on it, or without a touch: it opened behind the tab on screen
   * (never taking the screen from what the user is doing), and the user is told, with a way to switch to it.
   */
  onOpenedInBackground: (opened: Tab) => void;
  searchEngine: SearchEngineId;
  onAsk: (text: string) => void;
  /** "My apps" on the new tab page: asks the assistant for a first app (a draft, not sent). */
  onAskForApp: () => void;
  onOpenLibrary: (tab: LibraryTab) => void;
  /** Reader mode look (the text size is textZoom). */
  reader: Omit<ReaderPrefs, 'textZoom'>;
  onOpenReaderSettings: () => void;
};

export function BrowserView({
  browser,
  newTabActions,
}: {
  browser: Browser;
  newTabActions: TabActions;
}) {
  return (
    <View style={styles.container}>
      {/* Sleeping tabs have no WebView until they are woken. */}
      {browser.tabs
        .filter((tab) => !tab.asleep)
        .map((tab) => (
          <TabWebView
            key={tab.id}
            tab={tab}
            browser={browser}
            active={tab.id === browser.activeId}
            newTabActions={newTabActions}
          />
        ))}
      {/* The working glow and the action marker are drawn at screen level (App.tsx, docs/working-mode.md). */}
    </View>
  );
}

function TabWebView({
  tab,
  browser,
  active,
  newTabActions,
}: {
  tab: Tab;
  browser: Browser;
  active: boolean;
  newTabActions: TabActions;
}) {
  // On iOS `incognito` gives each tab a non-persistent data store. On Android the
  // same prop calls CookieManager.removeAllCookies(), which logs the user out of
  // every normal tab and still shares cookies, so it is deliberately not used there:
  // incognito tabs get the incognito session's WebView profile instead (tab.profile,
  // see webviewProfile.ts), or share the default one where the WebView is too old.
  const iosIncognito = tab.incognito && Platform.OS === 'ios';
  const androidIncognito = tab.incognito && Platform.OS === 'android';
  const { textZoom, blockAds, blockingOffSites } = newTabActions;
  // The page script blocker (complements the native one: it catches what scripts add later) skips off sites itself.
  const { siteRules, userBlockedHosts } = newTabActions;
  const adScript = useMemo(
    () => (blockAds ? adBlockScript([...AD_HOSTS, ...userBlockedHosts], blockingOffSites) : ''),
    [blockAds, blockingOffSites, userBlockedHosts],
  );
  // "Block video ads": the ad plan taken out of the player's data before the player reads it. Every frame
  // (embedded players too); the script itself does nothing on other hosts or on off sites. Incognito tabs too.
  const videoScript = useMemo(
    () => (newTabActions.blockVideoAds ? videoAdScript(VIDEO_AD_RULES, blockingOffSites) : ''),
    [newTabActions.blockVideoAds, blockingOffSites],
  );
  // The user's own hiding rules; installed (empty) even while blocking is off, so turning rules off reaches open pages.
  const rulesScript = useMemo(
    () => siteRulesScript(blockAds ? siteRules : [], blockingOffSites),
    [blockAds, siteRules, blockingOffSites],
  );
  // The user's kept styles, unless "Styles off for this page" is on for this tab (pageStyleState).
  const stylesOff = useSyncExternalStore(pageStyleState.subscribe, () => pageStyleState.off(tab.id));
  const stylesScript = useMemo(() => userStylesScript(newTabActions.userStyles, stylesOff), [newTabActions.userStyles, stylesOff]);
  // Kept scripts never run in incognito tabs; the page only reports when it is ready (keptScripts decides).
  const keptReady = newTabActions.keptScripts && !tab.incognito ? keptScriptsReadyScript(tab.messageNonce) : '';
  const offSitesProp = useMemo(() => blockingOffSites.join('\n'), [blockingOffSites]);
  const ruleListsProp = useMemo(() => newTabActions.contentRuleLists.join('\n'), [newTabActions.contentRuleLists]);
  // Navigations and windows the app itself blocks (built-in list) are let through on off sites.
  const scriptBlocking = () => blockAds && !isHostIn(siteKey(tab.url), blockingOffSites);
  // The page's navigator.geolocation goes through the app (per-site permission); installed in every frame
  // (frames are always refused). Android runs it in the main frame only and leaves native geolocation off.
  const geoScript = geolocationScript(tab.geolocation.nonce);
  // Runs before the page's own scripts: request blocking and banner hiding (no flash of the banner), main frame
  // only, and the geolocation bridge.
  // Also keeps blobs a page creates readable for its downloads (BLOB_KEEP_SCRIPT).
  const mainFrameEarly = [
    adScript,
    rulesScript,
    stylesScript,
    newTabActions.hideCookieBanners ? COOKIE_BANNER_SCRIPT : '',
    BLOB_KEEP_SCRIPT,
  ].join('\n');
  // getUserMedia asks the app (per-site permission) before the WebView's own capture may run; the native
  // mediaCaptureGrant prop below is what enforces it. Every frame on iOS (frames are refused), main frame on Android.
  const mediaScript = mediaCaptureScript(tab.media.nonce);
  // Watches the page's media (audible tab, background playback, media controls); every frame on iOS, main frame on
  // Android. See playback.ts.
  // iOS: with "Keep playing in the background" on, a video WebKit pauses when the app leaves plays on as sound.
  const playScript = playbackScript(
    tab.playback.nonce,
    tab.incognito,
    t('playback.privateTab'),
    Platform.OS === 'ios' && newTabActions.backgroundPlayback,
  );
  // Qutai's page script (browser/agentScript.ts), main frame only: installed before the page's own scripts (iOS; on
  // Android as early as the WebView runs this), under the tab's secret name; commands then send only the call.
  const agentScript = tab.agentInstallScript;
  const earlyScript = [
    agentScript,
    videoScript,
    geoScript,
    mediaScript,
    playScript,
    mainFrameEarly.trim() ? `if (window.top === window) (function () {\n${mainFrameEarly}\n})();` : '',
    keptReady,
    // Answers touches while the page is still loading (main frame only; installed once).
    Platform.OS === 'android' ? PULL_STATE_SCRIPT : '',
  ].join('\n');
  // Runs after every page load: long-press menu, text selection, desktop viewport (Android) and text size (iOS).
  const pageSetupScript = [
    // Again after load: Android may have run the early script for the previous page (a no-op when installed).
    agentScript,
    // Android may run the early script too soon for the new page; installing again is a no-op otherwise.
    // (Video ads: too late for the first player data, but later navigations, ad boxes and the skip fallback work.)
    Platform.OS === 'android' ? videoScript : '',
    Platform.OS === 'android' ? geoScript : '',
    Platform.OS === 'android' ? mediaScript : '',
    Platform.OS === 'android' ? playScript : '',
    Platform.OS === 'android' ? FILE_CAPTURE_SCRIPT : '',
    Platform.OS === 'android' ? BLOB_KEEP_SCRIPT : '',
    // Again after load (main frame): Android may have run the early script for the previous page.
    `if (window.top === window) (function () {\n${rulesScript}\n})();`,
    `if (window.top === window) (function () {\n${stylesScript}\n})();`,
    keptReady,
    CONTEXT_MENU_SCRIPT,
    SELECTION_SCRIPT,
    tab.desktop && Platform.OS === 'android' ? DESKTOP_VIEWPORT_SCRIPT : '',
    Platform.OS === 'android' ? PULL_STATE_SCRIPT : '',
    Platform.OS === 'android' ? USER_AGENT_SCRIPT : '',
    Platform.OS === 'ios' && textZoom !== 100 ? textZoomScript(textZoom) : '',
    // Where the page was scrolled, so a woken tab comes back there (incognito tabs never sleep).
    tab.incognito ? '' : SCROLL_MEMORY_SCRIPT,
    // Scrolling down slides the address bar away; the page says when (toolbarScroll.ts), not every scroll frame.
    TOOLBAR_SCROLL_SCRIPT,
    newTabActions.forceZoom ? FORCE_ZOOM_SCRIPT : '',
  ].join('\n');

  const palette = usePalette();
  // Android: Chrome's own user agent instead of the WebView's "embedded browser" one (fewer bot checks).
  const chromeUserAgent = useChromeUserAgent();
  const userAgent = tab.desktop ? DESKTOP_USER_AGENT : Platform.OS === 'android' ? chromeUserAgent : undefined;
  // Downloads started outside the WebView's listener (long-press menu, the assistant) send the same user agent.
  useEffect(() => {
    tab.setUserAgent(userAgent);
  }, [tab, userAgent]);
  // Android pull to refresh: the patched WebView turns it off for each touch the page says would scroll
  // (pullToRefresh.ts, RNCWebViewPull.java).
  const [refreshing, setRefreshing] = useState(false);
  // Android: the answer to the WebView's "send the form again?" question (formResubmission.ts).
  const [formResubmission, setFormResubmission] = useState(FORM_ANSWER_IDLE);

  // Changed rules (saved, switched, removed, an "off" site) reach the page already open at once.
  const firstRules = useRef(true);
  useEffect(() => {
    if (firstRules.current) {
      firstRules.current = false;
      return;
    }
    tab.webview?.injectJavaScript(`if (window.top === window) (function () {\n${rulesScript}\n})(); true;`);
  }, [tab, rulesScript]);

  // Changed styles (kept, switched, edited, deleted, "Styles off for this page") reach the page already open at once.
  const firstStyles = useRef(true);
  useEffect(() => {
    if (firstStyles.current) {
      firstStyles.current = false;
      return;
    }
    tab.webview?.injectJavaScript(`if (window.top === window) (function () {\n${stylesScript}\n})(); true;`);
  }, [tab, stylesScript]);

  // iOS: apply a new text size to the page already on screen too.
  useEffect(() => {
    if (Platform.OS === 'ios') tab.webview?.injectJavaScript(textZoomScript(textZoom));
  }, [tab, textZoom]);

  // The camera / microphone grant reached the WebView: the page may now call the real getUserMedia.
  const mediaGrant = tab.media.grant;
  useEffect(() => {
    tab.media.applied(mediaGrant);
  }, [tab, mediaGrant]);

  // Capture is paused while another tab is shown (and while the app is in the background).
  useEffect(() => {
    tab.media.setShown(active);
  }, [tab, active]);

  return (
    <View
      ref={(ref) => tab.setContainer(ref)}
      collapsable={false}
      style={[StyleSheet.absoluteFill, active ? styles.visible : styles.hidden]}
      // A full-page capture scrolls the page itself; touches would get in its way.
      pointerEvents={active && !tab.capturing ? 'auto' : 'none'}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!active}
      // Touches inside the page land here too; they let the page ask to open another app.
      onTouchStart={() => noteUserGesture(tab)}
    >
      {tab.isNewTab ? (
        <NewTabPage
          incognito={tab.incognito}
          darkMode={newTabActions.darkMode}
          active={active}
          onNavigate={(url) => tab.loadUrl(url)}
          onAskForApp={newTabActions.onAskForApp}
          onOpenLibrary={newTabActions.onOpenLibrary}
        />
      ) : (
        <PullToRefresh
          enabled={!tab.capturing}
          refreshing={refreshing}
          tint={palette.tint}
          background={palette.surface}
          onRefresh={() => {
            setRefreshing(true);
            tab.reload();
            // In case the page never reports finishing.
            setTimeout(() => setRefreshing(false), 10000);
          }}
        >
          {/* Android: an ended page process leaves its WebView unusable; a new key gives the tab a new one. */}
          {Platform.OS === 'android' && tab.crashed ? null : (
          <WebView
            key={tab.webviewKey}
            ref={(ref) => tab.setWebView(ref)}
            source={tab.source}
            style={styles.flex}
            onMessage={(e) => {
              if (tab.handleMessage(e.nativeEvent.data)) return;
              if (keptScripts.handleMessage(tab, e.nativeEvent.data)) return;
              if (tab.geolocation.handleMessage(e.nativeEvent.data)) return;
              if (tab.media.handleMessage(e.nativeEvent.data)) return;
              if (tab.playback.handleMessage(e.nativeEvent.data)) return;
              if (handleFileCaptureMessage(tab, e.nativeEvent.data)) return;
              if (handleUserAgentMessage(e.nativeEvent.data)) return;
              const bar = parseBarMessage(e.nativeEvent.data);
              if (bar !== null) return tab.noteBarScroll(bar);
              const scrolled = parseScrollMessage(e.nativeEvent.data);
              if (scrolled !== null) return tab.noteScroll(scrolled);
              const selection = parseSelection(e.nativeEvent.data);
              if (selection !== null) return newTabActions.onSelection(tab, selection);
              const target = parseContextTarget(e.nativeEvent.data);
              if (target && active) newTabActions.onContextMenu(tab, target);
            }}
            onLoadStart={(e) => {
              tab.handleLoadStart(e.nativeEvent.url, e.nativeEvent.loading);
              // A style tried but not kept belongs to the page it was approved on.
              pageStyleState.pageLoaded(tab.id);
            }}
            // The WebView's own progress reaching 100 % also ends a load: a page's soft navigation (react.dev's
            // client-side routing) goes 10 % → 100 % on Android with no load end after its start.
            onLoadProgress={(e) => tab.handleLoadProgress(e.nativeEvent.progress)}
            onLoadEnd={(e) => {
              tab.handleWebViewLoadEnd(e.nativeEvent.url);
              // A woken tab back on its page: where it was scrolled.
              const y = tab.takeScrollRestore(e.nativeEvent.url);
              if (y !== null) tab.webview?.injectJavaScript(restoreScrollScript(y));
              // An https page that is still on screen without an error a moment later had a valid certificate
              // (Android reports a load end before the error of a failed load).
              const loaded = e.nativeEvent.url;
              if (/^https:/i.test(loaded)) {
                setTimeout(() => {
                  if (!tab.loadError && !tab.loading && tab.url === loaded) noteValidCertificate(loaded, tab.incognito);
                }, 1500);
              }
              setRefreshing(false);
              // A page has loaded: a tab opened from another app no longer counts its redirects as the user's tap.
              if (/^https?:/i.test(e.nativeEvent.url)) endLaunchChain(tab);
              // Is this page an article? (reader mode indicator)
              tab.probeReaderSoon();
            }}
            pullToRefreshEnabled={!tab.capturing}
            // Scrollbars would be drawn on every piece of a full-page capture.
            showsVerticalScrollIndicator={!tab.capturing}
            showsHorizontalScrollIndicator={!tab.capturing}
            onNavigationStateChange={(nav) => {
              tab.handleNavigationStateChange(nav);
              if (!nav.loading) browser.notifyVisit(tab);
            }}
            // Links opened from an incognito tab stay incognito.
            onOpenWindow={(e) => {
              if (scriptBlocking() && isAdUrl(e.nativeEvent.targetUrl)) return;
              // A window the page opens joins the page's tab group (pages that open several windows
              // stay together, and the assistant can manage and close them as one). It comes to the front only when
              // the user just touched this page and is still on it: a window that arrives late (a slow site) or that
              // the page opens on its own goes behind, so it never takes the screen from the tab the user is on
              // (20 Nov 2026 report: a slow load seemed to land in the tab opened meanwhile).
              const front = windowOpensInFront(active && browser.activeId === tab.id, touchedRecently(tab));
              const opened = browser.openTab(e.nativeEvent.targetUrl, {
                incognito: tab.incognito,
                openerId: tab.id,
                group: true,
                activate: front,
              });
              if (!front) newTabActions.onOpenedInBackground(opened);
            }}
            // Every URL reaches onShouldStartLoadWithRequest; the default allowlist would hand other
            // schemes to canOpenURL, which silently drops links to apps the OS doesn't let us see.
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(request) => {
              // Ad and tracker pages, frames and redirects never load.
              if (scriptBlocking() && isAdUrl(request.url)) return false;
              // The sign-in email's link (its website page, or the app link that page opens): handled by the account,
              // never loaded, so its token stays out of the tab and the history. Pro builds only (null otherwise).
              if (request.isTopFrame !== false && takeSignInLink(request.url)) return false;
              if (request.isTopFrame !== false) {
                const secure = upgradeToHttps(request.url, newTabActions.httpsOnly);
                if (secure !== request.url) {
                  tab.markHttpsUpgrade(request.url);
                  tab.loadUrl(secure);
                  return false;
                }
              }
              if (request.isTopFrame !== false && request.navigationType === 'formresubmit' && Date.now() > tab.allowResubmitUntil) {
                // iOS: going back to, or reloading, the result of a sent form would send it again (an order, a
                // payment). Asked first; Android's WebView never sends it again and doesn't say so (no JavaScript hook).
                dialog.alert(t('nav.resubmitTitle'), t('nav.resubmitBody'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('nav.resubmitSend'),
                    onPress: () => {
                      tab.allowResubmitUntil = Date.now() + 5000;
                      if (tab.lastAppAction === 'back') tab.historyBack();
                      else if (tab.lastAppAction === 'forward') tab.historyForward();
                      else tab.reload();
                    },
                  },
                ]);
                tab.nav.end('stopped');
                return false;
              }
              if (linkTarget(request.url) === 'web' && request.isTopFrame !== false) {
                // The pending navigation starts now (the progress line moves before the site answers). A user's tap:
                // iOS says so; Android doesn't, so a touch on this page a moment ago counts.
                const type = request.navigationType;
                const tapped = isUserTap(Platform.OS, type, touchedRecently(tab));
                tab.noteNavigationRequest(request.url, tapped, type === 'backforward' || type === 'reload' ? 'app' : 'page');
              }
              if (linkTarget(request.url) !== 'external') return true;
              // Only the page itself may hand off to another app, frames (often ads) can't, and only
              // when the user just touched it or the tab was just opened from another app (its first
              // load's redirects, DL-18): no prompts from redirects on load otherwise.
              const clicked = request.navigationType === 'click';
              if (request.isTopFrame !== false && mayOfferExternal(tab, request.url, clicked)) {
                openExternal(request.url, tab, newTabActions.onNotice);
              }
              return false;
            }}
            onError={(e) => {
              tab.handleError(e.nativeEvent);
              const insecure = tab.takeHttpsUpgrade();
              if (!insecure) return;
              dialog.alert(t('https.failedTitle'), t('https.failedBody', { url: insecure }), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('https.continue'),
                  style: 'destructive',
                  onPress: () => {
                    allowInsecure(insecure);
                    tab.loadUrl(insecure);
                  },
                },
              ]);
            }}
            renderError={(_domain, code, description) => {
              const error = toLoadError(code, description);
              const url = tab.url;
              const local = isLocalUrl(url);
              const fingerprint = error.fingerprint;
              return (
                <ErrorPage
                  error={error}
                  url={url}
                  local={local}
                  incognito={tab.incognito}
                  onRetry={() => tab.reload()}
                  onBack={() => (tab.canGoBack ? tab.historyBack() : tab.showNewTab())}
                  // Android only (the patch reports the certificate); never for a host whose certificate was
                  // valid earlier this session.
                  onContinue={
                    Platform.OS === 'android' && error.kind === 'cert' && fingerprint && mayBypassCertificate(url, fingerprint)
                      ? () => tab.continuePastCertificate(url, fingerprint)
                      : undefined
                  }
                  // A local server that doesn't speak https (most development servers): offer http, not secure.
                  onOpenHttp={
                    error.kind === 'ssl' && local && /^https:/i.test(url)
                      ? () => {
                          const insecure = url.replace(/^https:/i, 'http:');
                          allowInsecure(insecure);
                          tab.loadUrl(insecure);
                        }
                      : undefined
                  }
                />
              );
            }}
            userAgent={userAgent}
            contentMode={tab.desktop ? 'desktop' : 'recommended'}
            thirdPartyCookiesEnabled={!newTabActions.blockThirdPartyCookies}
            // Videos can go full screen (Android) and play in the page (iOS; also a page's camera preview).
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            // iOS: the system player's picture-in-picture, never for incognito tabs (read when the WebView is created).
            allowsPictureInPictureMediaPlayback={!tab.incognito}
            // Android (patched react-native-webview): the playback script's reports also reach the background playback
            // service natively, which keeps working while React Native is paused. "private": no title or site shown.
            mediaPlayback={Platform.OS === 'android' ? `${tab.playback.nonce}${tab.incognito ? ' private' : ''}` : undefined}
            // Android: a page that was allowed to capture may play its own preview without another tap (the
            // user's tap is long gone after the prompt). iOS sets this only when the WebView is created; WebKit
            // already lets a capturing page play its stream.
            mediaPlaybackRequiresUserAction={Platform.OS === 'android' ? !tab.media.playbackUnlocked : undefined}
            injectedJavaScript={pageSetupScript}
            injectedJavaScriptBeforeContentLoaded={earlyScript}
            // iOS: the geolocation script must reach frames too, so they can't use WebKit's own location prompt.
            injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
            // Android (patched react-native-webview): Qutai's page script at document start, before the page's own
            // scripts (WebViewCompat.addDocumentStartJavaScript); the early and after-load scripts stay as fallbacks
            // for WebViews without that feature. iOS already runs the early script at document start.
            // "Block video ads" goes there too (every frame: the WebView adds it to frames, and it runs only on its hosts).
            documentStartScript={Platform.OS === 'android' ? [agentScript, videoScript].filter(Boolean).join('\n') : undefined}
            // Android: native geolocation would grant every site once Qutai has the permission; the script handles it.
            geolocationEnabled={false}
            // Camera and microphone (patched react-native-webview): refused unless this names the requesting
            // origin and kind, which it does only while a request the user allowed is answered. See mediaCapture.ts.
            mediaCaptureGrant={mediaGrant}
            // Android (patched react-native-webview): "host:port sha256" certificates the user chose to continue past
            // on the error page this session; the WebView proceeds past a certificate error only for these.
            certificateExceptions={Platform.OS === 'android' ? certificateExceptionsFor(tab) : undefined}
            // iOS until the grant is first set (and if the patch were missing): WebKit refuses without a prompt.
            mediaCapturePermissionGrantType="deny"
            textZoom={newTabActions.textZoom}
            // The app shows its own long-press menu for links and images.
            allowsLinkPreview={false}
            // Both platforms (patched react-native-webview on Android): Qutai downloads the file itself.
            onFileDownload={(e) => {
              // iOS: the navigation that turned into this file reported a start and will never finish.
              tab.handleDownloadStart();
              newTabActions.onDownload(tab, pageDownloadFrom(e.nativeEvent));
            }}
            // The page's web process crashed or was killed (Android) / terminated (iOS): no load end will come.
            // Android (patched react-native-webview): the WebView asks before sending a form again; the same question
            // as iOS. Not answered within 30 s (the dialog left open), the form is not sent again.
            formResubmissionAnswer={Platform.OS === 'android' ? formResubmission : undefined}
            onFormResubmission={(e) => {
              const id = e.nativeEvent.id;
              const answer = (resend: boolean) => {
                if (!resend) tab.nav.end('stopped');
                setFormResubmission(formAnswer(id, resend));
              };
              dialog.alert(t('nav.resubmitTitle'), t('nav.resubmitBody'), [
                { text: t('common.cancel'), style: 'cancel', onPress: () => answer(false) },
                { text: t('nav.resubmitSend'), onPress: () => answer(true) },
              ]);
            }}
            onRenderProcessGone={() => tab.handleProcessGone(active)}
            onContentProcessDidTerminate={() => tab.handleProcessGone(active)}
            allowsBackForwardNavigationGestures
            javaScriptEnabled
            domStorageEnabled
            incognito={iosIncognito}
            // Android (patched react-native-webview): the incognito session's own cookies and site data. Read only
            // when the WebView is created, before it loads anything; a tab's profile never changes. iOS (patched): a
            // key naming this WebView's own data store, for the cookie list (device/cookieStore.ts).
            webviewProfile={Platform.OS === 'ios' ? iosStoreKey(tab) : tab.profile}
            // Network ad and tracker blocking (patched react-native-webview). Android: every request but the page's
            // own document is checked natively against the filter lists' domains; iOS: the compiled WebKit rule lists
            // are attached. Not on sites where the user turned it off. Incognito tabs block the same way.
            contentBlocking={blockAds}
            contentBlockingOffSites={offSitesProp}
            contentRuleLists={ruleListsProp}
            onContentBlocked={(e) => tab.handleContentBlocked(e.nativeEvent.blocked)}
            cacheEnabled={!androidIncognito}
            saveFormDataDisabled={androidIncognito}
          />
          )}
        </PullToRefresh>
      )}
      {tab.crashed && !tab.isNewTab && (
        <CrashPage
          url={tab.crashed.url}
          incognito={tab.incognito}
          onReload={() => tab.recoverFromCrash()}
          onClose={() => browser.closeTab(tab.id)}
        />
      )}
      {/* Until the site answers, the new tab page (its first address was just opened) or a woken tab's last picture
          stays on screen instead of a blank white page. */}
      {!tab.isNewTab && tab.cover === 'newTab' && (
        <View style={StyleSheet.absoluteFill}>
          <NewTabPage
            incognito={tab.incognito}
            darkMode={newTabActions.darkMode}
            active={active}
            onNavigate={(url) => tab.loadUrl(url)}
            onAskForApp={newTabActions.onAskForApp}
            onOpenLibrary={newTabActions.onOpenLibrary}
          />
        </View>
      )}
      {!tab.isNewTab && tab.cover === 'thumbnail' && tab.thumbnail && (
        <Image
          source={{ uri: tab.thumbnail }}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.surface }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      )}
      {tab.reader && !tab.isNewTab && (
        <ReaderView
          key={tab.reader.pageKey}
          tab={tab}
          prefs={{ ...newTabActions.reader, textZoom }}
          dark={newTabActions.darkMode || tab.incognito}
          onOpenSettings={newTabActions.onOpenReaderSettings}
          onSelection={newTabActions.onSelection}
          onNotice={newTabActions.onNotice}
        />
      )}
    </View>
  );
}

/**
 * Android only: a non-scrolling ScrollView around the page, whose RefreshControl catches the pull.
 * iOS uses the WebView's own pullToRefreshEnabled and gets the page as is.
 */
function PullToRefresh({
  enabled,
  refreshing,
  tint,
  background,
  onRefresh,
  children,
}: {
  enabled: boolean;
  refreshing: boolean;
  tint: string;
  background: string;
  onRefresh: () => void;
  children: ReactNode;
}) {
  if (Platform.OS !== 'android') return children;
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.flex}
      scrollEnabled={false}
      refreshControl={
        <RefreshControl
          enabled={enabled}
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[tint]}
          progressBackgroundColor={background}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  visible: { opacity: 1, zIndex: 1 },
  hidden: { opacity: 0, zIndex: 0 },
});
