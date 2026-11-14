import { Platform } from 'react-native';
import type { NotificationPlan } from '../agent/scheduling';
import { t } from '../i18n';
import { DeviceToolError } from './calendar';

type NotificationsModule = typeof import('expo-notifications');
type PermissionStatus = Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>;

const CHANNEL_ID = 'reminders';

let loading: Promise<NotificationsModule> | null = null;

// Loaded lazily, so a build without the native module still starts.
function load(): Promise<NotificationsModule> {
  loading ??= import('expo-notifications').then((Notifications) => {
    // Without a handler, notifications that arrive while Qutai is open are not shown.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return Notifications;
  });
  return loading.catch(() => {
    loading = null;
    throw new DeviceToolError(
      'Notifications are not in this build of Qutai yet (a new app build is needed). Tell the user it is not available.',
    );
  });
}

/** Sets up how notifications show while the app is open. Asks for no permission. */
export function initNotifications() {
  load().catch(() => {});
}

function allowed(Notifications: NotificationsModule, status: PermissionStatus): boolean {
  if (status.granted) return true;
  const ios = status.ios?.status;
  return (
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL || ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

/** Schedules a local notification from Qutai (no push, no push token). */
export async function scheduleNotification(plan: NotificationPlan): Promise<void> {
  const Notifications = await load();
  // Android 13+ shows the permission prompt only once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('notifications.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let status = await Notifications.getPermissionsAsync();
  if (!allowed(Notifications, status) && status.canAskAgain) {
    status = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
  }
  if (!allowed(Notifications, status)) {
    throw new DeviceToolError(
      'Permission denied: the user has not allowed Qutai to show notifications. Explain this to the user and offer ' +
        "(with ask_user) to open Qutai's page in the phone's settings with open_settings (target system), where they can allow it. " +
        'Do not call this tool again unless they say they have allowed it.',
    );
  }
  await Notifications.scheduleNotificationAsync({
    content: { title: plan.title, body: plan.body, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.at, channelId: CHANNEL_ID },
  });
}

/**
 * Asks for permission to show notifications when it is not granted yet (Android 13+ and iOS show the system prompt;
 * older Android grants it at install). "blocked": refused and the system no longer asks, so only Settings helps.
 */
export async function ensureNotificationPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  const Notifications = await load();
  // Android 13+ shows the permission prompt only once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('notifications.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let status = await Notifications.getPermissionsAsync();
  if (allowed(Notifications, status)) return 'granted';
  if (!status.canAskAgain) return 'blocked';
  status = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (allowed(Notifications, status)) return 'granted';
  return status.canAskAgain ? 'denied' : 'blocked';
}
