import { BLOB_KEEP_SCRIPT } from '../browser/pageScript';
import { PageDownload, pageDownloadFrom } from '../browser/downloadRequests';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Browser } from '../browser/Browser';
import { WorkingGlow } from './WorkingGlow';
import type { SearchEngineId } from '../browser/search';
import { CONTEXT_MENU_SCRIPT, ContextTarget, parseContextTarget } from '../browser/contextMenu';
import { parseSelection, SELECTION_SCRIPT } from '../browser/selection';
import { adBlockScript, COOKIE_BANNER_SCRIPT, isAdUrl, isHostIn } from '../content';
import { AD_HOSTS } from '../content/adBlock';
import { PageRule, siteRulesScript } from '../content/siteRules';
import { siteKey } from '../agent/sitePolicy';
import { DARK_SITE_SCRIPT } from '../content/darkSites';
import { allowInsecure, upgradeToHttps } from '../browser/httpsOnly';
import { DESKTOP_USER_AGENT, DESKTOP_VIEWPORT_SCRIPT, textZoomScript } from '../browser/desktopMode';
import { linkTarget, toLoadError } from '../browser/navigation';
import { certificateExceptionsFor, mayBypassCertificate, noteValidCertificate } from '../browser/certificateExceptions';
import { isLocalUrl } from '../browser/localNetwork';
import { mayOfferExternal, noteUserGesture } from '../browser/externalGuard';
import { FORCE_ZOOM_SCRIPT } from '../browser/forceZoom';
import { geolocationScript } from '../browser/geolocation';
import { FILE_CAPTURE_SCRIPT, handleFileCaptureMessage } from '../browser/fileCapture';
import { mediaCaptureScript } from '../browser/mediaCapture';
import { playbackScript } from '../browser/playback';
import { openExternal } from '../browser/openExternal';
import { takeSignInLink } from './AccountLinks';
import { parsePullState, PULL_STATE_SCRIPT } from '../browser/pullToRefresh';
import { handleUserAgentMessage, USER_AGENT_SCRIPT, useChromeUserAgent } from '../browser/userAgent';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { usePalette } from '../ui/theme';
import { dialog } from './Dialog';
import { ErrorPage } from './ErrorPage';
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
  /** Dark theme is on (sites are darkened when darkSites is also on). */
  darkMode: boolean;
  darkSites: boolean;
  blockAds: boolean;
  /**
   * Sites where ad and tracker blocking is off ("Don't block on this site"), with their subdomains; read natively
   * on every request (Android) or navigation (iOS), so a change applies from the next load.
   */
  blockingOffSites: string[];
  /** iOS: the compiled WebKit content rule lists to attach (see blocking.ts); empty until lists are compiled. */
  contentRuleLists: string[];
  hideCookieBanners: boolean;
  /**
   * The user's own hiding rules (content/siteRules.ts), enabled ones only; each page applies those that match its
   * address. Not on "Don't block on this site" sites, and none while blockAds is off.
   */
  siteRules: PageRule[];
  /** Domains the user blocks with their own rules, also caught by the page script blocker. */
  userBlockedHosts: string[];
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
  searchEngine: SearchEngineId;
  onAsk: (text: string) => void;
  onOpenLibrary: (tab: LibraryTab) => void;
  /** Reader mode look (the text size is textZoom). */
  reader: Omit<ReaderPrefs, 'textZoom'>;
  onOpenReaderSettings: () => void;
};

