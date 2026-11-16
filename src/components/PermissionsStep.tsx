import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { listWritableCalendars } from '../device/calendarChoice';
import {
  PermissionKind,
  permissionState,
  PermissionState,
  requestPermission,
  setupPermissions,
} from '../device/permissionStatus';
import { openSettingsOrExplain } from '../device/settings';
import { MessageKey, t } from '../i18n';
import { Icon, IconName } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { CalendarChoiceScreen } from './CalendarChoiceScreen';

const ICONS: Record<PermissionKind, IconName> = {
  location: 'location',
  microphone: 'microphone',
  calendar: 'calendar',
  reminders: 'reminder',
  notifications: 'notifications',
};

const BODY: Record<PermissionKind, MessageKey> = {
  location: 'permissions.locationBody',
  microphone: Platform.OS === 'ios' ? 'permissions.microphoneBodyIos' : 'permissions.microphoneBody',
  calendar: 'permissions.calendarBody',
  reminders: 'permissions.remindersBody',
  notifications: Platform.OS === 'android' ? 'permissions.notificationsBodyAndroid' : 'permissions.notificationsBody',
};

/**
 * Setup's "What Qutai may use" step: one row per phone permission with what it is for and a switch. Nothing is asked
 * until the user turns a switch on; the switch then shows what the system answered (rows re-read the state when the
 * user comes back from the phone's settings). Every row is optional; the step's own button moves on either way.
 * Turning a granted row off opens the phone's settings, the only place a permission can be taken back.
 */
export function PermissionsStep() {
  const styles = useStyles();
  const kinds = setupPermissions();
  const [states, setStates] = useState<Partial<Record<PermissionKind, PermissionState>>>({});
  /** Rows the user tapped in this step: only those say "not allowed" (Android reports never-asked as denied). */
  const [asked, setAsked] = useState<Partial<Record<PermissionKind, boolean>>>({});
  const [busy, setBusy] = useState<PermissionKind | null>(null);
  const [choosing, setChoosing] = useState(false);

  const refresh = useCallback(() => {
    for (const kind of setupPermissions()) {
      permissionState(kind).then((state) => setStates((s) => ({ ...s, [kind]: state })));
    }
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const toggle = async (kind: PermissionKind, on: boolean) => {
    const state = states[kind];
    if (!on || state === 'blocked') {
      // A permission can only be taken back (or allowed after "don't ask again") in the phone's settings.
      if (state === 'granted' || state === 'limited' || state === 'blocked') openSettingsOrExplain();
      return;
    }
    setBusy(kind);
    setAsked((a) => ({ ...a, [kind]: true }));
    const next = await requestPermission(kind);
    setStates((s) => ({ ...s, [kind]: next }));
    setBusy(null);
    // Just allowed: choose the calendar the assistant adds events to, when there is a choice.
    if (kind === 'calendar' && next === 'granted' && state !== 'granted') {
      const calendars = await listWritableCalendars().catch(() => []);
      if (calendars.length >= 2) setChoosing(true);
    }
  };

  return (
    <>
      <View style={styles.card}>
        {kinds.map((kind) => (
          <Row
            key={kind}
            kind={kind}
            state={states[kind]}
            asked={!!asked[kind]}
            busy={busy === kind}
            onToggle={(on) => void toggle(kind, on)}
            onChooseCalendar={() => setChoosing(true)}
          />
        ))}
      </View>
      <CalendarChoiceScreen visible={choosing} onClose={() => setChoosing(false)} />
    </>
  );
}

function Row({
  kind,
  state,
  asked,
  busy,
  onToggle,
  onChooseCalendar,
}: {
  kind: PermissionKind;
  state: PermissionState | undefined;
  asked: boolean;
  busy: boolean;
  onToggle: (on: boolean) => void;
  onChooseCalendar: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const title = t(`permissions.${kind}`);
  const on = state === 'granted' || state === 'limited';
  let status: string | null = null;
  if (state === 'granted') status = t('permissions.allowed');
  else if (state === 'limited')
    status = t(kind === 'microphone' ? 'permissions.microphoneLimited' : 'permissions.calendarLimited');
  else if (state === 'blocked') status = t('permissions.blocked');
  else if (state === 'denied' && asked) status = t('permissions.denied');
  else if (state === 'unavailable') status = t('permissions.unavailable');
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Icon name={ICONS[kind]} size={20} color={palette.tintText} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{t(BODY[kind])}</Text>
        {status && (
          <Text style={[styles.status, on && styles.statusOn]} accessibilityLiveRegion="polite">
            {status}
          </Text>
        )}
        {state === 'blocked' && (
          <Pressable onPress={openSettingsOrExplain} accessibilityRole="button" hitSlop={6} style={styles.link}>
            <Text style={styles.linkText}>{t('settings.openSystem')}</Text>
          </Pressable>
        )}
        {kind === 'calendar' && state === 'granted' && (
          <Pressable onPress={onChooseCalendar} accessibilityRole="button" hitSlop={6} style={styles.link}>
            <Text style={styles.linkText}>{t('permissions.chooseCalendar')}</Text>
          </Pressable>
        )}
      </View>
      <ThemedSwitch
        value={on}
        onValueChange={onToggle}
        disabled={busy || state === undefined || state === 'unavailable'}
        accessibilityLabel={title}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  card: { backgroundColor: c.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
  },
  title: { color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 2 },
  body: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  status: { color: c.danger, fontSize: 13, marginTop: 4 },
  statusOn: { color: c.textSecondary },
  link: { alignSelf: 'flex-start', marginTop: 4 },
  linkText: { color: c.tintText, fontSize: 14, fontWeight: '600' },
}));
