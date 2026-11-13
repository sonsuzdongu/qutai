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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsSpeaking } from '../device/speech';
import { useKeyboardVisible } from '../utils/useKeyboardVisible';

export type ChatItem = {
  id: string;
  kind: 'user' | 'assistant' | 'action' | 'error' | 'info';
  text: string;
};

type Props = {
  open: boolean;
  items: ChatItem[];
  running: boolean;
  /** Provider and model shown under the title, e.g. "OpenAI · GPT-5.6 Terra". */
  modelInfo: string;
  onClose: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onMessageAction: (action: MessageAction, text: string) => void;
};

const MAX_WIDTH = 420;

/**
 * Side panel that slides in from the right over the page, like the Chrome
 * side panel. It stays mounted while closed so the conversation keeps its
 * scroll position.
 */
export function AssistantPanel({
  open,
  items,
  running,
  modelInfo,
  onClose,
  onSend,
  onStop,
  onNewChat,
  onOpenSettings,
  onMessageAction,
}: Props) {
  const speaking = useIsSpeaking();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(Math.round(screenWidth * 0.88), MAX_WIDTH);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  const [progress] = useState(() => new Animated.Value(0));
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);

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
    if (!t || running) return;
    setText('');
    onSend(t);
  };

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Paneli kapat" />
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
                <Text style={styles.title}>✦ ALPAI</Text>
                <Pressable onPress={onOpenSettings} hitSlop={4} accessibilityLabel={`Model: ${modelInfo}. Değiştir`}>
                  <Text style={styles.status} numberOfLines={1}>
                    {running ? 'çalışıyor…' : modelInfo}
                  </Text>
                </Pressable>
              </View>
              {items.length > 0 && !running && (
                <HeaderButton label="＋" accessibilityLabel="Yeni sohbet" onPress={onNewChat} />
              )}
              <HeaderButton label="⚙︎" accessibilityLabel="Ayarlar" onPress={onOpenSettings} />
              <HeaderButton label="✕" accessibilityLabel="Paneli kapat" onPress={onClose} />
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
            >
              {items.length === 0 && (
                <Text style={styles.empty}>
                  Bu sayfada ne yapmamı istersiniz?{'\n\n'}Örneğin: “Bu sayfayı özetle” ya da “İstanbul–Ankara uçak
                  biletlerini karşılaştır”.
                </Text>
              )}
              {items.map((item) => (
                <ChatRow key={item.id} item={item} speaking={speaking} onAction={onMessageAction} />
              ))}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="ALPAI'ye bir görev verin…"
                multiline
                editable={!running}
              />
              {running ? (
                <Pressable style={[styles.sendButton, styles.stopButton]} onPress={onStop} accessibilityLabel="Durdur">
                  <Text style={styles.sendText}>■</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.sendButton, !text.trim() && styles.sendDisabled]}
                  onPress={send}
                  accessibilityLabel="Gönder"
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
}: {
  item: ChatItem;
  speaking: boolean;
  onAction: (action: MessageAction, text: string) => void;
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
            <Text style={styles.assistantText} selectable>
              {item.text}
            </Text>
          </View>
          <View style={styles.messageActions}>
            <MessageButton label="⧉ Kopyala" onPress={() => onAction('copy', item.text)} />
            <MessageButton label={speaking ? '⏹ Durdur' : '🔊 Oku'} onPress={() => onAction('speak', item.text)} />
            <MessageButton label="⤴ Paylaş" onPress={() => onAction('share', item.text)} />
          </View>
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
