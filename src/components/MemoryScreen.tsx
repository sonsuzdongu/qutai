import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_MEMORY_CHARS, Memory, MEMORY_CATEGORIES, MemoryCategory } from '../agent/memory';
import { MAX_ORGANISE, proposeCategories } from '../agent/organiseMemory';
import type { ProviderId } from '../ai/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { getDb } from '../storage/db';
import {
  addMemory,
  clearMemories,
  deleteMemory,
  deleteMemoryCategory,
  listMemories,
  moveMemories,
  updateMemory,
} from '../storage/memory';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { CATEGORY_ICONS, categoryName, warnsAboutIdNumbers } from './memoryCategories';
import { ProfileQuestionsScreen } from './ProfileQuestions';

/** The AI the user chose in settings, for "Organise for me"; null without a key. */
export type MemoryAi = { provider: ProviderId; apiKey: string; model: string; endpoint?: string; label: string } | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  ai: MemoryAi;
  /**
   * "Answer a few questions" (setup's questions again); absent with memory off. Not offered while the tab on screen
   * is incognito, so nothing typed there lands in memory from an incognito context.
   */
  questions?: {
    incognito: boolean;
    providerLabel: string | null;
    onInstructions: (update: (current: string) => string) => void;
  };
};

/** Lists what Qutai remembers about the user by category; everything can be edited, moved or deleted. */
export function MemoryScreen({ visible, onClose, ai, questions }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <MemoryList onClose={onClose} ai={ai} questions={questions} />}
      <DialogHost />
    </Modal>
  );
}

const showError = (e: unknown) => dialog.alert(t('memory.saveFailed'), e instanceof Error ? e.message : String(e));

type Proposal = { memory: Memory; category: MemoryCategory; accepted: boolean }[];

function MemoryList({ onClose, ai, questions }: Omit<Props, 'visible'>) {
  const styles = useStyles();
  const palette = usePalette();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('general');
  const [editing, setEditing] = useState<{ id: string; text: string; category: MemoryCategory } | null>(null);
  const [query, setQuery] = useState('');
  const [organising, setOrganising] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [asking, setAsking] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

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
    run((db) => addMemory(db, text, newCategory));
  };

  const saveEdit = () => {
    if (!editing) return;
    const { id, text, category } = editing;
    setEditing(null);
    run((db) => updateMemory(db, id, text, category));
  };

  const clearAll = () =>
    dialog.alert(t('memory.clearConfirm'), t('memory.clearConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('memory.clearAll'), style: 'destructive', onPress: () => run(clearMemories) },
    ]);

  const clearCategory = (category: MemoryCategory, count: number) =>
    dialog.alert(
      t('memory.deleteCategoryConfirm', { category: categoryName(category) }),
      t('memory.deleteCategoryBody', { count }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('memory.deleteCategory'), style: 'destructive', onPress: () => run((db) => deleteMemoryCategory(db, category)) },
      ],
    );

  const general = (memories ?? []).filter((m) => m.category === 'general');

  /** One AI request, said up front; nothing changes until the user accepts the proposal. */
  const organise = async () => {
    if (!ai) return dialog.alert(t('memory.organiseNoKey'));
    const count = Math.min(general.length, MAX_ORGANISE);
    const ok = await dialog.confirm({
      title: t('memory.organiseConfirm'),
      message: t('memory.organiseConfirmBody', { count, provider: ai.label }),
      confirmText: t('memory.organiseSend'),
    });
    if (!ok) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setOrganising(true);
    try {
      const moves = await proposeCategories(general, ai, controller.signal);
      if (controller.signal.aborted) return;
      if (!moves.length) dialog.alert(t('memory.organiseNothing'));
      else setProposal(moves.map((m) => ({ ...m, accepted: true })));
    } catch (e) {
      if (!controller.signal.aborted) dialog.alert(t('memory.organiseFailed'), e instanceof Error ? e.message : String(e));
    } finally {
      if (abort.current === controller) setOrganising(false);
    }
  };

  const applyProposal = () => {
    if (!proposal) return;
    const moves = proposal.filter((p) => p.accepted).map((p) => ({ id: p.memory.id, category: p.category }));
    setProposal(null);
    run((db) => moveMemories(db, moves));
  };

  const sections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const shown = (memories ?? []).filter((m) => !needle || m.text.toLocaleLowerCase().includes(needle));
    return MEMORY_CATEGORIES.flatMap((category) => {
      const data = shown.filter((m) => m.category === category);
      const total = (memories ?? []).filter((m) => m.category === category).length;
      return data.length ? [{ category, total, data }] : [];
    });
  }, [memories, query]);

  const header = (
    <View style={styles.top}>
      <Text style={styles.hint}>{t('memory.hint')}</Text>
      {!!memories?.length && (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('memory.search')}
          placeholderTextColor={palette.textSecondary}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel={t('memory.search')}
        />
      )}
      <View style={styles.actions}>
        {questions && (
          <Pressable
            onPress={() => setAsking(true)}
            disabled={questions.incognito}
            style={({ pressed }) => [styles.action, pressed && styles.pressed, questions.incognito && styles.disabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: questions.incognito }}
            accessibilityHint={questions.incognito ? t('memory.askQuestionsIncognito') : undefined}
          >
            <Text style={styles.actionText}>{t('memory.askQuestions')}</Text>
          </Pressable>
        )}
        {general.length > 0 && (
          <Pressable
            onPress={organise}
            disabled={organising}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityHint={t('memory.organiseHint')}
          >
            {organising ? (
              <ActivityIndicator color={palette.tintText} />
            ) : (
              <Text style={styles.actionText}>{t('memory.organise')}</Text>
            )}
          </Pressable>
        )}
      </View>
      {questions?.incognito && <Text style={styles.small}>{t('memory.askQuestionsIncognito')}</Text>}
      {proposal && (
        <View style={styles.proposal}>
          <Text style={styles.proposalTitle}>{t('memory.proposalTitle')}</Text>
          <Text style={styles.small}>{t('memory.proposalHint')}</Text>
          {proposal.map((p, i) => (
            <Pressable
              key={p.memory.id}
              onPress={() => setProposal(proposal.map((q, j) => (j === i ? { ...q, accepted: !q.accepted } : q)))}
              style={styles.proposalRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: p.accepted }}
            >
              <View style={[styles.box, p.accepted && styles.boxOn]}>
                {p.accepted && <Icon name="check" size={14} color={palette.onTint} />}
              </View>
              <Text style={styles.proposalText}>
                {p.memory.text}
                <Text style={styles.arrow}>{`  →  ${categoryName(p.category)}`}</Text>
              </Text>
            </Pressable>
          ))}
          <View style={styles.proposalButtons}>
            <Pressable onPress={() => setProposal(null)} hitSlop={8}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={applyProposal}
              disabled={!proposal.some((p) => p.accepted)}
              style={[styles.applyButton, !proposal.some((p) => p.accepted) && styles.disabled]}
            >
              <Text style={styles.addText}>{t('memory.proposalApply')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <View style={styles.header}>
        <Pressable onPress={clearAll} disabled={!memories?.length} hitSlop={8} style={styles.side}>
          <Text style={[styles.clear, !memories?.length && styles.disabled]}>{t('memory.clearAll')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('memory.title')}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          memories ? <Text style={styles.empty}>{t(query.trim() ? 'memory.noMatch' : 'memory.empty')}</Text> : undefined
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Icon name={CATEGORY_ICONS[section.category]} size={18} color={palette.textSecondary} />
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('memory.categoryCount', { category: categoryName(section.category), count: section.total })}
            </Text>
            <Pressable
              onPress={() => clearCategory(section.category, section.total)}
              hitSlop={8}
              accessibilityLabel={t('memory.deleteCategoryLabel', { category: categoryName(section.category) })}
            >
              <Text style={styles.sectionDelete}>{t('memory.deleteCategory')}</Text>
            </Pressable>
          </View>
        )}
        renderItem={({ item }) =>
          editing?.id === item.id ? (
            <View style={[styles.row, styles.editRow]}>
              <TextInput
                style={[styles.rowText, styles.editInput]}
                value={editing.text}
                onChangeText={(text) => setEditing({ ...editing, text })}
                maxLength={MAX_MEMORY_CHARS}
                autoFocus
                multiline
                accessibilityLabel={t('memory.editHint')}
              />
              <CategoryPicker value={editing.category} onChange={(category) => setEditing({ ...editing, category })} />
              {warnsAboutIdNumbers(editing.category) && <Text style={styles.warning}>{t('memory.idWarning')}</Text>}
              <View style={styles.proposalButtons}>
                <Pressable onPress={() => setEditing(null)} hitSlop={8}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable onPress={saveEdit} style={styles.applyButton}>
                  <Text style={styles.addText}>{t('common.save')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditing({ id: item.id, text: item.text, category: item.category })}
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

      <View style={styles.addArea}>
        {!!newText.trim() && (
          <>
            <CategoryPicker value={newCategory} onChange={setNewCategory} />
            {warnsAboutIdNumbers(newCategory) && <Text style={styles.warning}>{t('memory.idWarning')}</Text>}
          </>
        )}
        <View style={styles.addRow}>
          <TextInput
            placeholderTextColor={palette.textSecondary}
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
      </View>
      {questions && (
        <ProfileQuestionsScreen
          visible={asking}
          onClose={() => {
            setAsking(false);
            reload();
          }}
          providerLabel={questions.providerLabel}
          onInstructions={questions.onInstructions}
        />
      )}
    </SafeAreaView>
  );
}

