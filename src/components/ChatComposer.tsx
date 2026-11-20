import { useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, Text, TextInput, TextInputInstance, View } from 'react-native';
import type { AttachmentInfo } from '../chat/attachments';
import { signal, tick, toggle } from '../device/haptics';
import {
  abortVoiceInput,
  startVoiceInput,
  stopVoiceInput,
  warmVoice,
  useVoiceInfo,
  useVoiceLevel,
  useVoiceState,
  VoiceState,
} from '../device/voiceInput';
import { languageLabel, spokenLanguageName } from '../device/voiceLanguage';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { usePalette } from '../ui/theme';
import { useReduceMotion } from '../utils/useReduceMotion';
import { AttachmentThumb } from './AttachmentViews';
import type { QuickAction, VoiceProps } from './AssistantPanel';
import { PanelTheme, useChatStyles } from './chatStyles';
import { FINAL_WAIT_MS } from './PushToTalk';
import { useHoldGesture, useScreenReader } from './useHoldGesture';
import { VoiceLanguageSheet } from './VoiceLanguageSheet';

/**
 * The bottom of the chat panel (design record UI-29): the research switch and one-tap tasks, the files about to be
 * sent, the message field, the microphone with its listening language, and Send or Stop. Typing redraws this part and
 * the panel's frame, never the messages above it.
 */
