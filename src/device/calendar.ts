import { Platform } from 'react-native';
import type { CalendarEntry, CalendarEventPlan, CalendarReadPlan, ReminderPlan } from '../agent/scheduling';
import { getCalendarChoice, isWritable, offerCalendarChoice, setCalendarChoice } from './calendarChoice';

type CalendarModule = typeof import('expo-calendar');
type PermissionResponse = Awaited<ReturnType<CalendarModule['getCalendarPermissions']>>;

/** An error whose message is written for the model, to explain to the user. */
export class DeviceToolError extends Error {}

const NEEDS_BUILD =
  'Calendar support is not in this build of Qutai yet (a new app build is needed). Tell the user it is not available.';

/** Android has no system reminders; a reminder becomes a short calendar event with an alarm. */
const ANDROID_REMINDER_MINUTES = 15;

// Loaded on first use, so a build without the native module still starts.
async function load(): Promise<CalendarModule> {
  try {
    return await import('expo-calendar');
  } catch {
    throw new DeviceToolError(NEEDS_BUILD);
  }
}

function denied(what: string): DeviceToolError {
  return new DeviceToolError(
    `Permission denied: the user has not allowed Qutai to access ${what}. Explain this to the user and offer ` +
      "(with ask_user) to open Qutai's page in the phone's settings with open_settings (target system), where they can allow it. " +
      'Do not call this tool again unless they say they have allowed it.',
  );
}

/**
 * Asks for the permission only if it was never decided; a denial is final until the user changes it in Settings.
 * Resolves true when this call is what granted it (the system prompt was shown and the user allowed it).
 */
async function ensure(
  get: () => Promise<PermissionResponse>,
  request: () => Promise<PermissionResponse>,
  what: string,
): Promise<boolean> {
  let status = await get();
  if (status.granted) return false;
  if (status.canAskAgain) status = await request();
  if (!status.granted) throw denied(what);
  return true;
}

/**
 * iOS: write-only access is enough to add events (iOS 17+); Android needs read and write to find a calendar.
 * Granted just now: the user is offered to choose the calendar before the event is added (offerCalendarChoice only
 * shows it when calendars can be listed, so not with iOS write-only access, and when there are two or more).
 */
async function ensureCalendarAccess(Calendar: CalendarModule) {
  const writeOnly = Platform.OS === 'ios';
  const granted = await ensure(
    () => Calendar.getCalendarPermissions(writeOnly),
    () => Calendar.requestCalendarPermissions(writeOnly),
    'the calendar',
  );
  if (granted) await offerCalendarChoice();
}

/** The calendar used, and what the model should tell the user when it isn't the one they chose. */
type Target = { calendar: Awaited<ReturnType<CalendarModule['getCalendars']>>[number]; note: string };

const MISSING_NOTE =
  ' The calendar the user chose in Settings is no longer on this phone (or can no longer be written to), so this one ' +
  'was used instead; tell the user, and that they can choose another in Settings › Assistant › Calendar for the assistant.';
const NO_FULL_ACCESS_NOTE =
  ' The calendar the user chose in Settings can only be used with full calendar access, which Qutai does not have ' +
  'now, so the default calendar was used instead; tell the user.';

/**
 * The calendar new events go to: the one the user chose (Settings › Assistant › Calendar for the assistant) while it still exists and
 * can be written; otherwise the default one on iOS and, on Android, where there is no default, the primary calendar of
 * an account (or else the first writable one). No calendar is created. A chosen calendar that is gone is forgotten.
 */
async function targetCalendar(Calendar: CalendarModule): Promise<Target> {
  const { calendarId } = await getCalendarChoice();
  let note = '';
  if (calendarId) {
    const full = Platform.OS !== 'ios' || (await Calendar.getCalendarPermissions(false)).granted;
    if (full) {
      const all =
        Platform.OS === 'ios' ? await Calendar.getCalendars(Calendar.EntityTypes.EVENT) : await Calendar.getCalendars();
      const chosen = all.find((c) => c.id === calendarId);
      if (chosen && isWritable(chosen)) return { calendar: chosen, note };
      await setCalendarChoice({ calendarId: null }).catch(() => {});
      note = MISSING_NOTE;
    } else {
      note = NO_FULL_ACCESS_NOTE;
    }
  }
  if (Platform.OS === 'ios') return { calendar: Calendar.getDefaultCalendarSync(), note };
  const writable = (await Calendar.getCalendars()).filter(isWritable);
  const calendar = writable.find((c) => c.isPrimary) ?? writable[0];
  if (!calendar) {
    throw new DeviceToolError(
      'No writable calendar was found on this phone. Tell the user to add an account with a calendar ' +
        '(for example their Google account) in the phone settings, or offer schedule_notification instead.',
    );
  }
  return { calendar, note };
}

/** Adds an event to the user's calendar; resolves with the calendar's name and a note for the model ('' or a sentence). */
export async function addCalendarEvent(plan: CalendarEventPlan): Promise<{ calendar: string; note: string }> {
  const Calendar = await load();
  await ensureCalendarAccess(Calendar);
  const { calendar, note } = await targetCalendar(Calendar);
  const method = Platform.OS === 'android' ? Calendar.AlarmMethod.ALERT : undefined;
  await calendar.createEvent({
    title: plan.title,
    startDate: plan.start,
    endDate: plan.end,
    location: plan.location ?? null,
    notes: plan.notes,
    alarms: plan.alertMinutes === undefined ? [] : [{ relativeOffset: -plan.alertMinutes, method }],
  });
  return { calendar: calendar.title, note };
}

/**
 * iOS: a reminder in the Reminders list the user chose (Settings › Assistant › Calendar for the assistant) or else the default list,
 * with an alert at the due time.
 * Android: a calendar event with an alarm at the due time (a due time is required there).
 */