export function BrowserView({
  browser,
  newTabActions,
  working,
}: {
  browser: Browser;
  newTabActions: TabActions;
  /** A task is running: the tab it works in glows while it is the one on screen. */
  working: boolean;
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
      {/* Over the tabs, not inside the tab's container: screenshots of the page never include it. */}
      <WorkingGlow visible={working && browser.agentTabId === browser.activeId} />
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
  // The user's own hiding rules; installed (empty) even while blocking is off, so turning rules off reaches open pages.
  const rulesScript = useMemo(
    () => siteRulesScript(blockAds ? siteRules : [], blockingOffSites),
    [blockAds, siteRules, blockingOffSites],
  );
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
  const earlyScript = [
    geoScript,
    mediaScript,
    playScript,
    mainFrameEarly.trim() ? `if (window.top === window) (function () {\n${mainFrameEarly}\n})();` : '',
  ].join('\n');
  // Runs after every page load: long-press menu, text selection, desktop viewport (Android) and text size (iOS).
  const pageSetupScript = [
    // Android may run the early script too soon for the new page; installing again is a no-op otherwise.
    Platform.OS === 'android' ? geoScript : '',
    Platform.OS === 'android' ? mediaScript : '',
    Platform.OS === 'android' ? playScript : '',
    Platform.OS === 'android' ? FILE_CAPTURE_SCRIPT : '',
    Platform.OS === 'android' ? BLOB_KEEP_SCRIPT : '',
    // Again after load (main frame): Android may have run the early script for the previous page.
    `if (window.top === window) (function () {\n${rulesScript}\n})();`,
    CONTEXT_MENU_SCRIPT,
    SELECTION_SCRIPT,
    tab.desktop && Platform.OS === 'android' ? DESKTOP_VIEWPORT_SCRIPT : '',
    Platform.OS === 'android' ? PULL_STATE_SCRIPT : '',
    Platform.OS === 'android' ? USER_AGENT_SCRIPT : '',
    Platform.OS === 'ios' && textZoom !== 100 ? textZoomScript(textZoom) : '',
    Platform.OS === 'ios' && newTabActions.darkMode && newTabActions.darkSites ? DARK_SITE_SCRIPT : '',
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
  // Android pull to refresh: allowed only while the page says a downward drag can't scroll it.
  const [atTop, setAtTop] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Changed rules (saved, switched, removed, an "off" site) reach the page already open at once.
  const firstRules = useRef(true);
  useEffect(() => {
    if (firstRules.current) {
      firstRules.current = false;
      return;
    }
    tab.webview?.injectJavaScript(`if (window.top === window) (function () {\n${rulesScript}\n})(); true;`);
  }, [tab, rulesScript]);

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
          searchEngine={newTabActions.searchEngine}
          active={active}
          onNavigate={(url) => tab.loadUrl(url)}
          onAsk={newTabActions.onAsk}
          onOpenLibrary={newTabActions.onOpenLibrary}
        />
      ) : (
        <PullToRefresh
          enabled={atTop && !tab.capturing}
          refreshing={refreshing}
          tint={palette.tint}
          background={palette.surface}
          onRefresh={() => {
            setRefreshing(true);
            tab.webview?.reload();
            // In case the page never reports finishing.
            setTimeout(() => setRefreshing(false), 10000);
          }}
        >
          <WebView
            ref={(ref) => tab.setWebView(ref)}
            source={tab.source}
            style={styles.flex}
            onMessage={(e) => {
              if (tab.handleMessage(e.nativeEvent.data)) return;
              if (tab.geolocation.handleMessage(e.nativeEvent.data)) return;
              if (tab.media.handleMessage(e.nativeEvent.data)) return;
              if (tab.playback.handleMessage(e.nativeEvent.data)) return;
              if (handleFileCaptureMessage(tab, e.nativeEvent.data)) return;
              if (handleUserAgentMessage(e.nativeEvent.data)) return;
              const pull = parsePullState(e.nativeEvent.data);
              if (pull !== null) return setAtTop(pull);
              const selection = parseSelection(e.nativeEvent.data);
              if (selection !== null) return newTabActions.onSelection(tab, selection);
              const target = parseContextTarget(e.nativeEvent.data);
              if (target && active) newTabActions.onContextMenu(tab, target);
            }}
            onLoadStart={(e) => {
              tab.handleLoadStart(e.nativeEvent.url);
              setAtTop(true);
            }}
            onLoadEnd={(e) => {
              tab.handleLoadEnd();
              // An https page that is still on screen without an error a moment later had a valid certificate
              // (Android reports a load end before the error of a failed load).
              const loaded = e.nativeEvent.url;
              if (/^https:/i.test(loaded)) {
                setTimeout(() => {
                  if (!tab.loadError && !tab.loading && tab.url === loaded) noteValidCertificate(loaded, tab.incognito);
                }, 1500);
              }
              setRefreshing(false);
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
              // stay together, and the assistant can manage and close them as one).
              browser.openTab(e.nativeEvent.targetUrl, { incognito: tab.incognito, openerId: tab.id, group: true });
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
              if (linkTarget(request.url) !== 'external') return true;
              // Only the page itself may hand off to another app, frames (often ads) can't, and only
              // when the user just touched it: no prompts from redirects on load.
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
                  onRetry={() => tab.webview?.reload()}
                  onBack={() => (tab.canGoBack ? tab.webview?.goBack() : tab.showNewTab())}
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
            forceDarkOn={newTabActions.darkMode && newTabActions.darkSites}
            injectedJavaScript={pageSetupScript}
            injectedJavaScriptBeforeContentLoaded={earlyScript}
            // iOS: the geolocation script must reach frames too, so they can't use WebKit's own location prompt.
            injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
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
            onFileDownload={(e) => newTabActions.onDownload(tab, pageDownloadFrom(e.nativeEvent))}
            allowsBackForwardNavigationGestures
            javaScriptEnabled
            domStorageEnabled
            incognito={iosIncognito}
            // Android (patched react-native-webview): the incognito session's own cookies and site data. Read only
            // when the WebView is created, before it loads anything; a tab's profile never changes.
            webviewProfile={tab.profile}
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
        </PullToRefresh>
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
