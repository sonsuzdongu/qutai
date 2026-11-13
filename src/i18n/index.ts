import { getLocales, useLocales } from 'expo-localization';
import { en } from './en';
import { tr } from './tr';

export type Language = 'en' | 'tr';
export type MessageKey = keyof typeof en;

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, tr };

/** Turkish when the device (or the per-app language setting) is Turkish, English otherwise. */
export function detectLanguage(languageCode: string | null | undefined): Language {
  return languageCode?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let current: Language = detectLanguage(getLocales()[0]?.languageCode);

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language) {
  current = language;
}

/** Looks up a UI string and fills in `{name}` placeholders. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = dictionaries[current][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * Follows the device language. Call it at the root so the tree re-renders with the new
 * language when the user changes it while the app is running.
 */
export function useLanguage(): Language {
  const locales = useLocales();
  const language = detectLanguage(locales[0]?.languageCode);
  setLanguage(language);
  return language;
}
