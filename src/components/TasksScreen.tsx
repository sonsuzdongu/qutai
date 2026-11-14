import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { formatDateTime, hostOf } from '../i18n/format';
import { getDb } from '../storage/db';
import {
  addSavedTask,
  deleteSavedTask,
  listSavedTasks,
  MAX_TASK_NAME,
  MAX_TASK_PROMPT,
  SavedTask,
  TaskInput,
  TaskTarget,
  updateSavedTask,
} from '../storage/savedTasks';
import { makeStyles, usePalette } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';

/** A task to create, prefilled (e.g. from "Save as task" on a sent message); `incognito` when it came from one. */
export type TaskDraft = TaskInput & { incognito?: boolean };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Run was tapped: the screen closes and the app runs the task. */
  onRun: (task: SavedTask) => void;
  /** Opens straight on the editor for a new task. */
  draft?: TaskDraft | null;
};

/** Saved tasks: messages to run again, with where they run. Everything can be edited or deleted. */
export function TasksScreen({ visible, onClose, onRun, draft }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <TaskList onClose={onClose} onRun={onRun} draft={draft ?? null} />}
      <DialogHost />
    </Modal>
  );
}

export const emptyTask = (): TaskInput => ({ name: '', prompt: '', target: 'page', url: null, research: false });

/** "On the page on screen", "Opens example.com first", "No particular page", plus deep research. */
export function describeTarget(task: Pick<SavedTask, 'target' | 'url' | 'research'>): string {
  const where =
    task.target === 'url' && task.url
      ? t('tasks.targetUrlShort', { host: hostOf(task.url) })
      : t(task.target === 'none' ? 'tasks.targetNoneShort' : 'tasks.targetPageShort');
  return task.research ? `${where} · ${t('chat.research')}` : where;
}

const saveError = (e: unknown) => {
  const code = e instanceof Error ? e.message : '';
  const message =
    code === 'empty-prompt'
      ? t('tasks.errorEmpty')
      : code === 'bad-url'
        ? t('tasks.errorUrl')
        : code === 'full'
          ? t('tasks.errorFull')
          : code || String(e);
  dialog.alert(t('tasks.saveFailed'), message);
};

