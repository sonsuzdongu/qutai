import type { CustomHeader } from '../ai/customHeaders';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  hiddenKindOf,
  hiddenLabel,
  MAX_HIDDEN_LABEL_CHARS,
  MAX_MEMORY_CHARS,
  Memory,
  MEMORY_CATEGORIES,
  MemoryCategory,
  suggestsHiding,
} from '../agent/memory';
import { MAX_ORGANISE, OrganiseNotAvailable, proposeCategories } from '../agent/organiseMemory';
import { organiseMemoryRequest } from '../credits';
import type { ProviderId } from '../ai/types';
import { t } from '../i18n';
import { memoryErrorText } from './memoryError';
import { plainError } from '../ai/plainError';
import { Icon } from '../ui/Icon';
import { FactRow } from './FactRow';
import { makeStyles, readableColumn, usePalette, radii, common } from '../ui/theme';
import { authenticate } from '../device/biometric';
import { ThemedSwitch } from '../ui/ThemedSwitch';
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
import { ProfileStepScreen, type IntroVoiceSettings } from './ProfileStep';
import { KeyboardAvoidingContainer, KeyboardAwareScrollView } from './KeyboardAware';
import { ScreenHeader } from './ScreenHeader';
import { reportStorageFailure } from '../storage/failures';

/** The AI the user chose in settings, for "Organise for me"; null without a key. */
export type MemoryAi = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  endpoint?: string;
  extraHeaders?: CustomHeader[];
} | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  ai: MemoryAi;
  /** The app lock is on: showing a hidden memory's value asks for Face ID / fingerprint / passcode first. */
  appLock: boolean;
  /**
   * "Introduce yourself" (setup's "Tell me about yourself" and its questions again, ProfileStep); absent with memory
   * off. Not offered while an incognito tab is open, so nothing said there lands in memory from an incognito context.
   */
  questions?: {
    incognito: boolean;
    onInstructions: (update: (current: string) => string) => void;
    voice: IntroVoiceSettings;
    onVoice: (change: Partial<IntroVoiceSettings>) => void;
  };
};

/** Lists what Qutai remembers about the user by category; everything can be edited, moved or deleted. */
export function MemoryScreen({ visible, onClose, ai, appLock, questions }: Props) {
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <MemoryList onClose={onClose} ai={ai} appLock={appLock} questions={questions} />}
      <DialogHost />
    </AppModal>
  );
}

const showError = (e: unknown) =>
  dialog.alert(
    t('memory.saveFailed'),
    memoryErrorText(e),
  );

/** What the list, search and proposals show for a memory: a hidden one's label until the user reveals it. */
const shownText = (m: Memory) => (m.sensitive ? hiddenLabel(m) : m.text);

type Editing = { id: string; text: string; category: MemoryCategory; hidden: boolean; label: string };

type Proposal = { memory: Memory; category: MemoryCategory; accepted: boolean }[];

