import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Suggestion } from '../agent/pageSuggestions';
import type { Source } from '../agent/types';
import type { AttachmentInfo } from '../chat/attachments';
import type { Conversation } from '../chat/Conversation';
import { nextFollowing } from '../chat/followEnd';
import type { ShareOffer } from '../chat/shareable';
import { segmentChat } from '../chat/stepSummary';
import type { FileOffer } from '../device/composedFile';
import { tick } from '../device/haptics';
import type { SmsOffer } from '../device/sms';
import { useIsSpeaking } from '../device/speech';
import { stopVoiceInput, type VoiceOnline } from '../device/voiceInput';
import type { WhatsAppOffer } from '../device/whatsapp';
import { t } from '../i18n';
import type { SavedTask } from '../storage/savedTasks';
import { GradientText } from '../ui/BrandGradient';
import { Icon, type IconName } from '../ui/Icon';
import { panelHeaderHeight, panelWidth } from '../ui/layout';
import { QutaiMark } from '../ui/QutaiMark';
import { usePalette } from '../ui/theme';
import { useKeyboardVisible } from '../utils/useKeyboardVisible';
import { useReduceMotion } from '../utils/useReduceMotion';
import { ActionSheet, type SheetAction } from './ActionSheet';
import { reportAnswer } from './reportFlow';
import { reportsAvailable } from '../report/report';
import { ChatComposer } from './ChatComposer';
import { ChatActions, ChatEntry, EmptyState, menuTitle, StepGroup, type ChatActionHandlers } from './ChatRows';
import { darkStyles, PanelTheme, useChatStyles } from './chatStyles';
import type { CardAction, ChatItem, ChatItemAction, MessageAction } from './chatTypes';
import { KeyboardAvoidingContainer } from './KeyboardAware';
import { statusFullFits, statusLabelFits } from './statusFit';
import { useConversation } from './useConversation';

export type { CardAction, ChatItem, ChatItemAction, MessageAction } from './chatTypes';

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

export type AssistantPanelProps = Props;

