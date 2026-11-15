import { Platform } from 'react-native';
import {
  calendarListAccess,
  ListAccess,
  remindersAccess,
  requestCalendarListAccess,
  requestRemindersAccess,
} from './calendarChoice';
import { ensureNotificationPermission, notificationPermissionState } from './notifications';

/**
 * The phone permissions setup offers up front (Onboarding's "What Qutai may use" step), each asked only when the user
 * turns its switch on. The in-context requests (device/location.ts, calendar.ts, notifications.ts) stay as they are,
 * and none of them asks again once the system has an answer.
 *
 * Not offered here: the camera and the microphone (asked when the user scans a QR code, takes a photo or talks to the
 * assistant, where the reason is plain) and saving to Photos (asked on the first save).
 */
export type PermissionKind = 'location' | 'calendar' | 'reminders' | 'notifications';

/**
 * 'limited': iOS write-only calendar access (events can be added to the default calendar, the calendars can't be
 * listed or read). 'denied': refused but the system can ask again (on Android also "not asked yet" for some).
 * 'blocked': only the phone's settings can change it. 'unavailable': not in this build.
 */
export type PermissionState = 'granted' | 'limited' | 'undetermined' | 'denied' | 'blocked' | 'unavailable';

/** Reminders lists exist on iOS only; Android's reminders are calendar events (the calendar row covers them). */
export function setupPermissions(): PermissionKind[] {
  return Platform.OS === 'ios'
    ? ['location', 'calendar', 'reminders', 'notifications']
    : ['location', 'calendar', 'notifications'];
}

const fromList = (s: ListAccess): PermissionState => (s === 'writeOnly' ? 'limited' : s);

async function locationState(): Promise<PermissionState> {
  try {
    const Location = await import('expo-location');
    const s = await Location.getForegroundPermissionsAsync();
    if (s.granted) return 'granted';
    if (s.status === 'undetermined') return 'undetermined';
    return s.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'unavailable';
  }
}

export async function permissionState(kind: PermissionKind): Promise<PermissionState> {
  try {
    if (kind === 'location') return await locationState();
    if (kind === 'calendar') return fromList(await calendarListAccess());
    if (kind === 'reminders') return fromList(await remindersAccess());
    return await notificationPermissionState();
  } catch {
    return 'unavailable';
  }
}

/** Shows the system prompt when the system still asks; resolves with the state afterwards. Only on the user's tap. */
export async function requestPermission(kind: PermissionKind): Promise<PermissionState> {
  try {
    if (kind === 'location') {
      const before = await locationState();
      if (before === 'granted' || before === 'blocked' || before === 'unavailable') return before;
      const Location = await import('expo-location');
      await Location.requestForegroundPermissionsAsync();
      return await locationState();
    }
    // The calendar row asks for full access on iOS: it is what lets the user choose the calendar and lets the
    // assistant read their appointments ("to manage your calendar"); adding alone keeps asking write-only in context.
    if (kind === 'calendar') return fromList(await requestCalendarListAccess());
    if (kind === 'reminders') return fromList(await requestRemindersAccess());
    const result = await ensureNotificationPermission();
    return result;
  } catch {
    return 'unavailable';
  }
}
