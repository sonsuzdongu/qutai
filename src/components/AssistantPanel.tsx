import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsSpeaking } from '../device/speech';
import {
  abortVoiceInput,
  startVoiceInput,
  stopVoiceInput,
  useVoiceInfo,
  useVoiceLevel,
  useVoiceState,
  VoiceOnline,
  VoiceState,
} from '../device/voiceInput';
import { languageLabel, spokenLanguageName } from '../device/voiceLanguage';
import { VoiceLanguageSheet } from './VoiceLanguageSheet';
import { t } from '../i18n';
import { makeStyles, usePalette } from '../ui/theme';
import { Icon, IconName } from '../ui/Icon';
import { GradientText } from '../ui/BrandGradient';
import { QutaiMark } from '../ui/QutaiMark';
import type { Source } from '../agent/types';
import type { AnswerCost } from '../ai/cost';
import { AnswerCostInline, AnswerCostLine } from './AnswerCost';
import type { Suggestion } from '../agent/pageSuggestions';
import type { CallOffer } from '../device/phone';
import type { SmsOffer } from '../device/sms';
import type { WhatsAppOffer } from '../device/whatsapp';
import type { SavedTask } from '../storage/savedTasks';
import { composedFileAvailable, FileOffer } from '../device/composedFile';
import type { AttachmentInfo } from '../chat/attachments';
import type { ShareOffer } from '../chat/shareable';
import { AttachmentThumb } from './AttachmentViews';
import { attachmentAvailable } from '../device/attachments';
import { imageFormatLabel } from '../chat/imageEdit';
import { formatNumber, formatSize, hostOf } from '../i18n/format';
import { hasTable, MarkdownText } from './MarkdownText';
import { SearchSuggestions } from './SearchSuggestions';
import { KeyboardAvoidingContainer } from './KeyboardAware';
import { useKeyboardVisible } from '../utils/useKeyboardVisible';
import { useReduceMotion } from '../utils/useReduceMotion';
import { withoutLeadingSymbol } from '../utils/leadingSymbol';
import { bump, tick } from '../device/haptics';
import { ActionSheet, SheetAction } from './ActionSheet';
import { FINAL_WAIT_MS } from './PushToTalk';
import { useHoldGesture, useScreenReader } from './useHoldGesture';
import { ErrorDetails } from './ErrorDetails';
import { segmentChat, stepSummaryText, summarizeSteps } from '../chat/stepSummary';

export type ChatItemAction = 'buyCredits' | 'signIn';

export type ChatItem = {
  id: string;
  kind:
    | 'user'
    | 'assistant'
    | 'action'
    | 'error'
    | 'info'
    | 'choices'
    | 'sources'
    | 'call'
    | 'sms'
    | 'whatsapp'
    | 'file'
    | 'image'
    | 'pdf'
    | 'share';
  text: string;
  /** For 'action' and 'info': the icon before the text (absent in conversations saved before icons). */
  icon?: IconName;
  /** For 'action': the tool's name, for the step summary (absent in conversations saved before it was kept). */
  tool?: string;
  /** For 'choices': the buttons offered. */
  options?: string[];
  /** For 'choices': the option the user tapped. */
  chosen?: string;
  /** For 'assistant': the reply is still being written. */
  streaming?: boolean;
  /** For 'sources': the pages the answer is based on. */
  sources?: Source[];
  /** For 'sources': Google's search suggestions widget, shown with Gemini answers grounded in Google Search. */
  searchWidget?: string;
  /** For 'call': the number behind the Call button (stays usable, unlike ask_user options). */
  call?: CallOffer;
  /** For 'sms': the prepared text message behind the "Open in Messages" button. */
  sms?: SmsOffer;
  /** For 'whatsapp': the prepared message behind the "Open in WhatsApp" button. */
  whatsapp?: WhatsAppOffer;
  /** For 'file': the composed file behind the Share / Save buttons (only its name and size; the content is not saved). */
  file?: FileOffer;
  /**
   * For 'user': the files attached to the message (their manifest; the files are on the phone). For 'image': the one
   * image the assistant made with edit_image. For 'pdf': the one PDF Qutai made.
   */
  attachments?: AttachmentInfo[];
  /** For 'share': the prepared share (or the files an email draft took), described without content. */
  share?: ShareOffer;
  /** For 'image': its file was removed to keep the conversation's edited images under the limit. */
  expired?: boolean;
  /** The last item of a task: the tokens and approximate cost of all the task's requests (numbers only). */
  cost?: AnswerCost;
  /** For 'error': a way out offered under it (Qutai Credits: buy credits, or sign in / choose another provider). */
  action?: ChatItemAction;
  /** For 'error': the raw error text behind the plain sentence, shown on demand (ai/plainError.ts). */
  details?: string;
};

/** Voice input: the settings it follows and where its messages go. */
export type VoiceProps = {
  /** The conversation is incognito: on-device recognition only. */
  incognito: boolean;
  online: VoiceOnline;
  onOnlineChange: (online: VoiceOnline) => void;
  /** Send as soon as the user stops speaking. */
  autoSend: boolean;
  /** A short message for a toast. */
  notify: (message: string) => void;
  /** The languages to listen in, best first, worked out when listening starts (device/voiceLanguage.ts). */
  languages: () => string[];
  /** The language picked by hand for this conversation, or null (automatic). */
  picked: string | null;
  onPick: (language: string | null) => void;
  /** The automatic row's text and what it would choose now (the Settings default when that isn't Automatic). */
  autoLabel: string;
  autoHint?: string;
  /** Listening started in this recogniser language (remembered as the last one used). */
  onStarted: (lang: string) => void;
};

/** A one-tap task shown above the input, e.g. "Summarize"; id matches a page suggestion that offers the same. */
export type QuickAction = { id: string; icon: IconName; label: string; prompt: string };