export function ChatComposer({
  open,
  text,
  setText,
  research,
  onResearchChange,
  quickActions,
  pending,
  onAttach,
  onRemovePending,
  onOpenAttachment,
  running,
  busyElsewhere,
  voice,
  onSend,
  onStop,
  focusRequest,
  dark,
}: {
  /** The panel is on screen (the microphone is only on while it is). */
  open: boolean;
  text: string;
  setText: (text: string) => void;
  research: boolean;
  onResearchChange: (on: boolean) => void;
  quickActions: QuickAction[];
  pending: AttachmentInfo[];
  onAttach: () => void;
  onRemovePending: (id: string) => void;
  onOpenAttachment: (info: AttachmentInfo) => void;
  running: boolean;
  busyElsewhere: boolean;
  voice: VoiceProps;
  onSend: (text: string) => void;
  onStop: () => void;
  focusRequest: number;
  dark: boolean;
}) {
  const styles = useChatStyles();
  const palette = usePalette();
  const d = useContext(PanelTheme);
  const reduceMotion = useReduceMotion();
  const inputRef = useRef<TextInputInstance>(null);
  // While a task runs the input is closed (not editable, dimmed, "Qutai is working…") with only Stop left, also while
  // a confirmation waits: the dialog is answered with its own buttons, and a message can't be sent before the task
  // ends anyway. It opens again when the task ends (finished, a question with choices or free text, stopped, failed,
  // a message handed back to the input). Text already in the field stays there, dimmed, to send later.
  const busy = running;
  const voiceStateAny = useVoiceState();
  const voiceInfo = useVoiceInfo();
  // Holding the Qutai button listens too; that shows in its own bubble, not here.
  const voiceState: VoiceState = voiceInfo.owner === 'panel' ? voiceStateAny : 'idle';
  const listening = voiceState !== 'idle';
  const [languageSheet, setLanguageSheet] = useState(false);
  // Read when a voice session ends, which may be renders later.
  const latest = useRef({ running, busyElsewhere, onSend });
  useEffect(() => {
    latest.current = { running, busyElsewhere, onSend };
  });

  // The microphone is only on while the panel is on screen.
  useEffect(() => {
    if (!open) stopVoiceInput();
  }, [open]);
  useEffect(() => () => stopVoiceInput(), []);
  // The microphone closes with the input (the words heard so far stay in the field). Said once to a screen reader.
  useEffect(() => {
    if (!busy) return;
    if (voiceInfo.owner === 'panel') stopVoiceInput(false);
    if (open) AccessibilityInfo.announceForAccessibility(t('chat.inputBusy'));
    // Only on the change to busy, not when the panel opens later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // A language that isn't available here: said once when listening starts in the next one.
  const fellBackFrom = listening ? voiceInfo.fellBackFrom : null;
  const notifyVoice = voice.notify;
  useEffect(() => {
    if (fellBackFrom && voiceInfo.lang)
      notifyVoice(
        t('voice.fellBack', { wanted: spokenLanguageName(fellBackFrom), language: spokenLanguageName(voiceInfo.lang) }),
      );
  }, [fellBackFrom, voiceInfo.lang, notifyVoice]);

  // The panel opened: the microphone's start is made ready (languages, on-device or online), so tapping or holding it
  // starts listening without waiting (voiceInput.ts warmVoice; the microphone stays off).
  useEffect(() => {
    if (open) warmVoice(voice.languages());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** `hold`: the microphone is held down, so listening goes on through pauses until the finger is lifted. */
  const startListening = (draft: string, hold = false) => {
    // Bound to this conversation: if the user switches tabs, the words still land in this draft.
    const write = setText;
    void startVoiceInput({
      languages: voice.languages(),
      owner: 'panel',
      hold,
      onStarted: voice.onStarted,
      incognito: voice.incognito,
      online: voice.online,
      onOnlineChange: voice.onOnlineChange,
      draft,
      write,
      onFinal: voice.autoSend
        ? (final) => {
            const message = final.trim();
            const now = latest.current;
            // A task still running: the text stays in the field to send later.
            if (!message || now.running || now.busyElsewhere) return;
            write('');
            now.onSend(message);
          }
        : undefined,
      notify: voice.notify,
    });
  };
  const toggleVoice = () => (listening ? stopVoiceInput(false) : startListening(text));
  /**
   * Holding the microphone: listens while it is held, like holding the Qutai button in the address bar, and lifting
   * the finger stops (sent when "Send automatically after speaking" is on). Sliding away before lifting stops without
   * sending; the words stay in the field. A hold on a microphone already listening (after a tap) stops it on release.
   */
  const holdVoice = {
    start: () => {
      signal('listening');
      if (!listening) startListening(text, true);
    },
    release: (away: boolean) => stopVoiceInput(away, FINAL_WAIT_MS),
    cancel: () => stopVoiceInput(),
  };

  /** A language picked while listening: listening starts again in it, after the words heard so far. */
  const pickLanguage = (language: string | null) => {
    voice.onPick(language);
    if (!listening) return;
    abortVoiceInput();
    // The field already holds the words heard so far.
    startListening(text);
  };

  /** Typing while listening takes over: the microphone stops and the field is the user's again. */
  const changeText = (value: string) => {
    if (listening) abortVoiceInput();
    setText(value);
  };


  useEffect(() => {
    if (!focusRequest) return;
    // Wait for the slide-in animation, otherwise the keyboard opens over a moving panel.
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  const send = () => {
    const t = text.trim();
    if ((!t && !pending.length) || running || busyElsewhere) return;
    setText('');
    onSend(t);
  };
  const canSend = (!!text.trim() || pending.length > 0) && !busyElsewhere;

  return (
    <>
              {/* One row: the research switch first, then the one-tap tasks (hidden while typing or researching). */}
              {/* While a task runs the row stays (disabled) so the input doesn't move. */}
              {!busyElsewhere && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.chips}
                  contentContainerStyle={styles.chipsContent}
                >
                  <Pressable
                    onPress={() => {
                      toggle(!research);
                      onResearchChange(!research);
                    }}
                    disabled={busy}
                    style={[styles.chip, d?.chip, research && styles.chipOn, busy && styles.sendDisabled]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: research, disabled: busy }}
                    accessibilityHint={t('chat.researchHint')}
                  >
                    <Icon name="research" size={15} color={research ? '#ffffff' : palette.textSecondary} />
                    <Text style={[styles.chipText, d?.text, research && styles.chipTextOn]}>{t('chat.research')}</Text>
                  </Pressable>
                  {!research &&
                    !text.trim() &&
                    quickActions.map((action) => (
                      <Pressable
                        key={action.label}
                        onPress={() => onSend(action.prompt)}
                        disabled={busy}
                        style={({ pressed }) => [styles.chip, d?.chip, pressed && styles.pressed, busy && styles.sendDisabled]}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: busy }}
                      >
                        <Icon name={action.icon} size={15} color={palette.textSecondary} />
                        <Text style={[styles.chipText, d?.text]}>{action.label}</Text>
                      </Pressable>
                    ))}
                </ScrollView>
              )}
              {research && !running && !busyElsewhere ? (
                <Text style={styles.modeHint}>{`${t('chat.researchHint')} ${t('chat.researchNext')}`}</Text>
              ) : null}

              {pending.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.pendingRow}
                  contentContainerStyle={styles.pendingContent}
                >
                  {pending.map((a, i) => (
                    <View key={a.id}>
                      <AttachmentThumb info={a} index={i} size={56} onPress={() => onOpenAttachment(a)} />
                      {!running && (
                        <Pressable
                          onPress={() => onRemovePending(a.id)}
                          style={styles.thumbRemove}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t('attach.remove', { name: a.name })}
                        >
                          <Icon name="close" size={12} color="#ffffff" />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={[styles.inputRow, d?.inputRow]}>
                <Pressable
                  onPress={onAttach}
                  disabled={running}
                  style={[styles.attachButton, running && styles.sendDisabled]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('attach.button')}
                  accessibilityState={{ disabled: running }}
                >
                  <Icon name="attach" size={20} color={palette.textSecondary} />
                </Pressable>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, d?.input, busy && styles.inputBusy]}
                  placeholderTextColor={dark ? '#a9a8b3' : '#6b6862'}
                  value={text}
                  onChangeText={changeText}
                  // Short texts that fit beside the buttons on a narrow phone; while listening, the TR/EN tag next
                  // to the field names the language. At large text sizes the multiline field wraps it.
                  placeholder={t(
                    busy
                      ? 'chat.inputBusy'
                      : voiceState === 'preparing'
                        ? 'ptt.preparing'
                        : listening
                        ? 'voice.listening'
                        : research
                          ? 'chat.researchPlaceholder'
                          : 'chat.placeholder',
                  )}
                  multiline
                  // Android's full-screen landscape keyboard would hide the conversation; the panel keeps the field above it.
                  disableFullscreenUI
                  editable={!busy}
                  accessibilityState={{ disabled: busy }}
                  // With text kept in the field the placeholder doesn't show, so a screen reader hears why it is closed.
                  accessibilityHint={busy && text ? t('chat.inputBusy') : undefined}
                />
                {listening && voiceInfo.lang ? (
                  <Pressable
                    onPress={() => setLanguageSheet(true)}
                    hitSlop={8}
                    style={[styles.langTag, d?.langTag]}
                    accessibilityRole="button"
                    accessibilityLabel={t('voice.languageTagLabel', { language: spokenLanguageName(voiceInfo.lang) })}
                    accessibilityHint={t('voice.languageTagHint')}
                  >
                    <Text style={[styles.langTagText, d?.langTagText]}>{languageLabel(voiceInfo.lang)}</Text>
                  </Pressable>
                ) : null}
                <MicButton
                  disabled={busy}
                  state={voiceState}
                  onPress={toggleVoice}
                  hold={holdVoice}
                  onLanguage={() => setLanguageSheet(true)}
                  reduceMotion={reduceMotion}
                />
                {running ? (
                  // Stopping is always possible, also while a confirmation waits.
                  <Pressable
                    style={[styles.sendButton, styles.stopButton]}
                    onPress={() => {
                      signal('stopped');
                      onStop();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.stop')}
                  >
                    <Icon name="stop" size={16} color="#ffffff" />
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.sendButton, !canSend && styles.sendDisabled]}
                    onPress={() => {
                      if (canSend && !running) tick();
                      send();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.send')}
                  >
                    <Icon name="send" size={20} color="#ffffff" />
                  </Pressable>
                )}
              </View>
      <VoiceLanguageSheet
        visible={languageSheet}
        value={voice.picked}
        autoLabel={voice.autoLabel}
        autoHint={voice.autoHint}
        onPick={pickLanguage}
        onClose={() => setLanguageSheet(false)}
        dark={dark}
      />
    </>
  );
}

/**
 * The microphone: hold to talk and lift to stop, or tap to talk and tap again to stop (a pause also stops it). The
 * hold is the address bar's gesture (useHoldGesture.ts); with a screen reader on there is only the tap. While
 * listening it is filled, and a ring grows with the voice's loudness (still, without the ring moving, under Reduce
 * motion).
 */
function MicButton({
  state,
  onPress,
  hold,
  onLanguage,
  reduceMotion,
  disabled,
}: {
  /** While the task works: no listening (and no hold). */
  disabled: boolean;
  state: VoiceState;
  onPress: () => void;
  hold: { start: () => void; release: (away: boolean) => void; cancel: () => void };
  /** Opens the listening-language picker (a screen reader's action; the TR/EN tag while listening). */
  onLanguage: () => void;
  reduceMotion: boolean;
}) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const level = useVoiceLevel();
  const screenReader = useScreenReader();
  const [scale] = useState(() => new Animated.Value(1));
  const away = useRef(false);
  const gesture = useHoldGesture(!screenReader && !disabled, {
    start: () => {
      away.current = false;
      hold.start();
    },
    move: (far) => {
      away.current = far;
      tick();
    },
    release: () => hold.release(away.current),
    cancel: hold.cancel,
  });
  const on = state === 'listening';
  useEffect(() => {
    Animated.timing(scale, {
      toValue: on && !reduceMotion ? 1 + level * 0.45 : 1,
      duration: reduceMotion ? 0 : 110,
      useNativeDriver: true,
    }).start();
  }, [on, level, reduceMotion, scale]);
  const active = state !== 'idle';
  return (
    <View {...gesture.touch}>
      <Pressable
        onPress={() => {
          // The lift that ends a hold is not a tap.
          if (gesture.held()) return;
          gesture.clear();
          onPress();
        }}
        disabled={disabled}
        // Once holding, nothing else can take the touch away.
        cancelable={!gesture.holding}
        // 40pt drawn, 44pt to touch.
        hitSlop={2}
        style={styles.micWrap}
        accessibilityRole="button"
        accessibilityLabel={t(active ? 'voice.stop' : 'voice.start')}
        accessibilityHint={active ? undefined : t(screenReader ? 'voice.startHint' : 'voice.holdHint')}
        accessibilityState={{ busy: state === 'preparing' || state === 'stopping', selected: active, disabled }}
        accessibilityActions={[{ name: 'longpress', label: t('voice.languageTitle') }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLanguage();
        }}
      >
        {on ? <Animated.View style={[styles.micRing, { transform: [{ scale }] }]} /> : null}
        <View
          style={[
            styles.micButton,
            d?.micButton,
            active && styles.micOn,
            !on && active && styles.micPending,
            disabled && styles.sendDisabled,
          ]}
        >
          <Icon name="microphone" size={19} color={active ? '#ffffff' : palette.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
}
