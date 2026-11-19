# 16. Saved, scheduled and background tasks

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Tasks the user saves to run again, reminders that bring a saved task back at a set time, tasks that keep working
when the user leaves Qutai (Android), and the notifications that say how a task went.

## How it works

1. **Saved tasks.** "Save as task" on a message, or Settings › Tasks: a name, the request ("Find the cheapest flight
   Istanbul–Ankara next Friday"), where it runs (the page on screen, an address opened first, or no page), deep
   research or not, and an optional schedule.
2. **Scheduled tasks** are reminders: once, daily or weekly at a time, a notification "Time for: <name>" appears.
   Tapping it opens Qutai with the task ready ("Run now"), or runs it, if the user chose that for the task. Nothing runs
   while Qutai is closed. A task can be paused (no reminder) or private (the notification shows only its name).
3. **Running a task by name.** "Run the task called Weekly prices": the assistant reads the saved task and carries it
   out as if the user had typed it. It cannot create, change, delete or schedule tasks.
4. **Keep working in the background** (Android only, off by default; asked in setup and in Settings › Assistant): a
   task the user started goes on when they leave Qutai or lock the screen, with an ongoing notification (title from the
   message, the current step, Stop and Open). Steps that need the user or the screen pause the task with a notification
   saying what is needed.
5. **iPhone, and Android with the setting off:** a task pauses when Qutai leaves the screen and continues on return.
   If the user stays away for more than 8 seconds, a notification says the task is waiting. An own-key request already
   sent may still finish in the background ([section 2](02-ai-providers.md)).
6. **Task notifications:** "Notify me when a task finishes" (on by default) also tells when a task ended or failed
   while Qutai was away; questions and approvals waiting always notify.
7. **The assistant's own reminders** ("remind me in 10 minutes"): `schedule_notification`; tapping it opens the tab it
   was asked from.

## The rules

- **`TASK-1`** A scheduled task is only a reminder: a local notification at the time; it never runs without the user's tap, and nothing runs while Qutai is closed.
  Status: Default (manager or implementing session; open to change) · Why: "There is no server and nothing runs while Qutai is closed" · Enforced: In the app: src/device/taskSchedule.ts · Source: 248bb53; README › Known limitations
- **`TASK-3`** Only the task's id travels in its notification; a private task's notification shows only its name, never the request; the text is at most 160 characters.
  Status: Default (manager or implementing session; open to change) · Why: the lock screen must not show what the user asked · Enforced: In the app: src/device/taskSchedule.ts (MAX_BODY); src/storage/savedTasks.ts (private) · Source: 248bb53
- **`TASK-4`** Task reminders use at most 48 pending notifications (soonest first), leaving room within iOS's limit of 64 for the assistant's own reminders; the exact-alarm permission is not requested, so Android may be a few minutes late.
  Status: Default (manager or implementing session; open to change) · Why: iOS keeps at most 64 pending notifications per app · Source: src/device/taskSchedule.ts (MAX_PENDING)
- **`TASK-5`** A saved task has a name of up to 80 characters and a request of up to 4,000; at most 200 tasks; new tasks start not paused, not private and not run on tap.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/savedTasks.ts (MAX_TASK_NAME, MAX_TASK_PROMPT, MAX_SAVED_TASKS); src/components/TasksScreen.tsx
- **`TASK-6`** A saved task carries no model of its own.
  Status: Owner, 2026-11-15 ("Decided not to do: an optional model per saved task") · Why: it would need a new column, backup field and editor · Source: TODO.md › Assistant; item 30 hand-over note
- **`TASK-7`** The assistant may only list and read saved tasks (`list_saved_tasks`, `get_saved_task`: by name, ignoring case and Turkish i forms, then accents, then part of a name; several matches go to the user); creating, editing, deleting and scheduling stay with the user. Incognito conversations may use them.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/savedTaskTool.ts (read-only tools only) · Source: 11af7c4
- **`TASK-8`** "Keep working in the background" exists only on Android and is off by default.
  Status: Default (manager or implementing session; open to change) · Why: iOS gives an app only a short time after it leaves the screen and stops WebKit's pages with it · Source: src/device/backgroundTask.ts header; src/storage/settings.ts (backgroundTasks); 0b5f332, 3ef2bdc
- **`TASK-9`** The background run uses an Android foreground service of the "special use" kind with an ongoing notification; it stops when the user returns, the task ends or pauses, the page stalls (no answer twice, or no progress for 4 minutes), or after 30 minutes away.
  Status: Default (manager or implementing session; open to change) · Why: "special use" has no system time limit, unlike the data-sync kind (6 h a day on Android 15+), the short-service kind (about 3 minutes) and user-initiated transfers (downloads only); Google Play reviews its declaration · Source: item 25 hand-over note; README › Known limitations
- **`TASK-10`** In the background nothing is approved for the user: confirmations, questions (and so CAPTCHAs), screenshots and PDFs, a new tab, a sleeping tab, the email composer and settings changes pause the task with a notification.
  Status: Default (manager or implementing session; open to change) · Why: approvals need the user looking at the screen · Enforced: In the app: src/agent/executeTool.ts (backgroundBlocker); src/agent/runAgent.ts (pauseWhileBackgrounded) · Source: 0b5f332
- **`TASK-11`** Incognito conversations never continue in the background.
  Status: Default (manager or implementing session; open to change) · Why: nothing about incognito use may appear in a notification · Enforced: In the app: src/device/backgroundTask.ts; src/agent/runAgent.ts · Source: 0b5f332
- **`TASK-12`** The assistant cannot turn background work or its notification on or off.
  Status: Default (manager or implementing session; open to change) · Why: "it lets the assistant work while the user is away" · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE) · Source: febcdb4
