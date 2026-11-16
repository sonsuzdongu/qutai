import { ComponentRef, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { Icon, IconLines } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { useKeyboardHeight } from '../utils/useKeyboardHeight';
import { useReduceMotion } from '../utils/useReduceMotion';

/**
 * The app's alerts and confirmations, drawn with the theme instead of the platform's Alert.
 *
 * Call it from anywhere, like Alert.alert: `dialog.alert(...)`, `await dialog.confirm(...)`,
 * `await dialog.prompt(...)`. Requests queue, one dialog at a time.
 *
 * Where it is drawn: on iOS a Modal can only be presented from the screen that holds it, and a
 * second Modal next to an open one is never shown; on Android every Modal is its own window.
 * So each Modal screen and sheet mounts a <DialogHost />, and the dialog appears as a small
 * transparent Modal inside the host mounted last (the screen on top). If iOS refuses the
 * presentation (another sheet is still sliding away), the dialog tries again shortly after.
 */

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';
export type DialogButton = {
  text: string;
  style?: DialogButtonStyle;
  /**
   * The emphasised action (filled, rightmost in a row, on top when stacked). Without it, the last
   * button that isn't cancel is the primary one.
   */
  primary?: boolean;
  onPress?: () => void;
};

export type DialogOptions = {
  title: string;
  message?: string;
  /** Lines with icons, shown before the message (e.g. the step the assistant wants to take). */
  lines?: IconLines;
  /** One to three buttons; just "OK" when left out. A cancel button is also what the backdrop and back button do. */
  buttons?: DialogButton[];
  /** A picture under the title (e.g. the image a page is about to get); width over height for its shape. */
  image?: { uri: string; aspectRatio: number; label: string };
  /** A checkbox line under the message, e.g. "Always allow on this site". */
  checkbox?: { label: string; initial?: boolean };
  /** A single-line text field; the other buttons stay disabled while it is empty. */
  input?: {
    label: string;
    placeholder?: string;
    initial?: string;
    maxLength?: number;
  };
  /** Aborting dismisses the dialog (or drops it from the queue) as if no button was pressed. */
  signal?: AbortSignal;
};

/** button: the index of the pressed button in `buttons`, null when dismissed by the signal. */
export type DialogResult = { button: number | null; checked: boolean; text: string };

type Entry = {
  id: number;
  options: DialogOptions & { buttons: DialogButton[] };
  resolve: (result: DialogResult) => void;
  cleanup: () => void;
};

type Host = { id: number; hold: boolean };
type Snapshot = { current: Entry | null; host: number; background: boolean };

/** How long iOS gets to present the dialog before it is tried again. */
const PRESENT_TIMEOUT_MS = 700;
const MAX_FONT_SCALE = 2;

let nextEntryId = 0;
let nextHostId = 0;
const queue: Entry[] = [];
const hosts: Host[] = [];
const listeners = new Set<() => void>();
let background = AppState.currentState === 'background';
let snapshot: Snapshot = { current: null, host: 0, background };

function emit() {
  const top = hosts[hosts.length - 1];
  snapshot = { current: queue[0] ?? null, host: top && !top.hold ? top.id : 0, background };
  listeners.forEach((listener) => listener());
}

// Hidden while the app is in the background (the lock screen may need to come up first) and
// drawn again on return; the request itself stays queued, so nothing is lost.
AppState.addEventListener('change', (state) => {
  const next = state === 'background';
  if (next === background) return;
  background = next;
  emit();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

function settle(entry: Entry, result: DialogResult) {
  const index = queue.indexOf(entry);
  if (index < 0) return;
  queue.splice(index, 1);
  entry.cleanup();
  emit();
  entry.resolve(result);
  if (result.button !== null) entry.options.buttons[result.button]?.onPress?.();
}

function show(options: DialogOptions): Promise<DialogResult> {
  return new Promise((resolve) => {
    const { signal } = options;
    const dismissed = { button: null, checked: false, text: '' };
    if (signal?.aborted) return resolve(dismissed);
    const buttons = options.buttons?.length ? options.buttons.slice(0, 3) : [{ text: t('common.ok') }];
    const onAbort = () => settle(entry, dismissed);
    const entry: Entry = {
      id: ++nextEntryId,
      options: { ...options, buttons },
      resolve,
      cleanup: () => signal?.removeEventListener('abort', onAbort),
    };
    signal?.addEventListener('abort', onAbort);
    queue.push(entry);
    emit();
  });
}

/** Whether a dialog is showing or waiting; voice input stops listening as soon as one opens. */
export const dialogState = {
  subscribe,
  isOpen: () => queue.length > 0,
};

export const dialog = {
  show,

  /** Same shape as Alert.alert: the pressed button's onPress runs after the dialog closes. */
  alert(title: string, message?: string, buttons?: DialogButton[]) {
    void show({ title, message, buttons });
  },

  /** Cancel and a confirming button; true when confirmed. */
  async confirm(options: {
    title: string;
    message?: string;
    confirmText: string;
    cancelText?: string;
    destructive?: boolean;
    signal?: AbortSignal;
  }): Promise<boolean> {
    const result = await show({
      title: options.title,
      message: options.message,
      signal: options.signal,
      buttons: [
        { text: options.cancelText ?? t('common.cancel'), style: 'cancel' },
        { text: options.confirmText, style: options.destructive ? 'destructive' : 'default' },
      ],
    });
    return result.button === 1;
  },

  /** A text field with Cancel and a confirming button; the trimmed text, or null when cancelled. */
  async prompt(options: {
    title: string;
    message?: string;
    label: string;
    placeholder?: string;
    initial?: string;
    maxLength?: number;
    confirmText?: string;
  }): Promise<string | null> {
    const result = await show({
      title: options.title,
      message: options.message,
      input: {
        label: options.label,
        placeholder: options.placeholder,
        initial: options.initial,
        maxLength: options.maxLength,
      },
      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: options.confirmText ?? t('common.save') }],
    });
    return result.button === 1 ? result.text.trim() : null;
  },
};

/**
 * Where dialogs are drawn: one at the app root (`root`, always the lowest) and one inside every
 * Modal (see above). `hold` (the lock screen) keeps dialogs waiting while it is on top instead
 * of drawing them over it.
 */
export function DialogHost({ root = false, hold = false }: { root?: boolean; hold?: boolean }) {
  const [id] = useState(() => ++nextHostId);
  useEffect(() => {
    const host = { id, hold };
    if (root) hosts.unshift(host);
    else hosts.push(host);
    emit();
    return () => {
      hosts.splice(hosts.indexOf(host), 1);
      emit();
    };
  }, [id, root, hold]);
  const { current, host, background: inBackground } = useSyncExternalStore(subscribe, getSnapshot);
  if (!current || host !== id || inBackground) return null;
  return <DialogView key={current.id} entry={current} />;
}

function DialogView({ entry }: { entry: Entry }) {
  const styles = useStyles();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const keyboard = useKeyboardHeight();
  const { fontScale, height } = useWindowDimensions();
  const { title, message, lines, buttons, checkbox, input, image } = entry.options;

  const [checked, setChecked] = useState(checkbox?.initial ?? false);
  const [text, setText] = useState(input?.initial ?? '');
  // Side by side when they fit; three buttons, large text or a label that wraps stack them.
  const [stacked, setStacked] = useState(buttons.length > 2 || fontScale > 1.3);
  const [progress] = useState(() => new Animated.Value(0));
  const [attempt, setAttempt] = useState(0);
  const shown = useRef(false);
  const closing = useRef(false);
  const titleRef = useRef<ComponentRef<typeof Text>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  // iOS ignores a presentation while another one is still in progress; try again until it shows.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shown.current) return;
      setAttempt((n) => n + 1);
    }, PRESENT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  const cancelIndex = buttons.findIndex((b) => b.style === 'cancel');
  let primaryIndex = buttons.findIndex((b) => b.primary && b.style !== 'cancel');
  if (primaryIndex < 0) {
    buttons.forEach((b, i) => {
      if (b.style !== 'cancel') primaryIndex = i;
    });
  }
  const missingText = input !== undefined && !text.trim();

  const onShow = () => {
    shown.current = true;
    if (reduceMotion) progress.setValue(1);
    else
      Animated.timing(progress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    if (input) inputRef.current?.focus();
    else if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
  };

  const choose = (index: number) => {
    if (closing.current) return;
    closing.current = true;
    if (input) Keyboard.dismiss();
    const result = { button: index, checked, text };
    if (reduceMotion) return settle(entry, result);
    Animated.timing(progress, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => settle(entry, result));
  };

  // Backdrop, Android back button and the VoiceOver escape gesture: Cancel, when there is one.
  const dismiss = () => {
    if (cancelIndex >= 0) choose(cancelIndex);
  };

  // Row: cancel on the left, the main action on the right. Stacked: main action on top.
  const order = buttons.map((_, i) => i);
  const row = [
    ...order.filter((i) => i === cancelIndex),
    ...order.filter((i) => i !== cancelIndex && i !== primaryIndex),
    ...order.filter((i) => i === primaryIndex),
  ];
  const ordered = stacked ? [...row].reverse() : row;

  const scale = reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Modal
      key={attempt}
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
      onShow={onShow}
    >
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.frame,
            {
              paddingTop: insets.top + (input ? Math.round(height * 0.12) : 24),
              paddingBottom: Math.max(insets.bottom, keyboard) + 24,
              paddingLeft: insets.left + 24,
              paddingRight: insets.right + 24,
              // The text field sits high, so the keyboard never covers it.
              justifyContent: input ? 'flex-start' : 'center',
            },
          ]}
        >
          <Animated.View
            style={[styles.card, { transform: [{ scale }] }]}
            accessibilityViewIsModal
            accessibilityRole="alert"
            onAccessibilityEscape={dismiss}
          >
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false}>
              <Text
                ref={titleRef}
                style={styles.title}
                accessibilityRole="header"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              >
                {title}
              </Text>
              {image ? (
                <Image
                  source={{ uri: image.uri }}
                  style={[styles.image, { aspectRatio: image.aspectRatio > 0 ? image.aspectRatio : 1 }]}
                  resizeMode="contain"
                  accessibilityLabel={image.label}
                />
              ) : null}
              {lines?.lines.length ? (
                <View style={lines.spaced ? styles.linesSpaced : null}>
                  {lines.lines.map((line, i) => {
                    const indent = !lines.spaced && !line.icon && lines.lines.some((l) => l.icon);
                    return (
                      <View key={i} style={[styles.line, indent && styles.lineIndent]}>
                        {line.icon ? (
                          <Icon name={line.icon} size={16} color={palette.textSecondary} style={styles.lineIcon} />
                        ) : null}
                        <Text style={[styles.message, styles.lineText]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {line.text}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {message ? (
                <Text style={styles.message} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {message}
                </Text>
              ) : null}
            </ScrollView>

            {input && (
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholderTextColor={palette.textSecondary}
                value={text}
                onChangeText={setText}
                placeholder={input.placeholder ?? input.label}
                accessibilityLabel={input.label}
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={() => !missingText && primaryIndex >= 0 && choose(primaryIndex)}
                maxLength={input.maxLength}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              />
            )}

            {checkbox && (
              <Pressable
                onPress={() => setChecked((v) => !v)}
                style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <View style={[styles.box, checked && styles.boxChecked]}>
                  {checked && <Icon name="check" size={16} color={palette.onTint} />}
                </View>
                <Text style={styles.checkLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {checkbox.label}
                </Text>
              </Pressable>
            )}

            <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
              {ordered.map((index) => {
                const button = buttons[index];
                const primary = index === primaryIndex;
                const destructive = button.style === 'destructive';
                const disabled = missingText && index !== cancelIndex;
                return (
                  <Pressable
                    key={index}
                    onPress={() => choose(index)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.button,
                      !stacked && styles.buttonInRow,
                      primary ? (destructive ? styles.dangerFill : styles.tintFill) : styles.plain,
                      pressed && styles.buttonPressed,
                      disabled && styles.disabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={button.text}
                    accessibilityState={{ disabled }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        primary ? styles.onFill : destructive ? styles.dangerText : null,
                        button.style === 'cancel' && styles.cancelText,
                      ]}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      onTextLayout={(e) => {
                        if (!stacked && e.nativeEvent.lines.length > 1) setStacked(true);
                      }}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.backdrop },
  frame: { flex: 1, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    backgroundColor: c.bg,
    borderRadius: 18,
    padding: 20,
    gap: 14,
    borderWidth: c.dark ? StyleSheet.hairlineWidth : 0,
    borderColor: c.border,
  },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: c.text },
  message: { fontSize: 15, lineHeight: 21, color: c.textSecondary },
  linesSpaced: { gap: 21 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // Lines without an icon start where the text of the lines with one does (not paragraphs, which stand alone).
  lineIndent: { paddingStart: 24 },
  lineIcon: { marginTop: 2.5 },
  lineText: { flex: 1 },
  image: { width: '100%', maxHeight: 200, borderRadius: 8, backgroundColor: c.border },
  input: {
    color: c.text,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    borderRadius: 10,
  },
  pressed: { backgroundColor: c.pressed },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: c.tint, borderColor: c.tint },
  checkLabel: { flex: 1, fontSize: 15, color: c.text },
  buttons: { flexDirection: 'row', gap: 10 },
  buttonsStacked: { flexDirection: 'column' },
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInRow: { flex: 1 },
  plain: { backgroundColor: c.sunken },
  tintFill: { backgroundColor: c.tint },
  dangerFill: { backgroundColor: c.dangerFill },
  buttonPressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    textAlign: 'center',
  },
  cancelText: { fontWeight: '500' },
  onFill: { color: c.onTint },
  dangerText: { color: c.danger },
}));
