import { Platform } from 'react-native';
import {
  calendarListAccess,
  ListAccess,
  remindersAccess,
  requestCalendarListAccess,
  requestRemindersAccess,
} from './calendarChoice';
import { ensureNotificationPermission, notificationPermissionState } from './notifications';
import { requestVoicePermissions, voicePermissionState } from './voiceInput';

/**
 * The phone permissions setup offers up front (Onboarding's "What Qutai may use" step), each asked only when the user
 * turns its switch on. The in-context requests (device/location.ts, calendar.ts, notifications.ts) stay as they are,
 * and none of them asks again once the system has an answer.
 *
 * The microphone row asks what voice input asks on first use (device/voiceInput.ts): the microphone, and on iOS also
 * speech recognition, so talking to the assistant later prompts nothing more. The separate one-time question about the
 * phone's online speech service stays where it is (asked before that service is first used).
 *
 * Not offered here: the camera (asked when the user scans a QR code or takes a photo, where the reason is plain) and
 * saving to Photos (asked on the first save).
 */
export type PermissionKind = 'location' | 'microphone' | 'calendar' | 'reminders' | 'notifications';

/**
 * 'limited': iOS write-only calendar access, or the microphone allowed without speech recognition (iOS; only languages
 * the phone recognises on the device work) (events can be added to the default calendar, the calendars can't be
 * listed or read). 'denied': refused but the system can ask again (on Android also "not asked yet" for some).
 * 'blocked': only the phone's settings can change it. 'unavailable': not in this build.
 */
export type PermissionState = 'granted' | 'limited' | 'undetermined' | 'denied' | 'blocked' | 'unavailable';

/**
 * The setup step's rows, in order: the microphone first. Reminders lists exist on iOS only; Android's reminders are
 * calendar events (the calendar row covers them).
 */
export function setupPermissions(): PermissionKind[] {
  return Platform.OS === 'ios'
    ? ['microphone', 'location', 'calendar', 'reminders', 'notifications']
    : ['microphone', 'location', 'calendar', 'notifications'];
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
    if (kind === 'microphone') return await voicePermissionState();
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
    if (kind === 'microphone') {
      const before = await voicePermissionState();
      if (before === 'granted' || before === 'blocked' || before === 'unavailable') return before;
      await requestVoicePermissions();
      return await voicePermissionState();
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
