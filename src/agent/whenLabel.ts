import { t } from '../i18n';
import { formatDateTime, timeLabel } from '../i18n/format';

/** Up to this far ahead a time is said relative to now; later ones get the full date. */
const RELATIVE_LIMIT_MINUTES = 24 * 60;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const count = (n: number, one: Parameters<typeof t>[0], many: Parameters<typeof t>[0]) =>
  n === 1 ? t(one) : t(many, { count: n });

/**
 * When something will happen, for a confirmation: relative first, the clock time in brackets ("in 3 minutes
 * (13:36)", "in 2 hours 5 minutes (tomorrow 01:10)"); a day or more ahead, the full date and time. A time already
 * past (the dialog waited) reads as the clock time alone.
 */
export function whenLabel(at: Date, now = Date.now()): string {
  const ms = at.getTime() - now;
  if (ms <= 0) return timeLabel(at.getTime());
  const seconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.round(seconds / 60);
  if (seconds >= 60 && minutes >= RELATIVE_LIMIT_MINUTES) return formatDateTime(at);
  let span: string;
  if (seconds < 60) span = count(seconds, 'when.second', 'when.seconds');
  else if (minutes < 60) span = count(minutes, 'when.minute', 'when.minutes');
  else {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    span = count(hours, 'when.hour', 'when.hours');
    if (rest) span = `${span} ${count(rest, 'when.minute', 'when.minutes')}`;
  }
  const clock = timeLabel(at.getTime());
  const days = Math.round((startOfDay(at.getTime()) - startOfDay(now)) / 86_400_000);
  return t('when.in', { span, time: days === 0 ? clock : t('when.tomorrow', { time: clock }) });
}

/**
 * The offset ("+05:00", "Z") a date-time was given with, in minutes east of UTC; null when it had none (the phone's
 * local time, as the model is asked to send).
 */
export function givenOffsetMinutes(raw: unknown): number | null {
  const match = /(Z|[+-]\d{2}:?\d{2})$/i.exec(String(raw ?? '').trim());
  if (!match || !/T|\s/.test(String(raw))) return null;
  const zone = match[1];
  if (zone.toUpperCase() === 'Z') return 0;
  return (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
}

/**
 * The confirmation names the time zone only when the time was given in another one than the phone's at that moment
 * (it is always shown in the phone's local time).
 */
export function showsTimeZone(at: Date, givenOffset: number | null | undefined): boolean {
  return givenOffset !== null && givenOffset !== undefined && givenOffset !== -at.getTimezoneOffset();
}
