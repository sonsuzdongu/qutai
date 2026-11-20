import { ComponentRef, ReactNode, RefObject, useEffect, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Pressable,
  ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { plainError } from '../ai/plainError';
import { getProvider } from '../ai/providers';
import type { MemoryCategory } from '../agent/memory';
import { speak, stopSpeaking } from '../device/speech';
import { spokenLanguageName } from '../device/voiceLanguage';
import {
  abortVoiceInput,
  startVoiceInput,
  stopVoiceInput,
  useVoiceInfo,
  useVoiceLevel,
  useVoiceState,
  type VoiceOnline,
} from '../device/voiceInput';
import { getLanguage, MessageKey, t } from '../i18n';
import { answersTurn, ExtractionError, MAX_TRANSCRIPT_CHARS, transcriptTurn } from '../intro/extract';
import { canSubmit, finalExtraction, hasBack, introReducer, leavesFlow, pendingAnswers, START, type FlowState } from '../intro/flow';
import type { FollowUp, FollowUpAnswer } from '../intro/followUps';
import { FillFromLocation } from './FillFromLocation';
import { introWrites, reviewRows, withReplacements, withStyleLine, type ReviewRow } from '../intro/items';
import { understand, type IntroTarget } from '../intro/request';
import { getDb } from '../storage/db';
import { addMemory, deleteMemory, listMemories, updateMemory } from '../storage/memory';
import { GradientButton } from '../ui/BrandGradient';
import { Icon, type IconName } from '../ui/Icon';
import { isShort } from '../ui/layout';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { useReduceMotion } from '../utils/useReduceMotion';
import { dialog } from './Dialog';
import { KeyboardAwareScrollView } from './KeyboardAware';
import { CATEGORY_ICONS } from './memoryCategories';
import { memoryErrorText } from './memoryError';
import { reportStorageFailure } from '../storage/failures';

/**
 * "Tell me about yourself": the start of setup's "Let me get to know you a little" step and of
 * Settings › Assistant › Memory › "Introduce yourself" (docs/voice-introduction.md). It opens on three choices: speak
 * (only then the large microphone shows), type, or "Ask me questions" (the four fixed questions one at a time, answered
 * by a chip, typing or voice, then the same review). The user talks or types freely;
 * one request to their AI turns it into notes (src/intro/), Qutai asks at most three fixed follow-up questions, and
 * the user checks every note before anything is saved. The typed questions (ProfileQuestions) are the alternative
 * and the way out of every failure; ProfileStep switches between the two.
 *
 * Voice input is the panel's own (device/voiceInput.ts: its language order, the one-time question about the phone's
 * online speech service, its errors). The flow itself is a pure reducer (intro/flow.ts).
 */

export type IntroVoice = {
  /** Languages to listen in, best first. */
  languages: string[];
  online: VoiceOnline;
  onOnlineChange: (online: VoiceOnline) => void;
  /** Listening started in this language (remembered as the last one used). */
  onStarted?: (lang: string) => void;
};

type Props = {
  /** The AI to understand with; null when none is set up (the questions are offered instead). */
  ai: IntroTarget | null;
  voice: IntroVoice;
  /** Updates the custom instructions (the answer-style line). */
  onInstructions: (update: (current: string) => string) => void;
  /** Left the flow: to the typed questions (with what was said), skipped, or finished. */
  onExit: (to: 'typed' | 'skip' | 'done', transcript: string) => void;
  /** Page changes blur out and in, as setup's steps do (absent on the Memory screen). */
  transition?: (change: () => void) => void;
  /** This flow's back step for the screen around it (false: at its start). */
  registerBack: (handler: (() => boolean) | null) => void;
};

const STYLE_LINES = () => [t('profile.style.shortLine'), t('profile.style.detailedLine')];

export function VoiceIntro({ ai, voice, onInstructions, onExit, transition, registerBack }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [state, dispatchRaw] = useReducer(introReducer, START);
  const phase = state.phase;
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [readAloud, setReadAloud] = useState(false);
  const voiceState = useVoiceState();
  const voiceInfo = useVoiceInfo();
  const ownsMicrophone = voiceInfo.owner === 'intro' && voiceState !== 'idle';
  const ownsRef = useRef(false);
  useEffect(() => {
    ownsRef.current = ownsMicrophone;
  }, [ownsMicrophone]);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  /**
   * A change of page the user made blurs like setup's steps; every change of page starts at the top. `page`: 'user'
   * (a tap: blurred), 'result' (a request or save finished: never through the blur, which ignores changes while it
   * runs), 'none' (the same page).
   */
  const dispatch = (event: Parameters<typeof introReducer>[1], page: 'user' | 'result' | 'none' = 'user') => {
    const change = () => {
      dispatchRaw(event);
      if (page !== 'none') scrollRef.current?.scrollTo({ y: 0, animated: false });
    };
    // Leaving the flow: the screen around changes the page (and blurs); a blur here would swallow that change.
    if (page === 'user' && transition && !leavesFlow(event)) transition(change);
    else change();
  };

  // Leaving the flow: once per exit, with the latest callback.
  const exitRef = useRef(onExit);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);
  useEffect(() => {
    if (phase.name === 'exit') exitRef.current(phase.to, state.transcript);
    // The phase object changes only on a real change, so this runs once per exit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // The request reads the AI at the time it starts; the screen around may hand over a new object on every render.
  const aiRef = useRef(ai);
  useEffect(() => {
    aiRef.current = ai;
  }, [ai]);

  // The microphone and read-aloud never outlive the screen.
  useEffect(
    () => () => {
      if (ownsRef.current) stopVoiceInput();
      void stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    registerBack(() => {
      if (ownsMicrophone) {
        stopVoiceInput(false);
        return true;
      }
      if (!hasBack(state)) return false;
      dispatch({ type: 'back' });
      return true;
    });
    return () => registerBack(null);
  });

  // ---- Listening ----
  const listen = (
    draft: string,
    write: (text: string) => void,
    continuous: boolean,
    onEnd?: (text: string, started: boolean) => void,
  ) => {
    setVoiceNotice(null);
    void startVoiceInput({
      languages: voice.languages,
      owner: 'intro',
      continuous,
      incognito: false,
      online: voice.online,
      onOnlineChange: voice.onOnlineChange,
      onStarted: voice.onStarted,
      draft,
      write,
      notify: setVoiceNotice,
      onEnd: (result) => onEnd?.(result.text ? joinText(draft, result.text) : draft, true),
    }).then((started) => {
      // Not started (refused, unavailable, a question answered "no"; voice input said why): what was there stays.
      if (!started) onEnd?.(draft, false);
    });
  };

  const speakIntro = () => {
    const draft = phase.name === 'transcript' ? state.transcript : '';
    dispatch({ type: 'speak' }, 'none');
    listen(
      draft,
      (text) => dispatchRaw({ type: 'heard', text }),
      true,
      (text, started) => dispatchRaw({ type: 'voiceEnded', text, started }),
    );
  };

  // ---- Understanding ----
  useEffect(() => {
    const ai = aiRef.current;
    if (phase.name !== 'understanding' || !ai) return;
    const controller = new AbortController();
    const round = phase.round;
    const pending = pendingAnswers(state);
    const text =
      round === 1
        ? transcriptTurn(state.transcript)
        : answersTurn(pending.map((p) => ({ about: p.question.about, text: p.text })));
    const quotes = round === 1 ? text : pending.map((p) => p.text).join('\n');
    AccessibilityInfo.announceForAccessibility(t(round === 1 ? 'voiceIntro.understanding' : 'voiceIntro.understandingAnswers'));
    understand(ai, text, getLanguage(), controller.signal, getProvider(ai.provider), quotes)
      .then((result) => {
        if (!controller.signal.aborted) dispatch({ type: 'understood', result }, 'result');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ExtractionError) dispatch({ type: 'failed', reason: 'unreadable' }, 'result');
        else
          dispatch(
            { type: 'failed', reason: 'request', detail: plainError(e, { credits: ai.provider === 'qutai' }).message },
            'result',
          );
      });
    return () => controller.abort();
    // Only a new round starts a request (its inputs are fixed while it runs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name === 'understanding' ? phase.round : 0]);

  // ---- Review rows: made when the review page opens, edited there ----
  // Built once per arrival at the review page (each arrival is a new phase object); edits are kept until it is left.
  const [rowsFor, setRowsFor] = useState<FlowState['phase'] | null>(null);
  if (phase.name === 'review' && rowsFor !== phase) {
    setRowsFor(phase);
    setRows(reviewRows(finalExtraction(state, t).items, t));
  }
  // Then which earlier notes each one-value row replaces (read from memory, so a moment later).
  useEffect(() => {
    if (!rowsFor || rowsFor.name !== 'review') return;
    let live = true;
    getDb()
      .then(listMemories)
      .then((memories) => {
        if (live) setRows((current) => withReplacements(current, memories, t));
      })
      .catch((e) => reportStorageFailure('voiceIntro.memories', e, 'record'));
    return () => {
      live = false;
    };
  }, [rowsFor]);

  const save = async () => {
    dispatch({ type: 'save' }, 'none');
    const db = await getDb();
    let count = 0;
    const problems: string[] = [];
    for (const write of introWrites(rows, t)) {
      if (write.kind === 'instruction') {
        onInstructions((current) => withStyleLine(current, write.line, STYLE_LINES()));
        count++;
        continue;
      }
      try {
        if (write.replace?.length) {
          // The earlier note of this kind takes the new text (a hidden one stays hidden); any others of the kind go.
          const [first, ...rest] = write.replace;
          await updateMemory(db, first, write.text, write.category, write.hidden);
          for (const id of rest) await deleteMemory(db, id);
        } else {
          await addMemory(db, write.text, write.category, write.hidden);
        }
        count++;
      } catch (e) {
        problems.push(t('voiceIntro.notSaved', { text: write.text, reason: memoryErrorText(e) }));
      }
    }
    dispatch({ type: 'saved', count }, 'result');
    if (problems.length) dialog.alert(t('memory.saveFailed'), problems.join('\n\n'));
  };

  // ---- Follow-ups: read aloud when the speaker is on; a screen reader moves to each new question ----
  const questionRef = useRef<ComponentRef<typeof Text>>(null);
  const followIndex = phase.name === 'followUp' ? phase.index : -1;
  useEffect(() => {
    if (followIndex < 0) {
      void stopSpeaking();
      return;
    }
    const question = t(state.questions[followIndex].question);
    if (readAloud) void speak(question, getLanguage());
    // The earlier questions and answers stay above as a conversation; the current one is at the bottom, so the page
    // follows it (with five questions it was pushed out of view). After the page change's own scroll to the top.
    const scroll = setTimeout(() => {
      if (followIndex > 0) scrollRef.current?.scrollToEnd({ animated: false });
    }, 60);
    const timer = setTimeout(() => {
      const node = questionRef.current && findNodeHandle(questionRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 400);
    return () => {
      clearTimeout(timer);
      clearTimeout(scroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followIndex]);

  const stop = () => stopVoiceInput(false);

  // ---- Footer ----
  let footer: ReactNode = null;
  switch (phase.name) {
    case 'choose':
      footer = (
        <Footer>
          <Secondary label={t('profile.skipAll')} onPress={() => dispatch({ type: 'skipAll' })} />
        </Footer>
      );
      break;
    case 'intro':
      footer = (
        <Footer>
          {ai && <Secondary label={t('voiceIntro.typeInstead')} icon="keyboard" onPress={() => dispatch({ type: 'typeInstead' })} />}
          <Secondary label={t('profile.skipAll')} onPress={() => dispatch({ type: 'skipAll' })} />
        </Footer>
      );
      break;
    case 'listening':
      footer = (
        <Footer>
          <Primary label={t('voice.stop')} onPress={stop} />
        </Footer>
      );
      break;
    case 'transcript':
      footer = (
        <Footer>
          <Primary
            label={t('onboarding.continue')}
            disabled={!canSubmit(state)}
            onPress={() => dispatch({ type: 'submit', hasAi: !!ai })}
          />
          <Secondary label={t('voiceIntro.questionsInstead')} onPress={() => dispatch({ type: 'questionsInstead' })} />
        </Footer>
      );
      break;
    case 'understanding':
      footer = (
        <Footer>
          <Secondary label={t('common.cancel')} onPress={() => dispatch({ type: 'cancel' })} />
        </Footer>
      );
      break;
    case 'followUp': {
      const answer = state.answers[phase.index];
      const answered = !!answer && (answer.chips.length > 0 || !!answer.text.trim());
      footer = (
        <Footer>
          <Primary
            label={t(answered ? 'onboarding.continue' : 'profile.skip')}
            onPress={() => {
              if (ownsMicrophone) abortVoiceInput();
              dispatch({ type: answered ? 'next' : 'skipQuestion' });
            }}
          />
        </Footer>
      );
      break;
    }
    case 'review':
      footer = (
        <Footer>
          {rows.length > 0 ? (
            <Primary label={t('common.save')} onPress={() => void save()} />
          ) : (
            <Primary label={t('common.done')} onPress={() => dispatch({ type: 'done' })} />
          )}
        </Footer>
      );
      break;
    case 'saving':
      footer = (
        <Footer>
          <Primary label={t('common.save')} disabled onPress={() => {}} />
        </Footer>
      );
      break;
    case 'saved':
      footer = (
        <Footer>
          <Primary label={t('common.done')} onPress={() => dispatch({ type: 'done' })} />
        </Footer>
      );
      break;
    case 'failed':
      footer = (
        <Footer>
          <Primary label={t('voiceIntro.continueQuestions')} onPress={() => dispatch({ type: 'questionsInstead' })} />
          {phase.reason !== 'noAi' && <Secondary label={t('voiceIntro.tryAgain')} onPress={() => dispatch({ type: 'retry' })} />}
        </Footer>
      );
      break;
  }

  return (
    <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={styles.content} footer={footer}>
      {phase.name === 'choose' && (
        <ChoosePage
          ai={!!ai}
          credits={ai?.provider === 'qutai'}
          onSpeak={() => dispatch({ type: 'chooseSpeak' })}
          onType={() => dispatch({ type: 'typeInstead' })}
          onAsk={() => dispatch({ type: 'askMe', hasAi: !!ai })}
        />
      )}

      {phase.name === 'intro' && (
        <IntroPage ai={!!ai} credits={ai?.provider === 'qutai'} onSpeak={speakIntro} notice={state.notice === 'noSpeech' ? t('voice.error.noSpeech') : voiceNotice} />
      )}

      {phase.name === 'listening' && (
        <>
          <Title>{t('voiceIntro.title')}</Title>
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {voiceInfo.lang ? t('voice.listeningIn', { language: spokenLanguageName(voiceInfo.lang) }) : t('ptt.preparing')}
          </Text>
          <MicButton active onPress={stop} label={t('voice.stop')} />
          <Text style={styles.hint}>{t('voiceIntro.listeningHint')}</Text>
          {!!state.transcript && (
            <View style={styles.card}>
              <Text style={styles.transcriptLive}>{state.transcript}</Text>
            </View>
          )}
        </>
      )}

      {phase.name === 'transcript' && (
        <>
          <Title>{t(state.typing ? 'voiceIntro.title' : 'voiceIntro.transcriptTitle')}</Title>
          <Text style={styles.lead}>{t(state.typing ? 'voiceIntro.typeHint' : 'voiceIntro.transcriptHint')}</Text>
          <TextInput
            style={styles.transcriptInput}
            value={state.transcript}
            onChangeText={(text) => dispatch({ type: 'edit', text }, 'none')}
            placeholder={t('voiceIntro.placeholder')}
            placeholderTextColor={palette.textSecondary}
            accessibilityLabel={t('voiceIntro.transcriptLabel')}
            autoFocus={state.typing && !state.transcript}
            multiline
            maxLength={MAX_TRANSCRIPT_CHARS}
            textAlignVertical="top"
            autoCapitalize="sentences"
          />
          {!!(state.notice === 'noSpeech' || voiceNotice) && (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {state.notice === 'noSpeech' ? t('voice.error.noSpeech') : voiceNotice}
            </Text>
          )}
          <View style={styles.row}>
            {ai && (
              <Pressable
                onPress={speakIntro}
                style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Icon name="microphone" size={18} color={palette.tintText} />
                <Text style={styles.outlineText}>{t('voiceIntro.speakMore')}</Text>
              </Pressable>
            )}
            {!!state.transcript && (
              <Pressable
                onPress={() => dispatch({ type: 'startOver' })}
                style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.outlineText}>{t('voiceIntro.startOver')}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {phase.name === 'understanding' && (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={styles.lead} accessibilityLiveRegion="polite">
            {t(phase.round === 1 ? 'voiceIntro.understanding' : 'voiceIntro.understandingAnswers')}
          </Text>
        </View>
      )}

      {phase.name === 'followUp' && (
        <FollowUps
          questions={state.questions}
          answers={state.answers}
          index={phase.index}
          questionRef={questionRef}
          readAloud={readAloud}
          onReadAloud={(on) => {
            setReadAloud(on);
            if (on) void speak(t(state.questions[phase.index].question), getLanguage());
            else void stopSpeaking();
          }}
          listening={ownsMicrophone}
          notice={voiceNotice}
          onText={(text) => dispatch({ type: 'answerText', text }, 'none')}
          onChip={(chip) => {
            const question = state.questions[phase.index];
            if (ownsMicrophone) abortVoiceInput();
            // A single-choice chip answers and moves on (a page change); a multi-choice one only toggles.
            dispatch({ type: 'toggleChip', chip }, question.multi ? 'none' : 'user');
          }}
          onSubmit={() => {
            if (ownsMicrophone) abortVoiceInput();
            const answer = state.answers[phase.index];
            dispatch({ type: answer && (answer.chips.length || answer.text.trim()) ? 'next' : 'skipQuestion' });
          }}
          onMic={() => {
            if (ownsMicrophone) return stop();
            const current = state.answers[phase.index]?.text ?? '';
            listen(current, (text) => dispatchRaw({ type: 'answerText', text }), false);
          }}
        />
      )}

      {phase.name === 'review' && (
        <Review
          rows={rows}
          notice={
            state.notice === 'answersVerbatim'
              ? t('voiceIntro.answersVerbatim')
              : state.notice === 'answersAsWritten'
                ? t('voiceIntro.answersAsWritten')
                : null
          }
          onChange={setRows}
        />
      )}

      {phase.name === 'saving' && (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.tint} />
        </View>
      )}

      {phase.name === 'saved' && (
        <>
          <Title>{t('voiceIntro.savedTitle')}</Title>
          <Text style={styles.lead}>{t('voiceIntro.savedCount', { count: phase.count })}</Text>
          <Text style={styles.hint}>{t('voiceIntro.savedHint')}</Text>
        </>
      )}

      {phase.name === 'failed' && (
        <>
          <Title>{t(FAILED[phase.reason], { detail: phase.detail ?? '' })}</Title>
          {phase.reason === 'noAi' && <Text style={styles.lead}>{t('voiceIntro.noAi')}</Text>}
          <Text style={styles.lead}>{t('voiceIntro.failedThen')}</Text>
          <TranscriptCard text={state.transcript} />
        </>
      )}
    </KeyboardAwareScrollView>
  );
}

const FAILED: Record<'noAi' | 'request' | 'unreadable' | 'nothing', MessageKey> = {
  noAi: 'voiceIntro.failed.noAi',
  request: 'voiceIntro.failed.request',
  unreadable: 'voiceIntro.failed.unreadable',
  nothing: 'voiceIntro.failed.nothing',
};

function joinText(base: string, words: string) {
  if (!base.trim()) return words;
  return /\s$/.test(base) ? base + words : `${base} ${words}`;
}

// ---- Pieces ----

function Title({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

function Footer({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.bottom}>{children}</View>;
}

function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const styles = useStyles();
  return <GradientButton label={label} onPress={onPress} disabled={disabled} style={styles.primary} textStyle={styles.primaryText} />;
}

function Secondary({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} style={styles.secondary} accessibilityRole="button" hitSlop={6}>
      {icon && <Icon name={icon} size={18} color={palette.tintText} />}
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

/** The large microphone: a ring follows the voice level while listening (still with reduce motion). */
function MicButton({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  const styles = useStyles();
  const palette = usePalette();
  const level = useVoiceLevel();
  const reduceMotion = useReduceMotion();
  const window = useWindowDimensions();
  const size = isShort(window) ? 72 : 104;
  const ring = active && !reduceMotion ? 1 + level * 0.35 : 1;
  return (
    <View style={[styles.micWrap, { height: size * 1.4 }]}>
      {active && (
        <View
          style={[
            styles.micRing,
            { width: size, height: size, borderRadius: size / 2, transform: [{ scale: ring }] },
          ]}
        />
      )}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.mic,
          { width: size, height: size, borderRadius: size / 2 },
          active && styles.micActive,
          pressed && styles.micPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name={active ? 'stop' : 'microphone'} size={size * 0.4} color={palette.onTint} />
      </Pressable>
    </View>
  );
}

const MENTIONS: { key: MessageKey; icon: IconName }[] = [
  { key: 'voiceIntro.mention.name', icon: 'person' },
  { key: 'voiceIntro.mention.city', icon: 'home' },
  { key: 'voiceIntro.mention.ageGender', icon: 'info' },
  { key: 'voiceIntro.mention.food', icon: 'food' },
  { key: 'voiceIntro.mention.shopping', icon: 'delivery' },
  { key: 'voiceIntro.mention.style', icon: 'preferences' },
];

function IntroPage({ ai, credits, onSpeak, notice }: { ai: boolean; credits: boolean; onSpeak: () => void; notice: string | null }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <>
      <Title>{t('voiceIntro.title')}</Title>
      <Text style={styles.lead}>{t('voiceIntro.lead')}</Text>
      {ai ? (
        <>
          <MicButton active={false} onPress={onSpeak} label={t('voiceIntro.speakA11y')} />
          <Text style={styles.micLabel} importantForAccessibility="no" accessibilityElementsHidden>
            {t('voiceIntro.speak')}
          </Text>
          {/* Said before the microphone is used, so it sits right under it (a screen reader reaches it next). */}
          <View style={[styles.card, styles.privacy]}>
            <Icon name="secure" size={16} color={palette.textSecondary} />
            <Text style={styles.hintFlex}>{t(credits ? 'voiceIntro.privacyCredits' : 'voiceIntro.privacy')}</Text>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardText}>{t('voiceIntro.noAi')}</Text>
        </View>
      )}
      {!!notice && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
      <Text style={styles.label} accessibilityRole="header">
        {t('voiceIntro.mentionTitle')}
      </Text>
      <View style={styles.mentions}>
        {MENTIONS.map((m) => (
          <View key={m.key} style={styles.mention}>
            <Icon name={m.icon} size={18} color={palette.textSecondary} />
            <Text style={styles.mentionText}>{t(m.key)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

/** The first page: three ways to tell Qutai about yourself. Without an AI only the questions are offered. */
function ChoosePage({
  ai,
  credits,
  onSpeak,
  onType,
  onAsk,
}: {
  ai: boolean;
  credits: boolean;
  onSpeak: () => void;
  onType: () => void;
  onAsk: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <>
      <Title>{t('voiceIntro.title')}</Title>
      <Text style={styles.lead}>{t('voiceIntro.chooseLead')}</Text>
      {!ai && (
        <View style={styles.card}>
          <Text style={styles.cardText}>{t('voiceIntro.noAiAsk')}</Text>
        </View>
      )}
      {ai && (
        <Choice icon="microphone" title={t('voiceIntro.choice.speak')} body={t('voiceIntro.choice.speakHint')} onPress={onSpeak} />
      )}
      {ai && <Choice icon="keyboard" title={t('voiceIntro.choice.type')} body={t('voiceIntro.choice.typeHint')} onPress={onType} />}
      <Choice icon="message" title={t('voiceIntro.choice.ask')} body={t('voiceIntro.choice.askHint')} onPress={onAsk} />
      {ai && (
        <View style={styles.privacy}>
          <Icon name="secure" size={16} color={palette.textSecondary} />
          <Text style={styles.hintFlex}>{t(credits ? 'voiceIntro.choosePrivacyCredits' : 'voiceIntro.choosePrivacy')}</Text>
        </View>
      )}
    </>
  );
}

function Choice({ icon, title, body, onPress }: { icon: IconName; title: string; body: string; onPress: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
    >
      <View style={styles.choiceIcon}>
        <Icon name={icon} size={22} color={palette.onTint} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.hint}>{body}</Text>
      </View>
      <Icon name="chevronRight" size={18} color={palette.textSecondary} />
    </Pressable>
  );
}

/** What was said, selectable so it can be copied (failure page, and above the typed questions). */
export function TranscriptCard({ text }: { text: string }) {
  const styles = useStyles();
  if (!text.trim()) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('voiceIntro.yourWords')}</Text>
      <Text style={styles.cardText} selectable>
        {text}
      </Text>
    </View>
  );
}

function answerSummary(question: FollowUp, answer: FollowUpAnswer | undefined): string {
  if (!answer || answer.skipped) return t('voiceIntro.skipped');
  const chips = question.chips.filter((c) => answer.chips.includes(c.id)).map((c) => t(c.label));
  const text = answer.text.trim();
  const all = [...chips, ...(text ? [text] : [])];
  return all.length ? all.join(', ') : t('voiceIntro.skipped');
}

function FollowUps({
  questions,
  answers,
  index,
  questionRef,
  readAloud,
  onReadAloud,
  listening,
  notice,
  onText,
  onChip,
  onMic,
  onSubmit,
}: {
  questions: FollowUp[];
  answers: FollowUpAnswer[];
  index: number;
  questionRef: RefObject<ComponentRef<typeof Text> | null>;
  readAloud: boolean;
  onReadAloud: (on: boolean) => void;
  listening: boolean;
  notice: string | null;
  onText: (text: string) => void;
  onChip: (chip: string) => void;
  onMic: () => void;
  onSubmit: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const question = questions[index];
  const answer = answers[index];
  return (
    <>
      <Title>{t('voiceIntro.followTitle')}</Title>
      <Text style={styles.hint}>{t('voiceIntro.followLead')}</Text>
      <View style={styles.speakerRow}>
        <Icon name="readAloud" size={18} color={palette.textSecondary} />
        <Text style={styles.speakerText}>{t('voiceIntro.readAloud')}</Text>
        <ThemedSwitch value={readAloud} onValueChange={onReadAloud} accessibilityLabel={t('voiceIntro.readAloud')} />
      </View>
      <Text style={styles.counter}>{t('profile.questionOf', { n: index + 1, total: questions.length })}</Text>
      {questions.slice(0, index).map((q, i) => (
        <View key={q.id} style={styles.exchange}>
          <Bubble from="qutai">{t(q.question)}</Bubble>
          <Bubble from="you">{answerSummary(q, answers[i])}</Bubble>
        </View>
      ))}
      <View
        style={[styles.bubble, styles.bubbleQutai]}
        accessible
        accessibilityLabel={`${t('voiceIntro.from.qutai')}: ${t(question.question)}`}
      >
        <Text ref={questionRef} style={styles.bubbleText} accessibilityRole="header">
          {t(question.question)}
        </Text>
      </View>
      {question.chips.length > 0 && (
        <View style={styles.chips}>
          {question.chips.map((chip) => {
            const on = !!answer?.chips.includes(chip.id);
            return (
              <Pressable
                key={chip.id}
                onPress={() => onChip(chip.id)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole={question.multi ? 'checkbox' : 'button'}
                accessibilityState={question.multi ? { checked: on } : undefined}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(chip.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={styles.answerRow}>
        <TextInput
          style={styles.answerInput}
          value={answer?.text ?? ''}
          onChangeText={(text) => {
            // Typing takes over from the microphone (the words heard so far are in the field).
            if (listening) abortVoiceInput();
            onText(text);
          }}
          placeholder={t('voiceIntro.answerPlaceholder')}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={`${t('voiceIntro.answerPlaceholder')}: ${t(question.question)}`}
          multiline
          maxLength={500}
          autoCapitalize="sentences"
          // The keyboard's own key answers and moves on (the button below may be under the keyboard).
          returnKeyType="next"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={onSubmit}
        />
        <Pressable
          onPress={onMic}
          style={({ pressed }) => [styles.smallMic, listening && styles.micActive, pressed && styles.micPressed]}
          accessibilityRole="button"
          accessibilityLabel={t(listening ? 'voice.stop' : 'voiceIntro.answerMic')}
          hitSlop={6}
        >
          <Icon name={listening ? 'stop' : 'microphone'} size={20} color={palette.onTint} />
        </Pressable>
      </View>
      {question.id === 'city' && (
        // The place name fills the field like a typed answer (INTRO-31); the microphone stops first.
        <FillFromLocation onFill={onText} onStart={() => listening && abortVoiceInput()} />
      )}
      {listening && (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {t('voice.listening')}
        </Text>
      )}
      {!!notice && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
    </>
  );
}

function Bubble({ from, children }: { from: 'qutai' | 'you'; children: string }) {
  const styles = useStyles();
  return (
    <View
      style={[styles.bubble, from === 'qutai' ? styles.bubbleQutai : styles.bubbleYou]}
      accessible
      accessibilityLabel={`${t(from === 'qutai' ? 'voiceIntro.from.qutai' : 'voiceIntro.from.you')}: ${children}`}
    >
      <Text style={[styles.bubbleText, from === 'you' && styles.bubbleTextYou]}>{children}</Text>
    </View>
  );
}

function Review({ rows, notice, onChange }: { rows: ReviewRow[]; notice: string | null; onChange: (rows: ReviewRow[]) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);
  const update = (key: string, change: Partial<ReviewRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const remove = (key: string) => onChange(rows.filter((r) => r.key !== key));
  const finishEdit = () => {
    if (!editing) return;
    const text = editing.text.replace(/\s+/g, ' ').trim();
    setEditing(null);
    if (!text) remove(editing.key);
    else update(editing.key, { text });
  };
  const icon = (row: ReviewRow): IconName => (row.kind === 'instruction' ? 'preferences' : CATEGORY_ICONS[row.category as MemoryCategory]);
  return (
    <>
      <Title>{t('voiceIntro.reviewTitle')}</Title>
      <Text style={styles.lead}>{t(rows.length ? 'voiceIntro.reviewLead' : 'voiceIntro.reviewEmpty')}</Text>
      {!!notice && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
      {rows.map((row) => {
        const shown = row.kind === 'instruction' ? t('profile.summaryInstruction', { line: row.text }) : row.text;
        return (
          <View key={row.key} style={styles.reviewRow}>
            <View style={styles.reviewMain}>
              <Icon name={icon(row)} size={18} color={palette.textSecondary} />
              {editing?.key === row.key ? (
                <TextInput
                  style={styles.reviewInput}
                  value={editing.text}
                  onChangeText={(text) => setEditing({ key: row.key, text })}
                  onBlur={finishEdit}
                  onSubmitEditing={finishEdit}
                  autoFocus
                  multiline
                  submitBehavior="blurAndSubmit"
                  returnKeyType="done"
                  maxLength={300}
                  accessibilityLabel={t('voiceIntro.editItem', { text: row.text })}
                />
              ) : (
                <Pressable
                  onPress={() => row.kind === 'memory' && setEditing({ key: row.key, text: row.text })}
                  disabled={row.kind !== 'memory'}
                  style={styles.flex}
                  accessibilityRole={row.kind === 'memory' ? 'button' : 'text'}
                  accessibilityHint={row.kind === 'memory' ? t('memory.editHint') : undefined}
                >
                  <Text style={styles.reviewText}>{shown}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => remove(row.key)}
                hitSlop={10}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={t('voiceIntro.deleteItem', { text: shown })}
              >
                <Icon name="close" size={16} color={palette.textSecondary} />
              </Pressable>
            </View>
            {(() => {
              // The same text already saved is just kept; only a different earlier note is worth saying.
              const other = (row.replaces ?? []).filter((r) => r.shown.trim().toLocaleLowerCase() !== row.text.trim().toLocaleLowerCase());
              return other.length ? (
                <Text style={styles.replaces}>
                  {t('voiceIntro.replaces', { old: other.map((r) => `“${r.shown}”`).join(', ') })}
                </Text>
              ) : null;
            })()}
            {row.canHide && (
              <View style={styles.hideRow}>
                <View style={styles.flex}>
                  <Text style={styles.hideText}>{t('voiceIntro.hide')}</Text>
                  <Text style={styles.hint}>{t('voiceIntro.hideHint')}</Text>
                </View>
                <ThemedSwitch
                  value={row.hidden}
                  onValueChange={(hidden) => update(row.key, { hidden })}
                  accessibilityLabel={`${t('voiceIntro.hide')}: ${row.text}`}
                />
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  title: { color: c.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginTop: 8 },
  lead: { color: c.textSecondary, fontSize: 16, lineHeight: 23 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 4 },
  hint: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  hintFlex: { flex: 1, color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  status: { color: c.tintText, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  notice: { color: c.text, fontSize: 14.5, lineHeight: 20 },
  counter: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  card: { ...common(c).card, paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  cardText: { color: c.text, fontSize: 15, lineHeight: 21 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.card,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  choiceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
  choiceTitle: { color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 2 },
  mentions: { gap: 8 },
  mention: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  mentionText: { flex: 1, color: c.text, fontSize: 15, lineHeight: 21 },
  micWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  micRing: { position: 'absolute', backgroundColor: c.tint, opacity: 0.25 },
  mic: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
  micActive: { backgroundColor: c.dangerFill },
  micPressed: { opacity: 0.8 },
  micLabel: { color: c.tintText, fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: -8 },
  transcriptLive: { color: c.text, fontSize: 17, lineHeight: 25 },
  transcriptInput: {
    color: c.text,
    minHeight: 160,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 16,
    lineHeight: 23,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  outline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: c.tint,
  },
  outlineText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  pressed: { backgroundColor: c.pressed },
  centre: { alignItems: 'center', gap: 16, paddingVertical: 48 },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speakerText: { flex: 1, color: c.text, fontSize: 15 },
  exchange: { gap: 8 },
  bubble: { maxWidth: '88%', borderRadius: radii.popover, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleQutai: { alignSelf: 'flex-start', backgroundColor: c.surface, borderBottomLeftRadius: 6 },
  bubbleYou: { alignSelf: 'flex-end', backgroundColor: c.tint, borderBottomRightRadius: 6 },
  bubbleText: { color: c.text, fontSize: 16, lineHeight: 22 },
  bubbleTextYou: { color: c.onTint },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: { backgroundColor: c.tint, borderColor: c.tint },
  chipText: { color: c.text, fontSize: 15 },
  chipTextOn: { color: c.onTint, fontWeight: '600' },
  answerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  answerInput: {
    flex: 1,
    color: c.text,
    minHeight: 46,
    maxHeight: 140,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 16,
  },
  smallMic: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
  reviewRow: {
    borderRadius: radii.control,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    gap: 8,
  },
  reviewMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewText: { color: c.text, fontSize: 15, lineHeight: 20 },
  reviewInput: { flex: 1, color: c.text, fontSize: 15, lineHeight: 20, paddingVertical: 0 },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  replaces: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19, paddingLeft: 28, paddingRight: 8 },
  hideRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 28, paddingRight: 8 },
  hideText: { color: c.text, fontSize: 14.5, fontWeight: '600' },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  primary: { height: 52, borderRadius: radii.button },
  primaryText: { fontSize: 17 },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  secondaryText: { color: c.tintText, fontSize: 16, fontWeight: '600', textAlign: 'center' },
}));

