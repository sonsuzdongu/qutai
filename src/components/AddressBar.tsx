import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SearchEngineId } from '../browser/search';
import { toUrl } from '../browser/url';
import { t } from '../i18n';
import { OmniboxSuggestions } from './OmniboxSuggestions';

type Props = {
  url: string;
  loading: boolean;
  canGoBack: boolean;
  tabCount: number;
  incognito: boolean;
  /** Dark theme (incognito is always dark). */
  darkMode?: boolean;
  /** Where the bar sits; at the bottom, suggestions open upwards. */
  position?: 'top' | 'bottom';
  /** Horizontal swipe on the bar: -1 for the previous tab, 1 for the next one. */
  onSwipe?: (direction: -1 | 1) => void;
  assistantOpen: boolean;
  assistantRunning: boolean;
  searchEngine: SearchEngineId;
  searchSuggestions: boolean;
  onSubmit: (url: string) => void;
  onAsk: (text: string) => void;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenTabs: () => void;
  onToggleAssistant: () => void;
};

/** URL as shown when not editing: no scheme, no "www.", no trailing slash. */
function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

export function AddressBar({
  url,
  loading,
  canGoBack,
  tabCount,
  incognito,
  darkMode,
  position = 'top',
  onSwipe,
  assistantOpen,
  assistantRunning,
  searchEngine,
  searchSuggestions,
  onSubmit,
  onAsk,
  onBack,
  onOpenMenu,
  onOpenTabs,
  onToggleAssistant,
}: Props) {
  const [text, setText] = useState(url);
  const [editing, setEditing] = useState(false);
  const darkUI = incognito || !!darkMode;
  const dark = darkUI ? darkStyles : null;

  const bottom = position === 'bottom';
  // Swiping sideways on the bar switches tabs; taps and vertical moves are left alone.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dy) < 12,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > 60) onSwipe?.(g.dx < 0 ? 1 : -1);
        },
      }),
    [onSwipe],
  );

  const finishEditing = () => {
    Keyboard.dismiss();
    setEditing(false);
  };

  return (
    <View style={[styles.bar, bottom && styles.barBottom, dark?.bar]} {...(editing ? {} : swipe.panHandlers)}>
      <IconButton label="‹" onPress={onBack} disabled={!canGoBack} incognito={darkUI} />

      {/* A TextInput scrolls long URLs to the cursor, so a plain Text is shown until the user taps to edit. */}
      {editing ? (
        <View style={[styles.field, styles.fieldRow, dark?.field]}>
          <TextInput
            style={[styles.fieldText, styles.fieldTextFlex, styles.input, dark?.text]}
            placeholderTextColor={darkUI ? '#8f8e99' : '#999'}
            value={text}
            onChangeText={setText}
            onBlur={() => setEditing(false)}
            onSubmitEditing={() => {
              if (!text.trim()) return;
              finishEditing();
              onSubmit(toUrl(text, searchEngine));
            }}
            autoFocus
            selectTextOnFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            placeholder={t('address.placeholder')}
          />
          {text.length > 0 && (
            <Pressable
              onPress={() => setText('')}
              hitSlop={8}
              style={[styles.clear, dark?.clear]}
              accessibilityLabel={t('address.clear')}
            >
              <Text style={[styles.clearText, dark?.text]}>✕</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          style={[styles.field, styles.fieldRow, dark?.field]}
          onPress={() => {
            setText(url);
            setEditing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('address.a11y', { url })}
        >
          {incognito && <Text style={styles.incognitoBadge}>🕶</Text>}
          {/^https:\/\//i.test(url) && (
            <Text style={[styles.security, dark?.dim]} accessibilityLabel={t('address.secure')}>
              🔒
            </Text>
          )}
          {/^http:\/\//i.test(url) && (
            <Text style={[styles.security, styles.insecure]} accessibilityLabel={t('address.notSecure')}>
              ⚠︎
            </Text>
          )}
          <Text
            style={[styles.fieldText, styles.fieldTextFlex, dark?.text, !url && styles.placeholder]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {url ? displayUrl(url) : t('address.placeholder')}
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={onOpenTabs}
        hitSlop={6}
        style={styles.icon}
        accessibilityLabel={t('address.tabs', { count: tabCount })}
      >
        <View style={[styles.tabCount, dark?.tabCount]}>
          <Text style={[styles.tabCountText, dark?.text]}>{tabCount}</Text>
        </View>
      </Pressable>
      <IconButton label="⋮" onPress={onOpenMenu} incognito={darkUI} accessibilityLabel={t('address.menu')} />
      <Pressable
        onPress={onToggleAssistant}
        hitSlop={6}
        style={[styles.assistantButton, assistantOpen && styles.assistantButtonActive]}
        accessibilityLabel={t(assistantOpen ? 'address.closeAssistant' : 'address.openAssistant')}
      >
        {assistantRunning && !assistantOpen ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.assistantIcon}>✦</Text>
        )}
      </Pressable>
      {loading && <LoadingBar top={bottom} />}
      {editing && (
        <Pressable
          style={[styles.backdrop, bottom && styles.backdropAbove]}
          onPress={finishEditing}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        />
      )}
      {editing && (
        <OmniboxSuggestions
          text={text}
          incognito={incognito}
          dark={darkUI}
          above={bottom}
          searchEngine={searchEngine}
          suggestionsEnabled={searchSuggestions}
          onNavigate={(next) => {
            finishEditing();
            onSubmit(next);
          }}
          onAsk={(query) => {
            finishEditing();
            onAsk(query);
          }}
        />
      )}
    </View>
  );
}

/** Thin indeterminate progress line along the bottom edge while a page loads. */
function LoadingBar({ top }: { top: boolean }) {
  const { width } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.4, width] });
  return (
    <View style={[styles.loadingTrack, top && styles.loadingTrackTop]} pointerEvents="none">
      <Animated.View style={[styles.loadingBar, { width: width * 0.4, transform: [{ translateX }] }]} />
    </View>
  );
}

