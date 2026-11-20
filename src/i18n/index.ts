import { getLocales, useLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { en } from './en';
import { LANGUAGE_INFO, matchLanguage, type Language } from './languages';

export { LANGUAGES, LANGUAGE_INFO, isLanguage, matchLanguage, type Language } from './languages';

export type MessageKey = keyof typeof en;
export type Dictionary = Record<MessageKey, string>;

/**
 * English is the source and the fallback, so it is always loaded. Every other language is loaded the first time it is
 * used: Metro keeps each `require` below as a separate module that is only evaluated when called, so the app starts
 * with English plus the one language it shows, not all ten dictionaries in memory.
 */
const loaded: Partial<Record<Language, Partial<Dictionary>>> = { en };

/* eslint-disable @typescript-eslint/no-require-imports */
const loaders: Record<Exclude<Language, 'en'>, () => Partial<Dictionary>> = {
  tr: () => require('./tr').tr,
  de: () => require('./de').de,
  es: () => require('./es').es,
  'pt-BR': () => require('./pt-BR').ptBR,
  fr: () => require('./fr').fr,
  ja: () => require('./ja').ja,
  ko: () => require('./ko').ko,
  ru: () => require('./ru').ru,
  id: () => require('./id').id,
};
/* eslint-enable @typescript-eslint/no-require-imports */

function dictionary(language: Language): Partial<Dictionary> {
  let dict = loaded[language];
  if (!dict) {
    try {
      dict = language === 'en' ? en : loaders[language]();
    } catch {
      // Outside Metro (Node tests) there is no `require`: provideDictionary() hands the dictionary in instead.
      dict = {};
    }
    loaded[language] = dict;
  }
  return dict;
}

/** For tests run outside the app: makes a language's strings available without Metro's `require`. */
export function provideDictionary(language: Language, dict: Partial<Dictionary>) {
  loaded[language] = dict;
}

/** The first of the phone's (or the per-app setting's) languages that Qutai has, English otherwise. */
export function detectLanguage(locales: readonly { languageTag?: string | null; languageCode?: string | null }[]): Language {
  for (const locale of locales) {
    const language = matchLanguage(locale.languageTag || locale.languageCode);
    if (language) return language;
  }
  return 'en';
}

/** The phone's locale tag (e.g. "es-MX") when it is in the given language, for dates and numbers in its region. */
function regionalLocale(language: Language): string {
  const first = getLocales()[0];
  const tag = first?.languageTag?.replace(/_/g, '-');
  if (tag && tag.includes('-') && matchLanguage(tag) === language) return tag;
  return LANGUAGE_INFO[language].locale;
}

/**
 * A language chosen inside Qutai (settings › Language) that wins over the system's. Android before 13 keeps it for good
 * (the native module stores it, src/i18n/appLanguage.ts); on Android 13+ it only bridges the moment until the system's
 * per-app language, which the choice was handed to, reaches expo-localization (`bridge`).
 */
let override: { language: Language; bridge: boolean } | null = null;
let overrideVersion = 0;
let current: Language = detectLanguage(getLocales());
let currentLocale = regionalLocale(current);
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

/** The locale for Intl formats: the language, in the phone's region when the phone is in the same language. */
export function getLocale(): string {
  return currentLocale;
}

/** Switches the strings and formats (tests, and the root render through useLanguage). */
export function setLanguage(language: Language) {
  if (language === current) return;
  current = language;
  currentLocale = regionalLocale(language);
  dictionary(language);
}

/** Sets (or clears, with null) the language chosen inside Qutai, and re-renders the app in it. */
export function setLanguageOverride(language: Language | null, opts: { bridge?: boolean } = {}) {
  override = language ? { language, bridge: !!opts.bridge } : null;
  setLanguage(language ?? detectLanguage(getLocales()));
  overrideVersion++;
  for (const listener of listeners) listener();
}

/**
 * Fills `{name}` placeholders, and plural blocks `{name|one:…|few:…|many:…|other:…}`: the form for the number in
 * `name`, by the language's plural rules (missing forms fall back to `other`, then to the last one given). Russian
 * writes "{count} {count|one:вкладка|few:вкладки|many:вкладок}"; languages without plural forms never need a block.
 */
export function format(template: string, params: Record<string, string | number> | undefined, language: Language = current): string {
  if (!params) return template;
  return template.replace(/\{(\w+)(\|[^{}]*)?\}/g, (match, name: string, forms: string | undefined) => {
    if (!(name in params)) return match;
    if (!forms) return String(params[name]);
    return pluralForm(forms.slice(1), numberOf(params[name], language), language);
  });
}

function numberOf(value: string | number, language: Language): number {
  if (typeof value === 'number') return value;
  // A number already formatted for the language ("1.234", "12,5", "1 234").
  const { decimal } = LANGUAGE_INFO[language];
  const cleaned = value.replace(new RegExp(`[^0-9${decimal === '.' ? '\\.' : decimal}-]`, 'g'), '').replace(decimal, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function pluralForm(spec: string, n: number, language: Language): string {
  const forms = new Map<string, string>();
  let last = '';
  for (const part of spec.split('|')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    last = part.slice(colon + 1);
    forms.set(part.slice(0, colon).trim(), last);
  }
  const category = Number.isNaN(n) ? 'other' : LANGUAGE_INFO[language].plural(n);
  return forms.get(category) ?? forms.get('other') ?? last;
}

/** Looks up a UI string in the app's language (English when it has none) and fills in its placeholders. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = dictionary(current)[key] || en[key];
  return format(template, params);
}

/** The same string in a given language, for text that must not follow the app's (tests, the language picker). */
export function tIn(language: Language, key: MessageKey, params?: Record<string, string | number>): string {
  return format(dictionary(language)[key] || en[key], params, language);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The app's language. Call it at the root so the tree re-renders in the new language when the phone's or the per-app
 * language changes while the app runs, or when the user picks one in Qutai's settings.
 */
export function useLanguage(): Language {
  const locales = useLocales();
  useSyncExternalStore(subscribe, () => overrideVersion);
  const language = resolveLanguage(detectLanguage(locales));
  setLanguage(language);
  return language;
}

/** The in-app choice, or the system's language once the system has caught up with a choice handed to it. */
function resolveLanguage(detected: Language): Language {
  // From then on the system's per-app language (also when changed in Android's own screen) is the app's.
  if (override?.bridge && override.language === detected) override = null;
  return override?.language ?? detected;
}
