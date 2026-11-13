import { useEffect } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
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
import { openExternal } from '../browser/openExternal';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
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
    Platform.OS === 'ios' && textZoom !== 100 ? textZoomScript(textZoom) : '',
    Platform.OS === 'ios' && newTabActions.darkMode && newTabActions.darkSites ? DARK_SITE_SCRIPT : '',
  ].join('\n');

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
        <WebView
          ref={(ref) => tab.setWebView(ref)}
          source={tab.source}
          style={styles.flex}
          onMessage={(e) => {
            if (tab.handleMessage(e.nativeEvent.data)) return;
            const selection = parseSelection(e.nativeEvent.data);
            if (selection !== null) return newTabActions.onSelection(tab, selection);
            const target = parseContextTarget(e.nativeEvent.data);
            if (target && active) newTabActions.onContextMenu(tab, target);
          }}
          onLoadStart={() => tab.handleLoadStart()}
          onLoadEnd={() => tab.handleLoadEnd()}
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
            // Only the page itself may hand off to another app; frames (often ads) can't.
            if (request.isTopFrame !== false) openExternal(request.url, tab, newTabActions.onNotice);
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  visible: { opacity: 1, zIndex: 1 },
  hidden: { opacity: 0, zIndex: 0 },
});
