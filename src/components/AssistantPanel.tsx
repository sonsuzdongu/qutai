import { useEffect, useRef, useState } from 'react';
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
import type { Source } from '../agent/types';
import { hostOf } from '../i18n/format';
import { MarkdownText } from './MarkdownText';
import { useKeyboardVisible } from '../utils/useKeyboardVisible';

export type ChatItem = {
  id: string;
  kind: 'user' | 'assistant' | 'action' | 'error' | 'info' | 'choices' | 'sources';
  text: string;
  /** For 'choices': the buttons offered. */
  options?: string[];
  /** For 'choices': the option the user tapped. */
  chosen?: string;
  /** For 'sources': the pages the answer is based on. */
  sources?: Source[];
};

/** A one-tap task shown above the input, e.g. "Summarize". */
export type QuickAction = { label: string; prompt: string };

type Props = {
  open: boolean;
  quickActions: QuickAction[];
  /** The message being typed; owned by the app so other features (e.g. selected text) can prefill it. */
  draft: string;
  onDraftChange: (text: string) => void;
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
};

const MAX_WIDTH = 420;

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
}: Props) {
  const speaking = useIsSpeaking();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(Math.round(screenWidth * 0.88), MAX_WIDTH);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

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
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (!open) Keyboard.dismiss();
  }, [open, progress]);

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
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('chat.closePanel')} />
      </Animated.View>

      <Animated.View style={[styles.panel, { width, transform: [{ translateX }] }]}>
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
            <View style={styles.header}>
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
                <HeaderButton label="＋" accessibilityLabel={t('chat.newChat')} onPress={onNewChat} />
              )}
              <HeaderButton label="⚙︎" accessibilityLabel={t('chat.settings')} onPress={onOpenSettings} />
              <HeaderButton label="✕" accessibilityLabel={t('chat.closePanel')} onPress={onClose} />
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
            >
              {items.length === 0 && <Text style={styles.empty}>{t('chat.empty')}</Text>}
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
              <Pressable onPress={onShowRunningTab} style={styles.busy} accessibilityRole="button">
                <Text style={styles.busyText}>{t('chat.busyElsewhere')}</Text>
                <Text style={styles.busyAction}>{t('chat.showTab')}</Text>
              </Pressable>
            )}

            {!running && !busyElsewhere && !text.trim() && quickActions.length > 0 && (
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
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipText}>{action.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={t('chat.placeholder')}
                multiline
                editable={!running}
              />
              {running ? (
                <Pressable
                  style={[styles.sendButton, styles.stopButton]}
                  onPress={onStop}
                  accessibilityLabel={t('common.stop')}
                >
                  <Text style={styles.sendText}>■</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.sendButton, (!text.trim() || busyElsewhere) && styles.sendDisabled]}
                  onPress={send}
                  accessibilityLabel={t('common.send')}
                >
                  <Text style={styles.sendText}>↑</Text>
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

function HeaderButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.headerButton} accessibilityLabel={accessibilityLabel}>
      <Text style={styles.headerButtonText}>{label}</Text>
    </Pressable>
  );
}

export type MessageAction = 'copy' | 'speak' | 'share';

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
          <View style={[styles.bubble, styles.assistantBubble]}>
            <MarkdownText text={item.text} style={styles.assistantText} onOpenLink={onOpenLink} />
          </View>
          <View style={styles.messageActions}>
            <MessageButton label={t('chat.copy')} onPress={() => onAction('copy', item.text)} />
            <MessageButton
              label={t(speaking ? 'chat.stopReading' : 'chat.read')}
              onPress={() => onAction('speak', item.text)}
            />
            <MessageButton label={t('chat.share')} onPress={() => onAction('share', item.text)} />
          </View>
        </View>
      );
    case 'choices':
      return (
        <View style={styles.choices}>
          <View style={[styles.bubble, styles.assistantBubble]}>
            <MarkdownText text={item.text} style={styles.assistantText} onOpenLink={onOpenLink} />
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
          <Text style={styles.sourcesTitle}>{t('chat.sources')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourcesRow}>
            {(item.sources ?? []).map((source, i) => (
              <Pressable
                key={source.url}
                onPress={() => onOpenSource(source)}
                style={({ pressed }) => [styles.source, pressed && styles.pressed]}
                accessibilityRole="link"
                accessibilityLabel={source.title || hostOf(source.url)}
              >
                <Text style={styles.sourceTitle} numberOfLines={2}>
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
        </View>
      );
    case 'error':
      return <Text style={styles.error}>⚠️ {item.text}</Text>;
    default:
      return <Text style={styles.action}>{item.text}</Text>;
  }
}

function MessageButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}>
      <Text style={styles.messageButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  assistantRow: { alignSelf: 'flex-start', maxWidth: '90%', gap: 4 },
  messageActions: { flexDirection: 'row', gap: 4, marginLeft: 4 },
  messageButton: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  messageButtonText: { fontSize: 12, color: '#8a8780' },
  pressed: { backgroundColor: '#ebe8e0' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#faf9f5',
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
    borderBottomColor: '#e0ddd4',
  },
  title: { fontWeight: '700', color: '#c96442', fontSize: 17 },
  status: { color: '#999', fontSize: 12, marginTop: 1 },
  headerTitle: { flex: 1, marginRight: 8 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerButtonText: { fontSize: 18, color: '#555' },
  messagesContent: { padding: 12, gap: 8 },
  empty: { color: '#888', fontSize: 14, lineHeight: 20, marginTop: 8 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#c96442' },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0ddd4',
  },
  userText: { color: '#fff', fontSize: 15 },
  assistantText: { color: '#222', fontSize: 15, lineHeight: 21 },
  action: { color: '#777', fontSize: 12, marginLeft: 4 },
  error: { color: '#b3261e', fontSize: 13, marginLeft: 4 },
  sources: { alignSelf: 'stretch', gap: 4 },
  sourcesTitle: { fontSize: 12, color: '#8a8780', marginLeft: 4 },
  sourcesRow: { gap: 6, paddingRight: 8 },
  source: {
    width: 150,
    padding: 8,
    gap: 2,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0ddd4',
  },
  sourceIndex: { color: '#c96442', fontWeight: '700' },
  sourceTitle: { fontSize: 12.5, color: '#333', lineHeight: 16 },
  sourceHost: { fontSize: 11, color: '#999' },
  choices: { alignSelf: 'stretch', gap: 6 },
  choice: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c96442',
    backgroundColor: '#fff',
  },
  choiceChosen: { backgroundColor: '#c96442' },
  choiceClosed: { opacity: 0.4 },
  choiceText: { fontSize: 15, color: '#c96442', fontWeight: '600' },
  choiceTextChosen: { color: '#fff' },
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
  busyAction: { fontSize: 13, fontWeight: '700', color: '#c96442' },
  chips: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 8, paddingTop: 8, gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3c9',
  },
  chipText: { fontSize: 13, color: '#444' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0ddd4',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3c9',
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#c96442',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  stopButton: { backgroundColor: '#444' },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
