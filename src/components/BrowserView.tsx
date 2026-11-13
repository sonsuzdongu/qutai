import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Browser } from '../browser/Browser';
import type { SearchEngineId } from '../browser/search';
import { DESKTOP_USER_AGENT, DESKTOP_VIEWPORT_SCRIPT } from '../browser/desktopMode';
import { classifyLoadError, linkTarget } from '../browser/navigation';
import { openExternal } from '../browser/openExternal';
import type { Tab } from '../browser/Tab';
import { ErrorPage } from './ErrorPage';
import type { LibraryTab } from './LibraryScreen';
import { NewTabPage } from './NewTabPage';

/**
 * Renders every tab's WebView stacked on top of each other. Hidden tabs stay
 * mounted and laid out (only made invisible) so they keep their state and the
 * agent can still read and click in a tab the user isn't looking at.
 */
export type TabActions = {
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
          onMessage={(e) => tab.handleMessage(e.nativeEvent.data)}
          onLoadStart={() => tab.handleLoadStart()}
          onLoadEnd={() => tab.handleLoadEnd()}
          onNavigationStateChange={(nav) => {
            tab.handleNavigationStateChange(nav);
            if (!nav.loading) browser.notifyVisit(tab);
          }}
          // Links opened from an incognito tab stay incognito.
          onOpenWindow={(e) => browser.openTab(e.nativeEvent.targetUrl, { incognito: tab.incognito, openerId: tab.id })}
          // Every URL reaches onShouldStartLoadWithRequest; the default allowlist would hand other
          // schemes to canOpenURL, which silently drops links to apps the OS doesn't let us see.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(request) => {
            if (linkTarget(request.url) !== 'external') return true;
            // Only the page itself may hand off to another app; frames (often ads) can't.
            if (request.isTopFrame !== false) openExternal(request.url, tab, newTabActions.onNotice);
            return false;
          }}
          onError={(e) => tab.handleError(e.nativeEvent)}
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
          injectedJavaScript={tab.desktop && Platform.OS === 'android' ? DESKTOP_VIEWPORT_SCRIPT : undefined}
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
