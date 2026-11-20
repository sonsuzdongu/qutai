import { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  findNodeHandle,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { deleteKey, getDb, getJson, setJson } from '../storage/db';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles, usePalette, radii } from '../ui/theme';
import { useScreenReader } from './useHoldGesture';

/**
 * The first-run introduction to the Qutai button: after setup, the browser dims except for the button in the address
 * bar (at the top or the bottom) and a card says that a tap opens the assistant panel and holding it starts listening
 * at once. Shown once (a flag in the kv table), dismissed with "Got it", a tap outside or the back button; tapping the
 * button itself opens the panel. Settings › Assistant › "Show the Qutai button tour" shows it again.
 */

type Frame = { x: number; y: number; width: number; height: number };
type Measure = (then: (frame: Frame) => void) => void;

const KEY = 'ui:assistant_intro_seen';
let measureButton: Measure | null = null;
const listeners = new Set<() => void>();

/** AssistantButton registers how to find it on screen while it is mounted; returns the unregister function. */
export function registerAssistantButton(measure: Measure): () => void {
  measureButton = measure;
  listeners.forEach((l) => l());
  return () => {
    if (measureButton === measure) measureButton = null;
  };
}

export async function assistantIntroSeen(): Promise<boolean> {
  try {
    return !!(await getJson<boolean>(await getDb(), KEY));
  } catch {
    return true;
  }
}

/**
 * Marks the intro as seen through a database handle the caller already holds. A backup restore holds the database
 * (storage/db.ts › holdDb), so anything that asks for it again with getDb() waits until the app restarts: after a
 * restore the mark must be written with the restore's own handle (20 Nov 2026: setup's restore hung on this).
 */
export async function markAssistantIntroSeen(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await setJson(db, KEY, true);
}

export async function setAssistantIntroSeen(seen: boolean): Promise<void> {
  const db = await getDb();
  if (seen) await setJson(db, KEY, true);
  else await deleteKey(db, KEY);
}

type Props = {
  visible: boolean;
  /** Holding the button talks (Settings › Assistant › "Hold the Qutai button to talk"). */
  holdToTalk: boolean;
  barAtBottom: boolean;
  onOpenAssistant: () => void;
  onDismiss: () => void;
};

const PAD = 6;
const CARD_MAX = 340;
const MARGIN = 16;

export function AssistantIntro({ visible, holdToTalk, barAtBottom, onOpenAssistant, onDismiss }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const [frame, setFrame] = useState<Frame | null>(null);
  const titleRef = useRef<ComponentRef<typeof Text>>(null);

  // Finds the button when shown, when it remounts (the bar moved), when the screen turns, and every half second
  // while shown: the bar can still be settling (safe-area insets, the keyboard, the bar sliding in) after the first
  // measurement, which left the highlight one inset below the button on iOS.
  useEffect(() => {
    if (!visible) return;
    const read = () =>
      measureButton?.((f) => {
        if (f.width <= 0) return;
        setFrame((old) =>
          old && Math.abs(old.x - f.x) < 0.5 && Math.abs(old.y - f.y) < 0.5 && old.width === f.width ? old : f,
        );
      });
    read();
    const timer = setInterval(read, 500);
    listeners.add(read);
    return () => {
      clearInterval(timer);
      listeners.delete(read);
    };
  }, [visible, screenW, screenH, barAtBottom]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, onDismiss]);

  const shown = visible && !!frame;
  const opacity = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!shown) {
      opacity.set(0);
      cancelAnimation(pulse);
      pulse.set(0);
      return;
    }
    opacity.set(reduceMotion ? 1 : withTiming(1, { duration: 220 }));
    if (!reduceMotion) {
      pulse.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    }
    // A screen reader starts on the card's title.
    const node = findNodeHandle(titleRef.current);
    if (node) setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 350);
  }, [shown, reduceMotion, opacity, pulse]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const ring = useAnimatedStyle(() => ({
    opacity: 1 - pulse.get(),
    transform: [{ scale: 1 + pulse.get() * 0.45 }],
  }));

  if (!shown || !frame) return null;

  const size = Math.max(frame.width, frame.height) + PAD * 2;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const hole = { left: cx - size / 2, top: cy - size / 2, width: size, height: size };
  const cardWidth = Math.min(CARD_MAX, screenW - MARGIN * 2);
  const cardLeft = Math.max(MARGIN, Math.min(cx - cardWidth + 28, screenW - MARGIN - cardWidth));
  const cardPos = barAtBottom ? { bottom: screenH - hole.top + 12 } : { top: hole.top + size + 12 };
  const holdLine = holdToTalk ? t(screenReader ? 'intro.holdScreenReader' : 'intro.hold') : null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade]} accessibilityViewIsModal>
      {/* The dimmed screen around the button: four bands, so the button itself stays bright. */}
      <Pressable
        style={[styles.dim, { left: 0, top: 0, right: 0, height: Math.max(0, hole.top) }]}
        onPress={onDismiss}
        accessible={false}
      />
      <Pressable
        style={[styles.dim, { left: 0, top: hole.top + size, right: 0, bottom: 0 }]}
        onPress={onDismiss}
        accessible={false}
      />
      <Pressable
        style={[styles.dim, { left: 0, top: hole.top, width: Math.max(0, hole.left), height: size }]}
        onPress={onDismiss}
        accessible={false}
      />
      <Pressable
        style={[styles.dim, { left: hole.left + size, top: hole.top, right: 0, height: size }]}
        onPress={onDismiss}
        accessible={false}
      />
      {!reduceMotion && <Animated.View pointerEvents="none" style={[styles.ring, hole, { borderRadius: size / 2 }, ring]} />}
      <View pointerEvents="none" style={[styles.ringStill, hole, { borderRadius: size / 2 }]} />
      <Pressable
        style={[styles.hole, hole, { borderRadius: size / 2 }]}
        onPress={() => {
          onDismiss();
          onOpenAssistant();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('address.openAssistant')}
      />
      <View style={[styles.card, { width: cardWidth, left: cardLeft }, cardPos]}>
        <View style={styles.cardHead}>
          <QutaiMark size={26} />
          <Text ref={titleRef} style={styles.title} accessibilityRole="header">
            {t('intro.title')}
          </Text>
        </View>
        <View style={styles.line}>
          <Icon name="assistant" size={18} color={palette.tintText} />
          <Text style={styles.body}>{t('intro.tap')}</Text>
        </View>
        {holdLine && (
          <View style={styles.line}>
            <Icon name="microphone" size={18} color={palette.tintText} />
            <Text style={styles.body}>{holdLine}</Text>
          </View>
        )}
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t('intro.gotIt')}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  hole: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 3, borderColor: c.tintText },
  ringStill: { position: 'absolute', borderWidth: 2, borderColor: c.tintText },
  card: {
    position: 'absolute',
    backgroundColor: c.surface,
    borderRadius: radii.window,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: c.text, fontSize: 17, fontWeight: '700' },
  line: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  body: { flex: 1, color: c.text, fontSize: 15, lineHeight: 21 },
  button: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 18,
    minHeight: 40,
    paddingVertical: 6,
    borderRadius: radii.button,
    justifyContent: 'center',
    backgroundColor: c.tint,
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: c.onTint, fontSize: 15, fontWeight: '600' },
}));