type Props = {
  open: boolean;
  quickActions: QuickAction[];
  /** The message being typed; owned by the app so other features (e.g. selected text) can prefill it. */
  draft: string;
  onDraftChange: (text: string) => void;
  /** The next message runs as deep research. */
  research: boolean;
  onResearchChange: (on: boolean) => void;
  /** Bumped to focus the input, e.g. after prefilling a quote. */
  focusRequest: number;
  items: ChatItem[];
  running: boolean;
  /** Another tab's conversation is running a task (only one runs at a time). */
  busyElsewhere: boolean;
  onShowRunningTab: () => void;
  /** How a task ended in another tab's or group's conversation that the user has not looked at since. */
  finishedElsewhere: 'done' | 'failed' | 'needsAnswer' | null;
  onShowFinished: () => void;
  /** Provider and model shown under the title, e.g. "OpenAI · GPT-5.6 Terra". */
  modelInfo: string;
  /** The conversation has its own model choice (modelInfo then says so). */
  modelChosen?: boolean;
  /** Opens the sheet to choose this conversation's provider and model. */
  onModelPress: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  /** An option of an ask_user question was tapped. */
  onChoose: (itemId: string, option: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  /** An error's way out (Qutai Credits: buy credits, sign in or choose another provider). */
  onItemAction?: (action: ChatItemAction) => void;
  /** Qutai Credits: the balance dropped below a few steps' worth (credits/lowBalance.ts); null when not shown. */
  lowCredits?: { onBuy: () => void; onDismiss: () => void } | null;
  /** Opens "What was sent to the AI" for this conversation. */
  onShowSent: () => void;
  /** Show the approximate cost under answers (Settings › Assistant). */
  showCost: boolean;
  onMessageAction: (action: MessageAction, text: string) => void;
  /** A link in an answer was tapped. */
  onOpenLink: (url: string) => void;
  /** A Call button or a tel: link in an answer was tapped; number is already normalised. */
  onCall: (number: string) => void;
  /** The "Open in Messages" button of a prepared text message was tapped. */
  onSms: (offer: SmsOffer) => void;
  /** The "Open in WhatsApp" button of a prepared WhatsApp message was tapped. */
  onWhatsApp: (offer: WhatsAppOffer) => void;
  /** Share or Save on a file the assistant composed. */
  onFile: (action: 'share' | 'save', file: FileOffer) => void;
  /** A source under an answer was tapped. */
  onOpenSource: (source: Source) => void;
  dark?: boolean;
  /** A web page is open in the tab (not the new tab page); picks the lead text in the empty chat. */
  hasPage?: boolean;
  /** Suggestions for the page on screen, shown in the empty chat (agent/pageSuggestions.ts). */
  suggestions: Suggestion[];
  voice: VoiceProps;
  /** Saved tasks run most recently, shown as chips in the empty chat. */
  recentTasks: SavedTask[];
  onRunTask: (task: SavedTask) => void;
  onOpenTasks: () => void;
  /** "Save as task" in the menu of a message the user sent. */
  onSaveAsTask: (text: string) => void;
  /** A saved task opened from its reminder waits in the input: its name, for the "Run now" row. */
  preparedTask: string | null;
  onRunPrepared: () => void;
  /** Files attached to the message being written (thumbnails above the input). */
  pending: AttachmentInfo[];
  /** The attach button: Photos, Camera, File. */
  onAttach: () => void;
  onRemovePending: (id: string) => void;
  /** A thumbnail (pending or sent) was tapped: full-screen preview. */
  onOpenAttachment: (info: AttachmentInfo) => void;
  /** Share or Save on the card of an edited image or of a PDF Qutai made. */
  onImage: (action: 'share' | 'save', info: AttachmentInfo) => void;
  /** The button of a share card ("Share to WhatsApp" / "Share…") was tapped. */
  onShare: (offer: ShareOffer) => void;
};

const MAX_WIDTH = 420;

/** Dark styles for the panel's parts, or null in the light theme. */
const PanelTheme = createContext<typeof darkStyles | null>(null);

/**
 * Side panel that slides in from the right over the page, like the Chrome
 * side panel. It stays mounted while closed so the conversation keeps its
 * scroll position.
 */
export function AssistantPanel({
  open,
  quickActions,
  draft: text,
  onDraftChange: setText,
  focusRequest,
  research,
  onResearchChange,
  items,
  running,
  busyElsewhere,
  onShowRunningTab,
  finishedElsewhere,
  onShowFinished,
  modelInfo,
  modelChosen,
  onModelPress,
  onClose,
  onSend,
  onStop,
  onChoose,
  onNewChat,
  onOpenSettings,
  onItemAction,
  lowCredits,
  onShowSent,
  showCost,
  onMessageAction,
  onOpenLink,
  onCall,
  onSms,
  onWhatsApp,
  onFile,
  onOpenSource,
  dark = false,
  hasPage = false,
  suggestions,
  voice,
  recentTasks,
  onRunTask,
  onOpenTasks,
  onSaveAsTask,
  preparedTask,
  onRunPrepared,
  pending,
  onAttach,
  onRemovePending,
  onOpenAttachment,
  onImage,
  onShare,
}: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const d = dark ? darkStyles : null;
  const speaking = useIsSpeaking();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(Math.round(screenWidth * 0.88), MAX_WIDTH);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const reduceMotion = useReduceMotion();

  const [progress] = useState(() => new Animated.Value(0));
  /** The message whose menu is open; full: opened by long press, so it lists the row's icons too. */
  const [menu, setMenu] = useState<{ item: ChatItem; full: boolean } | null>(null);
  /** The answer being read aloud (Read aloud turns into Stop on that one only). */
  const [readingId, setReadingId] = useState<string | null>(null);
  /** The answer whose text was made selectable from its menu (selecting would otherwise fight the long press). */
  const [selectableId, setSelectableId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [listWidth, setListWidth] = useState<number | null>(null);
  const costConversation = () => items.flatMap((i) => (i.cost ? [i.cost] : []));
  /** Folded step runs the user opened (by their first item's id). */
  const [expandedSteps, setExpandedSteps] = useState<ReadonlySet<string>>(() => new Set());
  const toggleSteps = (id: string) => {
    tick();
    setExpandedSteps((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
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
      bump();
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

  /** Screens over the panel hide the listening state, so the microphone stops first. */
  const leavePanel = (go: () => void) => () => {
    stopVoiceInput();
    go();
  };

  useEffect(() => {
    if (!focusRequest) return;
    // Wait for the slide-in animation, otherwise the keyboard opens over a moving panel.
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    }).start();
    if (!open) Keyboard.dismiss();
  }, [open, progress, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [items.length, open]);

  const send = () => {
    const t = text.trim();
    if ((!t && !pending.length) || running || busyElsewhere) return;
    setText('');
    onSend(t);
  };
  const canSend = (!!text.trim() || pending.length > 0) && !busyElsewhere;

  // Only the latest question is answerable, and only until the user has replied in some other way.
  const lastUserIndex = items.findLastIndex((item) => item.kind === 'user');
  const canChoose = (index: number) => !running && !busyElsewhere && index > lastUserIndex && !items[index].chosen;

  const messageAction = (action: MessageAction, item: ChatItem) => {
    if (action === 'speak') setReadingId(item.id);
    onMessageAction(action, item.text);
  };

  const menuActions = (open: { item: ChatItem; full: boolean }): SheetAction[] => {
    const { item, full } = open;
    const copy: SheetAction = { icon: 'copy', label: t('chat.actionCopy'), onPress: () => messageAction('copy', item) };
    if (item.kind === 'user')
      return [
        copy,
        { icon: 'tasks', label: t('tasks.saveAsTask'), onPress: leavePanel(() => onSaveAsTask(item.text)) },
      ];
    const reading = speaking && readingId === item.id;
    return [
      ...(full
        ? [
            copy,
            reading
              ? {
                  icon: 'stopReading' as const,
                  label: t('chat.actionStopReading'),
                  onPress: () => messageAction('stopSpeaking', item),
                }
              : {
                  icon: 'readAloud' as const,
                  label: t('chat.actionRead'),
                  onPress: () => messageAction('speak', item),
                },
            { icon: 'share' as const, label: t('chat.actionShare'), onPress: () => messageAction('share', item) },
          ]
        : []),
      ...(selectableId === item.id
        ? []
        : [{ icon: 'selectText' as const, label: t('chat.actionSelect'), onPress: () => setSelectableId(item.id) }]),
      { icon: 'pdf', label: t('chat.actionPdf'), onPress: () => messageAction('pdf', item) },
      { icon: 'info', label: t('chat.actionSent'), onPress: leavePanel(onShowSent) },
    ];
  };

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <PanelTheme.Provider value={d}>
      <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('chat.closePanel')} />
        </Animated.View>

        <Animated.View
          style={[styles.panel, d?.panel, { width, transform: [{ translateX }] }]}
          // VoiceOver stays inside the panel while it is open.
          accessibilityViewIsModal={open}
        >
          {/* The message field stays above the keyboard (the navigation bar inset gives way to it below). */}
          <KeyboardAvoidingContainer style={styles.flex}>
            <View
              style={[
                styles.flex,
                {
                  paddingTop: insets.top,
                  paddingRight: insets.right,
                  paddingBottom: keyboardVisible ? 0 : insets.bottom,
                },
              ]}
            >
              <View style={[styles.header, d?.header]}>
                <QutaiMark size={24} working={running} sweepWhenIdle animate={open} />
                <View style={styles.headerTitle}>
                  <GradientText style={styles.title} dark={dark}>
                    {t('chat.title')}
                  </GradientText>
                  {/* The running task keeps its model, so the choice opens only between tasks. */}
                  <Pressable
                    onPress={onModelPress}
                    disabled={running}
                    hitSlop={4}
                    style={styles.statusRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.modelA11y', { model: modelInfo })}
                    accessibilityState={{ disabled: running }}
                  >
                    {/* Beside four buttons on a narrow phone: shortened in the middle, so the end of the model
                        name and the arrow stay in view, and very large text sizes capped. */}
                    <Text
                      style={[styles.status, modelChosen && !running && styles.statusChosen]}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      maxFontSizeMultiplier={1.4}
                    >
                      {running ? t('chat.working') : modelInfo}
                    </Text>
                    {running ? null : (
                      <Icon
                        name="chevronDown"
                        size={13}
                        color={modelChosen ? palette.tintText : palette.textSecondary}
                        style={styles.statusIcon}
                      />
                    )}
                  </Pressable>
                </View>
                {items.length > 0 && !running && (
                  <HeaderButton icon="newTab" accessibilityLabel={t('chat.newChat')} onPress={onNewChat} />
                )}
                <HeaderButton icon="tasks" accessibilityLabel={t('tasks.title')} onPress={leavePanel(onOpenTasks)} />
                <HeaderButton
                  icon="settings"
                  accessibilityLabel={t('chat.settings')}
                  onPress={leavePanel(onOpenSettings)}
                />
                <HeaderButton icon="close" accessibilityLabel={t('chat.closePanel')} onPress={onClose} />
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.flex}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
                // The answers' rows of icons fit their figure into what is left of this width.
                onLayout={(e) => {
                  const width = Math.round(e.nativeEvent.layout.width);
                  setListWidth((w) => (w === width ? w : width));
                }}
                // Follow a reply while it is being written.
                onContentSizeChange={() => {
                  if (open && running) scrollRef.current?.scrollToEnd({ animated: false });
                }}
              >
                {items.length === 0 && (
                  <EmptyState
                    hasPage={hasPage}
                    animate={open}
                    suggestions={suggestions}
                    onSuggestion={running || busyElsewhere ? null : (suggestion) => onSend(suggestion.prompt)}
                    recentTasks={running || busyElsewhere ? [] : recentTasks}
                    onRunTask={onRunTask}
                  />
                )}
                {segmentChat(items, running).map((segment) => {
                  if (segment.type === 'steps') {
                    const first = items[segment.start];
                    const shown = expandedSteps.has(first.id);
                    return (
                      <StepGroup
                        key={`steps-${first.id}`}
                        items={items.slice(segment.start, segment.end)}
                        expanded={shown}
                        onToggle={() => toggleSteps(first.id)}
                      />
                    );
                  }
                  const index = segment.index;
                  const item = items[index];
                  return (
                      <Fragment key={item.id}>
                        <ChatRow
                          item={item}
                          onOpenAttachment={onOpenAttachment}
                          onItemAction={onItemAction}
                          reading={speaking && readingId === item.id}
                          selectable={selectableId === item.id}
                          onAction={(action) => messageAction(action, item)}
                          onMenu={(full) => setMenu({ item, full })}
                          onOpenLink={onOpenLink}
                          onCall={onCall}
                          onSms={onSms}
                          onWhatsApp={onWhatsApp}
                          onFile={onFile}
                          onImage={onImage}
                          onShare={onShare}
                          onOpenSource={onOpenSource}
                          onChoose={item.kind === 'choices' && canChoose(index) ? onChoose : undefined}
                          answered={item.kind === 'choices' && (!!item.chosen || index < lastUserIndex)}
                          cost={showCost ? item.cost : undefined}
                          costConversation={costConversation}
                          listWidth={listWidth}
                        />
                        {/* An answer shows its figure in its row of icons; items without that row (an error, a stopped
                            task, a question) keep it on a small line of its own. */}
                        {showCost && item.cost && item.kind !== 'assistant' ? (
                          <AnswerCostLine
                            cost={item.cost}
                            conversation={costConversation}
                          />
                        ) : null}
                      </Fragment>
                  );
                })}
              </ScrollView>

              {lowCredits && (
                <View style={[styles.busy, d?.busy, styles.lowCredits]}>
                  <Icon name="wallet" size={16} color={palette.textSecondary} />
                  <Text style={styles.busyText}>{t('credits.low')}</Text>
                  <Pressable
                    onPress={leavePanel(lowCredits.onBuy)}
                    style={styles.lowCreditsAction}
                    accessibilityRole="button"
                  >
                    <Text style={styles.busyAction}>{t('buy.open')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={lowCredits.onDismiss}
                    style={styles.lowCreditsClose}
                    accessibilityRole="button"
                    accessibilityLabel={t('credits.lowDismiss')}
                  >
                    <Icon name="close" size={14} color={palette.textSecondary} />
                  </Pressable>
                </View>
              )}
              {busyElsewhere && (
                <Pressable onPress={onShowRunningTab} style={[styles.busy, d?.busy]} accessibilityRole="button">
                  <Text style={styles.busyText}>{t('chat.busyElsewhere')}</Text>
                  <Text style={styles.busyAction}>{t('chat.showTab')}</Text>
                </Pressable>
              )}
              {preparedTask && !running && !busyElsewhere && (
                <Pressable onPress={onRunPrepared} style={[styles.busy, d?.busy]} accessibilityRole="button">
                  <Text style={styles.busyText} numberOfLines={2}>
                    {t('tasks.ready', { name: preparedTask })}
                  </Text>
                  <Text style={styles.busyAction}>{t('tasks.runNow')}</Text>
                </Pressable>
              )}
              {!busyElsewhere && finishedElsewhere && (
                <Pressable onPress={onShowFinished} style={[styles.busy, d?.busy]} accessibilityRole="button">
                  <Text style={styles.busyText}>
                    {t(
                      finishedElsewhere === 'done'
                        ? 'chat.finishedElsewhere'
                        : finishedElsewhere === 'failed'
                          ? 'chat.failedElsewhere'
                          : 'chat.answerElsewhere',
                    )}
                  </Text>
                  <Text style={styles.busyAction}>{t('chat.showTab')}</Text>
                </Pressable>
              )}

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
                    onPress={() => onResearchChange(!research)}
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
                      : listening
                        ? 'voice.listening'
                        : research
                          ? 'chat.researchPlaceholder'
                          : 'chat.placeholder',
                  )}
                  multiline
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
                    onPress={onStop}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.stop')}
                  >
                    <Icon name="stop" size={16} color="#ffffff" />
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.sendButton, !canSend && styles.sendDisabled]}
                    onPress={send}
                    accessibilityLabel={t('common.send')}
                  >
                    <Icon name="send" size={20} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            </View>
          </KeyboardAvoidingContainer>
        </Animated.View>
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
      <ActionSheet
        title={menu ? menuTitle(menu.item.text) : null}
        actions={menu ? menuActions(menu) : []}
        dark={dark}
        onClose={() => setMenu(null)}
      />
    </PanelTheme.Provider>
  );
}

