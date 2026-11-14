import { ReactNode, useEffect, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Browser } from '../browser/Browser';
import type { SearchEngineId } from '../browser/search';
import { CONTEXT_MENU_SCRIPT, ContextTarget, parseContextTarget } from '../browser/contextMenu';
import { parseSelection, SELECTION_SCRIPT } from '../browser/selection';
import { AD_BLOCK_SCRIPT, COOKIE_BANNER_SCRIPT, isAdUrl } from '../content';
import { DARK_SITE_SCRIPT } from '../content/darkSites';
import { allowInsecure, upgradeToHttps } from '../browser/httpsOnly';
import { DESKTOP_USER_AGENT, DESKTOP_VIEWPORT_SCRIPT, textZoomScript } from '../browser/desktopMode';
import { classifyLoadError, linkTarget } from '../browser/navigation';
import { mayOfferExternal, noteUserGesture } from '../browser/externalGuard';
import { openExternal } from '../browser/openExternal';
import { parsePullState, PULL_STATE_SCRIPT } from '../browser/pullToRefresh';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { usePalette } from '../ui/theme';
import { ErrorPage } from './ErrorPage';
import type { LibraryTab } from './LibraryScreen';
import { NewTabPage } from './NewTabPage';

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
  hideCookieBanners: boolean;
  /** A link or image was long-pressed in this tab. */
  onContextMenu: (tab: Tab, target: ContextTarget) => void;
  /** The text selection in this tab changed ("" when cleared). */
  onSelection: (tab: Tab, text: string) => void;
  /** iOS: the page offered a file the WebView can't show. */
  onDownload: (tab: Tab, url: string) => void;
  /** Page text size in percent. */
  textZoom: number;
  /** Short notice for the user, e.g. when no app can open a link. */
  onNotice: (message: string) => void;
  searchEngine: SearchEngineId;
  onAsk: (text: string) => void;
  onOpenLibrary: (tab: LibraryTab) => void;
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
  // every normal tab and still shares cookies, so it is deliberately not used there.
  const iosIncognito = tab.incognito && Platform.OS === 'ios';
  const androidIncognito = tab.incognito && Platform.OS === 'android';
  const { textZoom } = newTabActions;
  // Runs before the page's own scripts: request blocking and banner hiding (no flash of the banner).
  const earlyScript =
    [newTabActions.blockAds ? AD_BLOCK_SCRIPT : '', newTabActions.hideCookieBanners ? COOKIE_BANNER_SCRIPT : ''].join(
      '\n',
    ) || undefined;
  // Runs after every page load: long-press menu, text selection, desktop viewport (Android) and text size (iOS).
  const pageSetupScript = [
    CONTEXT_MENU_SCRIPT,
    SELECTION_SCRIPT,
    tab.desktop && Platform.OS === 'android' ? DESKTOP_VIEWPORT_SCRIPT : '',
    Platform.OS === 'android' ? PULL_STATE_SCRIPT : '',
    Platform.OS === 'ios' && textZoom !== 100 ? textZoomScript(textZoom) : '',
    Platform.OS === 'ios' && newTabActions.darkMode && newTabActions.darkSites ? DARK_SITE_SCRIPT : '',
  ].join('\n');

  const palette = usePalette();
  // Android pull to refresh: allowed only while the page says a downward drag can't scroll it.
  const [atTop, setAtTop] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // iOS: apply a new text size to the page already on screen too.
  useEffect(() => {
    if (Platform.OS === 'ios') tab.webview?.injectJavaScript(textZoomScript(textZoom));
  }, [tab, textZoom]);

  return (
    <View
      ref={(ref) => tab.setContainer(ref)}
      collapsable={false}
      style={[StyleSheet.absoluteFill, active ? styles.visible : styles.hidden]}
      pointerEvents={active ? 'auto' : 'none'}
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
          enabled={atTop}
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
            }}
            pullToRefreshEnabled
            onNavigationStateChange={(nav) => {
              tab.handleNavigationStateChange(nav);
              if (!nav.loading) browser.notifyVisit(tab);
            }}
            // Links opened from an incognito tab stay incognito.
            onOpenWindow={(e) => {
              if (newTabActions.blockAds && isAdUrl(e.nativeEvent.targetUrl)) return;
              browser.openTab(e.nativeEvent.targetUrl, { incognito: tab.incognito, openerId: tab.id });
            }}
            // Every URL reaches onShouldStartLoadWithRequest; the default allowlist would hand other
            // schemes to canOpenURL, which silently drops links to apps the OS doesn't let us see.
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(request) => {
              // Ad and tracker pages, frames and redirects never load.
              if (newTabActions.blockAds && isAdUrl(request.url)) return false;
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
              Alert.alert(t('https.failedTitle'), t('https.failedBody', { url: insecure }), [
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
            userAgent={tab.desktop ? DESKTOP_USER_AGENT : undefined}
            contentMode={tab.desktop ? 'desktop' : 'recommended'}
            thirdPartyCookiesEnabled={!newTabActions.blockThirdPartyCookies}
            // Videos can go full screen (Android) and play in the page (iOS).
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            forceDarkOn={newTabActions.darkMode && newTabActions.darkSites}
            injectedJavaScript={pageSetupScript}
            injectedJavaScriptBeforeContentLoaded={earlyScript}
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
            cacheEnabled={!androidIncognito}
            saveFormDataDisabled={androidIncognito}
          />
        </PullToRefresh>
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
