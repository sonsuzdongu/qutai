import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_MEMORY_CHARS, Memory } from '../agent/memory';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { getDb } from '../storage/db';
import { addMemory, clearMemories, deleteMemory, listMemories, updateMemory } from '../storage/memory';

type Props = { visible: boolean; onClose: () => void };

/** Lists what Qutai remembers about the user; everything can be edited or deleted. */
export function MemoryScreen({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <MemoryList onClose={onClose} />}
    </Modal>
  );
}

const showError = (e: unknown) => Alert.alert(t('memory.saveFailed'), e instanceof Error ? e.message : String(e));

function MemoryList({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [newText, setNewText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const reload = useCallback(() => {
    getDb()
      .then(listMemories)
      .then(setMemories)
      .catch(() => setMemories([]));
  }, []);
  useEffect(reload, [reload]);

  const run = (action: (db: Awaited<ReturnType<typeof getDb>>) => Promise<unknown>) =>
    getDb().then(action).then(reload, showError);

  const add = () => {
    const text = newText.trim();
    if (!text) return;
    setNewText('');
    run((db) => addMemory(db, text));
  };

  const saveEdit = () => {
    if (!editing) return;
    const { id, text } = editing;
    setEditing(null);
    run((db) => updateMemory(db, id, text));
  };

  const clearAll = () =>
    Alert.alert(t('memory.clearConfirm'), t('memory.clearConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('memory.clearAll'), style: 'destructive', onPress: () => run(clearMemories) },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={clearAll} disabled={!memories?.length} hitSlop={8} style={styles.side}>
          <Text style={[styles.clear, !memories?.length && styles.disabled]}>{t('memory.clearAll')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('memory.title')}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={memories ?? []}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.hint}>{t('memory.hint')}</Text>}
        ListEmptyComponent={memories ? <Text style={styles.empty}>{t('memory.empty')}</Text> : undefined}
        renderItem={({ item }) =>
          editing?.id === item.id ? (
            <View style={styles.row}>
              <TextInput
                style={[styles.rowText, styles.editInput]}
                value={editing.text}
                onChangeText={(text) => setEditing({ id: item.id, text })}
                // Return blurs the field, which saves.
                onBlur={saveEdit}
                maxLength={MAX_MEMORY_CHARS}
                autoFocus
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                multiline
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setEditing({ id: item.id, text: item.text })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityHint={t('memory.editHint')}
            >
              <Text style={styles.rowText}>{item.text}</Text>
              <Pressable
                onPress={() => run((db) => deleteMemory(db, item.id))}
                hitSlop={10}
                style={styles.delete}
                accessibilityLabel={t('memory.delete')}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </Pressable>
          )
        }
      />

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newText}
          onChangeText={setNewText}
          onSubmitEditing={add}
          placeholder={t('memory.addPlaceholder')}
          maxLength={MAX_MEMORY_CHARS}
          returnKeyType="done"
        />
        <Pressable
          onPress={add}
          disabled={!newText.trim()}
          style={[styles.addButton, !newText.trim() && styles.disabled]}
        >
          <Text style={styles.addText}>{t('memory.add')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  side: { flex: 1 },
  right: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  clear: { fontSize: 15, color: c.danger },
  done: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  disabled: { opacity: 0.35 },
  list: { padding: 16, gap: 8 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  pressed: { backgroundColor: c.pressed },
  rowText: { flex: 1, fontSize: 15, color: c.text, lineHeight: 20 },
  editInput: { paddingVertical: 0, marginRight: 8 },
  delete: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 14, color: c.textSecondary },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  addInput: {
    color: c.text,
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  addButton: {
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: c.tint,
    justifyContent: 'center',
  },
  addText: { color: c.onTint, fontWeight: '700', fontSize: 15 },
}));
