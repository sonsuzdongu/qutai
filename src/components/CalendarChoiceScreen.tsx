import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarChoice,
  calendarListAccess,
  CalendarOption,
  getCalendarChoice,
  ListAccess,
  listReminderLists,
  listWritableCalendars,
  remindersAccess,
  requestCalendarListAccess,
  requestRemindersAccess,
  setCalendarChooser,
  setCalendarChoice,
} from '../device/calendarChoice';
import { openSettingsOrExplain } from '../device/settings';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { Radio } from '../ui/Radio';
import { makeStyles, usePalette } from '../ui/theme';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';

type Loaded = {
  access: ListAccess;
  calendars: CalendarOption[];
  reminders: ListAccess;
  lists: CalendarOption[];
  choice: CalendarChoice;
};

/**
 * "Calendar for the assistant": which calendar new events go to and, on iOS, which Reminders list new reminders go
 * to (device/calendarChoice.ts). Opened from Settings › Assistant, from setup right after the calendar permission was
 * granted, and once when the assistant's first event got the permission (CalendarChoiceHost). Lists only calendars
 * that can take new events, with their account and colour; "Automatic" keeps the phone's default.
 */
export function CalendarChoiceScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <Content onClose={onClose} />}
      <DialogHost />
    </AppModal>
  );
}

async function loadAll(): Promise<Loaded> {
  const [access, reminders, choice] = await Promise.all([calendarListAccess(), remindersAccess(), getCalendarChoice()]);
  const [calendars, lists] = await Promise.all([
    access === 'granted' ? listWritableCalendars().catch(() => []) : Promise.resolve([]),
    reminders === 'granted' ? listReminderLists().catch(() => []) : Promise.resolve([]),
  ]);
  return { access, calendars, reminders, lists, choice };
}

