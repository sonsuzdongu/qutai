import { useEffect, useMemo, useRef, useState } from 'react';
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
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SearchEngineId } from '../browser/search';
import { lineTarget, type NavigationEnd } from '../browser/pendingNavigation';
import { toUrl } from '../browser/url';
import { addressDisplay } from '../browser/addressDisplay';
import { t } from '../i18n';
import { darkPalette, makeStyles, usePalette } from '../ui/theme';
import { Icon, IconName } from '../ui/Icon';
import { AssistantButton } from './AssistantButton';
import { useReduceMotion } from '../utils/useReduceMotion';
import { nudgeKeyboard } from '../utils/keyboardNudge';
import { showKeyboardFor } from '../utils/showKeyboard';
import { BarOverlay } from './BarOverlay';
import { OmniboxSuggestions } from './OmniboxSuggestions';
import { omniboxOverlayFrame } from './overlaySlot';
import type { HoldHandlers } from './PushToTalk';

/**
 * What the progress line shows (docs/design/14-tabs-and-conversations.md, "Pending navigation"). `key` names the tab and its
 * navigation number: within one key the line never moves backwards; a new key starts over.
 */
export type ProgressLineState = {
  key: string;
  /** A navigation is waiting or loading. */
  active: boolean;
  startedAt: number;
  responded: boolean;
  /** The WebView's own progress (0-1) once the site answered. */
  progress: number;
  /** How the navigation ended, once it has: 'loaded' fills and fades, anything else vanishes at once. */
  endedAs: NavigationEnd | null;
  /** For screen readers: the site being loaded. */
  host: string | null;
};

type Props = {
  url: string;
  /** A new id opens the field for typing with `text` in it (a new tab, or a search from outside); never submits. */
  editRequest?: { id: number; text: string } | null;
  /** Called once the request is applied, so the owner can drop it (a remounted bar must not apply it again). */
  onEditRequestApplied?: () => void;
  /** The progress line: the active tab's navigation, or how its last one ended. */
  progress: ProgressLineState;
  /** The page has used the location (shown as a small pin; tapping it opens the site's permissions). */
  usingLocation?: boolean;
  /** An https page that must not look secure: a certificate error, or one the user chose to continue past. */
  notSecure?: boolean;
  /** The page is capturing from the camera / microphone (small icons; tapping one opens the site's permissions). */
  usingCamera?: boolean;
  usingMicrophone?: boolean;
  onSitePermissionsPress?: () => void;
  /** Reader mode: shown as a small icon when the page looks like an article ('available') or reader mode is on. */
  readerState?: 'none' | 'available' | 'on';
  onToggleReader?: () => void;
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
  /** A task ended in a conversation the user has not looked at since: a dot on the Qutai button. */
  assistantUnseen?: boolean;
  /** Off: no Qutai button (the page menu has "Ask Qutai" instead). */
  showAssistant?: boolean;
  /** Holding the Qutai button to talk (absent when that setting is off). */
  assistantHold?: HoldHandlers;
  assistantHoldActive?: boolean;
  searchEngine: SearchEngineId;
  searchSuggestions: boolean;
  onSubmit: (url: string) => void;
  onAsk: (text: string) => void;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenTabs: () => void;
  onToggleAssistant: () => void;
};


