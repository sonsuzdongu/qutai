import { Db } from './db';

/** Where a saved task runs: the page on screen, a page opened first in a new tab, or no particular page. */
export type TaskTarget = 'page' | 'url' | 'none';
export const TASK_TARGETS: TaskTarget[] = ['page', 'url', 'none'];

export const MAX_TASK_NAME = 80;
export const MAX_TASK_PROMPT = 4000;
export const MAX_SAVED_TASKS = 200;

/**
 * When Qutai reminds the user of a saved task, in local wall-clock time. Weekdays are 1 (Sunday) to 7 (Saturday),
 * as expo-notifications' weekly trigger counts them.
 */
export type TaskSchedule =
  | { kind: 'once'; at: number }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekly'; hour: number; minute: number; days: number[] };

const isHour = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23;
const isMinute = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 59;

/** A schedule read from storage or a backup, or null when it isn't a valid one. */
export function parseSchedule(v: unknown): TaskSchedule | null {
  if (typeof v === 'string') {
    try {
      return parseSchedule(JSON.parse(v));
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.kind === 'once') return Number.isFinite(o.at) && (o.at as number) > 0 ? { kind: 'once', at: o.at as number } : null;
  if (!isHour(o.hour) || !isMinute(o.minute)) return null;
  if (o.kind === 'daily') return { kind: 'daily', hour: o.hour, minute: o.minute };
  if (o.kind !== 'weekly' || !Array.isArray(o.days)) return null;
  const days = [...new Set(o.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
  return days.length ? { kind: 'weekly', hour: o.hour, minute: o.minute, days } : null;
}

/** The next time the reminder is due after `now` (local time, so it follows time zone and DST changes), or null. */
export function nextRun(schedule: TaskSchedule | null, now = Date.now()): number | null {
  if (!schedule) return null;
  if (schedule.kind === 'once') return schedule.at > now ? schedule.at : null;
  for (let ahead = 0; ahead <= 7; ahead++) {
    const d = new Date(now);
    d.setDate(d.getDate() + ahead);
    d.setHours(schedule.hour, schedule.minute, 0, 0);
    if (d.getTime() <= now) continue;
    if (schedule.kind === 'daily' || schedule.days.includes(d.getDay() + 1)) return d.getTime();
  }
  return null;
}

/** A message the user saved to run again (Settings › Tasks, or "Save as task" on a message they sent). */
export type SavedTask = {
  id: string;
  name: string;
  prompt: string;
  target: TaskTarget;
  /** The page opened first, for target 'url'. */
  url: string | null;
  /** Runs as deep research. */
  research: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  /** The reminder, if any. */
  schedule: TaskSchedule | null;
  /** The reminder is paused (nothing scheduled) until resumed. */
  paused: boolean;
  /** Its notification shows only the name, never the prompt. */
  private: boolean;
  /** Tapping its notification runs the task; otherwise the task is shown ready with "Run now". */
  autoRun: boolean;
};

export type TaskInput = Pick<
  SavedTask,
  'name' | 'prompt' | 'target' | 'url' | 'research' | 'schedule' | 'paused' | 'private' | 'autoRun'
>;

type Row = {
  id: string;
  name: string;
  prompt: string;
  target: string;
  url: string | null;
  research: number;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
  schedule: string | null;
  schedule_paused: number;
  private: number;
  auto_run: number;
};

const toTask = (row: Row): SavedTask => ({
  id: row.id,
  name: row.name,
  prompt: row.prompt,
  target: (TASK_TARGETS as string[]).includes(row.target) ? (row.target as TaskTarget) : 'page',
  url: row.url,
  research: row.research === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastUsedAt: row.last_used_at,
  schedule: parseSchedule(row.schedule),
  paused: row.schedule_paused === 1,
  private: row.private === 1,
  autoRun: row.auto_run === 1,
});

const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/** An http(s) address for target 'url' (a bare host gets https://), or null. */
export function cleanTaskUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  return /^https?:\/\/[^\s/?#]+\.[^\s]*$|^https?:\/\/localhost\b/i.test(url) ? url : null;
}

/** Trims and checks a task before it is stored; throws with a message for the user. */
export function cleanTask(input: TaskInput): TaskInput {
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, MAX_TASK_NAME);
  const prompt = input.prompt.trim().slice(0, MAX_TASK_PROMPT);
  if (!prompt) throw new Error('empty-prompt');
  const target = TASK_TARGETS.includes(input.target) ? input.target : 'page';
  const url = target === 'url' ? cleanTaskUrl(input.url ?? '') : null;
  if (target === 'url' && !url) throw new Error('bad-url');
  return {
    name: name || prompt.replace(/\s+/g, ' ').slice(0, 40),
    prompt,
    target,
    url,
    research: input.research,
    schedule: parseSchedule(input.schedule),
    paused: input.paused,
    private: input.private,
    autoRun: input.autoRun,
  };
}

/** Most recently used first; tasks never run follow, newest first. */
export async function listSavedTasks(db: Db): Promise<SavedTask[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM saved_tasks ORDER BY last_used_at IS NULL, last_used_at DESC, created_at DESC',
    [],
  );
  return rows.map(toTask);
}

export async function getSavedTask(db: Db, id: string): Promise<SavedTask | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM saved_tasks WHERE id = ?', [id]);
  return row ? toTask(row) : null;
}

