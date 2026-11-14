import { createContext, useContext, type ReactNode } from 'react';
import type { Lang } from '../data/comparison';
import type { MessageKey, Messages } from '../i18n/en';

type I18n = { lang: Lang; t: (key: MessageKey, vars?: Record<string, string>) => string };

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ lang, messages, children }: { lang: Lang; messages: Messages; children: ReactNode }) {
  const t = (key: MessageKey, vars?: Record<string, string>) => {
    let s = messages[key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
  return <Ctx.Provider value={{ lang, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

/** "14 November 2026" / "14 Kasım 2026", the same on the server and in the browser (no time zone involved). */
export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  }[lang];
  return `${d} ${months[m - 1]} ${y}`;
}
