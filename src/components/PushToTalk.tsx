import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signal, tick } from '../device/haptics';
import { dialogState } from './Dialog';
import {
  abortVoiceInput,
  hasVoiceSession,
  isListening,
  warmVoice,
  startVoiceInput,
  stopVoiceInput,
  useVoiceInfo,
  useVoiceLevel,
  VoiceOnline,
  VoiceResult,
} from '../device/voiceInput';
import { languageLabel, spokenLanguageName } from '../device/voiceLanguage';
import { t } from '../i18n';
import { ListeningLook } from './AssistantGlass';
import { useReduceMotion } from '../utils/useReduceMotion';
import { radii } from '../ui/theme';

/**
 * Push-to-talk on the Qutai button: hold it, speak, lift the finger, and the words go to the conversation of the tab
 * on screen as a message, without opening the panel. The gesture is in AssistantButton.tsx; this is what it drives.
 *
 *   idle ──press──▶ (button waits HOLD_TO_TALK_MS; moving more than HOLD_SLOP first makes it a tap or a swipe)
 *        ──held───▶ preparing  haptic signal (vibrator, also with the phone's touch feedback off); a task already running → busy (nothing recorded)
 *   preparing ──recogniser started──▶ listening (live transcript, language tag)
 *   preparing/listening ──finger moves past CANCEL_DISTANCE──▶ same, "Release to cancel" (tick); back inside: tick
 *   listening ──lift──▶ finishing: waits up to FINAL_WAIT_MS for the final result
 *   finishing ──text──▶ sent (light haptic; the step strip that follows is the confirmation) · ──nothing / only noise──▶ nothing (bubble says so)
 *   any ──lift while "Release to cancel"──▶ cancelled · ──interruption (app left, call, dialog, permission prompt,
 *        touch taken by the system)──▶ stopped, nothing sent
 *   preparing ──permission or online-service question needed──▶ the question instead of listening (idle after)
 * With a screen reader on, the same session is driven by the button's custom actions (Start voice message / Send /
 * Cancel) and the bubble shows Send and Cancel buttons.
 */

/**
 * The finger stays down this long before listening starts: Android's own long-press time (400 ms on current
 * versions). Everything listening needs is made ready while it runs (warmVoice on touch-down).
 */
export const HOLD_TO_TALK_MS = 400;
/** Movement allowed while waiting for the hold (a slightly shaky finger still counts). */
export const HOLD_SLOP = 16;
/** Sliding this far from where the finger went down turns the release into a cancel. */
export const CANCEL_DISTANCE = 80;
/** After the finger is lifted, the recogniser gets this long to deliver its final result. */
export const FINAL_WAIT_MS = 1000;
/** A hold longer than this ends as if the finger were lifted. */
const MAX_HOLD_MS = 60_000;
/** How long an outcome stays in the bubble (nothing heard, stopped). */
const NOTICE_MS = 1800;
/** "Busy" stays longer: it has a button. */
const BUSY_MS = 4000;

/** The button's rectangle in the window, which the bubble is placed next to. */
export type Anchor = { x: number; y: number; width: number; height: number };

export type Phase = 'idle' | 'preparing' | 'listening' | 'finishing' | 'ready' | 'nothing' | 'busy' | 'stopped';

export type Bubble = {
  phase: Phase;
  anchor: Anchor | null;
  transcript: string;
  /** The finger is far enough away that lifting it cancels. */
  cancelling: boolean;
  /** Started from a screen reader's action: no finger, Send and Cancel buttons instead. */
  viaA11y: boolean;
  /** An error from the recogniser, for the 'stopped' phase. */
  message: string | null;
};

const IDLE: Bubble = {
  phase: 'idle',
  anchor: null,
  transcript: '',
  cancelling: false,
  viaA11y: false,
  message: null,
};

/** What the button calls. */
export type HoldHandlers = {
  /** A press began (it may become a hold): the recogniser's languages and the plan are worked out ahead. */
  pressIn: () => void;
  start: (anchor: Anchor, viaA11y?: boolean) => void;
  /** While held: whether the finger is now far enough away to cancel. */
  move: (away: boolean) => void;
  release: () => void;
  /** The touch was taken away (system gesture, a window on top): nothing is sent. */
  cancel: () => void;
};