/**
 * The empty chat: what Qutai can do, with suggestions that fit the page on screen (agent/pageSuggestions.ts, picked
 * on the phone). A tap sends one, like the quick chips.
 */
function EmptyState({
  hasPage,
  animate,
  suggestions,
  onSuggestion,
  recentTasks,
  onRunTask,
}: {
  hasPage: boolean;
  animate: boolean;
  suggestions: Suggestion[];
  /** Null while a task runs (here or in another tab): the rows are shown but can't be tapped. */
  onSuggestion: ((suggestion: Suggestion) => void) | null;
  recentTasks: SavedTask[];
  onRunTask: (task: SavedTask) => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const d = useContext(PanelTheme);
  return (
    <View style={styles.emptyBox}>
      <QutaiMark size={40} sweepWhenIdle animate={animate} />
      <Text style={styles.emptyTitle} accessibilityRole="header">
        {t('chat.emptyTitle')}
      </Text>
      <Text style={styles.emptyLead}>{t(hasPage ? 'chat.emptyLeadPage' : 'chat.emptyLeadWeb')}</Text>
      {recentTasks.length > 0 ? (
        <View style={styles.taskChips}>
          {recentTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => onRunTask(task)}
              style={({ pressed }) => [styles.chip, styles.taskChip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('tasks.runLabel', { name: task.name })}
            >
              <Icon name="tasks" size={15} color={palette.textSecondary} />
              <Text style={[styles.chipText, styles.shrink]} numberOfLines={1}>
                {task.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {suggestions.length > 0 ? (
        <View style={styles.examples}>
          <Text style={[styles.suggestTitle, d?.dim]} accessibilityRole="header">
            {t(suggestions.every((x) => x.general) ? 'suggest.titleWeb' : 'suggest.title')}
          </Text>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              onPress={onSuggestion ? () => onSuggestion(suggestion) : undefined}
              disabled={!onSuggestion}
              style={({ pressed }) => [
                styles.example,
                d?.chip,
                pressed && (d?.pressed ?? styles.pressed),
                !onSuggestion && styles.sendDisabled,
              ]}
              accessibilityRole="button"
              accessibilityHint={t('suggest.hint')}
              accessibilityState={{ disabled: !onSuggestion }}
            >
              <Icon name={suggestion.icon} size={18} color={palette.tintText} />
              <Text style={[styles.exampleText, d?.text]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                {suggestion.label}
              </Text>
              <Icon name="send" size={16} color={palette.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
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
  const styles = useStyles();
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

function HeaderButton({
  icon,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.headerButton} accessibilityLabel={accessibilityLabel}>
      <Icon name={icon} size={20} color={palette.textSecondary} />
    </Pressable>
  );
}

export type MessageAction = 'copy' | 'speak' | 'stopSpeaking' | 'share' | 'pdf';

/** A message's first words as the title of its menu, without Markdown marks. */
function menuTitle(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function ChatRow({
  item,
  reading,
  selectable,
  onAction,
  onMenu,
  onOpenLink,
  onCall,
  onSms,
  onWhatsApp,
  onFile,
  onImage,
  onShare,
  onOpenSource,
  onChoose,
  answered,
  onOpenAttachment,
  onItemAction,
  cost,
  costConversation,
  listWidth,
}: {
  item: ChatItem;
  /** The answer's figure for its row of icons (only when the cost display is on). */
  cost?: AnswerCost;
  costConversation: () => AnswerCost[];
  /** The message list's width (null until measured), for what fits beside the icons. */
  listWidth: number | null;
  onOpenAttachment: (info: AttachmentInfo) => void;
  /** An error's way out (`item.action`). */
  onItemAction?: (action: ChatItemAction) => void;
  onImage: (action: 'share' | 'save', info: AttachmentInfo) => void;
  /** This answer is being read aloud. */
  reading: boolean;
  /** This answer's text can be selected (chosen from its menu). */
  selectable: boolean;
  onAction: (action: MessageAction) => void;
  /** Opens the message's menu; full when opened by long press (it then lists the row's actions too). */
  onMenu: (full: boolean) => void;
  onOpenLink: (url: string) => void;
  onCall: (number: string) => void;
  onSms: (offer: SmsOffer) => void;
  onWhatsApp: (offer: WhatsAppOffer) => void;
  onFile: (action: 'share' | 'save', file: FileOffer) => void;
  onShare: (offer: ShareOffer) => void;
  onOpenSource: (source: Source) => void;
  /** Set while the question can still be answered. */
  onChoose?: (itemId: string, option: string) => void;
  /**
   * The question was answered (an option tapped, or a reply typed): its options are gone and the user's own bubble
   * below says the answer, so the chat reads as question, answer.
   */
  answered?: boolean;
}) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const textStyle = styles.assistantText;
  const wide = item.kind === 'assistant' && hasTable(item.text);
  switch (item.kind) {
    case 'user':
      return (
        <View style={styles.userRow}>
          {item.attachments?.length ? (
            <View style={styles.sentThumbs}>
              {item.attachments.map((a, i) => (
                <AttachmentThumb key={a.id} info={a} index={i} size={72} onPress={() => onOpenAttachment(a)} />
              ))}
            </View>
          ) : null}
          {item.text ? (
            // Long press: Copy, Save as task (no row under the user's own messages: it would repeat under every one).
            <Pressable
              onLongPress={() => {
                bump();
                onMenu(true);
              }}
              style={[styles.bubble, styles.userBubble]}
              accessibilityHint={t('chat.userMessageHint')}
              accessibilityActions={[{ name: 'longpress', label: t('chat.moreActions') }]}
              onAccessibilityAction={() => onMenu(true)}
            >
              <Text style={styles.userText}>{item.text}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    case 'assistant': {
      const bubbleStyle = [styles.bubble, styles.assistantBubble, d?.assistantBubble, wide && styles.wideBubble];
      const markdown = (
        <MarkdownText
          text={item.streaming ? `${item.text} ▍` : item.text}
          style={textStyle}
          onOpenLink={onOpenLink}
          onCall={onCall}
          dark={!!d}
          selectable={selectable}
        />
      );
      return (
        // Tables need the room: the message spans the panel instead of shrink-wrapping at 90%.
        <View style={[styles.assistantRow, wide && styles.wideRow]}>
          {/* Long press: every action by name. Once "Select text" is chosen, a long press selects instead
              (a Pressable around the text would keep it from being selected). */}
          {item.streaming || selectable ? (
            <View style={bubbleStyle}>{markdown}</View>
          ) : (
            <Pressable
              onLongPress={() => {
                bump();
                onMenu(true);
              }}
              style={bubbleStyle}
              // Not one element for screen readers: its links stay reachable, and the row below has every action.
              accessible={false}
            >
              {markdown}
            </Pressable>
          )}
          {item.streaming ? null : (
            <View style={styles.messageActions}>
              <ActionIcon icon="copy" label={t('chat.actionCopy')} onPress={() => onAction('copy')} />
              <ActionIcon
                icon={reading ? 'stopReading' : 'readAloud'}
                label={t(reading ? 'chat.actionStopReading' : 'chat.actionRead')}
                onPress={() => onAction(reading ? 'stopSpeaking' : 'speak')}
              />
              <ActionIcon icon="share" label={t('chat.actionShare')} onPress={() => onAction('share')} />
              <ActionIcon icon="ellipsis" label={t('chat.moreActions')} onPress={() => onMenu(false)} />
              {cost ? (
                <AnswerCostInline
                  cost={cost}
                  conversation={costConversation}
                  room={
                    listWidth === null
                      ? null
                      : (listWidth - 2 * LIST_PADDING) * (wide ? 1 : ROW_MAX) - ACTION_ICONS * ACTION_ICON_WIDTH
                  }
                  color={d ? '#a9a8b3' : palette.textSecondary}
                />
              ) : null}
            </View>
          )}
        </View>
      );
    }
    case 'choices':
      return (
        <View style={styles.choices}>
          <View style={[styles.bubble, styles.assistantBubble, d?.assistantBubble]}>
            <MarkdownText text={item.text} style={textStyle} onOpenLink={onOpenLink} onCall={onCall} dark={!!d} />
          </View>
          {answered
            ? null
            : (item.options ?? []).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => onChoose?.(item.id, option)}
                  disabled={!onChoose}
                  style={({ pressed }) => [
                    styles.choice,
                    d?.choice,
                    !onChoose && styles.choiceClosed,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !onChoose }}
                >
                  <Text style={[styles.choiceText, styles.choiceLabel]}>{option}</Text>
                </Pressable>
              ))}
        </View>
      );
    case 'sources':
      return (
        <View style={styles.sources}>
          {item.sources?.length ? <Text style={styles.sourcesTitle}>{t('chat.sources')}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourcesRow}>
            {(item.sources ?? []).map((source, i) => (
              <Pressable
                key={source.url}
                onPress={() => onOpenSource(source)}
                style={({ pressed }) => [styles.source, d?.chip, pressed && styles.pressed]}
                accessibilityRole="link"
                accessibilityLabel={source.title || hostOf(source.url)}
              >
                <Text style={[styles.sourceTitle, d?.text]} numberOfLines={2}>
                  <Text style={styles.sourceIndex}>{i + 1} </Text>
                  {source.title || hostOf(source.url)}
                </Text>
                <View style={styles.sourceHostRow}>
                  {source.incognito ? (
                    <Icon name="incognito" size={12} color={d?.dim.color ?? palette.textSecondary} />
                  ) : null}
                  <Text style={[styles.sourceHost, styles.sourceHostText]} numberOfLines={1}>
                    {hostOf(source.url)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {item.searchWidget ? <SearchSuggestions html={item.searchWidget} onOpenLink={onOpenLink} /> : null}
        </View>
      );
    case 'call': {
      const call = item.call;
      if (!call) return <StepLine icon="phone" text={item.text} />;
      return (
        <View style={[styles.callCard, d?.assistantBubble]}>
          <View style={styles.callInfo}>
            {call.name ? (
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {call.name}
              </Text>
            ) : null}
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {call.number}
            </Text>
          </View>
          <Pressable
            onPress={() => onCall(call.number)}
            style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={
              call.name
                ? t('chat.callLabel', { name: call.name, number: call.number })
                : t('chat.callNumberLabel', { number: call.number })
            }
          >
            <Icon name="phone" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.call')}</Text>
          </Pressable>
        </View>
      );
    }
    case 'sms': {
      const sms = item.sms;
      if (!sms) return <StepLine icon="message" text={item.text} />;
      const label = sms.name
        ? t('chat.smsLabel', { name: sms.name, number: sms.number })
        : t('chat.smsNumberLabel', { number: sms.number });
      return (
        <View style={[styles.smsCard, d?.assistantBubble]}>
          <View style={styles.callInfo}>
            {sms.name ? (
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {sms.name}
              </Text>
            ) : null}
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {sms.number}
            </Text>
          </View>
          <Text style={[styles.smsBody, d?.text]} selectable>
            {sms.body}
          </Text>
          <Pressable
            onPress={() => onSms(sms)}
            style={({ pressed }) => [styles.callButton, styles.smsButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Icon name="message" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.openInMessages')}</Text>
          </Pressable>
        </View>
      );
    }
    case 'whatsapp': {
      const wa = item.whatsapp;
      if (!wa) return <StepLine icon="message" text={item.text} />;
      const label = wa.number
        ? t('chat.whatsAppLabel', { who: wa.name ? `${wa.name}, ${wa.number}` : wa.number })
        : t('chat.whatsAppNoNumberLabel');
      return (
        <View style={[styles.smsCard, d?.assistantBubble]}>
          <View style={styles.callInfo}>
            {wa.name ? (
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {wa.name}
              </Text>
            ) : null}
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {wa.number ?? t('chat.whatsAppPickChat')}
            </Text>
          </View>
          <Text style={[styles.smsBody, d?.text]} selectable>
            {wa.body}
          </Text>
          <Pressable
            onPress={() => onWhatsApp(wa)}
            style={({ pressed }) => [styles.callButton, styles.smsButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Icon name="message" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.openInWhatsApp')}</Text>
          </Pressable>
        </View>
      );
    }
    case 'file': {
      const file = item.file;
      if (!file) return <StepLine icon="document" text={item.text} />;
      const details = [
        file.format.toUpperCase(),
        formatSize(file.size),
        ...(file.rows !== undefined ? [t('chat.fileRows', { count: formatNumber(file.rows) })] : []),
      ].join(' · ');
      const available = composedFileAvailable(file.id);
      return (
        <View style={[styles.smsCard, d?.assistantBubble]}>
          <View style={styles.fileHeader}>
            <Icon name="document" size={22} color={palette.textSecondary} />
            <View style={styles.callInfo}>
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {file.name}
              </Text>
              <Text style={[styles.callNumber, d?.dim]}>{details}</Text>
            </View>
          </View>
          {available ? (
            <View style={styles.fileButtons}>
              {Platform.OS === 'android' ? (
                <Pressable
                  onPress={() => onFile('save', file)}
                  style={({ pressed }) => [styles.fileButton, d?.chip, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.fileSaveLabel', { name: file.name })}
                >
                  <Icon name="download" size={17} color={palette.tintText} />
                  <Text style={styles.fileButtonText}>{t('chat.fileSave')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => onFile('share', file)}
                style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('chat.fileShareLabel', { name: file.name })}
              >
                <Icon name="share" size={17} color={palette.onTint} />
                <Text style={styles.callButtonText}>
                  {t(Platform.OS === 'ios' ? 'chat.fileShareIos' : 'chat.fileShare')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.callNumber, d?.dim]}>{t('chat.fileExpired')}</Text>
          )}
        </View>
      );
    }
    case 'image': {
      const image = item.attachments?.[0];
      if (!image) return <StepLine icon="image" text={item.text} />;
      return <ImageCard info={image} expired={!!item.expired} onOpen={onOpenAttachment} onImage={onImage} />;
    }
    case 'pdf': {
      const pdf = item.attachments?.[0];
      if (!pdf) return <StepLine icon="pdf" text={item.text} />;
      return <PdfCard info={pdf} onOpen={onOpenAttachment} onPdf={onImage} />;
    }
    case 'share': {
      const share = item.share;
      if (!share) return <StepLine icon="share" text={item.text} />;
      return <ShareCard share={share} onOpen={onOpenAttachment} onShare={onShare} />;
    }
    case 'error':
      if (item.action && onItemAction) {
        const action = item.action;
        return (
          <View>
            <StepLine icon="insecure" text={item.text} error />
            {item.details ? <ErrorDetails details={item.details} /> : null}
            <Pressable
              onPress={() => onItemAction(action)}
              style={({ pressed }) => [styles.itemAction, pressed && styles.itemActionPressed]}
              accessibilityRole="button"
              hitSlop={6}
            >
              <Icon name={action === 'buyCredits' ? 'wallet' : 'person'} size={16} color={palette.tintText} />
              <Text style={styles.itemActionText}>{t(action === 'buyCredits' ? 'buy.open' : 'credits.signInOrChoose')}</Text>
            </Pressable>
          </View>
        );
      }
      if (item.details) {
        return (
          <View>
            <StepLine icon="insecure" text={item.text} error />
            <ErrorDetails details={item.details} />
          </View>
        );
      }
      return <StepLine icon="insecure" text={item.text} error />;
    default:
      return <StepLine icon={item.icon} text={item.text} />;
  }
}

/**
 * A finished task's steps folded into one line ("7 steps · opened 2 pages · filled 1 form"); a tap shows the step
 * lines as they were recorded, and hides them again.
 */
function StepGroup({ items, expanded, onToggle }: { items: ChatItem[]; expanded: boolean; onToggle: () => void }) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const summary = stepSummaryText(summarizeSteps(items));
  const color = d?.dim.color ?? palette.textSecondary;
  return (
    <View style={styles.stepGroup}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.stepSummary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t(expanded ? 'steps.hideA11y' : 'steps.showA11y', { summary })}
      >
        <Icon name="tool" size={14} color={color} style={styles.stepIcon} />
        <Text style={[styles.action, d?.dim, styles.stepText]}>{summary}</Text>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={13} color={color} style={styles.stepIcon} />
      </Pressable>
      {expanded
        ? items.map((item) =>
            item.kind === 'error' ? (
              <StepLine key={item.id} icon="insecure" text={item.text} error />
            ) : (
              <StepLine key={item.id} icon={item.icon} text={item.text} />
            ),
          )
        : null}
    </View>
  );
}

/** An assistant step, a status line, an error or an older card's text: a small icon, then the text. */
function StepLine({ icon, text, error }: { icon?: IconName; text: string; error?: boolean }) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const color = error ? palette.danger : (d?.dim.color ?? palette.textSecondary);
  return (
    <View style={styles.stepLine}>
      {icon ? <Icon name={icon} size={error ? 15 : 14} color={color} style={styles.stepIcon} /> : null}
      <Text style={[error ? styles.error : [styles.action, d?.dim], styles.stepText]}>{withoutLeadingSymbol(text)}</Text>
    </View>
  );
}

/** An image the assistant made (edit_image): preview, size, format and bytes, Save to Photos and Share. */
function ImageCard({
  info,
  expired,
  onOpen,
  onImage,
}: {
  info: AttachmentInfo;
  expired: boolean;
  onOpen: (info: AttachmentInfo) => void;
  onImage: (action: 'share' | 'save', info: AttachmentInfo) => void;
}) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const available = useMemo(() => !expired && attachmentAvailable(info.id), [expired, info.id]);
  const details = [
    info.width && info.height ? `${info.width}×${info.height}` : '',
    imageFormatLabel(info.mimeType),
    formatSize(info.size),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.smsCard, d?.assistantBubble]}>
      <View style={styles.fileHeader}>
        <AttachmentThumb info={info} index={0} size={64} onPress={() => onOpen(info)} />
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2}>
            {info.name}
          </Text>
          <Text style={[styles.callNumber, d?.dim]}>{details}</Text>
        </View>
      </View>
      {available ? (
        <View style={styles.fileButtons}>
          <Pressable
            onPress={() => onImage('save', info)}
            style={({ pressed }) => [styles.fileButton, d?.chip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.imageSaveLabel', { name: info.name })}
          >
            <Icon name="download" size={17} color={palette.tintText} />
            <Text style={styles.fileButtonText}>{t('chat.imageSave')}</Text>
          </Pressable>
          <Pressable
            onPress={() => onImage('share', info)}
            style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.fileShareLabel', { name: info.name })}
          >
            <Icon name="share" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.fileShare')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.callNumber, d?.dim]}>{t(expired ? 'chat.imageExpired' : 'attach.gone')}</Text>
      )}
    </View>
  );
}

/** A PDF Qutai made (save_pdf, or an answer saved as a PDF): name and size, Save (Android) and Share. */
function PdfCard({
  info,
  onOpen,
  onPdf,
}: {
  info: AttachmentInfo;
  onOpen: (info: AttachmentInfo) => void;
  onPdf: (action: 'share' | 'save', info: AttachmentInfo) => void;
}) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const available = useMemo(() => attachmentAvailable(info.id), [info.id]);
  return (
    <View style={[styles.smsCard, d?.assistantBubble]}>
      <View style={styles.fileHeader}>
        <AttachmentThumb info={info} index={0} size={56} onPress={() => onOpen(info)} />
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2}>
            {info.name}
          </Text>
          <Text style={[styles.callNumber, d?.dim]}>{`${t('chat.pdfPages')} · ${formatSize(info.size)}`}</Text>
        </View>
      </View>
      {available ? (
        <View style={styles.fileButtons}>
          {Platform.OS === 'android' ? (
            <Pressable
              onPress={() => onPdf('save', info)}
              style={({ pressed }) => [styles.fileButton, d?.chip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('chat.fileSaveLabel', { name: info.name })}
            >
              <Icon name="download" size={17} color={palette.tintText} />
              <Text style={styles.fileButtonText}>{t('chat.fileSave')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onPdf('share', info)}
            style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.fileShareLabel', { name: info.name })}
          >
            <Icon name="share" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t(Platform.OS === 'ios' ? 'chat.fileShareIos' : 'chat.fileShare')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.callNumber, d?.dim]}>{t('attach.gone')}</Text>
      )}
    </View>
  );
}

/**
 * A share the assistant prepared (share), or the files an email draft took: who it is for, the files (thumbnails of
 * images, names of other files), the text, what the user does next, and for a share the button that opens WhatsApp
 * or the share sheet. Nothing is sent from here: the user picks the chat or app and sends.
 */
function ShareCard({
  share,
  onOpen,
  onShare,
}: {
  share: ShareOffer;
  onOpen: (info: AttachmentInfo) => void;
  onShare: (offer: ShareOffer) => void;
}) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const fileNames = share.files.map((f) => f.name).join(', ');
  const who = [share.name, share.number].filter(Boolean).join(', ');
  const email = share.app === 'email';
  return (
    <View style={[styles.smsCard, d?.assistantBubble]}>
      {email ? (
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2}>
            {share.subject ? t('chat.emailDraftTitle', { subject: share.subject }) : t('chat.emailNoSubject')}
          </Text>
          {share.to?.length ? (
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {t('chat.emailTo', { to: share.to.join(', ') })}
            </Text>
          ) : null}
        </View>
      ) : who ? (
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2} selectable>
            {share.app === 'whatsapp' ? t('chat.shareLookFor', { who }) : who}
          </Text>
        </View>
      ) : null}
      {share.files.length ? (
        <View style={styles.shareFiles}>
          {share.files.map((f, i) =>
            f.attachment ? (
              <AttachmentThumb key={f.id} info={f.attachment} index={i} size={64} onPress={() => onOpen(f.attachment!)} />
            ) : (
              <View key={f.id} style={styles.shareFileChip} accessible accessibilityLabel={`${f.name}, ${formatSize(f.size)}`}>
                <Icon name="document" size={18} color={palette.textSecondary} />
                <Text style={[styles.callNumber, d?.text]} numberOfLines={2}>
                  {f.name}
                </Text>
              </View>
            ),
          )}
        </View>
      ) : null}
      {share.files.some((f) => f.attachment) ? (
        <Text style={[styles.callNumber, d?.dim]} numberOfLines={3}>
          {fileNames}
        </Text>
      ) : null}
      {share.original ? <Text style={[styles.callNumber, d?.dim]}>{t('chat.shareOriginal')}</Text> : null}
      {share.text ? (
        <Text style={[styles.smsBody, d?.text]} selectable>
          {share.text}
        </Text>
      ) : null}
      <Text style={[styles.callNumber, d?.dim]}>
        {email
          ? t(share.delivered === 'share' ? 'chat.emailFilesShared' : 'chat.emailFilesComposer')
          : t(share.app === 'whatsapp' ? 'chat.sharePickChat' : 'chat.sharePickApp')}
      </Text>
      {!email && share.copiesText ? (
        <Text style={[styles.callNumber, d?.dim]}>
          {t(share.app === 'whatsapp' ? 'chat.shareCopiesTextWhatsApp' : 'chat.shareCopiesText')}
        </Text>
      ) : null}
      {!email ? (
        <Pressable
          onPress={() => onShare(share)}
          style={({ pressed }) => [styles.callButton, styles.smsButton, pressed && styles.callButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={t(share.app === 'whatsapp' ? 'chat.shareToWhatsAppLabel' : 'chat.shareToLabel', {
            files: fileNames || t('chat.shareTo'),
          })}
        >
          <Icon name={share.app === 'whatsapp' ? 'message' : 'share'} size={17} color={palette.onTint} />
          <Text style={styles.callButtonText}>{t(share.app === 'whatsapp' ? 'chat.shareToWhatsApp' : 'chat.shareTo')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * An icon under an answer: quiet (secondary colour), 44pt wide and 36pt tall plus 4pt of slop above and
 * below, so it is a 44pt target. Icons are drawn in points, so the row keeps its width at any font size.
 */
function ActionIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.actionIcon, pressed && (d ? d.pressed : styles.pressed)]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={d ? '#a9a8b3' : palette.textSecondary} />
    </Pressable>
  );
}

/** The message list's padding, an answer's widest share of it, and its icons (copy, read aloud, share, more). */
const LIST_PADDING = 12;
const ROW_MAX = 0.9;
const ACTION_ICONS = 4;
const ACTION_ICON_WIDTH = 44;

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  assistantRow: { alignSelf: 'flex-start', maxWidth: `${ROW_MAX * 100}%`, gap: 4 },
  wideRow: { alignSelf: 'stretch', maxWidth: '100%' },
  wideBubble: { alignSelf: 'stretch' },
  // The first icon (18pt in a 44pt button) starts about where the answer's text does (12pt in the bubble).
  messageActions: { flexDirection: 'row', marginLeft: -1 },
  actionIcon: { width: ACTION_ICON_WIDTH, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: '#ebe8e0' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: c.bg,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: -2, height: 0 },
    elevation: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 56,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
  },
  title: { fontWeight: '700', fontSize: 17 },
  status: { color: c.textSecondary, fontSize: 12, marginTop: 1, flexShrink: 1 },
  statusChosen: { color: c.tintText },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statusIcon: { marginTop: 1 },
  headerTitle: { flex: 1, marginLeft: 10, marginRight: 8 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerButtonText: { fontSize: 18, color: c.textSecondary },
  messagesContent: { padding: LIST_PADDING, gap: 8 },
  emptyBox: { alignItems: 'center', gap: 8, paddingTop: 16, paddingHorizontal: 4 },
  emptyTitle: { color: c.text, fontSize: 19, fontWeight: '700', marginTop: 6 },
  emptyLead: { color: c.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  examples: { alignSelf: 'stretch', gap: 8, marginTop: 10 },
  suggestTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  taskChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  exampleText: { flex: 1, color: c.text, fontSize: 14.5, lineHeight: 20 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: c.tint },
  userRow: { alignItems: 'flex-end', gap: 4 },
  sentThumbs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, maxWidth: '90%' },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingRow: { flexGrow: 0, maxHeight: 76 },
  pendingContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, gap: 10 },
  attachButton: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  userText: { color: c.onTint, fontSize: 15 },
  assistantText: { color: c.text, fontSize: 15, lineHeight: 21 },
  action: { color: c.textSecondary, fontSize: 12, marginLeft: 4 },
  error: { color: c.danger, fontSize: 13, marginLeft: 4 },
  stepLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginLeft: 4 },
  itemAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
    marginLeft: 24,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.tint,
  },
  itemActionPressed: { opacity: 0.7 },
  itemActionText: { color: c.tintText, fontSize: 14, fontWeight: '600' },
  stepIcon: { marginTop: 1 },
  stepGroup: { gap: 6 },
  // A full-height touch target around the small line.
  stepSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4, minHeight: 44, alignSelf: 'flex-start' },
  stepText: { marginLeft: 0, flexShrink: 1 },
  sources: { alignSelf: 'stretch', gap: 4 },
  sourcesTitle: { fontSize: 12, color: c.textSecondary, marginLeft: 4 },
  sourcesRow: { gap: 6, paddingRight: 8 },
  source: {
    width: 150,
    padding: 8,
    gap: 2,
    borderRadius: 10,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  sourceIndex: { color: c.tintText, fontWeight: '700' },
  sourceTitle: { fontSize: 12.5, color: c.text, lineHeight: 16 },
  sourceHost: { fontSize: 11, color: c.textSecondary },
  sourceHostRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sourceHostText: { flexShrink: 1 },
  choices: { alignSelf: 'stretch', gap: 6 },
  choice: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.tint,
    backgroundColor: c.surface,
  },
  choiceClosed: { opacity: 0.4 },
  choiceText: { fontSize: 15, color: c.tintText, fontWeight: '600' },
  choiceLabel: { flexShrink: 1 },
  callCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  callInfo: { flex: 1, gap: 2 },
  callName: { fontSize: 15, fontWeight: '600', color: c.text },
  callNumber: { fontSize: 14, color: c.textSecondary, fontVariant: ['tabular-nums'] },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: c.tint,
  },
  callButtonPressed: { opacity: 0.8 },
  smsCard: {
    alignSelf: 'stretch',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  smsBody: {
    fontSize: 15,
    color: c.text,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: c.separator,
  },
  smsButton: { alignSelf: 'flex-end', justifyContent: 'center' },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareFiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shareFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  fileButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
    backgroundColor: c.surface,
  },
  fileButtonText: { flexShrink: 1, color: c.tintText, fontSize: 15, fontWeight: '700' },
  callButtonText: { flexShrink: 1, color: c.onTint, fontSize: 15, fontWeight: '700' },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginHorizontal: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: c.dark ? '#1c2b3d' : '#e3eefb',
  },
  busyText: { flex: 1, fontSize: 13, color: c.text },
  busyAction: { fontSize: 13, fontWeight: '700', color: c.tintText },
  // The buttons give the row its height; each keeps a 44 pt target.
  lowCredits: { paddingVertical: 0, paddingRight: 0 },
  lowCreditsAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  lowCreditsClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { flexGrow: 0 },
  // Room under the chips too, so they don't sit on the message row's top line.
  chipsContent: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  chipText: { fontSize: 13, color: c.text },
  taskChip: { maxWidth: '100%' },
  shrink: { flexShrink: 1 },
  chipOn: { backgroundColor: c.tint, borderColor: c.tint },
  chipTextOn: { color: c.onTint, fontWeight: '600' },
  modeHint: { fontSize: 12, lineHeight: 17, color: c.textSecondary, paddingHorizontal: 12, paddingBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.separator,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  // The input while the task works: dimmed, and its text (kept to send later) too.
  inputBusy: { opacity: 0.55 },
  micWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  langTag: {
    minWidth: 30,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langTagText: { fontSize: 11, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.5 },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  micOn: { backgroundColor: c.danger, borderColor: c.danger },
  micPending: { opacity: 0.6 },
  micRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.danger,
    opacity: 0.25,
  },
  stopButton: { backgroundColor: '#444' },
  sendText: { color: c.onTint, fontSize: 18, fontWeight: '700' },
}));

const darkStyles = StyleSheet.create({
  panel: { backgroundColor: '#1f1e24' },
  header: { borderBottomColor: '#3a3944' },
  inputRow: { borderTopColor: '#3a3944' },
  input: { backgroundColor: '#2b2a33', borderColor: '#42414d', color: '#f2f1f5' },
  micButton: { backgroundColor: '#2b2a33', borderColor: '#42414d' },
  langTag: { backgroundColor: '#2b2a33', borderColor: '#42414d' },
  langTagText: { color: '#a9a8b3' },
  chip: { backgroundColor: '#2b2a33', borderColor: '#42414d' },
  choice: { backgroundColor: '#2b2a33' },
  text: { color: '#f2f1f5' },
  dim: { color: '#9a99a3' },
  assistantBubble: { backgroundColor: '#2b2a33', borderColor: '#3a3944' },
  busy: { backgroundColor: '#1c2b3d' },
  pressed: { backgroundColor: '#3a3944' },
});
