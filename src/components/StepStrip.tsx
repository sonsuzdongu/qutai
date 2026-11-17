import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { emptyStripLine, offerLine, tickLine, type StripLineState } from '../chat/stripLine';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { answerCardMaxHeight } from '../ui/layout';
import type { AssistantLook } from '../ui/assistantLook';
import { QutaiMark } from '../ui/QutaiMark';
import { usePalette, type Palette } from '../ui/theme';
import { useReduceMotion } from '../utils/useReduceMotion';
import { GlassBack } from './AssistantGlass';

/**
 * The step line shown while lines arrive faster than they can be read: each stays MIN_LINE_MS, the ones replaced in
 * the meantime are skipped (src/chat/stripLine.ts).
 */
function useCoalescedLine(target: string): string {
  const state = useRef<StripLineState>(emptyStripLine);
  const [shown, setShown] = useState(target);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const apply = (step: { state: StripLineState; wakeAt: number | null }) => {
      state.current = step.state;
      setShown(step.state.shown);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (step.wakeAt !== null) {
        timer.current = setTimeout(() => apply(tickLine(state.current, Date.now())), Math.max(0, step.wakeAt - Date.now()));
      }
    };
    apply(offerLine(state.current, target, Date.now()));
  }, [target]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return shown;
}

/**
 * The step strip (docs/working-mode.md): one floating line at the bottom while a task runs with the panel closed:
 * the activity mark, what the assistant is doing in the user's language, and Stop. Tapping it opens the panel with
 * every step. When the assistant works in a tab that isn't on screen it says so and offers to show it.
 *
 * A screen reader hears each new line politely (a live region on Android, a queued announcement on iOS); focus is
 * never moved to the strip. With a large text size the line wraps to a second line instead of being cut.
 */
