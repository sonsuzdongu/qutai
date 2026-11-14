import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import {
  attachReaderWebView,
  handleReaderMessage,
  readerFailed,
  readerMounted,
  subscribeReader,
} from '../pdf/reader';
import { READER_BASE_URL, readerHtml } from '../pdf/readerHtml';

/**
 * The hidden WebView that reads PDFs (src/pdf/reader.ts). Rendered only while a PDF is being read, off screen and
 * invisible; it loads nothing but its own bundled page (no navigation, no storage, no network).
 */
export function PdfReaderHost() {
  const [mounted, setMounted] = useState(readerMounted);

  useEffect(() => subscribeReader(setMounted), []);

  if (!mounted) return null;
  const html = readerHtml();
  if (!html) return null;
  return (
    <View style={styles.host} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <WebView
        ref={attachReaderWebView}
        source={{ html, baseUrl: READER_BASE_URL }}
        originWhitelist={[READER_BASE_URL, 'about:*', 'blob:*']}
        onShouldStartLoadWithRequest={(req) => req.url.startsWith(READER_BASE_URL) || req.url.startsWith('about:')}
        onMessage={(e) => handleReaderMessage(e.nativeEvent.data)}
        onError={(e) => readerFailed(`The PDF reader failed: ${e.nativeEvent.description}`)}
        onContentProcessDidTerminate={() => readerFailed('The PDF reader stopped (the phone may be low on memory).')}
        onRenderProcessGone={() => readerFailed('The PDF reader stopped (the phone may be low on memory).')}
        javaScriptEnabled
        // iOS: a data store that keeps nothing. Never on Android, where the prop removes every cookie of every tab;
        // the page stores nothing anyway (no network, no storage API used).
        incognito={Platform.OS === 'ios'}
        cacheEnabled={false}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        allowsLinkPreview={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: -1000, top: 0, width: 300, height: 300, opacity: 0 },
  webview: { width: 300, height: 300, backgroundColor: 'transparent' },
});
