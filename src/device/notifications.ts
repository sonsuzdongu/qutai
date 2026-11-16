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

/**
 * Where a notification the assistant scheduled was asked from, so a tap leads back there. Only internal ids: a normal
 * tab's uid (random, saved with the session, kept when the tab is reopened from recently closed) and its group's id.
 * Never a URL or a page title. An incognito tab is only a random key; which tab it stands for is kept in memory
 * (below), so nothing about it reaches the notification store on disk and it is forgotten when Qutai closes.
 */
export type NotificationOrigin = { tab: string; group?: string } | { incognito: string };

/** Incognito keys → tab ids, this run of Qutai only. */
const incognitoOrigins = new Map<string, string>();

/** The origin of a notification asked from this tab. */
export function notificationOrigin(tab: { id: string; uid: string; groupId?: string; incognito: boolean }): NotificationOrigin {
  if (tab.incognito) {
    const key = Math.random().toString(36).slice(2, 12);
    incognitoOrigins.set(key, tab.id);
    return { incognito: key };
  }
  return tab.groupId ? { tab: tab.uid, group: tab.groupId } : { tab: tab.uid };
}

/** The incognito tab (its id in this run) a key stands for, or null once Qutai has restarted. */
export function incognitoOriginTab(key: string): string | null {
  return incognitoOrigins.get(key) ?? null;
}

/** Identifiers of the assistant's notifications; earlier builds left the identifier to expo-notifications. */
const ID_PREFIX = 'qutai-notification-';

function originFrom(data: unknown): NotificationOrigin | null {
  const from = (data as { qutaiFrom?: unknown } | undefined)?.qutaiFrom as Record<string, unknown> | undefined;
  if (!from || typeof from !== 'object') return null;
  if (typeof from.incognito === 'string') return { incognito: from.incognito };
  if (typeof from.tab !== 'string') return null;
  return typeof from.group === 'string' ? { tab: from.tab, group: from.group } : { tab: from.tab };
}

const handled = new Set<string>();

/**
 * Calls `listener` with the origin when the user taps a notification the assistant scheduled: the tap that started
 * Qutai (cold start) and taps while it runs or is in the background. Each tap is handed over once. Notifications
 * from before origins were stored carry none and are left alone (Qutai just opens, as it did). Returns the
 * unsubscribe.
 */
export function onAssistantNotificationTapped(listener: (origin: NotificationOrigin) => void): () => void {
  let subscription: { remove(): void } | null = null;
  let stopped = false;
  load()
    .then((Notifications) => {
      if (stopped) return;
      const take = (response: import('expo-notifications').NotificationResponse | null) => {
        if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const { request, date } = response.notification;
        if (!request.identifier.startsWith(ID_PREFIX)) return;
        const key = `${request.identifier} ${date}`;
        const origin = originFrom(request.content.data);
        if (!origin || handled.has(key)) return;
        handled.add(key);
        Notifications.clearLastNotificationResponse();
        listener(origin);
      };
      subscription = Notifications.addNotificationResponseReceivedListener(take);
      take(Notifications.getLastNotificationResponse());
    })
    .catch(() => {});
  return () => {
    stopped = true;
    subscription?.remove();
  };
}

/**
 * Schedules a local notification from Qutai (no push, no push token). `from`: where it was asked, for the tap (see
 * NotificationOrigin); null when that tab is unknown.
 */
export async function scheduleNotification(plan: NotificationPlan, from: NotificationOrigin | null = null): Promise<void> {
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
    identifier: `${ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    content: { title: plan.title, body: plan.body, sound: 'default', ...(from ? { data: { qutaiFrom: from } } : {}) },
    // A relative time counts from now (the user has just confirmed it); a clock time is that moment.
    trigger:
      plan.delaySeconds !== undefined
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: plan.delaySeconds, channelId: CHANNEL_ID }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.at, channelId: CHANNEL_ID },
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

/**
 * The notification permission without asking. 'undetermined': iOS has not asked yet. Android 13+ reports a permission
 * it has not asked for as denied but askable, so 'denied' there can also mean "not asked yet".
 */
export async function notificationPermissionState(): Promise<'granted' | 'undetermined' | 'denied' | 'blocked'> {
  const Notifications = await load();
  const status = await Notifications.getPermissionsAsync();
  if (allowed(Notifications, status)) return 'granted';
  if (status.status === 'undetermined') return 'undetermined';
  return status.canAskAgain ? 'denied' : 'blocked';
}
