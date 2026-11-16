import { Platform } from 'react-native';
import { t } from '../i18n';
import { nextRun, SavedTask } from '../storage/savedTasks';
import { cutText } from '../utils/wellFormed';

/**
 * Reminders for saved tasks. There is no server and nothing runs while Qutai is closed, so a scheduled task is a
 * local notification ("Time for: <name>"); tapping it opens Qutai with the task ready (or running, if the user chose
 * that for the task). Only the task's id travels in the notification: the task itself is read from the database.
 *
 * Triggers, all in local wall-clock time:
 * - once: a DATE trigger (one notification at that moment);
 * - daily: a repeating DAILY trigger (iOS: a repeating UNCalendarNotificationTrigger on hour and minute, which
 *   follows the device's time zone and DST; Android: an alarm for the next matching local time, set again after it
 *   fires);
 * - weekly: one repeating WEEKLY trigger per chosen day (weekday 1 = Sunday).
 * So each schedule is one to seven pending requests rather than a series. They are all cancelled and scheduled again
 * on start, on every return to the foreground and after each change, which also moves Android's next alarm after a
 * time zone change. iOS keeps at most 64 pending notifications per app, so task reminders stay within MAX_PENDING
 * (the soonest first), leaving room for the assistant's own reminders. After a reboot, expo-notifications schedules
 * Android's pending notifications again (RECEIVE_BOOT_COMPLETED); iOS keeps them itself. Without the exact-alarm
 * permission (not requested), Android may deliver them a few minutes late.
 */

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL_ID = 'tasks';
const ID_PREFIX = 'qutai-task-';
/** iOS keeps 64 pending notifications per app; the rest is left for schedule_notification. */
export const MAX_PENDING = 48;
const MAX_BODY = 160;

let loading: Promise<NotificationsModule> | null = null;

function load(): Promise<NotificationsModule> {
  loading ??= import('expo-notifications');
  return loading.catch((e) => {
    loading = null;
    throw e;
  });
}

/** How many pending notifications a task's schedule needs. */
export function pendingCount(task: Pick<SavedTask, 'schedule' | 'paused'>): number {
  if (!task.schedule || task.paused) return 0;
  if (task.schedule.kind === 'weekly') return task.schedule.days.length;
  return task.schedule.kind === 'once' ? (nextRun(task.schedule) ? 1 : 0) : 1;
}

async function ensureChannel(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  // Private on the lock screen: the name shows only once the phone is unlocked.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: t('tasks.channel'),
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Makes the pending task reminders match `tasks`: cancels every one of Qutai's task notifications and schedules the
 * active schedules again, soonest first, up to MAX_PENDING. Asks for no permission; without it, nothing is scheduled.
 * Calls are queued so two syncs never interleave.
 */
export function syncTaskReminders(tasks: SavedTask[]): Promise<void> {
  syncing = syncing.then(() => sync(tasks)).catch(() => {});
  return syncing;
}

async function sync(tasks: SavedTask[]) {
  const Notifications = await load();
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((request) => request.identifier.startsWith(ID_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
  const status = await Notifications.getPermissionsAsync();
  if (!status.granted && status.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;
  await ensureChannel(Notifications);
  const due = tasks
    .filter((task) => pendingCount(task) > 0)
    .sort((a, b) => (nextRun(a.schedule) ?? Infinity) - (nextRun(b.schedule) ?? Infinity));
  let used = 0;
  for (const task of due) {
    const schedule = task.schedule!;
    const count = pendingCount(task);
    if (used + count > MAX_PENDING) continue;
    used += count;
    const content = {
      title: t('tasks.notifyTitle', { name: task.name }),
      body: task.private ? t('tasks.notifyBodyPrivate') : cutText(task.prompt.replace(/\s+/g, ' '), MAX_BODY),
      data: { qutaiTask: task.id },
      sound: 'default',
    };
    const S = Notifications.SchedulableTriggerInputTypes;
    const triggers =
      schedule.kind === 'once'
        ? [{ type: S.DATE, date: schedule.at, channelId: CHANNEL_ID } as const]
        : schedule.kind === 'daily'
          ? [{ type: S.DAILY, hour: schedule.hour, minute: schedule.minute, channelId: CHANNEL_ID } as const]
          : schedule.days.map(
              (weekday) =>
                ({ type: S.WEEKLY, weekday, hour: schedule.hour, minute: schedule.minute, channelId: CHANNEL_ID }) as const,
            );
    for (const [i, trigger] of triggers.entries()) {
      await Notifications.scheduleNotificationAsync({ identifier: `${ID_PREFIX}${task.id}-${i}`, content, trigger });
    }
  }
}

const handled = new Set<string>();

/**
 * Calls `listener` with the task id when the user taps a task reminder: the tap that started Qutai (cold start) and
 * taps while it runs or is in the background (warm start). Each tap is handed over once. Returns the unsubscribe.
 */
export function onTaskReminderTapped(listener: (taskId: string) => void): () => void {
  let subscription: { remove(): void } | null = null;
  let stopped = false;
  load()
    .then((Notifications) => {
      if (stopped) return;
      const take = (response: import('expo-notifications').NotificationResponse | null) => {
        if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const { request, date } = response.notification;
        const id = request.content.data?.qutaiTask;
        const key = `${request.identifier} ${date}`;
        if (typeof id !== 'string' || !request.identifier.startsWith(ID_PREFIX) || handled.has(key)) return;
        handled.add(key);
        Notifications.clearLastNotificationResponse();
        listener(id);
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