type Props = {
  open: boolean;
  quickActions: QuickAction[];
  /**
   * The conversation shown. The panel follows it itself, so a streamed piece of an answer or a typed letter redraws
   * the panel and not the whole app (UI-29). Its draft is the message being typed; the app owns it so other features
   * (e.g. selected text) can prefill it.
   */
  conversation: Conversation;
  onDraftChange: (text: string) => void;
  /** The next message runs as deep research. */
  research: boolean;
  onResearchChange: (on: boolean) => void;
  /** Bumped to focus the input, e.g. after prefilling a quote. */
  focusRequest: number;
  running: boolean;
  /** Another tab's conversation is running a task (only one runs at a time). */
  busyElsewhere: boolean;
  /**
   * The panel is closing because a task started (docs/working-mode.md): it drops down into the step strip instead of
   * sliding back to the side.
   */
  collapseToStrip?: boolean;
  onShowRunningTab: () => void;
  /** How a task ended in another tab's or group's conversation that the user has not looked at since. */
  finishedElsewhere: 'done' | 'failed' | 'needsAnswer' | null;
  onShowFinished: () => void;
  /** Provider and model shown under the title, e.g. "OpenAI · GPT-5.6 Terra". */
  modelInfo: string;
  /** The conversation has its own model choice (modelInfo then says so). */
  modelChosen?: boolean;
  /** The model alone, without the provider ("Claude Sonnet 5.5"): shown instead of modelInfo when that does not fit. */
  modelName?: string;
  /** Qutai Credits: the balance ("12.34 credits"), shown after modelInfo and never shortened. */
  balance?: string | null;
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
  /** A long press on a link in an answer: its menu. */
  onLinkMenu?: (url: string, text: string) => void;
  /** A Call button or a tel: link in an answer was tapped; number is already normalised. */
  onCall: (number: string) => void;
  /** A button on a style or cookies card (pageCustomisation.tsx). */
  onCard?: (item: ChatItem, action: CardAction) => void;
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

/**
 * Side panel that slides in from the right over the page, like the Chrome
 * side panel. It stays mounted while closed so the conversation keeps its
 * scroll position. Its rows are in ChatRows.tsx, its bottom in ChatComposer.tsx.
 */
function AssistantPanelView({
  open,
  quickActions,
  conversation,
  onDraftChange: setText,
  focusRequest,
  research,
  onResearchChange,
  running,
  busyElsewhere,
  collapseToStrip = false,
  onShowRunningTab,
  finishedElsewhere,
  onShowFinished,
  modelInfo,
  modelName,
  balance = null,
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
  onLinkMenu,
  onCall,
  onCard,
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
  useConversation(conversation);
  const items = conversation.items;
  const text = conversation.draft;
  const styles = useChatStyles();
  const palette = usePalette();
  const d = dark ? darkStyles : null;
  const speaking = useIsSpeaking();
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  // About half the screen when it is wider than tall, so the page stays beside it (docs/landscape.md).
  const width = panelWidth({ width: screenWidth, height: screenHeight });
  const headerHeight = panelHeaderHeight({ width: screenWidth, height: screenHeight });
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const reduceMotion = useReduceMotion();

  const [progress] = useState(() => new Animated.Value(0));
  /** 0 → 1 while the panel drops into the step strip (then it is closed and this is 0 again). */
  const [drop] = useState(() => new Animated.Value(0));
  const collapseRef = useRef(collapseToStrip);
  // Before the effect below reads it (effects run in order).
  useEffect(() => {
    collapseRef.current = collapseToStrip;
  }, [collapseToStrip]);
  /** The message whose menu is open; full: opened by long press, so it lists the row's icons too. */
  const [menu, setMenu] = useState<{ item: ChatItem; full: boolean } | null>(null);
  /** The answer being read aloud (Read aloud turns into Stop on that one only). */
  const [readingId, setReadingId] = useState<string | null>(null);
  /** The answer whose text was made selectable from its menu (selecting would otherwise fight the long press). */
  const [selectableId, setSelectableId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [listWidth, setListWidth] = useState<number | null>(null);
  // Read through a ref: the rows keep the same function, and it sees the latest items when a cost is opened.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  const costConversation = useCallback(() => itemsRef.current.flatMap((i) => (i.cost ? [i.cost] : [])), []);
  /** Folded step runs the user opened (by their first item's id). */
  const [expandedSteps, setExpandedSteps] = useState<ReadonlySet<string>>(() => new Set());
  const toggleSteps = useCallback((id: string) => {
    tick();
    setExpandedSteps((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  /** Screens over the panel hide the listening state, so the microphone stops first. */
  const leavePanel = (go: () => void) => () => {
    stopVoiceInput();
    go();
  };

  useEffect(() => {
    if (!open && collapseRef.current && !reduceMotion) {
      // Down and away into the strip, which rises at the same time; then closed as usual.
      Animated.timing(drop, { toValue: 1, duration: 260, useNativeDriver: true }).start(() => {
        progress.setValue(0);
        drop.setValue(0);
      });
    } else {
      drop.setValue(0);
      Animated.timing(progress, {
        toValue: open ? 1 : 0,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: true,
      }).start();
    }
    if (!open) Keyboard.dismiss();
  }, [open, progress, drop, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  // Follows the end only while the user is at it (UI-30): reading an earlier message while an answer streams in is
  // left alone, and a button brings the latest back.
  const following = useRef(true);
  const userScrolling = useRef(false);
  const [showJump, setShowJump] = useState(false);
  const setFollowing = (on: boolean) => {
    following.current = on;
    setShowJump((shown) => (shown === !on ? shown : !on));
  };
  const jumpToEnd = (animated: boolean) => {
    setFollowing(true);
    scrollRef.current?.scrollToEnd({ animated });
  };
  // Opening the panel shows the latest.
  useEffect(() => {
    if (!open) return;
    following.current = true;
    const timer = setTimeout(() => {
      setShowJump(false);
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);
  // A new message: shown when following (after its layout, hence the short wait).
  useEffect(() => {
    if (!open || !following.current) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [items.length, open]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const next = nextFollowing(
      following.current,
      { offset: contentOffset.y, viewport: layoutMeasurement.height, content: contentSize.height },
      userScrolling.current,
    );
    if (next !== following.current) setFollowing(next);
  };

  // Only the latest question is answerable, and only until the user has replied in some other way.
  const lastUserIndex = items.findLastIndex((item) => item.kind === 'user');
  const canChoose = (index: number) => !running && !busyElsewhere && index > lastUserIndex && !items[index].chosen;

  const messageAction = (action: MessageAction, item: ChatItem) => {
    if (action === 'speak') setReadingId(item.id);
    onMessageAction(action, item.text);
  };

  // What the rows' buttons do: functions that never change, pointing at the latest props (ChatRows.tsx).
  const latestProps = useRef({ messageAction, onChoose, onOpenLink, onLinkMenu, onCall, onCard, onSms, onWhatsApp, onFile, onImage, onShare, onOpenSource, onOpenAttachment, onItemAction });
  useEffect(() => {
    latestProps.current = { messageAction, onChoose, onOpenLink, onLinkMenu, onCall, onCard, onSms, onWhatsApp, onFile, onImage, onShare, onOpenSource, onOpenAttachment, onItemAction };
  });
  const actions = useMemo<ChatActionHandlers>(() => {
    const p = () => latestProps.current;
    return {
      onAction: (action, item) => p().messageAction(action, item),
      onMenu: (item, full) => setMenu({ item, full }),
      onChoose: (itemId, option) => p().onChoose(itemId, option),
      onOpenLink: (url) => p().onOpenLink(url),
      onLinkMenu: (url, text) => p().onLinkMenu?.(url, text),
      onCall: (number) => p().onCall(number),
      onCard: (item, action) => p().onCard?.(item, action),
      onSms: (offer) => p().onSms(offer),
      onWhatsApp: (offer) => p().onWhatsApp(offer),
      onFile: (action, file) => p().onFile(action, file),
      onImage: (action, info) => p().onImage(action, info),
      onShare: (offer) => p().onShare(offer),
      onOpenSource: (source) => p().onOpenSource(source),
      onOpenAttachment: (info) => p().onOpenAttachment(info),
      onItemAction: (action) => p().onItemAction?.(action),
    };
  }, [setMenu]);

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
      // Report (SAFE-2): only where reports reach someone (builds with Qutai's server).
      ...(reportsAvailable && item.kind === 'assistant'
        ? [
            {
              icon: 'report' as const,
              label: t('report.action'),
              onPress: () => void reportAnswer(item.text, item.cost?.provider === 'qutai' || balance ? 'qutai' : 'own'),
            },
          ]
        : []),
    ];
  };

  // The width under the title and the balance's, for whether the model's name still fits beside the balance.
  const [statusRoom, setStatusRoom] = useState(0);
  const [balanceWidth, setBalanceWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);
  const statusFits = statusLabelFits(statusRoom, balanceWidth, labelWidth, fontScale);
  // Own key: the provider and the model when both fit, otherwise the model alone.
  const statusLine = balance || !modelName || statusFullFits(statusRoom, labelWidth, fontScale) ? modelInfo : modelName;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  const dropY = drop.interpolate({ inputRange: [0, 1], outputRange: [0, 260] });
  const dropScale = drop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });
  const dropOpacity = drop.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.2, 0] });
  const backdropOpacity = Animated.multiply(progress, Animated.subtract(1, drop));

  return (
    <PanelTheme.Provider value={d}>
      <ChatActions.Provider value={actions}>
      <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('chat.closePanel')} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            d?.panel,
            { width, opacity: dropOpacity, transform: [{ translateX }, { translateY: dropY }, { scale: dropScale }] },
          ]}
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
              <View style={[styles.header, d?.header, { minHeight: headerHeight }]}>
                <QutaiMark size={24} working={running} sweepWhenIdle animate={open} />
                <View style={styles.headerTitle} onLayout={(e) => setStatusRoom(e.nativeEvent.layout.width)}>
                  {balance || modelName ? (
                    // The line at its natural width, unseen: whether it fits whole (beside the balance, if any).
                    <View
                      style={styles.measure}
                      pointerEvents="none"
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                    >
                      <Text
                        style={styles.status}
                        numberOfLines={1}
                        maxFontSizeMultiplier={1.4}
                        onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
                      >
                        {modelInfo}
                      </Text>
                    </View>
                  ) : null}
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
                    accessibilityLabel={t('chat.modelA11y', { model: balance ? `${modelInfo} · ${balance}` : modelInfo })}
                    accessibilityState={{ disabled: running }}
                  >
                    {/* Beside four buttons on a narrow phone, very large text sizes capped. Own key: the provider
                        goes first, then the model's name is shortened at its end (never cut in the middle of a
                        word like "Anthropic"). Qutai Credits: the balance is never shortened; the tier's name
                        beside it is shortened in the middle, and goes when too little of it would show. */}
                    {running || !balance || statusFits ? (
                      <Text
                        style={[styles.status, modelChosen && !running && styles.statusChosen]}
                        numberOfLines={1}
                        ellipsizeMode={balance ? 'middle' : 'tail'}
                        maxFontSizeMultiplier={1.4}
                      >
                        {running ? t('chat.working') : statusLine}
                      </Text>
                    ) : null}
                    {!running && balance ? (
                      <>
                        {statusFits ? (
                          <Text
                            style={[styles.status, styles.statusFixed, modelChosen && styles.statusChosen]}
                            maxFontSizeMultiplier={1.4}
                          >
                            {' · '}
                          </Text>
                        ) : null}
                        <Text
                          style={[styles.status, styles.statusFixed, modelChosen && styles.statusChosen]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.4}
                          onLayout={(e) => setBalanceWidth(e.nativeEvent.layout.width)}
                        >
                          {balance}
                        </Text>
                      </>
                    ) : null}
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

              <View style={styles.flex}>
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
                // Follows the end while the user is at it (UI-30).
                onContentSizeChange={() => {
                  if (open && following.current) scrollRef.current?.scrollToEnd({ animated: false });
                }}
                onScroll={onScroll}
                scrollEventThrottle={100}
                onScrollBeginDrag={() => {
                  userScrolling.current = true;
                }}
                onScrollEndDrag={() => {
                  userScrolling.current = false;
                }}
                onMomentumScrollBegin={() => {
                  userScrolling.current = true;
                }}
                onMomentumScrollEnd={() => {
                  userScrolling.current = false;
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
                    return (
                      <StepGroup
                        key={`steps-${first.id}`}
                        items={items.slice(segment.start, segment.end)}
                        expanded={expandedSteps.has(first.id)}
                        onToggle={toggleSteps}
                      />
                    );
                  }
                  const index = segment.index;
                  const item = items[index];
                  return (
                    <ChatEntry
                      key={item.id}
                      item={item}
                      reading={speaking && readingId === item.id}
                      selectable={selectableId === item.id}
                      canChoose={item.kind === 'choices' && canChoose(index)}
                      answered={item.kind === 'choices' && (!!item.chosen || index < lastUserIndex)}
                      showCost={showCost}
                      costConversation={costConversation}
                      listWidth={listWidth}
                    />
                  );
                })}
              </ScrollView>
              {showJump && items.length > 0 ? (
                <Pressable
                  onPress={() => {
                    tick();
                    jumpToEnd(true);
                  }}
                  style={[styles.jump, d?.chip]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.jumpToLatest')}
                >
                  <Icon name="chevronDown" size={20} color={palette.textSecondary} />
                </Pressable>
              ) : null}
              </View>

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

              <ChatComposer
                open={open}
                text={text}
                setText={setText}
                research={research}
                onResearchChange={onResearchChange}
                quickActions={quickActions}
                pending={pending}
                onAttach={onAttach}
                onRemovePending={onRemovePending}
                onOpenAttachment={onOpenAttachment}
                running={running}
                busyElsewhere={busyElsewhere}
                voice={voice}
                onSend={onSend}
                onStop={onStop}
                focusRequest={focusRequest}
                dark={dark}
              />
            </View>
          </KeyboardAvoidingContainer>
        </Animated.View>
      </View>
      <ActionSheet
        title={menu ? menuTitle(menu.item.text) : null}
        actions={menu ? menuActions(menu) : []}
        dark={dark}
        onClose={() => setMenu(null)}
      />
      </ChatActions.Provider>
    </PanelTheme.Provider>
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
  const styles = useChatStyles();
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Icon name={icon} size={20} color={palette.textSecondary} />
    </Pressable>
  );
}

/**
 * The panel redraws only when what it shows changed (UI-29): the app passes functions that keep their identity
 * (useStableHandlers) and the conversation, which the panel follows itself. Lists the app rebuilds on every render
 * (suggestions, one-tap tasks, recent tasks, files about to be sent) count as the same when their contents are.
 */
function samePanelProps(a: Props, b: Props): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Props>;
  for (const key of keys) {
    const x = a[key];
    const y = b[key];
    if (x === y) continue;
    if (Array.isArray(x) && Array.isArray(y) && JSON.stringify(x) === JSON.stringify(y)) continue;
    return false;
  }
  return true;
}

export const AssistantPanel = memo(AssistantPanelView, samePanelProps);