- **`TASK-13`** A task notification is never posted while Qutai is on screen, for an incognito conversation, when the background run's own notification already covers it, or for a stop; a task waiting for an answer, an approval or the user's return always notifies; a finished or failed task notifies only with "Notify me when a task finishes" (on by default); the notification permission is never asked for here.
  Status: Default (manager or implementing session; open to change) · Why: a paused task "waits for the user as much as a question does" · Enforced: In the app: src/agent/taskNotice.ts (taskNoticeFor) · Source: 80cd751, 8f13cd0
- **`TASK-15`** A notification the assistant scheduled carries only internal ids (the tab's and the group's; for an incognito tab a random key kept in memory), never an address or title; tapping it opens that tab, else the first tab of its group, else the first tab with a short note; an incognito tab is never reopened.
  Status: Default (manager or implementing session; open to change) · Why: notifications are visible on the lock screen · Source: README › Known limitations
- **`TASK-16`** Calendar events, reminders and notifications are never added from incognito conversations.
  Status: Default (manager or implementing session; open to change) · Why: incognito leaves nothing behind · Enforced: In the app: src/agent/executeTool.ts (schedulingTool) · Source: 5e51edb

## Details

**Reminder scheduling**

- (was `TASK-2`) Schedules are once, daily or weekly (chosen weekdays), in local time; all reminders are cancelled and set again at start, on every return to Qutai and after each change. Why: follows time-zone and daylight-saving changes; Android has no time-zone-change signal for the app, so Qutai resyncs on every return. Where: src/device/taskSchedule.ts header; item 28 hand-over note

**Task notifications**

- (was `TASK-14`) The "task is waiting" notice is scheduled 8 seconds after the user leaves and taken back if they return sooner or the task ends. Why: a quick glance away should not notify. Where: src/agent/taskNotice.ts (PAUSED_NOTICE_DELAY_S); 8f13cd0

## Limits and what is not built

- No background tasks on iPhone (not planned: iOS doesn't allow it for web pages).
- Android background work has not been tried on a phone yet: phone makers' battery managers, pages that only move while visible, and the Google Play declaration video are open (TODO.md › Assistant).
- No task runs on a server or while Qutai is closed (would need a server).
- Before the own-key keep-alive, a request in flight when the user left was sent again on return and billed twice; see [section 2](02-ai-providers.md).

## Where it lives

- `src/storage/savedTasks.ts`, `src/device/taskSchedule.ts`, `src/agent/savedTaskTool.ts`, `src/components/TasksScreen.tsx`
- `src/device/backgroundTask.ts`, `modules/qutai-agent`, `src/agent/taskNotice.ts`, `src/device/notifications.ts`, `src/agent/scheduling.ts`
- README › Known limitations (background tasks, scheduled tasks, saved tasks); [docs/permissions.md](../../docs/permissions.md) (foreground service declaration)

## Disagreements between sources

- README › Known limitations says tasks on iOS "pause … and resume"; since 488c3e0 an own-key request already sent may finish on iOS in the background, though the task itself still pauses. The README paragraph does not mention this.
