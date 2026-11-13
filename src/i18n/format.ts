import { getLanguage, t } from './index';

const locale = () => (getLanguage() === 'tr' ? 'tr-TR' : 'en-US');

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

export function hostOf(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split(/[/?#]/)[0];
}