function MemoryList({ onClose, ai, appLock, questions }: Omit<Props, 'visible'>) {
  const styles = useStyles();
  const palette = usePalette();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('general');
  const [editing, setEditing] = useState<Editing | null>(null);
  /** Hidden memories whose value the user chose to see (until the screen closes). */
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
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
      .catch((e) => {
        // An empty list would say nothing is remembered: the user is told it couldn't be read.
        reportStorageFailure('memory.list', e, 'user');
        setMemories([]);
      });
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
    const { id, text, category, hidden, label } = editing;
    if (hidden && !hiddenKindOf(text) && !label.trim()) return dialog.alert(t('memory.hiddenLabelNeeded'));
    setEditing(null);
    run((db) => updateMemory(db, id, text, category, hidden ? { label: label.trim() || null } : null));
  };

  /** Shows a hidden memory's value, after the app lock's check when the lock is on. */
  const reveal = async (id: string): Promise<boolean> => {
    if (revealed.has(id)) return true;
    if (appLock && !(await authenticate(t('memory.revealPrompt')))) return false;
    setRevealed((current) => new Set(current).add(id));
    return true;
  };

  const hide = (id: string) =>
    setRevealed((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

  const startEdit = async (m: Memory) => {
    if (m.sensitive && !(await reveal(m.id))) return;
    setEditing({ id: m.id, text: m.text, category: m.category, hidden: m.sensitive, label: m.label ?? '' });
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
      message: t('memory.organiseConfirmBody', { count }),
      confirmText: t('memory.organiseSend'),
    });
    if (!ok) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setOrganising(true);
    try {
      // Qutai Credits: the server's own organise request (the relay can't carry these instructions).
      const credits = ai.provider === 'qutai' ? organiseMemoryRequest() : undefined;
      const moves = await proposeCategories(general, ai, controller.signal, { credits });
      if (controller.signal.aborted) return;
      if (!moves.length) dialog.alert(t('memory.organiseNothing'));
      else setProposal(moves.map((m) => ({ ...m, accepted: true })));
    } catch (e) {
      if (!controller.signal.aborted) {
        dialog.alert(t('memory.organiseFailed'), e instanceof OrganiseNotAvailable ? t('memory.organiseNotAvailable') : plainError(e).message);
      }
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
    // A hidden memory's value is not searched, only its label.
    const shown = (memories ?? []).filter((m) => !needle || shownText(m).toLocaleLowerCase().includes(needle));
    return MEMORY_CATEGORIES.flatMap((category) => {
      const data = shown.filter((m) => m.category === category);
      const total = (memories ?? []).filter((m) => m.category === category).length;
      return data.length ? [{ category, total, data }] : [];
    });
  }, [memories, query]);

  const header = (
    <View style={styles.top}>
      <Text style={styles.hint}>{t('memory.hint')}</Text>
      {memories?.some((m) => m.sensitive) && (
        <View style={styles.smallRow}>
          <Icon name="secure" size={14} color={palette.textSecondary} style={styles.smallIcon} />
          <Text style={[styles.small, styles.smallText]}>{t('memory.hiddenExplain')}</Text>
        </View>
      )}
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
            <Text style={styles.actionText}>{t('memory.introduce')}</Text>
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
                {shownText(p.memory)}
                <Text style={styles.arrow}>{`  →  ${categoryName(p.category)}`}</Text>
              </Text>
            </Pressable>
          ))}
          <View style={styles.proposalButtons}>
            <Pressable accessibilityRole="button" onPress={() => setProposal(null)} hitSlop={8}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
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
      <ScreenHeader
        title={t('memory.title')}
        left={{ label: t('memory.clearAll'), tone: 'danger', disabled: !memories?.length, onPress: clearAll }}
        right={{ label: t('common.done'), onPress: onClose }}
      />

      {/* The list and the add field stay above the keyboard; an edited memory scrolls into view. */}
      <KeyboardAvoidingContainer style={styles.flex}>
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          renderScrollComponent={(props) => <KeyboardAwareScrollView {...props} />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={header}
          ListEmptyComponent={
            memories ? (
              <Text style={styles.empty}>{t(query.trim() ? 'memory.noMatch' : 'memory.empty')}</Text>
            ) : (
              <ActivityIndicator style={styles.loading} />
            )
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Icon name={CATEGORY_ICONS[section.category]} size={18} color={palette.textSecondary} />
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t('memory.categoryCount', { category: categoryName(section.category), count: section.total })}
              </Text>
              <Pressable
                accessibilityRole="button"
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
                <View style={styles.lockRow}>
                  <Icon name="secure" size={16} color={palette.textSecondary} />
                  <View style={styles.lockText}>
                    <Text style={styles.lockTitle}>{t('memory.hiddenToggle')}</Text>
                    <Text style={styles.warning}>{t('memory.hiddenToggleHint')}</Text>
                  </View>
                  <ThemedSwitch
                    value={editing.hidden}
                    onValueChange={(hidden) => setEditing({ ...editing, hidden })}
                    accessibilityLabel={t('memory.hiddenToggle')}
                    accessibilityHint={t('memory.hiddenToggleHint')}
                  />
                </View>
                {editing.hidden && !hiddenKindOf(editing.text) && (
                  <TextInput
                    style={styles.labelInput}
                    value={editing.label}
                    onChangeText={(label) => setEditing({ ...editing, label })}
                    maxLength={MAX_HIDDEN_LABEL_CHARS}
                    placeholder={t('memory.hiddenLabelPlaceholder')}
                    placeholderTextColor={palette.textSecondary}
                    accessibilityLabel={t('memory.hiddenLabel')}
                  />
                )}
                {editing.hidden && !hiddenKindOf(editing.text) && (
                  <Text style={styles.warning}>{t('memory.hiddenLabelHint')}</Text>
                )}
                {!editing.hidden && suggestsHiding(editing.text, editing.category) && (
                  <Text style={styles.warning}>{t('memory.hiddenSuggest')}</Text>
                )}
                <View style={styles.proposalButtons}>
                  <Pressable accessibilityRole="button" onPress={() => setEditing(null)} hitSlop={8}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={saveEdit} style={styles.applyButton}>
                    <Text style={styles.addText}>{t('common.save')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <FactRow
                icon={item.sensitive ? 'secure' : undefined}
                text={item.sensitive && !revealed.has(item.id) ? t('memory.hiddenRow', { label: hiddenLabel(item) }) : item.text}
                onEdit={() => startEdit(item)}
                onRemove={() => run((db) => deleteMemory(db, item.id))}
                accessory={
                  item.sensitive ? (
                    <Pressable
                      onPress={() => (revealed.has(item.id) ? hide(item.id) : reveal(item.id))}
                      hitSlop={8}
                      style={styles.revealButton}
                      accessibilityRole="button"
                    >
                      <Text style={styles.revealText}>{t(revealed.has(item.id) ? 'memory.hide' : 'memory.reveal')}</Text>
                    </Pressable>
                  ) : undefined
                }
              />
            )
          }
        />

        <View style={styles.addArea}>
          {!!newText.trim() && (
            <>
              <CategoryPicker value={newCategory} onChange={setNewCategory} />
              {warnsAboutIdNumbers(newCategory) && <Text style={styles.warning}>{t('memory.idWarning')}</Text>}
              {suggestsHiding(newText, newCategory) && !hiddenKindOf(newText) && (
                <Text style={styles.warning}>{t('memory.hiddenSuggestAdd')}</Text>
              )}
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
              accessibilityRole="button"
              onPress={add}
              disabled={!newText.trim()}
              style={[styles.addButton, !newText.trim() && styles.disabled]}
            >
              <Text style={styles.addText}>{t('memory.add')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingContainer>
      {questions && (
        <ProfileStepScreen
          visible={asking}
          onClose={() => {
            setAsking(false);
            reload();
          }}
          ai={ai}
          voice={questions.voice}
          onVoice={questions.onVoice}
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
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: c.bg },
  disabled: { opacity: 0.35 },
  list: { ...readableColumn, padding: 16, gap: 8 },
  top: { gap: 10, marginBottom: 4 },
  hint: common(c).hint,
  small: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  smallRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  smallIcon: { marginTop: 2 },
  smallText: { flex: 1 },
  search: {
    color: c.text,
    // Grows with large text sizes instead of clipping the text.
    minHeight: 40,
    borderRadius: radii.control,
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
    borderRadius: radii.card,
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
    borderRadius: radii.inner,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: c.tint, borderColor: c.tint },
  proposalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 4 },
  cancelText: { fontSize: 15, color: c.tintText },
  applyButton: { paddingHorizontal: 16, minHeight: 36, paddingVertical: 6, borderRadius: radii.button, backgroundColor: c.tint, justifyContent: 'center' },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  loading: { marginTop: 32 },
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
    borderRadius: radii.control,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  editRow: { flexDirection: 'column', alignItems: 'stretch', paddingRight: 12 },
  pressed: { backgroundColor: c.pressed },
  rowText: { flex: 1, fontSize: 15, color: c.text, lineHeight: 20 },
  editInput: { paddingVertical: 0, flex: 0 },
  warning: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockText: { flex: 1, gap: 2 },
  lockTitle: { fontSize: 14, color: c.text, fontWeight: '600' },
  labelInput: {
    color: c.text,
    // Grows with large text sizes instead of clipping the text.
    minHeight: 38,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    backgroundColor: c.sunken,
    fontSize: 15,
  },
  revealButton: { paddingHorizontal: 8, height: 32, justifyContent: 'center' },
  revealText: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  chips: { gap: 6, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingVertical: 6,
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
    minHeight: 42,
    paddingVertical: 8,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  addButton: {
    paddingHorizontal: 16,
    borderRadius: radii.button,
    backgroundColor: c.tint,
    justifyContent: 'center',
  },
  addText: { color: c.onTint, fontWeight: '700', fontSize: 15 },
}));