/** The tasks run most recently, for the chips in the empty panel. */
export async function recentSavedTasks(db: Db, limit = 3): Promise<SavedTask[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM saved_tasks WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(toTask);
}

export async function addSavedTask(db: Db, input: TaskInput): Promise<SavedTask> {
  const task = cleanTask(input);
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM saved_tasks', []);
  if ((count?.n ?? 0) >= MAX_SAVED_TASKS) throw new Error('full');
  const now = Date.now();
  const id = newId();
  await db.runAsync(
    'INSERT INTO saved_tasks (id, name, prompt, target, url, research, created_at, updated_at, schedule, ' +
      'schedule_paused, private, auto_run) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, task.name, task.prompt, task.target, task.url, task.research ? 1 : 0, now, now, ...scheduleColumns(task)],
  );
  return { id, ...task, createdAt: now, updatedAt: now, lastUsedAt: null };
}

export async function updateSavedTask(db: Db, id: string, input: TaskInput): Promise<void> {
  const task = cleanTask(input);
  await db.runAsync(
    'UPDATE saved_tasks SET name = ?, prompt = ?, target = ?, url = ?, research = ?, updated_at = ?, schedule = ?, ' +
      'schedule_paused = ?, private = ?, auto_run = ? WHERE id = ?',
    [task.name, task.prompt, task.target, task.url, task.research ? 1 : 0, Date.now(), ...scheduleColumns(task), id],
  );
}

/** Pauses or resumes a task's reminder. */
export async function setSavedTaskPaused(db: Db, id: string, paused: boolean): Promise<void> {
  await db.runAsync('UPDATE saved_tasks SET schedule_paused = ? WHERE id = ?', [paused ? 1 : 0, id]);
}

function scheduleColumns(task: TaskInput): (string | number | null)[] {
  return [
    task.schedule ? JSON.stringify(task.schedule) : null,
    task.paused ? 1 : 0,
    task.private ? 1 : 0,
    task.autoRun ? 1 : 0,
  ];
}

export async function deleteSavedTask(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM saved_tasks WHERE id = ?', [id]);
}

export async function markSavedTaskUsed(db: Db, id: string): Promise<void> {
  await db.runAsync('UPDATE saved_tasks SET last_used_at = ? WHERE id = ?', [Date.now(), id]);
}

/** `{date}` and `{today}` in a saved prompt become today's date, written out in the app's language. */
export function fillTaskPrompt(prompt: string, formatToday: () => string): string {
  return /\{(date|today)\}/i.test(prompt) ? prompt.replace(/\{(date|today)\}/gi, formatToday()) : prompt;
}
