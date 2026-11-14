import { Platform } from 'react-native';
import type { CalendarEventPlan, ReminderPlan } from '../agent/scheduling';

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

/** Asks for the permission only if it was never decided; a denial is final until the user changes it in Settings. */
async function ensure(
  get: () => Promise<PermissionResponse>,
  request: () => Promise<PermissionResponse>,
  what: string,
): Promise<void> {
  let status = await get();
  if (!status.granted && status.canAskAgain) status = await request();
  if (!status.granted) {
    throw new DeviceToolError(
      `Permission denied: the user has not allowed Qutai to access ${what}. Explain this to the user; ` +
        "they can allow it for Qutai in the phone's Settings. Do not call this tool again unless they say they have allowed it.",
    );
  }
}

/** iOS: write-only access is enough to add events (iOS 17+); Android needs read and write to find a calendar. */
async function ensureCalendarAccess(Calendar: CalendarModule) {
  const writeOnly = Platform.OS === 'ios';
  await ensure(
    () => Calendar.getCalendarPermissions(writeOnly),
    () => Calendar.requestCalendarPermissions(writeOnly),
    'the calendar',
  );
}

const WRITABLE_LEVELS = new Set<string>(['owner', 'editor', 'contributor', 'root']);

/**
 * The calendar new events go to: the default one on iOS; on Android, where there is no default,
 * the primary calendar of an account (or else the first writable one). No calendar is created.
 */
async function targetCalendar(Calendar: CalendarModule) {
  if (Platform.OS === 'ios') return Calendar.getDefaultCalendarSync();
  const writable = (await Calendar.getCalendars()).filter(
    (c) =>
      c.allowsModifications &&
      c.isVisible !== false &&
      c.isSynced !== false &&
      (!c.accessLevel || WRITABLE_LEVELS.has(c.accessLevel)),
  );
  const calendar = writable.find((c) => c.isPrimary) ?? writable[0];
  if (!calendar) {
    throw new DeviceToolError(
      'No writable calendar was found on this phone. Tell the user to add an account with a calendar ' +
        '(for example their Google account) in the phone settings, or offer schedule_notification instead.',
    );
  }
  return calendar;
}

/** Adds an event to the user's calendar; resolves with the calendar's name. */
export async function addCalendarEvent(plan: CalendarEventPlan): Promise<string> {
  const Calendar = await load();
  await ensureCalendarAccess(Calendar);
  const calendar = await targetCalendar(Calendar);
  const method = Platform.OS === 'android' ? Calendar.AlarmMethod.ALERT : undefined;
  await calendar.createEvent({
    title: plan.title,
    startDate: plan.start,
    endDate: plan.end,
    location: plan.location ?? null,
    notes: plan.notes,
    alarms: plan.alertMinutes === undefined ? [] : [{ relativeOffset: -plan.alertMinutes, method }],
  });
  return calendar.title;
}

/**
 * iOS: a reminder in the user's default Reminders list, with an alert at the due time.
 * Android: a calendar event with an alarm at the due time (a due time is required there).
 */
export async function addReminder(plan: ReminderPlan): Promise<string> {
  const Calendar = await load();
  if (Platform.OS === 'android') {
    if (!plan.due) throw new DeviceToolError('A due time is required on Android.');
    await ensureCalendarAccess(Calendar);
    const calendar = await targetCalendar(Calendar);
    await calendar.createEvent({
      title: plan.title,
      startDate: plan.due,
      endDate: new Date(plan.due.getTime() + ANDROID_REMINDER_MINUTES * 60_000),
      notes: plan.notes,
      alarms: [{ relativeOffset: 0, method: Calendar.AlarmMethod.ALERT }],
    });
    return `a calendar event with an alarm in "${calendar.title}" (Android has no reminders app)`;
  }
  await ensure(Calendar.getRemindersPermissions, Calendar.requestRemindersPermissions, 'reminders');
  // The object API has no way to find the default Reminders list; the legacy call uses it when no list is given.
  const { createReminderAsync } = await import('expo-calendar/legacy');
  await createReminderAsync(null, {
    title: plan.title,
    notes: plan.notes,
    dueDate: plan.due,
    alarms: plan.due ? [{ absoluteDate: plan.due.toISOString() }] : [],
  });
  return 'the default Reminders list';
}