function Content({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const [data, setData] = useState<Loaded | null>(null);
  const reload = useCallback(() => {
    loadAll()
      .then(setData)
      .catch(() =>
        setData({
          access: 'unavailable',
          calendars: [],
          reminders: 'unavailable',
          lists: [],
          choice: { calendarId: null, reminderListId: null },
        }),
      );
  }, []);
  useEffect(reload, [reload]);

  const choose = (patch: Partial<CalendarChoice>) => {
    setData((d) => (d ? { ...d, choice: { ...d.choice, ...patch } } : d));
    setCalendarChoice(patch).catch(() => {});
  };
  // A chosen calendar that is no longer listed counts as automatic (the tools forget it on next use too).
  const calendarId =
    data?.choice.calendarId && data.calendars.some((c) => c.id === data.choice.calendarId) ? data.choice.calendarId : null;
  const listId =
    data?.choice.reminderListId && data.lists.some((c) => c.id === data.choice.reminderListId)
      ? data.choice.reminderListId
      : null;

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <View style={styles.header}>
        <Text style={[styles.title, styles.side]} accessibilityRole="header">
          {t('calendarChoice.title')}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      {!data ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>{t('calendarChoice.eventsLabel')}</Text>
          {data.access === 'granted' ? (
            data.calendars.length === 0 ? (
              <Text style={styles.hint}>{t('calendarChoice.none')}</Text>
            ) : (
              <View style={styles.card}>
                <Option
                  title={t('calendarChoice.automatic')}
                  subtitle={t(
                    Platform.OS === 'ios' ? 'calendarChoice.automaticIos' : 'calendarChoice.automaticAndroid',
                  )}
                  selected={!calendarId}
                  onPress={() => choose({ calendarId: null })}
                />
                {data.calendars.map((c) => (
                  <Option
                    key={c.id}
                    title={c.title}
                    subtitle={c.account}
                    color={c.color}
                    selected={calendarId === c.id}
                    onPress={() => choose({ calendarId: c.id })}
                  />
                ))}
              </View>
            )
          ) : (
            <AccessNeeded
              access={data.access}
              text={t(data.access === 'writeOnly' ? 'calendarChoice.writeOnly' : 'calendarChoice.needsAccess')}
              onAllow={() => requestCalendarListAccess().then(reload, reload)}
            />
          )}
          {Platform.OS === 'ios' && (
            <>
              <Text style={styles.label}>{t('calendarChoice.remindersLabel')}</Text>
              {data.reminders === 'granted' ? (
                data.lists.length === 0 ? (
                  <Text style={styles.hint}>{t('calendarChoice.noLists')}</Text>
                ) : (
                  <View style={styles.card}>
                    <Option
                      title={t('calendarChoice.automatic')}
                      subtitle={t('calendarChoice.automaticReminders')}
                      selected={!listId}
                      onPress={() => choose({ reminderListId: null })}
                    />
                    {data.lists.map((c) => (
                      <Option
                        key={c.id}
                        title={c.title}
                        subtitle={c.account}
                        color={c.color}
                        selected={listId === c.id}
                        onPress={() => choose({ reminderListId: c.id })}
                      />
                    ))}
                  </View>
                )
              ) : (
                <AccessNeeded
                  access={data.reminders}
                  text={t('calendarChoice.remindersNeedAccess')}
                  onAllow={() => requestRemindersAccess().then(reload, reload)}
                />
              )}
            </>
          )}
          <Text style={styles.hint}>{t('calendarChoice.footer')}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AccessNeeded({ access, text, onAllow }: { access: ListAccess; text: string; onAllow: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  if (access === 'unavailable') return <Text style={styles.hint}>{t('calendarChoice.unavailable')}</Text>;
  // iOS shows the upgrade from write-only to full access once; after that only Settings can change it.
  const settingsOnly = access === 'blocked';
  return (
    <View style={styles.card}>
      <Text style={[styles.hint, styles.cardText]}>{text}</Text>
      <Pressable
        onPress={settingsOnly ? openSettingsOrExplain : onAllow}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Icon name={settingsOnly ? 'openInNew' : 'check'} size={18} color={palette.tintText} />
        <Text style={styles.buttonText}>{t(settingsOnly ? 'settings.openSystem' : 'calendarChoice.allow')}</Text>
      </Pressable>
    </View>
  );
}

function Option({
  title,
  subtitle,
  color,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  color?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
    >
      <Radio selected={selected} />
      {color !== undefined && (
        <View style={[styles.swatch, color ? { backgroundColor: color } : styles.swatchEmpty]} />
      )}
      <View style={styles.flex}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Lets device/calendar.ts show the chooser in context: when the assistant's first event is what got the calendar
 * permission, the user picks the calendar before the event is added. Mounted once on the browser screen.
 */
export function CalendarChoiceHost() {
  const [visible, setVisible] = useState(false);
  const done = useRef<(() => void) | null>(null);
  useEffect(() => {
    setCalendarChooser(
      () =>
        new Promise<void>((resolve) => {
          done.current?.();
          done.current = resolve;
          setVisible(true);
        }),
    );
    return () => {
      setCalendarChooser(null);
      done.current?.();
      done.current = null;
    };
  }, []);
  return (
    <CalendarChoiceScreen
      visible={visible}
      onClose={() => {
        setVisible(false);
        done.current?.();
        done.current = null;
      }}
    />
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  side: { flex: 1 },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  done: { color: c.tintText, fontSize: 16, fontWeight: '600' },
  loading: { marginTop: 40 },
  content: { padding: 16, gap: 12, maxWidth: 680, alignSelf: 'center', width: '100%' },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 4 },
  hint: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden' },
  cardText: { padding: 14, paddingBottom: 4, fontSize: 14, lineHeight: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
  },
  optionTitle: { color: c.text, fontSize: 15 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  swatchEmpty: { borderWidth: 1, borderColor: c.border },
  pressed: { backgroundColor: c.pressed },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 14,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.tint,
  },
  buttonText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
}));