export type PushToTalkDeps = {
  /** A task is running in any conversation (one at a time): nothing is recorded or sent. */
  busy: () => boolean;
  /** Sends like a typed message, to the conversation on screen. */
  send: (text: string) => void;
  /** The languages to listen in for the conversation on screen, best first. */
  languages: () => string[];
  /** The conversation on screen is incognito (on-device recognition only). */
  incognito: () => boolean;
  online: VoiceOnline;
  onOnlineChange: (online: VoiceOnline) => void;
  onStarted: (lang: string) => void;
};

/** Speech that is only punctuation or nothing at all is never sent. */
const hasWords = (text: string) => /[\p{L}\p{N}]/u.test(text);

export function usePushToTalk(deps: PushToTalkDeps): { handlers: HoldHandlers; bubble: Bubble; dismiss: () => void } {
  const [bubble, setBubble] = useState<Bubble>(IDLE);
  /** `release`, for the timer that ends a very long hold (defined after `start`). */
  const releaseRef = useRef<() => void>(() => {});
  const latest = useRef(deps);
  useEffect(() => {
    latest.current = deps;
  });
  // The gesture's own state, read in callbacks that outlive renders.
  const g = useRef({
    /** The current hold, so callbacks of an older one are ignored. */
    id: 0,
    phase: 'idle' as Phase,
    released: false,
    cancelling: false,
    /** Cancelled or interrupted: whatever ends the session is thrown away. */
    discard: false,
    /** The session ended while the finger was still down: sent on release. */
    pending: null as string | null,
    hideTimer: null as ReturnType<typeof setTimeout> | null,
    maxTimer: null as ReturnType<typeof setTimeout> | null,
  });

  const update = useCallback((patch: Partial<Bubble>) => {
    if (patch.phase) g.current.phase = patch.phase;
    setBubble((b) => ({ ...b, ...patch }));
  }, []);

  const clearTimers = () => {
    const s = g.current;
    if (s.hideTimer) clearTimeout(s.hideTimer);
    if (s.maxTimer) clearTimeout(s.maxTimer);
    s.hideTimer = s.maxTimer = null;
  };

  const hide = useCallback(() => {
    clearTimers();
    g.current.phase = 'idle';
    setBubble(IDLE);
  }, []);

  /** An outcome that stays briefly, then the bubble goes. */
  const linger = useCallback(
    (patch: Partial<Bubble>, ms: number) => {
      clearTimers();
      update({ ...patch, cancelling: false });
      g.current.hideTimer = setTimeout(hide, ms);
    },
    [hide, update],
  );

  const deliver = useCallback(
    (raw: string) => {
      const text = raw.trim();
      const d = latest.current;
      if (!text || !hasWords(text)) {
        AccessibilityInfo.announceForAccessibility(t('ptt.nothingHeard'));
        return linger({ phase: 'nothing' }, NOTICE_MS);
      }
      // A task started meanwhile: never queued behind it without the user knowing.
      if (d.busy()) {
        AccessibilityInfo.announceForAccessibility(t('ptt.busy'));
        return linger({ phase: 'busy' }, BUSY_MS);
      }
      hide();
      d.send(text);
      signal('sent');
      AccessibilityInfo.announceForAccessibility(t('ptt.sentA11y'));
    },
    [hide, linger],
  );

  const onEnd = useCallback(
    (id: number, result: VoiceResult) => {
      const s = g.current;
      if (id !== s.id) return;
      if (s.discard) return;
      if (result.interrupted) {
        AccessibilityInfo.announceForAccessibility(t('ptt.stopped'));
        return linger({ phase: 'stopped', message: null }, NOTICE_MS);
      }
      if (!s.released) {
        // It ended by itself with the finger still down (an error, or a long silence on older Android).
        if (result.text && hasWords(result.text)) {
          s.pending = result.text;
          return update({ phase: 'ready', transcript: result.text });
        }
        return update({ phase: 'nothing' });
      }
      deliver(result.text);
    },
    [deliver, linger, update],
  );

  const start = useCallback(
    (anchor: Anchor, viaA11y = false) => {
      const d = latest.current;
      const s = g.current;
      // The panel's microphone is already on: that session is the user's, the hold does nothing.
      if (isListening()) return;
      clearTimers();
      s.id += 1;
      const id = s.id;
      s.released = false;
      s.cancelling = false;
      s.discard = false;
      s.pending = null;
      signal('listening');
      setBubble({ ...IDLE, anchor, viaA11y, phase: 'preparing' });
      s.phase = 'preparing';
      if (d.busy()) {
        AccessibilityInfo.announceForAccessibility(t('ptt.busy'));
        update({ phase: 'busy' });
        return;
      }
      s.maxTimer = setTimeout(() => {
        if (s.id === id && !s.released) releaseRef.current();
      }, MAX_HOLD_MS);
      let message: string | null = null;
      void startVoiceInput({
        languages: d.languages(),
        owner: 'hold',
        hold: true,
        incognito: d.incognito(),
        online: d.online,
        onOnlineChange: d.onOnlineChange,
        draft: '',
        write: (text) => {
          if (s.id === id) setBubble((b) => ({ ...b, transcript: text }));
        },
        notify: (m) => {
          message = m;
        },
        onStarted: (lang) => {
          if (s.id !== id) return;
          latest.current.onStarted(lang);
          if (s.phase === 'preparing') update({ phase: 'listening' });
          AccessibilityInfo.announceForAccessibility(
            t(viaA11y ? 'ptt.a11yListening' : 'voice.listeningIn', { language: spokenLanguageName(lang) }),
          );
        },
        onEnd: (result) => {
          if (s.id !== id) return;
          if (!result.text && result.failed && message && message !== t('voice.error.noSpeech') && !s.discard) {
            return linger({ phase: 'stopped', message }, NOTICE_MS);
          }
          onEnd(id, result);
        },
      }).then((started) => {
        // Not started: a question was asked instead (permission, online service), it was released first, or an
        // error was shown. Nothing to show any more.
        if (s.id !== id || started) return;
        if (s.phase === 'finishing') linger({ phase: 'nothing' }, NOTICE_MS);
        else if (s.phase === 'preparing') hide();
      });
    },
    [hide, linger, onEnd, update],
  );

  const release = useCallback(() => {
    const s = g.current;
    if (s.released) return;
    s.released = true;
    if (s.maxTimer) clearTimeout(s.maxTimer);
    s.maxTimer = null;
    switch (s.phase) {
      case 'busy':
        return linger({ phase: 'busy' }, BUSY_MS);
      case 'nothing':
        return linger({ phase: 'nothing' }, NOTICE_MS);
      case 'ready':
        return deliver(s.pending ?? '');
      case 'preparing':
      case 'listening':
        if (s.cancelling) {
          s.discard = true;
          abortVoiceInput();
          AccessibilityInfo.announceForAccessibility(t('ptt.cancelled'));
          return hide();
        }
        if (!hasVoiceSession()) {
          // Lifted while still preparing (or while a question is up): nothing was recorded.
          stopVoiceInput(false, FINAL_WAIT_MS);
          if (dialogState.isOpen()) return hide();
          return linger({ phase: 'nothing' }, NOTICE_MS);
        }
        update({ phase: 'finishing', cancelling: false });
        AccessibilityInfo.announceForAccessibility(t('ptt.finishing'));
        // Lifted before the recogniser said it started: stopping it ends it, and "nothing heard" follows.
        stopVoiceInput(false, FINAL_WAIT_MS);
        return;
      default:
        return;
    }
  }, [deliver, hide, linger, update]);

  const cancel = useCallback(() => {
    const s = g.current;
    if (s.phase === 'idle' || s.released) return;
    s.released = true;
    s.discard = true;
    abortVoiceInput();
    hide();
  }, [hide]);

  const move = useCallback(
    (away: boolean) => {
      const s = g.current;
      if (s.released || s.cancelling === away) return;
      if (s.phase !== 'preparing' && s.phase !== 'listening') return;
      s.cancelling = away;
      tick();
      update({ cancelling: away });
    },
    [update],
  );

  // A question asked before listening (the online speech service, a language download, an error) replaces the hold:
  // the bubble steps aside, and whatever follows is not this hold's. (Once listening, a dialog stops the microphone
  // in voiceInput.ts and the bubble says nothing was sent.)
  useEffect(
    () =>
      dialogState.subscribe(() => {
        const s = g.current;
        if (!dialogState.isOpen() || hasVoiceSession()) return;
        if (s.phase !== 'preparing' && s.phase !== 'finishing' && s.phase !== 'nothing') return;
        s.discard = true;
        hide();
      }),
    [hide],
  );
  // A system prompt (the microphone permission) or leaving the app while still preparing: nothing was recorded, and
  // the bubble goes. (While listening, voiceInput.ts stops the microphone and the bubble says nothing was sent.)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const s = g.current;
      if (next === 'active' || hasVoiceSession()) return;
      if (s.phase !== 'preparing' && s.phase !== 'finishing' && s.phase !== 'nothing') return;
      s.discard = true;
      hide();
    });
    return () => sub.remove();
  }, [hide]);
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    releaseRef.current = release;
  }, [release]);

  const handlers = useMemo<HoldHandlers>(
    () => ({ pressIn: () => warmVoice(latest.current.languages(), true), start, move, release, cancel }),
    [start, move, release, cancel],
  );
  return { handlers, bubble, dismiss: hide };
}