export function AddressBar({
  url,
  editRequest,
  onEditRequestApplied,
  progress,
  usingLocation,
  notSecure,
  usingCamera,
  usingMicrophone,
  onSitePermissionsPress,
  readerState = 'none',
  onToggleReader,
  canGoBack,
  tabCount,
  incognito,
  darkMode,
  position = 'top',
  onSwipe,
  assistantOpen,
  assistantRunning,
  assistantUnseen = false,
  showAssistant = true,
  assistantHold,
  assistantHoldActive,
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
  const inputRef = useRef<TextInputInstance>(null);
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  });
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  // Android: the keyboard is asked for again while it isn't showing after the field got focus (why: keyboardNudge.ts).
  const stopNudge = useRef<(() => void) | null>(null);
  const endNudge = () => {
    stopNudge.current?.();
    stopNudge.current = null;
  };
  const startNudge = () => {
    if (Platform.OS !== 'android') return;
    endNudge();
    stopNudge.current = nudgeKeyboard({
      isFocused: () => inputRef.current?.isFocused() ?? false,
      keyboardShown: () => Keyboard.isVisible(),
      show: () => showKeyboardFor(inputRef.current),
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
    });
  };
  useEffect(() => endNudge, []);
  const [handledEdit, setHandledEdit] = useState<number | null>(null);
  if (editRequest && editRequest.id !== handledEdit) {
    setHandledEdit(editRequest.id);
    setText(editRequest.text);
    setCleared(null);
    setEditing(true);
  }
  useEffect(() => {
    if (editRequest && editRequest.id === handledEdit) onEditRequestApplied?.();
  }, [editRequest, handledEdit, onEditRequestApplied]);
  const darkUI = incognito || !!darkMode;
  const palette = usePalette();
  const dark = darkUI ? darkStyles : null;

  const bottom = position === 'bottom';
  // Suggestions and the dimmed backdrop start exactly at the bar's edge (percent offsets drift on Android).
  const [barHeight, setBarHeight] = useState(48);
  const overlayFrame = omniboxOverlayFrame(bottom, barHeight);
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
              endNudge();
              setEditing(false);
              setCleared(null);
            }}
            onSubmitEditing={() => {
              if (!text.trim()) return;
              finishEditing();
              onSubmit(toUrl(text, searchEngine));
            }}
            ref={inputRef}
            // Focused from an effect instead of autoFocus: on iOS (Fabric) autoFocus focuses the field when it joins the
            // window, a path that skips selectTextOnFocus (only the focus() call selects), so the first typed letters
            // were appended to the address. The whole address is selected again once focused, on both platforms.
            onFocus={() => {
              startNudge();
              const length = textRef.current.length;
              requestAnimationFrame(() => inputRef.current?.setSelection(0, length));
            }}
            selectTextOnFocus
            // A tap on the field while it has focus and the keyboard was closed (Back) opens the keyboard again.
            onPress={() => {
              if (Platform.OS === 'android' && !Keyboard.isVisible()) showKeyboardFor(inputRef.current);
            }}
            // On a phone on its side the suggestions and the page stay in view (no full-screen keyboard).
            disableFullscreenUI
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
              accessibilityRole="button"
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
          {/^https:\/\//i.test(url) && !notSecure && (
            <View accessibilityLabel={t('address.secure')} accessible>
              <Icon name="secure" size={13} color={darkUI ? darkPalette.textSecondary : palette.textSecondary} />
            </View>
          )}
          {(/^http:\/\//i.test(url) || (notSecure && /^https:\/\//i.test(url))) && (
            <View accessibilityLabel={t('address.notSecure')} accessible>
              <Icon name="insecure" size={13} color={palette.danger} />
            </View>
          )}
          {url ? (
            <ShownAddress url={url} dark={darkUI} />
          ) : (
            <Text
              style={[styles.fieldText, styles.fieldTextFlex, dark?.text, styles.placeholder]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              numberOfLines={1}
            >
              {t('address.placeholder')}
            </Text>
          )}
          {usingCamera && (
            <Pressable
              onPress={onSitePermissionsPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('address.usingCamera')}
            >
              <Icon name="camera" size={13} color={palette.danger} />
            </Pressable>
          )}
          {usingMicrophone && (
            <Pressable
              onPress={onSitePermissionsPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('address.usingMicrophone')}
            >
              <Icon name="microphone" size={13} color={palette.danger} />
            </Pressable>
          )}
          {usingLocation && (
            <Pressable
              onPress={onSitePermissionsPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('address.usingLocation')}
            >
              <Icon name="location" size={13} color={darkUI ? darkPalette.tintText : palette.tintText} />
            </Pressable>
          )}
          {readerState !== 'none' && (
            <Pressable
              onPress={onToggleReader}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t(readerState === 'on' ? 'reader.exit' : 'reader.open')}
              accessibilityState={{ selected: readerState === 'on' }}
            >
              <Icon
                name="reader"
                size={15}
                color={
                  readerState === 'on'
                    ? darkUI
                      ? darkPalette.tintText
                      : palette.tintText
                    : darkUI
                      ? darkPalette.textSecondary
                      : palette.textSecondary
                }
              />
            </Pressable>
          )}
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
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
        <AssistantButton
          open={assistantOpen}
          running={assistantRunning}
          unseen={assistantUnseen}
          onPress={onToggleAssistant}
          hold={assistantHold}
          holdActive={assistantHoldActive}
        />
      )}
      <ProgressLine state={progress} top={bottom} />
      {/* Drawn in a layer as large as the page, never hanging outside the bar: on Android a tap there also pressed the
          page behind (components/overlaySlot.ts). */}
      {editing && (
        <BarOverlay>
          <Pressable
            style={[styles.backdrop, overlayFrame.backdrop]}
            onPress={finishEditing}
            accessibilityLabel={t('common.close')}
            accessibilityRole="button"
          />
          {/* Nothing until something is typed: no empty box (and no paste row) on a fresh tab (UI-80). */}
          {text.trim() !== '' && (
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
        </BarOverlay>
      )}
    </View>
  );
}

/** Line height in points; a little thicker than the old indeterminate line (2). */
const LINE = 3;

/**
 * The progress line along the bar's page edge, like Chrome's: starts at once at about 10 %, creeps towards 30 % while
 * the site hasn't answered, follows the WebView's real progress after that, never moves backwards, fills and fades out
 * when the page has loaded, and vanishes at once on stop or an error. With reduce motion it steps without sliding.
 */
