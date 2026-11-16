import { getLanguage, getLocale, t } from './index';
import { LANGUAGE_INFO } from './languages';

/** Dates and numbers go through the app's language (in the phone's region when it speaks the same language). */
const locale = () => getLocale();
const info = () => LANGUAGE_INFO[getLanguage()];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today", "Yesterday", or a localized weekday and date. */
export function dayLabel(ts: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);
  if (days === 0) return t('library.today');
  if (days === 1) return t('library.yesterday');
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(ts);
}

/** A full localized date, e.g. "14 November 2026". */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** A full localized date and time, e.g. "Saturday, 14 November 2026, 19:30". */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** A localized time of day, e.g. "09:30" or "9:30 AM". */
export function formatTime(hour: number, minute: number): string {
  const d = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** A short localized weekday name; `day` is 1 (Sunday) to 7 (Saturday). */
export function weekdayShort(day: number): string {
  // 2 January 2000 was a Sunday.
  return new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(new Date(2000, 0, 1 + day));
}

/** A short localized date with weekday, e.g. "Sat, 14 Nov". */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/** A localized number with at most one decimal, e.g. "12.5" or "12,5". */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(n);
}

export function timeLabel(ts: number): string {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(ts);
}

/** Groups newest-first items into consecutive per-day sections. */
export function groupByDay<T>(items: T[], timeOf: (item: T) => number, now = Date.now()) {
  const sections: { key: number; title: string; data: T[] }[] = [];
  for (const item of items) {
    const key = startOfDay(timeOf(item));
    const last = sections[sections.length - 1];
    if (last?.key === key) last.data.push(item);
    else sections.push({ key, title: dayLabel(timeOf(item), now), data: [item] });
  }
  return sections;
}

/** A file size for people: "512 B", "14 KB", "3.2 MB" ("3,2 MB" where the decimal is a comma); empty when unknown. */
export function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${mb.format(bytes / 1024 / 1024)} MB`;
}

/** A whole percentage: "120%" in English, "%120" in Turkish, "120 %" in German and French. */
export function formatPercent(n: number): string {
  return info().percent.replace('#', formatNumber(Math.round(n)));
}

/** The decimal and thousands separators of the app's language (Turkish and German write 1.234,56). */
export function numberSeparators(): { decimal: string; group: string } {
  const { decimal, group } = info();
  return { decimal, group };
}

/** A dollar amount already written with the language's decimal separator, placed as the language writes it. */
export function formatUsdAmount(amount: string): string {
  return info().usd.replace('#', amount);
}

/** "a, b, c" with the language's separator (Japanese 、). Hermes has no Intl.ListFormat. */
export function formatList(items: readonly string[]): string {
  return items.join(info().listSeparator);
}

/** The first day of the week in the app's language, 1 = Sunday, 2 = Monday. */
export function firstDayOfWeek(): 1 | 2 {
  return info().firstDay;
}

export function hostOf(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split(/[/?#]/)[0];
}
