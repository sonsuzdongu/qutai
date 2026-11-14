import { getCalendars } from 'expo-localization';
import { t } from '../i18n';
import { formatDateTime, timeLabel } from '../i18n/format';

/** The tools that put something on the user's calendar or schedule a notification. */
export const SCHEDULING_TOOLS = new Set(['add_calendar_event', 'add_reminder', 'schedule_notification']);

export type SchedulingTool = 'add_calendar_event' | 'add_reminder' | 'schedule_notification';

/** A validated request, ready to be confirmed by the user and written. */
export type CalendarEventPlan = {
  kind: 'event';
  title: string;
  start: Date;
  end: Date;
  location?: string;
  notes?: string;
  /** Minutes before the start; undefined means no alert. */
  alertMinutes?: number;
};
export type ReminderPlan = { kind: 'reminder'; title: string; due?: Date; notes?: string };
export type NotificationPlan = { kind: 'notification'; title: string; body: string; at: Date };
export type SchedulePlan = CalendarEventPlan | ReminderPlan | NotificationPlan;

const MAX_ALERT_MINUTES = 7 * 24 * 60;

/** The device's IANA time zone, e.g. "Europe/Istanbul". */
export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const pad = (n: number) => String(n).padStart(2, '0');

function utcOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** A local ISO date-time without seconds, e.g. "2026-11-14T19:30". */
export function localIso(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Tells the model what "now" is, so it can turn "tomorrow at 7" into a date. */
export function nowContext(now = new Date()): string {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
  return `Now: ${localIso(now)} (${weekday}), time zone ${deviceTimeZone()} (UTC${utcOffset(now)})`;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * Parses an ISO 8601 date-time. Without an offset it is the phone's local time, which is what the
 * model is asked to send. Impossible dates (Feb 30, 25:00) are rejected rather than rolled over.
 */
export function parseDateTime(raw: unknown): Date | null {
  const match = ISO.exec(String(raw ?? '').trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s = '0', zone] = match;
  const parts = [y, mo, d, h, mi, s].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  if (zone) {
    const offset =
      zone.toUpperCase() === 'Z'
        ? 0
        : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
    const utc = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000;
    const check = new Date(Date.UTC(year, month - 1, day));
    return check.getUTCDate() === day ? new Date(utc) : null;
  }
  const date = new Date(year, month - 1, day, hour, minute, second);
  // The day must survive; the hour may shift by a DST gap, which is fine.
  return date.getDate() === day && date.getMonth() === month - 1 ? date : null;
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function dateError(field: string, raw: unknown): string {
  return (
    `Invalid ${field}: ${JSON.stringify(raw ?? null)}. Use an ISO 8601 local date and time like ` +
    `"${localIso(new Date(Date.now() + 86_400_000))}" (the phone's time zone is ${deviceTimeZone()}).`
  );
}

/** Validates a scheduling tool's input; an error string is returned to the model as is. */
export function planSchedule(
  name: SchedulingTool,
  input: Record<string, unknown>,
  now = Date.now(),
): SchedulePlan | string {
  const title = text(input.title, 200);
  if (!title) return 'A title is required.';
  const notes = text(input.notes, 2000) || undefined;

  if (name === 'add_calendar_event') {
    const start = parseDateTime(input.start);
    if (!start) return dateError('start', input.start);
    const end = parseDateTime(input.end);
    if (!end) return dateError('end', input.end);
    if (end.getTime() <= start.getTime()) return 'The end must be after the start.';
    let alertMinutes: number | undefined;
    if (input.alert_minutes_before !== undefined && input.alert_minutes_before !== null) {
      alertMinutes = Number(input.alert_minutes_before);
      if (!Number.isInteger(alertMinutes) || alertMinutes < 0 || alertMinutes > MAX_ALERT_MINUTES)
        return `alert_minutes_before must be a whole number from 0 to ${MAX_ALERT_MINUTES}.`;
    }
    return { kind: 'event', title, start, end, location: text(input.location, 300) || undefined, notes, alertMinutes };
  }

  if (name === 'add_reminder') {
    if (input.due === undefined || input.due === null || input.due === '') return { kind: 'reminder', title, notes };
    const due = parseDateTime(input.due);
    if (!due) return dateError('due', input.due);
    return { kind: 'reminder', title, due, notes };
  }

  const body = text(input.body, 500);
  if (!body) return 'A body is required.';
  const at = parseDateTime(input.time);
  if (!at) return dateError('time', input.time);
  if (at.getTime() <= now)
    return `That time is in the past (${nowContext(new Date(now))}). Ask the user for a time in the future.`;
  return { kind: 'notification', title, body, at };
}

function alertLine(minutes: number): string {
  if (minutes === 0) return t('schedule.alertAtStart');
  if (minutes % 1440 === 0) return t('schedule.alertDays', { count: minutes / 1440 });
  if (minutes % 60 === 0) return t('schedule.alertHours', { count: minutes / 60 });
  return t('schedule.alertMinutes', { count: minutes });
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** Exactly what will be added, in the user's language, locale and time zone, for the confirmation. */
export function describePlan(plan: SchedulePlan, android: boolean): string {
  const zone = t('schedule.timeZone', { zone: deviceTimeZone() });
  const lines: string[] = [];
  if (plan.kind === 'event') {
    const end = sameDay(plan.start, plan.end) ? timeLabel(plan.end.getTime()) : formatDateTime(plan.end);
    lines.push(t('schedule.confirmEvent'), `“${plan.title}”`, `${formatDateTime(plan.start)} – ${end}`, zone);
    if (plan.location) lines.push(t('schedule.location', { location: plan.location }));
    lines.push(plan.alertMinutes === undefined ? t('schedule.noAlert') : alertLine(plan.alertMinutes));
  } else if (plan.kind === 'reminder') {
    lines.push(
      t(android ? 'schedule.confirmReminderAndroid' : 'schedule.confirmReminder'),
      `“${plan.title}”`,
      plan.due ? t('schedule.due', { when: formatDateTime(plan.due) }) : t('schedule.noDue'),
    );
    if (plan.due) lines.push(zone);
  } else {
    lines.push(t('schedule.confirmNotification'), `“${plan.title}”`, plan.body, formatDateTime(plan.at), zone);
  }
  if (plan.kind !== 'notification' && plan.notes) {
    const notes = plan.notes.length > 300 ? `${plan.notes.slice(0, 300)}…` : plan.notes;
    lines.push(t('schedule.notes', { notes }));
  }
  return lines.join('\n');
}