function ProgressLine({ state, top }: { state: ProgressLineState; top: boolean }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [value] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(0));
  // Which navigation the line belongs to and whether it is on screen, adjusted while rendering when the navigation
  // changes: a new one shows at once; one seen only after it ended (a tab switch) shows nothing; stop or an error hides it.
  const [line, setLine] = useState({ key: state.key, visible: state.active });
  if (line.key !== state.key) setLine({ key: state.key, visible: state.active });
  else if (!state.active && line.visible && state.endedAs !== 'loaded') setLine({ key: line.key, visible: false });
  const shown = useRef(0);
  const live = useRef(state);
  useEffect(() => {
    live.current = state;
  });

  const { key, active, endedAs, responded, progress } = state;
  // A new navigation starts where its creep is now (10 % for a fresh one).
  useEffect(() => {
    value.stopAnimation();
    opacity.stopAnimation();
    const start = live.current.active ? lineTarget(live.current, Date.now()) : 0;
    shown.current = start;
    value.setValue(start);
    opacity.setValue(live.current.active ? 1 : 0);
  }, [key, value, opacity]);

  // While it runs: the creep and the real progress, a few times a second (once a second, in steps, with reduce motion).
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const target = lineTarget(live.current, Date.now(), shown.current);
      if (target <= shown.current) return;
      shown.current = target;
      if (reduceMotion) value.setValue(target);
      else Animated.timing(value, { toValue: target, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    };
    tick();
    const timer = setInterval(tick, reduceMotion ? 1000 : 250);
    return () => clearInterval(timer);
  }, [key, active, responded, progress, reduceMotion, value]);

  // A loaded page: the line fills, then fades (with reduce motion: fills, then disappears).
  useEffect(() => {
    if (active || endedAs !== 'loaded') return;
    let cancelled = false;
    const hide = () => {
      if (!cancelled) setLine((l) => (l.key === key ? { key, visible: false } : l));
    };
    shown.current = 1;
    if (reduceMotion) {
      value.setValue(1);
      const timer = setTimeout(hide, 250);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(hide);
    return () => {
      cancelled = true;
    };
  }, [key, active, endedAs, reduceMotion, value, opacity]);

  if (!line.visible || line.key !== state.key) return null;
  const translateX = value.interpolate({ inputRange: [0, 1], outputRange: [-width, 0], extrapolate: 'clamp' });
  return (
    <View
      style={[styles.loadingTrack, top && styles.loadingTrackTop]}
      pointerEvents="none"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={state.host ? t('nav.loading', { host: state.host }) : undefined}
    >
      <Animated.View style={[styles.loadingBar, { width, opacity, transform: [{ translateX }] }]} />
    </View>
  );
}

/**
 * The address while not editing (`UI` rules, docs/design/27-interface.md): the registrable domain in full colour and
 * weight, subdomains and the path subdued. The host keeps its end (the domain) when it is too long, cut from the left;
 * the path gives way first.
 */
function ShownAddress({ url, dark }: { url: string; dark: boolean }) {
  const styles = useStyles();
  const parts = addressDisplay(url);
  const dim = dark ? styles.dimDark : styles.dim;
  return (
    <View style={styles.addressRow}>
      <Text
        style={[styles.fieldText, styles.host, dark && darkStyles.text]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        numberOfLines={1}
        ellipsizeMode="head"
      >
        {parts.before ? <Text style={dim}>{parts.before}</Text> : null}
        <Text style={styles.domain}>{parts.domain}</Text>
      </Text>
      {parts.after ? (
        <Text
          style={[styles.fieldText, styles.path, dim]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {parts.after}
        </Text>
      ) : null}
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
      accessibilityRole="button"
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
  backdrop: { position: 'absolute', left: 0, right: 0, backgroundColor: c.backdrop },
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
    backgroundColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 11, color: c.textSecondary, fontWeight: '700' },
  security: { fontSize: 12, color: c.textSecondary },
  insecure: { color: c.danger, fontSize: 14 },
  incognitoBadge: { fontSize: 14 },
  placeholder: { color: c.textSecondary },
  addressRow: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  // The path shrinks first; the host only once the path is gone, from its left.
  host: { flexShrink: 1 },
  path: { flexShrink: 1000, minWidth: 0 },
  domain: { fontWeight: '600' },
  dim: { color: c.textSecondary, fontWeight: '400' },
  dimDark: { color: '#a9a8b3', fontWeight: '400' },
  icon: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, color: c.text },
  disabled: { opacity: 0.35 },
  loadingTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: LINE, overflow: 'hidden' },
  loadingTrackTop: { bottom: 'auto', top: 0 },
  loadingBar: { height: LINE, backgroundColor: c.tint, borderTopRightRadius: LINE / 2, borderBottomRightRadius: LINE / 2 },
  tabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: c.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabCountText: { fontSize: 12, fontWeight: '700', color: c.text },
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
