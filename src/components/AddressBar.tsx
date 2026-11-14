import { useEffect, useMemo, useState } from 'react';
import {
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
import { darkPalette, makeStyles, usePalette } from '../ui/theme';
import { Icon, IconName } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { useReduceMotion } from '../utils/useReduceMotion';
import { OmniboxSuggestions } from './OmniboxSuggestions';

type Props = {
  url: string;
  loading: boolean;
  /** The page has used the location (shown as a small pin; tapping it opens the site's permissions). */
  usingLocation?: boolean;
  onLocationPress?: () => void;
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
  /** Off: no Qutai button (the page menu has "Ask Qutai" instead). */
  showAssistant?: boolean;
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
  usingLocation,
  onLocationPress,
  canGoBack,
  tabCount,
  incognito,
  darkMode,
  position = 'top',
  onSwipe,
  assistantOpen,
  assistantRunning,
  showAssistant = true,
  searchEngine,
  searchSuggestions,
  onSubmit,
  onAsk,
  onBack,
  onOpenMenu,
  onOpenTabs,
  onToggleAssistant,
}: Props) {
  const styles = useStyles();
  const [text, setText] = useState(url);
  // What the clear button removed, so one tap can bring it back (an accidental clear is common).
  const [cleared, setCleared] = useState<string | null>(null);
  const changeText = (next: string) => {
    setText(next);
    setCleared(null);
  };
  const [editing, setEditing] = useState(false);
  const darkUI = incognito || !!darkMode;
  const palette = usePalette();
  const dark = darkUI ? darkStyles : null;

  const bottom = position === 'bottom';
  // Suggestions and the dimmed backdrop start exactly at the bar's edge (percent offsets drift on Android).
  const [barHeight, setBarHeight] = useState(48);
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
    <View
      style={[styles.bar, bottom && styles.barBottom, dark?.bar]}
      onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
      {...(editing ? {} : swipe.panHandlers)}
    >
      <IconButton
        icon="back"
        onPress={onBack}
        disabled={!canGoBack}
        incognito={darkUI}
        accessibilityLabel={t('address.back')}
      />

      {/* A TextInput scrolls long URLs to the cursor, so a plain Text is shown until the user taps to edit. */}
      {editing ? (
        <View style={[styles.field, styles.fieldRow, dark?.field]}>
          <TextInput
            style={[styles.fieldText, styles.fieldTextFlex, styles.input, dark?.text]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            placeholderTextColor={darkUI ? '#a9a8b3' : '#6b6862'}
            value={text}
            onChangeText={changeText}
            onBlur={() => {
              setEditing(false);
              setCleared(null);
            }}
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
          {text.length > 0 ? (
            <Pressable
              onPress={() => {
                setCleared(text);
                setText('');
              }}
              hitSlop={8}
              style={[styles.clear, dark?.clear]}
              accessibilityLabel={t('address.clear')}
            >
              <Icon name="close" size={12} color={darkUI ? darkPalette.text : palette.text} />
            </Pressable>
          ) : cleared ? (
            <Pressable
              onPress={() => changeText(cleared)}
              hitSlop={8}
              style={styles.undo}
              accessibilityRole="button"
              accessibilityLabel={t('address.undoClear')}
            >
              <Icon name="reopen" size={14} color={darkUI ? darkPalette.tintText : palette.tintText} />
              <Text style={[styles.undoText, darkUI && { color: darkPalette.tintText }]}>{t('address.undo')}</Text>
            </Pressable>
          ) : null}
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
          {incognito && <Icon name="incognito" size={15} color={darkPalette.text} />}
          {/^https:\/\//i.test(url) && (
            <View accessibilityLabel={t('address.secure')} accessible>
              <Icon name="secure" size={13} color={darkUI ? darkPalette.textSecondary : palette.textSecondary} />
            </View>
          )}
          {/^http:\/\//i.test(url) && (
            <View accessibilityLabel={t('address.notSecure')} accessible>
              <Icon name="insecure" size={13} color={palette.danger} />
            </View>
          )}
          <Text
            style={[styles.fieldText, styles.fieldTextFlex, dark?.text, !url && styles.placeholder]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {url ? displayUrl(url) : t('address.placeholder')}
          </Text>
          {usingLocation && (
            <Pressable
              onPress={onLocationPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('address.usingLocation')}
            >
              <Icon name="location" size={13} color={darkUI ? darkPalette.tintText : palette.tintText} />
            </Pressable>
          )}
        </Pressable>
      )}

      <Pressable
        onPress={onOpenTabs}
        hitSlop={6}
        style={styles.icon}
        accessibilityLabel={t('address.tabs', { count: tabCount })}
      >
        <View style={[styles.tabCount, dark?.tabCount]}>
          <Text style={[styles.tabCountText, dark?.text]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tabCount}
          </Text>
        </View>
      </Pressable>
      <IconButton icon="more" onPress={onOpenMenu} incognito={darkUI} accessibilityLabel={t('address.menu')} />
      {showAssistant && (
        <Pressable
          onPress={onToggleAssistant}
          hitSlop={6}
          style={[styles.assistantButton, assistantOpen && styles.assistantButtonActive]}
          accessibilityLabel={t(assistantOpen ? 'address.closeAssistant' : 'address.openAssistant')}
        >
          {/* The orbit circles while a task runs. */}
          <QutaiMark size={24} working={assistantRunning} />
        </Pressable>
      )}
      {loading && <LoadingBar top={bottom} />}
      {editing && (
        <Pressable
          style={[styles.backdrop, bottom ? { bottom: barHeight } : { top: barHeight }]}
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
          barHeight={barHeight}
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
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    // With reduced motion the bar stays still.
    if (reduceMotion) return;
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
  }, [progress, reduceMotion]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.4, width] });
  return (
    <View style={[styles.loadingTrack, top && styles.loadingTrackTop]} pointerEvents="none">
      <Animated.View style={[styles.loadingBar, { width: width * 0.4, transform: [{ translateX }] }]} />
    </View>
  );
}

