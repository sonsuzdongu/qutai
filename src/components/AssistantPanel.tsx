import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
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
import { t } from '../i18n';
import { makeStyles, usePalette } from '../ui/theme';
import { Icon, IconName } from '../ui/Icon';
import type { Source } from '../agent/types';
import { hostOf } from '../i18n/format';
import { MarkdownText } from './MarkdownText';
import { SearchSuggestions } from './SearchSuggestions';
import { useKeyboardVisible } from '../utils/useKeyboardVisible';
import { useReduceMotion } from '../utils/useReduceMotion';

export type ChatItem = {
  id: string;
  kind: 'user' | 'assistant' | 'action' | 'error' | 'info' | 'choices' | 'sources';
  text: string;
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
};

/** A one-tap task shown above the input, e.g. "Summarize". */
export type QuickAction = { label: string; prompt: string };

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
  /** Provider and model shown under the title, e.g. "OpenAI · GPT-5.6 Terra". */
  modelInfo: string;
  onClose: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  /** An option of an ask_user question was tapped. */
  onChoose: (itemId: string, option: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onMessageAction: (action: MessageAction, text: string) => void;
  /** A link in an answer was tapped. */
  onOpenLink: (url: string) => void;
  /** A source under an answer was tapped. */
  onOpenSource: (source: Source) => void;
  dark?: boolean;
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
  modelInfo,
  onClose,
  onSend,
  onStop,
  onChoose,
  onNewChat,
  onOpenSettings,
  onMessageAction,
  onOpenLink,
  onOpenSource,
  dark = false,
}: Props) {
  const styles = useStyles();
  const d = dark ? darkStyles : null;
  const speaking = useIsSpeaking();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(Math.round(screenWidth * 0.88), MAX_WIDTH);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const reduceMotion = useReduceMotion();

  const [progress] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);

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
    if (!t || running || busyElsewhere) return;
    setText('');
    onSend(t);
  };

  // Only the latest question is answerable, and only until the user has replied in some other way.
  const lastUserIndex = items.findLastIndex((item) => item.kind === 'user');
  const canChoose = (index: number) => !running && !busyElsewhere && index > lastUserIndex && !items[index].chosen;

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
          {/* The panel spans the full screen height, so the keyboard offset needs no extra correction. */}
          <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
                <View style={styles.headerTitle}>
                  <Text style={styles.title}>{t('chat.title')}</Text>
                  <Pressable
                    onPress={onOpenSettings}
                    hitSlop={4}
                    accessibilityLabel={t('chat.modelA11y', { model: modelInfo })}
                  >
                    <Text style={styles.status} numberOfLines={1}>
                      {running ? t('chat.working') : modelInfo}
                    </Text>
                  </Pressable>
                </View>
                {items.length > 0 && !running && (
                  <HeaderButton icon="newTab" accessibilityLabel={t('chat.newChat')} onPress={onNewChat} />
                )}
                <HeaderButton icon="settings" accessibilityLabel={t('chat.settings')} onPress={onOpenSettings} />
                <HeaderButton icon="close" accessibilityLabel={t('chat.closePanel')} onPress={onClose} />
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.flex}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
                // Follow a reply while it is being written.
                onContentSizeChange={() => {
                  if (open && running) scrollRef.current?.scrollToEnd({ animated: false });
                }}
              >
                {items.length === 0 && <Text style={[styles.empty, d?.dim]}>{t('chat.empty')}</Text>}
                {items.map((item, index) => (
                  <ChatRow
                    key={item.id}
                    item={item}
                    speaking={speaking}
                    onAction={onMessageAction}
                    onOpenLink={onOpenLink}
                    onOpenSource={onOpenSource}
                    onChoose={item.kind === 'choices' && canChoose(index) ? onChoose : undefined}
                  />
                ))}
              </ScrollView>

              {busyElsewhere && (
                <Pressable onPress={onShowRunningTab} style={[styles.busy, d?.busy]} accessibilityRole="button">
                  <Text style={styles.busyText}>{t('chat.busyElsewhere')}</Text>
                  <Text style={styles.busyAction}>{t('chat.showTab')}</Text>
                </Pressable>
              )}

              {!running && !busyElsewhere && (
                <View style={styles.modeRow}>
                  <Pressable
                    onPress={() => onResearchChange(!research)}
                    style={[styles.chip, d?.chip, research && styles.chipOn]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: research }}
                  >
                    <Text style={[styles.chipText, d?.text, research && styles.chipTextOn]}>{t('chat.research')}</Text>
                  </Pressable>
                  {research ? <Text style={styles.modeHint}>{t('chat.researchHint')}</Text> : null}
                </View>
              )}

              {!running && !busyElsewhere && !research && !text.trim() && quickActions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.chips}
                  contentContainerStyle={styles.chipsContent}
                >
                  {quickActions.map((action) => (
                    <Pressable
                      key={action.label}
                      onPress={() => onSend(action.prompt)}
                      style={({ pressed }) => [styles.chip, d?.chip, pressed && styles.pressed]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, d?.text]}>{action.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={[styles.inputRow, d?.inputRow]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, d?.input]}
                  placeholderTextColor={dark ? '#a9a8b3' : '#6b6862'}
                  value={text}
                  onChangeText={setText}
                  placeholder={t(research ? 'chat.researchPlaceholder' : 'chat.placeholder')}
                  multiline
                  editable={!running}
                />
                {running ? (
                  <Pressable
                    style={[styles.sendButton, styles.stopButton]}
                    onPress={onStop}
                    accessibilityLabel={t('common.stop')}
                  >
                    <Icon name="stop" size={16} color="#ffffff" />
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.sendButton, (!text.trim() || busyElsewhere) && styles.sendDisabled]}
                    onPress={send}
                    accessibilityLabel={t('common.send')}
                  >
                    <Icon name="send" size={20} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
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
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.headerButton} accessibilityLabel={accessibilityLabel}>
      <Icon name={icon} size={20} color={palette.textSecondary} />
    </Pressable>
  );
}

