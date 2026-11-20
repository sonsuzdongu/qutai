import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { firstDayOfWeek, formatDateTime, formatList, formatShortDate, formatTime, hostOf, weekdayShort } from '../i18n/format';
import { ensureNotificationPermission } from '../device/notifications';
import { offerSettings } from '../device/settings';
import { MAX_PENDING, pendingCount, syncTaskReminders } from '../device/taskSchedule';
import { getDb } from '../storage/db';
import {
  addSavedTask,
  deleteSavedTask,
  listSavedTasks,
  MAX_TASK_NAME,
  MAX_TASK_PROMPT,
  nextRun,
  SavedTask,
  setSavedTaskPaused,
  TaskSchedule,
  TaskInput,
  TaskTarget,
  updateSavedTask,
} from '../storage/savedTasks';
import { Icon, IconName } from '../ui/Icon';
import { makeStyles, readableColumn, usePalette, radii, common } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { KeyboardAwareScrollView } from './KeyboardAware';
import { ScreenHeader } from './ScreenHeader';
import { WholeWordsText } from './WholeWordsText';

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
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <TaskList onClose={onClose} onRun={onRun} draft={draft ?? null} />}
      <DialogHost />
    </AppModal>
  );
}

export const emptyTask = (): TaskInput => ({
  name: '',
  prompt: '',
  target: 'page',
  url: null,
  research: false,
  schedule: null,
  paused: false,
  private: false,
  autoRun: false,
});

/** "Daily at 09:00", "Mon, Wed at 18:30", "Once, Saturday 14 November 2026, 09:00". */
export function describeSchedule(schedule: TaskSchedule): string {
  if (schedule.kind === 'once') return t('tasks.scheduleOnce', { when: formatDateTime(new Date(schedule.at)) });
  const time = formatTime(schedule.hour, schedule.minute);
  if (schedule.kind === 'daily') return t('tasks.scheduleDaily', { time });
  const days = weekOrder()
    .filter((d) => schedule.days.includes(d))
    .map(weekdayShort);
  return t('tasks.scheduleWeekly', { days: formatList(days), time });
}