function IconButton({
  icon,
  onPress,
  disabled,
  incognito,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  incognito?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={styles.icon}
      accessibilityLabel={accessibilityLabel}
    >
      <Icon
        name={icon}
        size={22}
        color={incognito ? darkPalette.text : palette.text}
        style={disabled ? styles.disabled : undefined}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    // Above the page, so the suggestion dropdown can overlap it.
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: c.chrome,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  field: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: c.surface,
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 15,
    color: c.text,
    textAlign: 'left',
    textAlignVertical: 'center',
    // Android adds extra font padding that pushes single-line text off-center.
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  fieldTextFlex: { flex: 1 },
  input: { paddingVertical: 0, height: '100%' },
  backdrop: { position: 'absolute', left: 0, right: 0, height: 4000, backgroundColor: c.backdrop },
  barBottom: {
    borderBottomWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  undoText: { color: c.tintText, fontSize: 13, fontWeight: '600' },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d6d3c9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 11, color: c.textSecondary, fontWeight: '700' },
  security: { fontSize: 12, color: c.textSecondary },
  insecure: { color: c.danger, fontSize: 14 },
  incognitoBadge: { fontSize: 14 },
  placeholder: { color: c.textSecondary },
  icon: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, color: c.text },
  disabled: { opacity: 0.35 },
  loadingTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, overflow: 'hidden' },
  loadingTrackTop: { bottom: 'auto', top: 0 },
  loadingBar: { height: 2, backgroundColor: c.tint, borderRadius: 1 },
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
  tabCountText: { fontSize: 12, fontWeight: '700', color: c.text },
  // A 34pt touch target around a 24pt logo, in line with the bar's 22pt icons.
  assistantButton: { width: 34, height: 34, marginLeft: 2, alignItems: 'center', justifyContent: 'center' },
  assistantButtonActive: { opacity: 0.7 },
}));

/** The bar has a fixed height, so very large text sizes are capped there. */
const MAX_FONT_SCALE = 1.4;

const darkStyles = StyleSheet.create({
  bar: { backgroundColor: '#24232b', borderBottomColor: '#3a3944', borderTopColor: '#3a3944' },
  field: { backgroundColor: '#3a3944' },
  text: { color: '#f2f1f5' },
  tabCount: { borderColor: '#f2f1f5' },
  clear: { backgroundColor: '#52515c' },
  dim: { color: '#a9a8b3' },
});