/**
 * The bubble next to the Qutai button while holding it: a listening indicator, the language tag, and the live
 * transcript, so what will be sent is always visible before the finger is lifted. Above the button when the address
 * bar is at the bottom, below and to its left when at the top (where the finger comes from below), inside the safe area.
 */
export function PushToTalkBubble({
  bubble,
  barAtBottom,
  onOpenPanel,
  onSend,
  onCancel,
  onDismiss,
}: {
  bubble: Bubble;
  barAtBottom: boolean;
  onOpenPanel: () => void;
  onSend: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const info = useVoiceInfo();
  const level = useVoiceLevel();
  const [opacity] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));
  const visible = bubble.phase !== 'idle' && bubble.anchor !== null;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : 120,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity, reduceMotion]);
  const listening = bubble.phase === 'listening';
  useEffect(() => {
    Animated.timing(pulse, {
      toValue: listening && !reduceMotion ? 1 + level * 0.8 : 1,
      duration: reduceMotion ? 0 : 110,
      useNativeDriver: true,
    }).start();
  }, [listening, level, reduceMotion, pulse]);

  const ownLang = info.owner === 'hold' ? info.lang : null;
  const fellBackFrom = info.owner === 'hold' ? info.fellBackFrom : null;
  const status =
    bubble.cancelling && (bubble.phase === 'listening' || bubble.phase === 'preparing')
      ? t('ptt.releaseToCancel')
      : bubble.phase === 'preparing'
        ? t('ptt.preparing')
        : bubble.phase === 'listening'
          ? bubble.viaA11y
            ? t('voice.listening')
            : t('ptt.listening')
          : bubble.phase === 'finishing'
            ? t('ptt.finishing')
            : bubble.phase === 'ready'
              ? t('ptt.ready')
              : bubble.phase === 'nothing'
                ? t('ptt.nothingHeard')
                : bubble.phase === 'busy'
                  ? t('ptt.busy')
                  : (bubble.message ?? t('ptt.stopped'));
  const withButtons =
    bubble.phase === 'busy' ||
    (bubble.viaA11y && (bubble.phase === 'preparing' || bubble.phase === 'listening' || bubble.phase === 'ready'));
  const recording = bubble.phase === 'preparing' || bubble.phase === 'listening' || bubble.phase === 'finishing';

  // The light curtain shows everything that has no buttons (those stay in the bubble: busy, a screen reader's Send/Cancel).
  if (!(visible && withButtons)) {
    return (
      <ListeningLook
        show={visible}
        barAtBottom={barAtBottom}
        level={listening ? level : 0}
        status={status}
        transcript={bubble.phase === 'nothing' ? '' : bubble.transcript}
        tag={ownLang && recording ? languageLabel(ownLang) : null}
        note={
          fellBackFrom && ownLang && recording
            ? t('voice.fellBack', { wanted: spokenLanguageName(fellBackFrom), language: spokenLanguageName(ownLang) })
            : null
        }
        cancelling={bubble.cancelling && (bubble.phase === 'listening' || bubble.phase === 'preparing')}
        waiting={bubble.phase === 'preparing'}
      />
    );
  }
  if (!visible || !bubble.anchor) return null;
  const a = bubble.anchor;
  const bubbleWidth = Math.min(320, width - 32);
  const GAP = 10;
  // Bottom bar: above the button, its right edge on the button's. Top bar: below, ending left of the button, so the
  // thumb on the button doesn't cover it.
  const right = Math.max(insets.right + 8, barAtBottom ? width - (a.x + a.width) : width - a.x + 4);
  const position = barAtBottom
    ? { bottom: Math.max(insets.bottom + 8, height - a.y + GAP) }
    : { top: Math.max(insets.top + 8, a.y + a.height + GAP) };

  return (
    <Animated.View
      pointerEvents={withButtons ? 'box-none' : 'none'}
      style={[
        styles.bubble,
        bubble.cancelling && styles.cancelling,
        { width: bubbleWidth, right, opacity },
        position,
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.header}>
        {recording ? (
          <Animated.View
            style={[styles.dot, bubble.phase !== 'listening' && styles.dotWaiting, { transform: [{ scale: pulse }] }]}
          />
        ) : null}
        <Text style={styles.status} numberOfLines={2}>
          {status}
        </Text>
        {ownLang && recording ? (
          <View
            style={styles.tag}
            accessible
            accessibilityLabel={t('voice.languageTagLabel', { language: spokenLanguageName(ownLang) })}
          >
            <Text style={styles.tagText}>{languageLabel(ownLang)}</Text>
          </View>
        ) : null}
      </View>
      {bubble.transcript && bubble.phase !== 'nothing' ? (
        <Text style={styles.transcript} numberOfLines={4} ellipsizeMode="head">
          {bubble.transcript}
        </Text>
      ) : null}
      {fellBackFrom && ownLang && recording ? (
        <Text style={styles.note}>
          {t('voice.fellBack', { wanted: spokenLanguageName(fellBackFrom), language: spokenLanguageName(ownLang) })}
        </Text>
      ) : null}
      {withButtons ? (
        <View style={styles.buttons}>
          {bubble.phase === 'busy' ? (
            <>
              <BubbleButton label={t('common.close')} onPress={onDismiss} />
              <BubbleButton
                label={t('ptt.open')}
                primary
                onPress={() => {
                  onDismiss();
                  onOpenPanel();
                }}
              />
            </>
          ) : (
            <>
              <BubbleButton label={t('common.cancel')} onPress={onCancel} />
              <BubbleButton label={t('common.send')} primary onPress={onSend} />
            </>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

function BubbleButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, primary && styles.primary]}>{label}</Text>
    </Pressable>
  );
}

// One look in every theme, like the toast: dark and translucent over any page.
const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    zIndex: 50,
    elevation: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.popover,
    backgroundColor: 'rgba(30,30,30,0.94)',
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  cancelling: { backgroundColor: 'rgba(150,32,32,0.95)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff5a5a' },
  dotWaiting: { opacity: 0.5 },
  status: { flex: 1, color: '#ffffff', fontSize: 14, fontWeight: '600' },
  tag: {
    minWidth: 28,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  transcript: { color: '#f2f1f5', fontSize: 15, lineHeight: 20 },
  note: { color: '#c9c8d0', fontSize: 12 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 2 },
  button: { paddingVertical: 4, paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  buttonText: { color: '#d8d7de', fontSize: 14, fontWeight: '600' },
  primary: { color: '#8ab4f8' },
});