/** A row of category chips; the chosen one is filled. */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: MemoryCategory;
  onChange: (category: MemoryCategory) => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chips}
      accessibilityLabel={t('memory.categoryPicker')}
    >
      {MEMORY_CATEGORIES.map((category) => {
        const on = category === value;
        return (
          <Pressable
            key={category}
            onPress={() => onChange(category)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Icon name={CATEGORY_ICONS[category]} size={14} color={on ? palette.onTint : palette.textSecondary} />
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{categoryName(category)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
  top: { gap: 10, marginBottom: 4 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  small: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  search: {
    color: c.text,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.sunken,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  actionText: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  proposal: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  proposalTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  proposalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  proposalText: { flex: 1, fontSize: 14, color: c.text, lineHeight: 19 },
  arrow: { color: c.tintText, fontWeight: '600' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: c.tint, borderColor: c.tint },
  proposalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 4 },
  cancelText: { fontSize: 15, color: c.tintText },
  applyButton: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: c.tint, justifyContent: 'center' },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 2 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase' },
  sectionDelete: { fontSize: 13, color: c.danger },
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
  editRow: { flexDirection: 'column', alignItems: 'stretch', paddingRight: 12 },
  pressed: { backgroundColor: c.pressed },
  rowText: { flex: 1, fontSize: 15, color: c.text, lineHeight: 20 },
  editInput: { paddingVertical: 0, flex: 0 },
  warning: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  delete: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 14, color: c.textSecondary },
  chips: { gap: 6, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: { backgroundColor: c.tint, borderColor: c.tint },
  chipText: { fontSize: 13, color: c.text },
  chipTextOn: { color: c.onTint, fontWeight: '600' },
  addArea: {
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  addRow: { flexDirection: 'row', gap: 8 },
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
