/**
 * The interface languages and how each writes numbers, dates and lists. One place, so nothing else in the app needs to
 * know which languages exist (no "not English means Turkish").
 *
 * Hermes on Android has Intl.NumberFormat and Intl.DateTimeFormat, but no Intl.PluralRules, Intl.ListFormat,
 * Intl.RelativeTimeFormat or Intl.DisplayNames, so the plural rules, list separators and percent patterns are written
 * out here (from CLDR) instead of asked from the engine.
 */

export const LANGUAGES = ['en', 'tr', 'de', 'es', 'pt-BR', 'fr', 'ja', 'ko', 'ru', 'id'] as const;
export type Language = (typeof LANGUAGES)[number];

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type LanguageInfo = {
  /** The language's name in itself, for the language picker. */
  name: string;
  /** Its name in English: the note to the model says which language the labels it quotes are in. */
  englishName: string;
  /** Locale used for dates and numbers when the phone's own region doesn't go with this language. */
  locale: string;
  /** How a whole percentage is written; `#` is the number. */
  percent: string;
  /** How a dollar amount is written; `#` is the number (already with this language's decimal separator). */
  usd: string;
  decimal: string;
  group: string;
  /** Between the items of a list ("a, b, c"). */
  listSeparator: string;
  /** First day of the week, 1 = Sunday, 2 = Monday. */
  firstDay: 1 | 2;
  /** CLDR cardinal plural category of a number. */
  plural: (n: number) => PluralCategory;
};

const NBSP = ' ';
const NNBSP = ' ';

const isInt = (n: number) => Number.isInteger(n);
const oneOther = (n: number): PluralCategory => (n === 1 ? 'one' : 'other');
const otherOnly = (): PluralCategory => 'other';

export const LANGUAGE_INFO: Record<Language, LanguageInfo> = {
  en: { name: 'English', englishName: 'English', locale: 'en-US', percent: '#%', usd: '$#', decimal: '.', group: ',', listSeparator: ', ', firstDay: 1, plural: oneOther },
  tr: { name: 'Türkçe', englishName: 'Turkish', locale: 'tr-TR', percent: '%#', usd: '$#', decimal: ',', group: '.', listSeparator: ', ', firstDay: 2, plural: oneOther },
  de: { name: 'Deutsch', englishName: 'German', locale: 'de-DE', percent: `#${NBSP}%`, usd: `#${NBSP}$`, decimal: ',', group: '.', listSeparator: ', ', firstDay: 2, plural: oneOther },
  es: { name: 'Español', englishName: 'Spanish', locale: 'es-ES', percent: `#${NBSP}%`, usd: `#${NBSP}US$`, decimal: ',', group: '.', listSeparator: ', ', firstDay: 2, plural: oneOther },
  'pt-BR': {
    name: 'Português (Brasil)',
    englishName: 'Portuguese (Brazil)',
    locale: 'pt-BR',
    percent: '#%',
    usd: `US$${NBSP}#`,
    decimal: ',',
    group: '.',
    listSeparator: ', ',
    firstDay: 1,
    // CLDR pt: 0 and 1 (and 0.x, 1.x) take the singular.
    plural: (n) => (Math.floor(Math.abs(n)) <= 1 ? 'one' : 'other'),
  },
  fr: {
    name: 'Français',
    englishName: 'French',
    locale: 'fr-FR',
    percent: `#${NNBSP}%`,
    usd: `#${NBSP}$US`,
    decimal: ',',
    group: NNBSP,
    listSeparator: ', ',
    firstDay: 2,
    // CLDR fr: 0 and 1 take the singular ("0 onglet").
    plural: (n) => (Math.floor(Math.abs(n)) <= 1 ? 'one' : 'other'),
  },
  ja: { name: '日本語', englishName: 'Japanese', locale: 'ja-JP', percent: '#%', usd: '$#', decimal: '.', group: ',', listSeparator: '、', firstDay: 1, plural: otherOnly },
  ko: { name: '한국어', englishName: 'Korean', locale: 'ko-KR', percent: '#%', usd: 'US$#', decimal: '.', group: ',', listSeparator: ', ', firstDay: 1, plural: otherOnly },
  ru: {
    name: 'Русский',
    englishName: 'Russian',
    locale: 'ru-RU',
    percent: `#${NBSP}%`,
    usd: `#${NBSP}$`,
    decimal: ',',
    group: NBSP,
    listSeparator: ', ',
    firstDay: 2,
    // CLDR ru: 1, 21, 31… one; 2–4, 22–24… few; 0, 5–20, 25–30… many; fractions other.
    plural: (n) => {
      if (!isInt(n)) return 'other';
      const a = Math.abs(n);
      const ten = a % 10;
      const hundred = a % 100;
      if (ten === 1 && hundred !== 11) return 'one';
      if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return 'few';
      return 'many';
    },
  },
  id: { name: 'Bahasa Indonesia', englishName: 'Indonesian', locale: 'id-ID', percent: '#%', usd: 'US$#', decimal: ',', group: '.', listSeparator: ', ', firstDay: 1, plural: otherOnly },
};

/**
 * The interface language for a locale ("de-AT", "pt_PT", "es-419", "in"), or null when Qutai has none for it.
 * Region variants go to the language: es-MX → es, fr-CA → fr, and every Portuguese → pt-BR.
 */
export function matchLanguage(tag: string | null | undefined): Language | null {
  if (!tag) return null;
  const code = tag.replace(/_/g, '-').toLowerCase().split('-')[0];
  switch (code) {
    case 'en':
    case 'tr':
    case 'de':
    case 'es':
    case 'fr':
    case 'ja':
    case 'ko':
    case 'ru':
    case 'id':
      return code;
    case 'in': // Android's old code for Indonesian
      return 'id';
    case 'pt':
      return 'pt-BR';
    default:
      return null;
  }
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
