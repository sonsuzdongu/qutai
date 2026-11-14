import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Browser } from '../browser/Browser';
import type { SearchEngineId } from '../browser/search';
import { CONTEXT_MENU_SCRIPT, ContextTarget, parseContextTarget } from '../browser/contextMenu';
import { parseSelection, SELECTION_SCRIPT } from '../browser/selection';
import { adBlockScript, COOKIE_BANNER_SCRIPT, isAdUrl, isHostIn } from '../content';
import { siteKey } from '../agent/sitePolicy';
import { DARK_SITE_SCRIPT } from '../content/darkSites';
import { allowInsecure, upgradeToHttps } from '../browser/httpsOnly';
import { DESKTOP_USER_AGENT, DESKTOP_VIEWPORT_SCRIPT, textZoomScript } from '../browser/desktopMode';
import { classifyLoadError, linkTarget } from '../browser/navigation';
import { mayOfferExternal, noteUserGesture } from '../browser/externalGuard';
import { FORCE_ZOOM_SCRIPT } from '../browser/forceZoom';
import { geolocationScript } from '../browser/geolocation';
import { FILE_CAPTURE_SCRIPT, handleFileCaptureMessage } from '../browser/fileCapture';
import { mediaCaptureScript } from '../browser/mediaCapture';
import { openExternal } from '../browser/openExternal';
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
  /** A link or image was long-pressed in this tab. */
  onContextMenu: (tab: Tab, target: ContextTarget) => void;
  /** The text selection in this tab changed ("" when cleared). */
  onSelection: (tab: Tab, text: string) => void;
  /** iOS: the page offered a file the WebView can't show. */
  onDownload: (tab: Tab, url: string) => void;
  /** Page text size in percent. */
  textZoom: number;
  /** Pinch-zoom pages that turn zooming off. */
  forceZoom: boolean;
  /** Short notice for the user, e.g. when no app can open a link. */
  onNotice: (message: string) => void;
  searchEngine: SearchEngineId;
  onAsk: (text: string) => void;
  onOpenLibrary: (tab: LibraryTab) => void;
  /** Reader mode look (the text size is textZoom). */
  reader: Omit<ReaderPrefs, 'textZoom'>;
  onOpenReaderSettings: () => void;
};

export function BrowserView({ browser, newTabActions }: { browser: Browser; newTabActions: TabActions }) {
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
  const adScript = useMemo(
    () => (blockAds ? adBlockScript(undefined, blockingOffSites) : ''),
    [blockAds, blockingOffSites],
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
  const mainFrameEarly = [adScript, newTabActions.hideCookieBanners ? COOKIE_BANNER_SCRIPT : ''].join('\n');
  // getUserMedia asks the app (per-site permission) before the WebView's own capture may run; the native
  // mediaCaptureGrant prop below is what enforces it. Every frame on iOS (frames are refused), main frame on Android.
  const mediaScript = mediaCaptureScript(tab.media.nonce);
  const earlyScript = [
    geoScript,
    mediaScript,
    mainFrameEarly.trim() ? `if (window.top === window) (function () {\n${mainFrameEarly}\n})();` : '',
  ].join('\n');
  // Runs after every page load: long-press menu, text selection, desktop viewport (Android) and text size (iOS).
  const pageSetupScript = [
    // Android may run the early script too soon for the new page; installing again is a no-op otherwise.
    Platform.OS === 'android' ? geoScript : '',
    Platform.OS === 'android' ? mediaScript : '',
    Platform.OS === 'android' ? FILE_CAPTURE_SCRIPT : '',
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
  // Android pull to refresh: allowed only while the page says a downward drag can't scroll it.
  const [atTop, setAtTop] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
              if (handleFileCaptureMessage(tab, e.nativeEvent.data)) return;
              if (handleUserAgentMessage(e.nativeEvent.data)) return;
              const pull = parsePullState(e.nativeEvent.data);
              if (pull !== null) return setAtTop(pull);
              const selection = parseSelection(e.nativeEvent.data);
              if (selection !== null) return newTabActions.onSelection(tab, selection);
              const target = parseContextTarget(e.nativeEvent.data);
              if (target && active) newTabActions.onContextMenu(tab, target);
            }}
            onLoadStart={() => {
              tab.handleLoadStart();
              setAtTop(true);
            }}
            onLoadEnd={() => {
              tab.handleLoadEnd();
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
            renderError={(_domain, code, description) => (
              <ErrorPage
                kind={classifyLoadError(code, description)}
                url={tab.url}
                incognito={tab.incognito}
                onRetry={() => tab.webview?.reload()}
              />
            )}
            userAgent={tab.desktop ? DESKTOP_USER_AGENT : Platform.OS === 'android' ? chromeUserAgent : undefined}
            contentMode={tab.desktop ? 'desktop' : 'recommended'}
            thirdPartyCookiesEnabled={!newTabActions.blockThirdPartyCookies}
            // Videos can go full screen (Android) and play in the page (iOS; also a page's camera preview).
            allowsFullscreenVideo
            allowsInlineMediaPlayback
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
            // iOS until the grant is first set (and if the patch were missing): WebKit refuses without a prompt.
            mediaCapturePermissionGrantType="deny"
            textZoom={newTabActions.textZoom}
            // The app shows its own long-press menu for links and images.
            allowsLinkPreview={false}
            onFileDownload={(e) => newTabActions.onDownload(tab, e.nativeEvent.downloadUrl)}
            // Android hands downloads to the system download manager (with the site's cookies).
            downloadingMessage={t('downloads.androidStarted')}
            lackPermissionToDownloadMessage={t('downloads.androidNoPermission')}
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
