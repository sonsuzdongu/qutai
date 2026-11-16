import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { linkTarget } from '../browser/navigation';
import { openExternal } from '../browser/openExternal';
import {
  READER_COLORS,
  READER_SETUP_SCRIPT,
  ReaderFont,
  ReaderLook,
  ReaderTheme,
  readerDocument,
  readerHighlightScript,
  readerLookScript,
  readerMetaLine,
  resolveReaderScheme,
} from '../browser/reader';
import { parseSelection } from '../browser/selection';
import type { Tab } from '../browser/Tab';
import {
  pauseReader,
  readerReading,
  resumeReader,
  speakReader,
  stopSpeaking,
  useIsSpeaking,
  useReaderReading,
} from '../device/speech';
import { t } from '../i18n';
import { actionErrorText } from '../agent/stepLine';
import { formatDate } from '../i18n/format';
import { Icon, IconName } from '../ui/Icon';
import { useReduceMotion } from '../utils/useReduceMotion';

export type ReaderPrefs = { theme: ReaderTheme; font: ReaderFont; easyReading: boolean; textZoom: number };

type Props = {
  tab: Tab;
  prefs: ReaderPrefs;
  /** The app's dark appearance (incognito tabs count as dark), for the "auto" theme. */
  dark: boolean;
  onOpenSettings: () => void;
  /** Text selected in the article ("" when cleared), for the Ask / Explain / Translate bar. */
  onSelection: (tab: Tab, text: string) => void;
  onNotice: (message: string) => void;
};

/**
 * Reader mode: the extracted article in its own WebView, laid over the tab's page, which stays
 * loaded and untouched underneath (scroll position, forms and media are as they were on leaving).
 * The article document runs no script of its own and loads only its images; it has no address of
 * its own (about:blank), so it shares no cookies or storage with the site. Links leave reader
 * mode and open in the tab.
 */
export function ReaderView({ tab, prefs, dark, onOpenSettings, onSelection, onNotice }: Props) {
  const article = tab.reader!.article;
  const reduceMotion = useReduceMotion();
  const { fontScale } = useWindowDimensions();
  const look: ReaderLook = {
    scheme: resolveReaderScheme(prefs.theme, dark),
    font: prefs.font,
    easyReading: prefs.easyReading,
    textZoom: prefs.textZoom,
    fontScale,
    reduceMotion,
  };
  const colors = READER_COLORS[look.scheme];
  const lookScript = readerLookScript(look);

  // The document is built once (the view is keyed by the page); later look changes are applied in
  // place, without a reload that would lose the reading position.
  const [html] = useState(() => readerDocument(article, look, readerMetaLine(article, formatDate)));

  const speaking = useIsSpeaking();
  const reading = useReaderReading();
  const ours = reading?.tabId === tab.id ? reading : null;
  const playing = speaking && ours !== null && !ours.paused;
  const highlight = ours ? ours.index : -1;

  useEffect(() => {
    tab.readerWebview?.injectJavaScript(lookScript);
  }, [tab, lookScript]);

  useEffect(() => {
    tab.readerWebview?.injectJavaScript(readerHighlightScript(highlight, reduceMotion));
  }, [tab, highlight, reduceMotion]);

  // Leaving reader mode stops reading its article and drops its text selection.
  useEffect(
    () => () => {
      if (readerReading()?.tabId === tab.id) stopSpeaking();
      onSelection(tab, '');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab],
  );

  const run = (action: () => Promise<unknown>) => {
    action().catch((e) => onNotice(actionErrorText(e)));
  };
  const togglePlay = () => {
    if (playing) return run(pauseReader);
    run(() => (ours ? resumeReader(tab) : speakReader(tab, 0)));
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      <View style={[styles.bar, { backgroundColor: colors.bar, borderBottomColor: colors.border }]}>
        <BarButton icon="close" label={t('reader.exit')} color={colors.text} onPress={() => tab.closeReader()} />
        <Text style={[styles.site, { color: colors.muted }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {t('reader.title')}
        </Text>
        {ours && (
          <BarButton icon="stop" label={t('reader.stopReading')} color={colors.text} onPress={() => run(stopSpeaking)} />
        )}
        <BarButton
          icon={playing ? 'pause' : 'play'}
          label={t(playing ? 'reader.pause' : ours ? 'reader.resume' : 'reader.listen')}
          color={colors.link}
          onPress={togglePlay}
        />
        <BarButton icon="textSize" label={t('reader.settings')} color={colors.text} onPress={onOpenSettings} />
      </View>
      <WebView
        ref={(ref) => tab.setReaderWebView(ref)}
        // No base address: the article gets an opaque origin, apart from the site's cookies and storage.
        source={{ html, baseUrl: '' }}
        style={[styles.flex, { backgroundColor: colors.bg }]}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => {
          // The document itself and jumps within it (footnotes, the article's own anchors).
          if (/^about:/i.test(request.url)) return true;
          const target = linkTarget(request.url);
          if (target === 'web') {
            tab.closeReader();
            tab.loadUrl(request.url);
          } else if (target === 'external') {
            openExternal(request.url, tab, onNotice);
          }
          return false;
        }}
        onMessage={(e) => {
          if (tab.handleMessage(e.nativeEvent.data)) return;
          const selection = parseSelection(e.nativeEvent.data);
          if (selection !== null) onSelection(tab, selection);
        }}
        onLoadEnd={() => {
          tab.readerWebview?.injectJavaScript(lookScript);
          tab.readerWebview?.injectJavaScript(readerHighlightScript(highlight, true));
        }}
        injectedJavaScript={READER_SETUP_SCRIPT}
        javaScriptEnabled
        // Nothing is stored for the article; incognito tabs keep nothing at all (as their pages do).
        domStorageEnabled={false}
        incognito={tab.incognito && Platform.OS === 'ios'}
        // Android: the incognito session's profile, so the article's images load with its cookies, not the normal ones.
        webviewProfile={tab.profile}
        cacheEnabled={!tab.incognito}
        saveFormDataDisabled
        // Sizes come from the reader's own text size; Android must not scale them again.
        textZoom={100}
        forceDarkOn={false}
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        allowFileAccess={false}
        // A list: Android's native side aborts the app on a plain string.
        dataDetectorTypes={['none']}
        mediaCapturePermissionGrantType="deny"
        geolocationEnabled={false}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={article.title}
      />
    </View>
  );
}

function BarButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  site: { flex: 1, fontSize: 14, fontWeight: '600', marginHorizontal: 4 },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { opacity: 0.5 },
  flex: { flex: 1 },
});
