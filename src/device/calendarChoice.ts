import { Platform } from 'react-native';
import { getLanguage } from '../i18n';
import { deleteKey, getDb, getJson, setJson } from '../storage/db';

type CalendarModule = typeof import('expo-calendar');

/**
 * Which calendar the assistant adds events to (and on iOS which Reminders list it adds reminders to), chosen by the
 * user (CalendarChoiceScreen). Stored on this phone only (the kv table, not in backups: calendar ids belong to the
 * phone). Nothing set: the default calendar on iOS, an account's primary calendar on Android (device/calendar.ts).
 */
export type CalendarChoice = {
  calendarId: string | null;
  /** iOS only: a Reminders list. */
  reminderListId: string | null;
};

/** One calendar or Reminders list as the chooser shows it. */
export type CalendarOption = {
  id: string;
  title: string;
  /** The account it belongs to ("Google: name@gmail.com", "iCloud", "On My iPhone"). */
  account: string;
  /** "#RRGGBB" or null. */
  color: string | null;
  primary: boolean;
};

const KEY = 'device:calendar_choice';
const NONE: CalendarChoice = { calendarId: null, reminderListId: null };

export async function getCalendarChoice(): Promise<CalendarChoice> {
  try {
    return { ...NONE, ...(await getJson<Partial<CalendarChoice>>(await getDb(), KEY)) };
  } catch {
    return NONE;
  }
}

export async function setCalendarChoice(patch: Partial<CalendarChoice>): Promise<void> {
  const next = { ...(await getCalendarChoice()), ...patch };
  const db = await getDb();
  if (!next.calendarId && !next.reminderListId) await deleteKey(db, KEY);
  else await setJson(db, KEY, next);
}

async function load(): Promise<CalendarModule | null> {
  try {
    return await import('expo-calendar');
  } catch {
    return null;
  }
}

/**
 * The state of the access the chooser needs to list calendars: Android's calendar permission; iOS full access (with
 * write-only access iOS shows one virtual calendar, so the real ones can't be listed). 'writeOnly' (iOS): events can be
 * added to the default calendar, but no list can be shown.
 */
export type ListAccess = 'granted' | 'writeOnly' | 'undetermined' | 'denied' | 'blocked' | 'unavailable';

export async function calendarListAccess(): Promise<ListAccess> {
  const Calendar = await load();
  if (!Calendar) return 'unavailable';
  try {
    const full = await Calendar.getCalendarPermissions(false);
    if (full.granted) return 'granted';
    if (Platform.OS === 'ios' && (await Calendar.getCalendarPermissions(true)).granted) return 'writeOnly';
    if (full.status === 'undetermined') return 'undetermined';
    return full.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'unavailable';
  }
}

/**
 * Asks for the access calendarListAccess describes, only after the user's tap. On iOS a user who gave write-only
 * access is shown the upgrade prompt once (iOS reports full access as not askable then, but still shows it).
 */
export async function requestCalendarListAccess(): Promise<ListAccess> {
  const Calendar = await load();
  if (!Calendar) return 'unavailable';
  const before = await calendarListAccess();
  if (before === 'granted' || before === 'blocked' || before === 'unavailable') return before;
  try {
    const status = await Calendar.requestCalendarPermissions(false);
    if (status.granted) return 'granted';
  } catch {
    return 'unavailable';
  }
  const after = await calendarListAccess();
  // iOS: a refused upgrade keeps write-only, and the upgrade prompt is not shown again.
  return after;
}

/** iOS Reminders access (Android has no Reminders lists). */
export async function remindersAccess(): Promise<ListAccess> {
  if (Platform.OS !== 'ios') return 'unavailable';
  const Calendar = await load();
  if (!Calendar) return 'unavailable';
  try {
    const status = await Calendar.getRemindersPermissions();
    if (status.granted) return 'granted';
    if (status.status === 'undetermined') return 'undetermined';
    return status.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'unavailable';
  }
}

export async function requestRemindersAccess(): Promise<ListAccess> {
  const before = await remindersAccess();
  if (before !== 'undetermined' && before !== 'denied') return before;
  const Calendar = await load();
  try {
    await Calendar?.requestRemindersPermissions();
  } catch {}
  return remindersAccess();
}

const WRITABLE_LEVELS = new Set<string>(['owner', 'editor', 'contributor', 'root']);

type Cal = Awaited<ReturnType<CalendarModule['getCalendars']>>[number];

/** Calendars new events can go to (Android: visible and synced ones the user may write to). */
export function isWritable(c: Cal): boolean {
  return (
    c.allowsModifications &&
    (Platform.OS === 'ios' || (c.isVisible !== false && c.isSynced !== false)) &&
    (!c.accessLevel || WRITABLE_LEVELS.has(c.accessLevel))
  );
}

function toOption(c: Cal): CalendarOption {
  const source = c.source;
  const account = source?.name?.trim() || c.ownerAccount?.trim() || '';
  return {
    id: c.id,
    title: c.title?.trim() || account,
    account,
    color: typeof c.color === 'string' && c.color ? c.color : null,
    primary: !!c.isPrimary,
  };
}

/** The writable event calendars, primary first, then by account and name. Needs calendarListAccess 'granted'. */
export async function listWritableCalendars(): Promise<CalendarOption[]> {
  const Calendar = await load();
  if (!Calendar) return [];
  const all =
    Platform.OS === 'ios' ? await Calendar.getCalendars(Calendar.EntityTypes.EVENT) : await Calendar.getCalendars();
  return sortOptions(all.filter(isWritable).map(toOption));
}

/** iOS Reminders lists that can take new reminders. Needs remindersAccess 'granted'. */
export async function listReminderLists(): Promise<CalendarOption[]> {
  if (Platform.OS !== 'ios') return [];
  const Calendar = await load();
  if (!Calendar) return [];
  const all = await Calendar.getCalendars(Calendar.EntityTypes.REMINDER);
  return sortOptions(all.filter((c) => c.allowsModifications).map(toOption));
}

function sortOptions(list: CalendarOption[]): CalendarOption[] {
  return list.sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) || a.account.localeCompare(b.account, getLanguage()) || a.title.localeCompare(b.title, getLanguage()),
  );
}

// ---------- Offering the chooser where the permission is first granted ----------

type Chooser = () => Promise<void>;
let chooser: Chooser | null = null;

/** The browser screen registers how to show the chooser (CalendarChoiceHost); null when it goes away. */
export function setCalendarChooser(show: Chooser | null) {
  chooser = show;
}

/**
 * Shows the chooser once, right after the calendar access was granted for the first time in context (the assistant
 * adding an event), and waits until the user picked or closed it. Only when there is a choice to make (two or more
 * writable calendars) and the app is on screen; otherwise resolves at once.
 */
export async function offerCalendarChoice(): Promise<void> {
  if (!chooser) return;
  try {
    if ((await calendarListAccess()) !== 'granted') return;
    if ((await listWritableCalendars()).length < 2) return;
    await chooser();
  } catch {}
}