function TaskList({
  onClose,
  onRun,
  draft,
}: {
  onClose: () => void;
  onRun: (task: SavedTask) => void;
  draft: TaskDraft | null;
}) {
  const styles = useStyles();
  const [tasks, setTasks] = useState<SavedTask[] | null>(null);
  // The task being edited: an existing one (id) or a new one (no id).
  const [editing, setEditing] = useState<{ id?: string; input: TaskInput; incognito?: boolean } | null>(() =>
    draft ? { input: draft, incognito: draft.incognito } : null,
  );

  const reload = useCallback(() => {
    getDb()
      .then(listSavedTasks)
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);
  useEffect(reload, [reload]);

  const save = async () => {
    if (!editing) return;
    // Saved tasks are stored on the phone like bookmarks; one from an incognito conversation is kept only if the
    // user says so (nothing is ever saved from one by itself).
    if (
      editing.incognito &&
      !(await dialog.confirm({
        title: t('tasks.incognitoTitle'),
        message: t('tasks.incognitoBody'),
        confirmText: t('common.save'),
      }))
    )
      return;
    try {
      const db = await getDb();
      if (editing.id) await updateSavedTask(db, editing.id, editing.input);
      else await addSavedTask(db, editing.input);
      setEditing(null);
      reload();
    } catch (e) {
      saveError(e);
    }
  };

  const remove = (id: string, name: string) =>
    dialog.alert(t('tasks.deleteConfirm', { name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tasks.delete'),
        style: 'destructive',
        onPress: () => {
          setEditing(null);
          getDb()
            .then((db) => deleteSavedTask(db, id))
            .then(reload, saveError);
        },
      },
    ]);

  if (editing) {
    return (
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <View style={styles.header}>
          <Pressable onPress={() => setEditing(null)} hitSlop={8} style={styles.side}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.title}>{t(editing.id ? 'tasks.editTitle' : 'tasks.newTitle')}</Text>
          <Pressable onPress={save} hitSlop={8} style={[styles.side, styles.right]}>
            <Text style={styles.done}>{t('common.save')}</Text>
          </Pressable>
        </View>
        <TaskEditor
          input={editing.input}
          onChange={(input) => setEditing({ ...editing, input })}
          onDelete={editing.id ? () => remove(editing.id!, editing.input.name) : undefined}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <View style={styles.header}>
        <View style={styles.side} />
        <Text style={styles.title}>{t('tasks.title')}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={tasks ?? []}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.hint}>{t('tasks.hint')}</Text>}
        ListEmptyComponent={tasks ? <Text style={styles.empty}>{t('tasks.empty')}</Text> : undefined}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing({ id: item.id, input: item })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityHint={t('tasks.editHint')}
          >
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.prompt} numberOfLines={2}>
                {item.prompt}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {describeTarget(item)}
                {item.lastUsedAt ? ` · ${t('tasks.lastUsed', { date: formatDateTime(new Date(item.lastUsedAt)) })}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => onRun(item)}
              style={({ pressed }) => [styles.run, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('tasks.runLabel', { name: item.name })}
            >
              <Text style={styles.runText}>{t('tasks.run')}</Text>
            </Pressable>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Pressable
          onPress={() => setEditing({ input: emptyTask() })}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.addText}>{t('tasks.new')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** The fields of a task: name, prompt, where it runs, deep research. */
function TaskEditor({
  input,
  onChange,
  onDelete,
}: {
  input: TaskInput;
  onChange: (input: TaskInput) => void;
  onDelete?: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const set = (patch: Partial<TaskInput>) => onChange({ ...input, ...patch });
  const targets: { value: TaskTarget; label: string }[] = [
    { value: 'page', label: t('tasks.targetPage') },
    { value: 'url', label: t('tasks.targetUrl') },
    { value: 'none', label: t('tasks.targetNone') },
  ];
  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('tasks.name')}</Text>
      <TextInput
        style={styles.input}
        value={input.name}
        onChangeText={(name) => set({ name })}
        placeholder={t('tasks.namePlaceholder')}
        placeholderTextColor={palette.textSecondary}
        maxLength={MAX_TASK_NAME}
      />
      <Text style={styles.label}>{t('tasks.prompt')}</Text>
      <TextInput
        style={[styles.input, styles.promptInput]}
        value={input.prompt}
        onChangeText={(prompt) => set({ prompt })}
        placeholder={t('tasks.promptPlaceholder')}
        placeholderTextColor={palette.textSecondary}
        maxLength={MAX_TASK_PROMPT}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.small}>{t('tasks.promptHint')}</Text>
      <Text style={styles.label}>{t('tasks.target')}</Text>
      <View style={styles.segment}>
        {targets.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => set({ target: o.value })}
            style={[styles.segmentButton, input.target === o.value && styles.segmentSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected: input.target === o.value }}
          >
            <Text style={[styles.segmentText, input.target === o.value && styles.segmentTextSelected]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {input.target === 'url' ? (
        <TextInput
          style={styles.input}
          value={input.url ?? ''}
          onChangeText={(url) => set({ url })}
          placeholder="https://"
          placeholderTextColor={palette.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel={t('tasks.urlLabel')}
        />
      ) : null}
      <Text style={styles.small}>
        {t(input.target === 'url' ? 'tasks.targetUrlHint' : input.target === 'none' ? 'tasks.targetNoneHint' : 'tasks.targetPageHint')}
      </Text>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.switchLabel}>{t('chat.research')}</Text>
          <Text style={styles.small}>{t('chat.researchHint')}</Text>
        </View>
        <ThemedSwitch
          value={input.research}
          onValueChange={(research) => set({ research })}
          accessibilityLabel={t('chat.research')}
        />
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteButton} accessibilityRole="button">
          <Text style={styles.deleteText}>{t('tasks.delete')}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
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
  cancel: { fontSize: 16, color: c.tintText },
  done: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  list: { padding: 16, gap: 8 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: c.text },
  prompt: { fontSize: 14, color: c.text, lineHeight: 19 },
  meta: { fontSize: 12, color: c.textSecondary },
  run: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: c.tint },
  runText: { color: c.onTint, fontWeight: '700', fontSize: 14 },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  addButton: { height: 44, borderRadius: 22, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  addText: { color: c.onTint, fontWeight: '700', fontSize: 15 },
  form: { padding: 16, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginTop: 8 },
  small: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  input: {
    color: c.text,
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  promptInput: { minHeight: 110 },
  segment: { flexDirection: 'row', borderRadius: 10, backgroundColor: c.sunken, padding: 3, gap: 3 },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  segmentTextSelected: { color: c.text, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  switchLabel: { fontSize: 15, color: c.text },
  deleteButton: { marginTop: 24, alignSelf: 'center', padding: 10 },
  deleteText: { fontSize: 15, color: c.danger },
}));
