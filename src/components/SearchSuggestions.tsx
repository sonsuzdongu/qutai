import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { QUTAI_UA_TOKEN } from '../net/qutaiUserAgent';

type Props = { html: string; onOpenLink: (url: string) => void };

// Reports the widget's height so the view fits it exactly.
const SIZE_SCRIPT = `(function () {
  function send() { window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight)); }
  send(); new ResizeObserver(send).observe(document.documentElement);
})(); true;`;

/**
 * Google's "search suggestions" widget, which Google requires to be shown with answers grounded in
 * Google Search. It is Google's own HTML; tapping a suggestion opens the search in a Qutai tab.
 */
export function SearchSuggestions({ html, onOpenLink }: Props) {
  const [height, setHeight] = useState(48);
  return (
    <WebView
      // The same " qutai.<build>" ending as the browser's pages (src/net/qutaiUserAgent.ts).
      applicationNameForUserAgent={QUTAI_UA_TOKEN ?? undefined}
      source={{
        html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">${html}</body></html>`,
      }}
      style={[styles.widget, { height }]}
      originWhitelist={['*']}
      scrollEnabled={false}
      injectedJavaScript={SIZE_SCRIPT}
      onMessage={(e) => {
        const h = Number(e.nativeEvent.data);
        if (h > 0 && h < 400) setHeight(h);
      }}
      onShouldStartLoadWithRequest={(req) => {
        if (/^https?:\/\//i.test(req.url)) {
          onOpenLink(req.url);
          return false;
        }
        return true;
      }}
      cacheEnabled={false}
      mediaCapturePermissionGrantType="deny"
    />
  );
}

const styles = StyleSheet.create({
  widget: { backgroundColor: 'transparent', marginTop: 4 },
});
