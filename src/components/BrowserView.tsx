import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';

/**
 * Renders every tab's WebView stacked on top of each other. Hidden tabs stay
 * mounted and laid out (only made invisible) so they keep their state and the
 * agent can still read and click in a tab the user isn't looking at.
 */
export function BrowserView({ browser }: { browser: Browser }) {
  return (
    <View style={styles.container}>
      {browser.tabs.map((tab) => (
        <TabWebView key={tab.id} tab={tab} browser={browser} active={tab.id === browser.activeId} />
      ))}
    </View>
  );
}

function TabWebView({ tab, browser, active }: { tab: Tab; browser: Browser; active: boolean }) {
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
      <WebView
        ref={(ref) => tab.setWebView(ref)}
        source={tab.source}
        style={styles.flex}
        onMessage={(e) => tab.handleMessage(e.nativeEvent.data)}
        onLoadStart={() => tab.handleLoadStart()}
        onLoadEnd={() => tab.handleLoadEnd()}
        onNavigationStateChange={(nav) => tab.handleNavigationStateChange(nav)}
        // Links opened from an incognito tab stay incognito.
        onOpenWindow={(e) => browser.openTab(e.nativeEvent.targetUrl, { incognito: tab.incognito, openerId: tab.id })}
        allowsBackForwardNavigationGestures
        javaScriptEnabled
        domStorageEnabled
        incognito={iosIncognito}
        cacheEnabled={!androidIncognito}
        saveFormDataDisabled={androidIncognito}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  visible: { opacity: 1, zIndex: 1 },
  hidden: { opacity: 0, zIndex: 0 },
});