export async function addReminder(plan: ReminderPlan): Promise<string> {
  const Calendar = await load();
  if (Platform.OS === 'android') {
    if (!plan.due) throw new DeviceToolError('A due time is required on Android.');
    await ensureCalendarAccess(Calendar);
    const { calendar, note } = await targetCalendar(Calendar);
    await calendar.createEvent({
      title: plan.title,
      startDate: plan.due,
      endDate: new Date(plan.due.getTime() + ANDROID_REMINDER_MINUTES * 60_000),
      notes: plan.notes,
      alarms: [{ relativeOffset: 0, method: Calendar.AlarmMethod.ALERT }],
    });
    return `a calendar event with an alarm in "${calendar.title}" (Android has no reminders app).${note}`;
  }
  await ensure(Calendar.getRemindersPermissions, Calendar.requestRemindersPermissions, 'reminders');
  const details = {
    title: plan.title,
    notes: plan.notes,
    dueDate: plan.due,
    alarms: plan.due ? [{ absoluteDate: plan.due.toISOString() }] : [],
  };
  const { reminderListId } = await getCalendarChoice();
  let note = '';
  if (reminderListId) {
    const list = (await Calendar.getCalendars(Calendar.EntityTypes.REMINDER)).find((c) => c.id === reminderListId);
    if (list?.allowsModifications) {
      const { createReminderAsync } = await import('expo-calendar/legacy');
      await createReminderAsync(list.id, details);
      return `the Reminders list "${list.title}".`;
    }
    await setCalendarChoice({ reminderListId: null }).catch(() => {});
    note =
      ' The Reminders list the user chose in Settings is no longer on this phone, so the default list was used; tell ' +
      'the user, and that they can choose another in Settings › Assistant › Calendar for the assistant.';
  }
  // The object API has no way to find the default Reminders list; the legacy call uses it when no list is given.
  const { createReminderAsync } = await import('expo-calendar/legacy');
  await createReminderAsync(null, details);
  return `the default Reminders list.${note}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Reading needs full calendar access. Android: the same read and write request as adding events.
 * iOS 17+: full access is a separate grant. An app that holds write-only access reports full access as
 * denied and not askable, but iOS still shows the prompt to upgrade once, so it is requested then too.
 */
async function ensureReadAccess(Calendar: CalendarModule) {
  if (Platform.OS !== 'ios') return ensureCalendarAccess(Calendar);
  let status = await Calendar.getCalendarPermissions(false);
  if (!status.granted) {
    const writeOnly = await Calendar.getCalendarPermissions(true);
    if (status.canAskAgain || writeOnly.granted) status = await Calendar.requestCalendarPermissions(false);
  }
  if (!status.granted) throw denied('read the calendar (full access; adding events alone is not enough)');
}

/** A date of an all-day event: Android stores those at UTC midnight, iOS at local midnight. */
function dayOf(date: Date): string {
  if (Platform.OS === 'android')
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Events in the range, from every event calendar the user can see (hidden Android calendars are left out;
 * on iOS Reminders lists are not event calendars, so they are never read). Both platforms return each
 * occurrence of a recurring event separately. Sorted by start; notes only when asked for.
 */
export async function readCalendarEvents(plan: CalendarReadPlan): Promise<CalendarEntry[]> {
  const Calendar = await load();
  await ensureReadAccess(Calendar);
  const calendars = (
    Platform.OS === 'ios' ? await Calendar.getCalendars(Calendar.EntityTypes.EVENT) : await Calendar.getCalendars()
  ).filter((c) => c.isVisible !== false && (!c.entityType || c.entityType === Calendar.EntityTypes.EVENT));
  if (calendars.length === 0) return [];
  const names = new Map(calendars.map((c) => [c.id, c.title]));
  const events = await Calendar.listEvents(calendars.map((c) => c.id), plan.start, plan.end);
  const firstDay = `${plan.start.getFullYear()}-${pad(plan.start.getMonth() + 1)}-${pad(plan.start.getDate())}`;
  const lastMoment = new Date(plan.end.getTime() - 1);
  const lastDay = `${lastMoment.getFullYear()}-${pad(lastMoment.getMonth() + 1)}-${pad(lastMoment.getDate())}`;
  const entries: CalendarEntry[] = [];
  for (const e of events) {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    let allDay: CalendarEntry['allDay'] = null;
    if (e.allDay) {
      // The end is exclusive midnight on Android and 23:59:59 of the last day on iOS.
      allDay = { first: dayOf(start), last: dayOf(new Date(Math.max(start.getTime(), end.getTime() - 1000))) };
      // Android matches all-day events in UTC, so a neighbouring day can come back; keep only the asked days.
      if (allDay.last < firstDay || allDay.first > lastDay) continue;
    } else if (end.getTime() <= plan.start.getTime() || start.getTime() >= plan.end.getTime()) {
      continue;
    }
    const availability = String(e.availability ?? '');
    entries.push({
      title: (e.title ?? '').trim(),
      start,
      end,
      allDay,
      location: e.location?.trim() || null,
      calendar: names.get(e.calendarId) ?? '',
      availability: ['busy', 'free', 'tentative', 'unavailable'].includes(availability) ? availability : null,
      ...(plan.details && e.notes?.trim() ? { notes: e.notes.trim() } : {}),
    });
  }
  // All-day events first on their day (on Android their start is UTC midnight, not local).
  const key = (e: CalendarEntry) => {
    if (!e.allDay) return e.start.getTime();
    const [y, m, d] = e.allDay.first.split('-').map(Number);
    return new Date(y, m - 1, d).getTime() - 1;
  };
  return entries.sort((a, b) => key(a) - key(b));
}