export type MessageAction = 'copy' | 'speak' | 'share' | 'pdf';

function ChatRow({
  item,
  speaking,
  onAction,
  onOpenLink,
  onOpenSource,
  onChoose,
}: {
  item: ChatItem;
  speaking: boolean;
  onAction: (action: MessageAction, text: string) => void;
  onOpenLink: (url: string) => void;
  onOpenSource: (source: Source) => void;
  /** Set while the question can still be answered. */
  onChoose?: (itemId: string, option: string) => void;
}) {
  const styles = useStyles();
  const d = useContext(PanelTheme);
  const textStyle = styles.assistantText;
  switch (item.kind) {
    case 'user':
      return (
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={styles.userText} selectable>
            {item.text}
          </Text>
        </View>
      );
    case 'assistant':
      return (
        <View style={styles.assistantRow}>
          <View style={[styles.bubble, styles.assistantBubble, d?.assistantBubble]}>
            <MarkdownText
              text={item.streaming ? `${item.text} ▍` : item.text}
              style={textStyle}
              onOpenLink={onOpenLink}
              dark={!!d}
            />
          </View>
          {item.streaming ? null : (
            <View style={styles.messageActions}>
              <MessageButton label={t('chat.copy')} onPress={() => onAction('copy', item.text)} />
              <MessageButton
                label={t(speaking ? 'chat.stopReading' : 'chat.read')}
                onPress={() => onAction('speak', item.text)}
              />
              <MessageButton label={t('chat.share')} onPress={() => onAction('share', item.text)} />
              <MessageButton label={t('chat.pdf')} onPress={() => onAction('pdf', item.text)} />
            </View>
          )}
        </View>
      );
    case 'choices':
      return (
        <View style={styles.choices}>
          <View style={[styles.bubble, styles.assistantBubble, d?.assistantBubble]}>
            <MarkdownText text={item.text} style={textStyle} onOpenLink={onOpenLink} dark={!!d} />
          </View>
          {(item.options ?? []).map((option) => {
            const chosen = item.chosen === option;
            return (
              <Pressable
                key={option}
                onPress={() => onChoose?.(item.id, option)}
                disabled={!onChoose}
                style={({ pressed }) => [
                  styles.choice,
                  d?.choice,
                  chosen && styles.choiceChosen,
                  !onChoose && !chosen && styles.choiceClosed,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !onChoose, selected: chosen }}
              >
                <Text style={[styles.choiceText, chosen && styles.choiceTextChosen]}>
                  {chosen ? '✓ ' : ''}
                  {option}
                </Text>
              </Pressable>
            );
          })}
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
                <Text style={styles.sourceHost} numberOfLines={1}>
                  {source.incognito ? '🕶 ' : ''}
                  {hostOf(source.url)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {item.searchWidget ? <SearchSuggestions html={item.searchWidget} onOpenLink={onOpenLink} /> : null}
        </View>
      );
    case 'error':
      return <Text style={styles.error}>⚠️ {item.text}</Text>;
    default:
      return <Text style={[styles.action, d?.dim]}>{item.text}</Text>;
  }
}

function MessageButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}>
      <Text style={styles.messageButtonText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  assistantRow: { alignSelf: 'flex-start', maxWidth: '90%', gap: 4 },
  messageActions: { flexDirection: 'row', gap: 4, marginLeft: 4 },
  messageButton: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  messageButtonText: { fontSize: 12, color: c.textSecondary },
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
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
  },
  title: { fontWeight: '700', color: c.tintText, fontSize: 17 },
  status: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
  headerTitle: { flex: 1, marginRight: 8 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerButtonText: { fontSize: 18, color: c.textSecondary },
  messagesContent: { padding: 12, gap: 8 },
  empty: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: c.tint },
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
  choiceChosen: { backgroundColor: c.tint },
  choiceClosed: { opacity: 0.4 },
  choiceText: { fontSize: 15, color: c.tintText, fontWeight: '600' },
  choiceTextChosen: { color: c.onTint },
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
    backgroundColor: '#f1e4dc',
  },
  busyText: { flex: 1, fontSize: 13, color: '#6b4a3a' },
  busyAction: { fontSize: 13, fontWeight: '700', color: c.tintText },
  chips: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 8, paddingTop: 8, gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  chipText: { fontSize: 13, color: c.text },
  chipOn: { backgroundColor: c.tint, borderColor: c.tint },
  chipTextOn: { color: c.onTint, fontWeight: '600' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 8 },
  modeHint: { flex: 1, fontSize: 12, color: c.textSecondary },
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
  stopButton: { backgroundColor: '#444' },
  sendText: { color: c.onTint, fontSize: 18, fontWeight: '700' },
}));

const darkStyles = StyleSheet.create({
  panel: { backgroundColor: '#1f1e24' },
  header: { borderBottomColor: '#3a3944' },
  inputRow: { borderTopColor: '#3a3944' },
  input: { backgroundColor: '#2b2a33', borderColor: '#42414d', color: '#f2f1f5' },
  chip: { backgroundColor: '#2b2a33', borderColor: '#42414d' },
  choice: { backgroundColor: '#2b2a33' },
  text: { color: '#f2f1f5' },
  dim: { color: '#9a99a3' },
  assistantBubble: { backgroundColor: '#2b2a33', borderColor: '#3a3944' },
  busy: { backgroundColor: '#3a2c26' },
});