export function StepStrip({
  line,
  elsewhere,
  bottom,
  look = 'classic',
  onOpen,
  onStop,
  onShowTab,
}: {
  /** The current step line (already translated). */
  line: string;
  /** The assistant works in a tab that isn't on screen. */
  elsewhere: boolean;
  /** Room to leave at the bottom (safe area, a bottom address bar). */
  bottom: number;
  /** TRIAL (src/ui/assistantLook.ts): "band" makes the strip glass with a thread of light around it. */
  look?: AssistantLook;
  onOpen: () => void;
  onStop: () => void;
  onShowTab: () => void;
}) {
  const palette = usePalette();
  const styles = useStyles(palette);
  const reduceMotion = useReduceMotion();
  const shown = useCoalescedLine(line);
  const insets = useSafeAreaInsets();
  const [rise] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return rise.setValue(1);
    Animated.spring(rise, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
  }, [rise, reduceMotion]);

  // iOS has no live regions: each new line is queued after whatever VoiceOver is saying.
  useEffect(() => {
    if (Platform.OS === 'ios' && shown) AccessibilityInfo.announceForAccessibilityWithOptions(shown, { queue: true });
  }, [shown]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom,
          // Clear of a camera cut-out at either side when the phone is on its side.
          left: 12 + insets.left,
          right: 12 + insets.right,
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        },
      ]}
    >
      <View style={[styles.strip, look === 'band' && styles.glass]}>
        {look === 'band' ? <GlassBack radius={26} thread /> : null}
        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${t('chat.inputBusy')} ${shown}${elsewhere ? `. ${t('chat.busyElsewhere')}` : ''}`}
          accessibilityHint={t('working.openHint')}
          // Android: TalkBack speaks the new label when the line changes, without moving focus.
          accessibilityLiveRegion="polite"
        >
          <QutaiMark size={20} working animate={!reduceMotion} />
          <View style={styles.texts}>
            <Text style={styles.line} numberOfLines={2}>
              {shown}
            </Text>
            {elsewhere ? (
              <Text style={styles.where} numberOfLines={1}>
                {t('working.otherTab')}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {elsewhere ? (
          <Pressable
            onPress={onShowTab}
            style={({ pressed }) => [styles.show, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${t('chat.showTab')}: ${t('chat.busyElsewhere')}`}
            hitSlop={6}
          >
            <Text style={styles.showText}>{t('chat.showTab')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onStop}
          style={({ pressed }) => [styles.stop, pressed && styles.stopPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.stop')}
          hitSlop={6}
        >
          <Icon name="stop" size={18} color={palette.onTint} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * A task started with the panel closed (voice from the Q logo) ended with an answer: the strip turns into the answer
 * itself, with "Open chat" for everything else. Announced to a screen reader; closes with its own button.
 */
export function AnswerCard({
  text,
  bottom,
  look = 'classic',
  onOpen,
  onClose,
}: {
  text: string;
  bottom: number;
  look?: AssistantLook;
  onOpen: () => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const styles = useStyles(palette);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  // Never taller than the room above it: a phone on its side is only ~360 pt high.
  const { height: windowHeight } = useWindowDimensions();
  const [grow] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return grow.setValue(1);
    Animated.timing(grow, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [grow, reduceMotion]);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${t('working.answerTitle')}: ${text}`);
  }, [text]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom, left: 12 + insets.left, right: 12 + insets.right, opacity: grow, transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}
    >
      <View
        style={[styles.card, look === 'band' && styles.glass, { maxHeight: answerCardMaxHeight(windowHeight, bottom, insets.top) }]}
      >
        {look === 'band' ? <GlassBack radius={20} /> : null}
        <View style={styles.cardHeader}>
          <QutaiMark size={20} animate={false} />
          <Text style={styles.cardTitle} accessibilityRole="header">
            {t('working.answerTitle')}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={8}
          >
            <Icon name="close" size={20} color={palette.textSecondary} />
          </Pressable>
        </View>
        <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerContent}>
          <Text style={styles.answer} selectable>
            {text}
          </Text>
        </ScrollView>
        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [styles.openChat, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.openChatText}>{t('working.openChat')}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function useStyles(p: Palette) {
  return useMemo(() => makeStyles(p), [p]);
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 30, elevation: 30 },
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      maxWidth: 560,
      minHeight: 52,
      paddingLeft: 4,
      paddingRight: 8,
      borderRadius: 26,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      shadowColor: '#000',
      shadowOpacity: p.dark ? 0.5 : 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
    },
    // The glass is drawn behind the content (GlassBack); a shadow would show through it as a grey smear.
    glass: {
      backgroundColor: 'transparent',
      borderColor: p.dark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.75)',
      shadowOpacity: 0,
      elevation: 0,
    },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 6, borderRadius: 22 },
    pressed: { backgroundColor: p.pressed },
    texts: { flex: 1 },
    line: { color: p.text, fontSize: 15 },
    where: { color: p.tintText, fontSize: 12, marginTop: 1 },
    show: { paddingHorizontal: 10, minHeight: 36, justifyContent: 'center', borderRadius: 18, marginRight: 4 },
    showText: { color: p.tintText, fontWeight: '600', fontSize: 14 },
    stop: { width: 36, height: 36, borderRadius: 18, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' },
    stopPressed: { opacity: 0.8 },
    card: {
      width: '100%',
      maxWidth: 560,
      // At most 360; less in a short window (answerCardMaxHeight).
      maxHeight: 360,
      borderRadius: 20,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      shadowColor: '#000',
      shadowOpacity: p.dark ? 0.5 : 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 3 },
      elevation: 10,
      overflow: 'hidden',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6, paddingTop: 8 },
    cardTitle: { flex: 1, color: p.textSecondary, fontSize: 13, fontWeight: '600' },
    close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    answerScroll: { flexGrow: 0 },
    answerContent: { paddingHorizontal: 16, paddingBottom: 8 },
    answer: { color: p.text, fontSize: 15, lineHeight: 21 },
    openChat: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.separator,
      paddingHorizontal: 16,
    },
    openChatText: { color: p.tintText, fontWeight: '600', fontSize: 15 },
  });
}