/** Weekdays in the order of the user's language: Monday first in Turkish or German, Sunday first in English. */
const weekOrder = () => (firstDayOfWeek() === 2 ? [2, 3, 4, 5, 6, 7, 1] : [1, 2, 3, 4, 5, 6, 7]);

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
          : code === 'past'
            ? t('tasks.errorPast')
            : code === 'too-many'
              ? t('tasks.errorTooMany', { max: MAX_PENDING })
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
  const palette = usePalette();
  const [tasks, setTasks] = useState<SavedTask[] | null>(null);
  // The task being edited: an existing one (id) or a new one (no id).
  const [editing, setEditing] = useState<{ id?: string; input: TaskInput; incognito?: boolean } | null>(() =>
    draft ? { input: draft, incognito: draft.incognito } : null,
  );

  // Every change to the list schedules the reminders again (a deleted or paused task's are cancelled).
  const reload = useCallback(() => {
    getDb()
      .then(listSavedTasks)
      .then((list) => {
        setTasks(list);
        syncTaskReminders(list);
      })
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
      const { schedule, paused } = editing.input;
      if (schedule && !paused) {
        if (schedule.kind === 'once' && schedule.at <= Date.now()) throw new Error('past');
        const others = (tasks ?? []).filter((x) => x.id !== editing.id).reduce((n, x) => n + pendingCount(x), 0);
        if (others + pendingCount(editing.input) > MAX_PENDING) throw new Error('too-many');
        // Asked when a reminder is set, not before; the task is saved either way.
        const permission = await ensureNotificationPermission().catch(() => 'denied' as const);
        if (permission === 'blocked') offerSettings(t('tasks.notifyBlocked'));
        else if (permission === 'denied') dialog.alert(t('tasks.notifyDenied'));
      }
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
        <ScreenHeader
          title={t(editing.id ? 'tasks.editTitle' : 'tasks.newTitle')}
          left={{ label: t('common.cancel'), tone: 'link', onPress: () => setEditing(null) }}
          right={{ label: t('common.save'), onPress: save }}
        />
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
      <ScreenHeader title={t('tasks.title')} right={{ label: t('common.done'), onPress: onClose }} />
      <FlatList
        data={tasks ?? []}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.hint}>{t('tasks.hint')}</Text>}
        ListEmptyComponent={tasks ? <Text style={styles.empty}>{t('tasks.empty')}</Text> : <ActivityIndicator style={styles.loading} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
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
              {item.schedule ? (
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleText}>
                    <Icon name="alarm" size={13} color={palette.textSecondary} style={styles.scheduleIcon} />
                    <Text style={[styles.meta, styles.scheduleMeta]} numberOfLines={2}>
                      {`${describeSchedule(item.schedule)} · ${scheduleState(item)}`}
                    </Text>
                  </View>
                  {nextRun(item.schedule) ? (
                    <Pressable
                      onPress={() =>
                        getDb()
                          .then((db) => setSavedTaskPaused(db, item.id, !item.paused))
                          .then(reload, saveError)
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pause}>{t(item.paused ? 'tasks.resume' : 'tasks.pause')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
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
    <KeyboardAwareScrollView contentContainerStyle={styles.form}>
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
            <WholeWordsText style={[styles.segmentText, input.target === o.value && styles.segmentTextSelected]}>{o.label}</WholeWordsText>
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
      <ScheduleFields input={input} set={set} />
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
    </KeyboardAwareScrollView>
  );
}

/** "next: Sat, 14 Nov 09:00", "paused", or "done" for a one-off reminder that has passed. */
function scheduleState(task: SavedTask): string {
  const next = nextRun(task.schedule);
  if (!next) return t('tasks.scheduleDone');
  if (task.paused) return t('tasks.schedulePaused');
  const d = new Date(next);
  return t('tasks.scheduleNext', { when: `${formatShortDate(d)} ${formatTime(d.getHours(), d.getMinutes())}` });
}

type ScheduleKind = 'off' | TaskSchedule['kind'];

/** `h:m` on `day`; without a day, the next time it comes round (today if still ahead, else tomorrow). */
function onceAt(h: number, m: number, day?: Date): number {
  const d = day ? new Date(day) : new Date();
  d.setHours(h, m, 0, 0);
  if (!day && d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** The reminder: off, once (a day and a time), daily or weekly (days and a time), and what tapping it does. */
function ScheduleFields({ input, set }: { input: TaskInput; set: (patch: Partial<TaskInput>) => void }) {
  const styles = useStyles();
  const schedule = input.schedule;
  const kind: ScheduleKind = schedule?.kind ?? 'off';
  // The time and day the fields show; kept when switching between kinds.
  const at = schedule?.kind === 'once' ? new Date(schedule.at) : null;
  const hour = schedule ? (schedule.kind === 'once' ? at!.getHours() : schedule.hour) : 9;
  const minute = schedule ? (schedule.kind === 'once' ? at!.getMinutes() : schedule.minute) : 0;
  const days = schedule?.kind === 'weekly' ? schedule.days : [new Date().getDay() + 1];

  const choose = (next: ScheduleKind) => {
    if (next === 'off') return set({ schedule: null });
    if (next === 'once') return set({ schedule: { kind: 'once', at: onceAt(hour, minute) } });
    if (next === 'daily') return set({ schedule: { kind: 'daily', hour, minute } });
    set({ schedule: { kind: 'weekly', hour, minute, days } });
  };
  const setTime = (h: number, m: number) => {
    if (!schedule) return;
    if (schedule.kind === 'once') set({ schedule: { kind: 'once', at: onceAt(h, m, at!) } });
    else set({ schedule: { ...schedule, hour: h, minute: m } });
  };
  const shiftDay = (by: number) => {
    if (schedule?.kind !== 'once') return;
    const d = new Date(schedule.at);
    d.setDate(d.getDate() + by);
    set({ schedule: { kind: 'once', at: d.getTime() } });
  };
  const toggleDay = (day: number) => {
    if (schedule?.kind !== 'weekly') return;
    const next = schedule.days.includes(day) ? schedule.days.filter((d) => d !== day) : [...schedule.days, day];
    if (next.length) set({ schedule: { ...schedule, days: next.sort() } });
  };
  const kinds: { value: ScheduleKind; label: string }[] = [
    { value: 'off', label: t('tasks.scheduleOff') },
    { value: 'once', label: t('tasks.scheduleKindOnce') },
    { value: 'daily', label: t('tasks.scheduleKindDaily') },
    { value: 'weekly', label: t('tasks.scheduleKindWeekly') },
  ];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <>
      <Text style={styles.label}>{t('tasks.schedule')}</Text>
      <View style={styles.segment}>
        {kinds.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => choose(o.value)}
            style={[styles.segmentButton, kind === o.value && styles.segmentSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === o.value }}
          >
            <WholeWordsText style={[styles.segmentText, kind === o.value && styles.segmentTextSelected]}>{o.label}</WholeWordsText>
          </Pressable>
        ))}
      </View>
      {schedule ? (
        <>
          {schedule.kind === 'once' && at ? (
            <View style={styles.stepRow}>
              <Stepper
                icon="chevronLeft"
                accessibilityLabel={t('tasks.dayEarlier')}
                disabled={at.getTime() - 86_400_000 < today.getTime()}
                onPress={() => shiftDay(-1)}
              />
              <Text style={styles.stepValue}>{formatShortDate(at)}</Text>
              <Stepper icon="chevronRight" accessibilityLabel={t('tasks.dayLater')} onPress={() => shiftDay(1)} />
            </View>
          ) : null}
          {schedule.kind === 'weekly' ? (
            <View style={styles.days}>
              {weekOrder().map((day) => {
                const on = schedule.days.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => toggleDay(day)}
                    style={[styles.day, on && styles.dayOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>{weekdayShort(day)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={styles.stepRow}>
            <Stepper
              label="−"
              accessibilityLabel={t('tasks.hourEarlier')}
              onPress={() => setTime((hour + 23) % 24, minute)}
            />
            <Stepper
              label="−5"
              accessibilityLabel={t('tasks.minutesEarlier')}
              onPress={() => (minute >= 5 ? setTime(hour, minute - 5) : setTime((hour + 23) % 24, 55))}
            />
            <Text style={styles.stepValue} accessibilityLiveRegion="polite">
              {formatTime(hour, minute)}
            </Text>
            <Stepper
              label="+5"
              accessibilityLabel={t('tasks.minutesLater')}
              onPress={() => (minute < 55 ? setTime(hour, minute + 5) : setTime((hour + 1) % 24, 0))}
            />
            <Stepper label="+" accessibilityLabel={t('tasks.hourLater')} onPress={() => setTime((hour + 1) % 24, minute)} />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchLabel}>{t('tasks.autoRun')}</Text>
              <Text style={styles.small}>{t('tasks.autoRunHint')}</Text>
            </View>
            <ThemedSwitch
              value={input.autoRun}
              onValueChange={(autoRun) => set({ autoRun })}
              accessibilityLabel={t('tasks.autoRun')}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchLabel}>{t('tasks.private')}</Text>
              <Text style={styles.small}>{t('tasks.privateHint')}</Text>
            </View>
            <ThemedSwitch
              value={input.private}
              onValueChange={(isPrivate) => set({ private: isPrivate })}
              accessibilityLabel={t('tasks.private')}
            />
          </View>
          {input.paused ? (
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, styles.flex]}>{t('tasks.schedulePausedLong')}</Text>
              <Pressable onPress={() => set({ paused: false })} hitSlop={8} accessibilityRole="button">
                <Text style={styles.pause}>{t('tasks.resume')}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      <Text style={styles.small}>{t('tasks.scheduleLimit')}</Text>
    </>
  );
}

/** A round step button with a short text ("+5") or an icon (the day arrows). */
function Stepper({
  label,
  icon,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  label?: string;
  icon?: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.stepper, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon ? <Icon name={icon} size={18} color={palette.text} /> : <Text style={styles.stepperText}>{label}</Text>}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  list: { ...readableColumn, padding: 16, gap: 8 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  loading: { marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: radii.control,
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
  addButton: { height: 44, borderRadius: radii.button, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  addText: { color: c.onTint, fontWeight: '700', fontSize: 15 },
  form: { ...readableColumn, padding: 16, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginTop: 8 },
  small: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  input: {
    color: c.text,
    minHeight: 42,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  promptInput: { minHeight: 110 },
  segment: { ...common(c).segment, gap: 3 },
  segmentButton: { ...common(c).segmentButton, paddingHorizontal: 2 },
  segmentSelected: common(c).segmentSelected,
  segmentText: { ...common(c).segmentText, fontSize: 13, textAlign: 'center' },
  segmentTextSelected: { ...common(c).segmentTextSelected, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  switchLabel: { fontSize: 15, color: c.text },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scheduleText: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, flexShrink: 1 },
  scheduleIcon: { marginTop: 1 },
  scheduleMeta: { flexShrink: 1 },
  pause: { fontSize: 13, color: c.tintText, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  stepValue: { minWidth: 96, textAlign: 'center', fontSize: 17, fontWeight: '600', color: c.text },
  stepperText: { fontSize: 15, fontWeight: '600', color: c.text },
  stepper: {
    minWidth: 40,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: c.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  day: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: c.sunken },
  dayOn: { backgroundColor: c.tint },
  dayText: { fontSize: 13, color: c.text },
  dayTextOn: { color: c.onTint, fontWeight: '600' },
  deleteButton: { marginTop: 24, alignSelf: 'center', padding: 10 },
  deleteText: { fontSize: 15, color: c.danger },
}));
