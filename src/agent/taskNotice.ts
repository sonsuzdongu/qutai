/**
 * "Task finished" notifications: whether a task's end (or a confirmation it waits for) gets a local notification.
 * Pure, so it is tested on its own (scripts/assistant-tests/taskNotice.test.ts); posting is device/notifications.ts
 * (postTaskNotice), which also does nothing without the notification permission (never asked from here).
 */

/** How the task ended, or 'needsApproval': a confirmation dialog waits while Qutai is not on screen. */
export type TaskNoticeEvent = 'done' | 'failed' | 'needsAnswer' | 'needsApproval' | 'stopped';

export type TaskNoticeKind = Exclude<TaskNoticeEvent, 'stopped'>;

export type TaskNoticeInput = {
  event: TaskNoticeEvent;
  /** Qutai is on screen (AppState "active"). */
  foreground: boolean;
  /** The conversation is incognito or touched an incognito tab: nothing from it goes in a notification. */
  incognito: boolean;
  /**
   * "Keep working in the background" (Android) owns this task's notifications: its own notification already says
   * how it ended or what it waits for.
   */
  backgroundRunNotifies: boolean;
  /** "Notify me when a task finishes": off, only a task that needs the user notifies. */
  notifyWhenDone: boolean;
};

export function taskNoticeFor(input: TaskNoticeInput): TaskNoticeKind | null {
  const { event } = input;
  if (event === 'stopped') return null;
  if (input.foreground || input.incognito || input.backgroundRunNotifies) return null;
  const needsUser = event === 'needsAnswer' || event === 'needsApproval';
  if (!needsUser && !input.notifyWhenDone) return null;
  return event;
}