function IconButton({
  label,
  onPress,
  disabled,
  incognito,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  incognito?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={styles.icon}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.iconText, incognito && darkStyles.text, disabled && styles.disabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Above the page, so the suggestion dropdown can overlap it.
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: '#f5f4ef',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d6d3c9',
  },
  field: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 15,
    color: '#222',
    textAlign: 'left',
    textAlignVertical: 'center',
    // Android adds extra font padding that pushes single-line text off-center.
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  fieldTextFlex: { flex: 1 },
  input: { paddingVertical: 0, height: '100%' },
  backdrop: { position: 'absolute', top: '100%', left: 0, right: 0, height: 4000, backgroundColor: 'rgba(0,0,0,0.25)' },
  backdropAbove: { top: 'auto', bottom: '100%' },
  barBottom: {
    borderBottomWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d6d3c9',
  },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d6d3c9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 11, color: '#555', fontWeight: '700' },
  security: { fontSize: 12, color: '#888' },
  insecure: { color: '#b3261e', fontSize: 14 },
  incognitoBadge: { fontSize: 14 },
  placeholder: { color: '#999' },
  icon: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#333' },
  disabled: { color: '#bbb' },
  loadingTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, overflow: 'hidden' },
  loadingTrackTop: { bottom: 'auto', top: 0 },
  loadingBar: { height: 2, backgroundColor: '#c96442', borderRadius: 1 },
  tabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabCountText: { fontSize: 12, fontWeight: '700', color: '#333' },
  assistantButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c96442',
  },
  assistantButtonActive: { backgroundColor: '#8f4026' },
  assistantIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
});

const darkStyles = StyleSheet.create({
  bar: { backgroundColor: '#24232b', borderBottomColor: '#3a3944', borderTopColor: '#3a3944' },
  field: { backgroundColor: '#3a3944' },
  text: { color: '#f2f1f5' },
  tabCount: { borderColor: '#f2f1f5' },
  clear: { backgroundColor: '#52515c' },
  dim: { color: '#a9a8b3' },
});
