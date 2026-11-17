import { messageLanguage } from './messageLanguage';

/**
 * Which voice reads a text aloud: the language the text is written in, not the app's or the phone's language.
 * Pure: no React Native imports (tested in scripts/text-tests/speechLanguage.test.ts).
 *
 * The rule:
 * - The text decides when its language is clear (the ten languages messageLanguage knows). A hint (the page's
 *   `lang`, or the language the assistant named for its read-aloud tool) never beats a clear text: pages often say
 *   "en" for Turkish articles, and the model sometimes names the app's language for a Turkish answer.
 * - The text is judged paragraph by paragraph (a paragraph that is itself mixed, sentence by sentence) and the
 *   language with the most letters wins when it clearly leads. A Turkish answer with English product names, a quoted
 *   English sentence or one English paragraph is read in Turkish. One voice reads the whole text: switching voices
 *   mid-answer sounds broken, and short paragraphs are where detection is least sure.
 * - A hint in the same language as the text keeps its region ("en-GB" stays "en-GB"). A text with no clear
 *   language (a number, a name, an even split) takes the hint; with neither, undefined: the phone's default voice.
 */

/** A default region per detected language, for the speech engine's BCP 47 code. */
const VOICE: Record<string, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-BR',
  fr: 'fr-FR',
  id: 'id-ID',
  ru: 'ru-RU',
  ja: 'ja-JP',
  ko: 'ko-KR',
};

/** Enough to tell the language; long pages needn't be scored whole. */
const SAMPLE_CHARS = 6000;
/** A paragraph longer than this that is mixed as a whole is judged sentence by sentence. */
const SPLIT_CHARS = 80;
/** The winner needs this many times the letters of the runner-up. */
const LEAD = 1.5;

export const baseLanguage = (code: string) => code.trim().toLowerCase().split(/[-_]/)[0];

/** A usable BCP 47 hint ("tr", "tr-TR", "pt_BR"), or undefined for anything else (empty, "und", a sentence). */
function cleanHint(hint: string | null | undefined): string | undefined {
  const value = hint?.trim().replace(/_/g, '-');
  if (!value || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value) || baseLanguage(value) === 'und') return undefined;
  return value;
}

const letters = (text: string) => (text.match(/\p{L}/gu) ?? []).length;

/** The language a (possibly long, possibly mixed) text is mostly written in, or null. */
export function textLanguage(text: string): string | null {
  const sample = text.slice(0, SAMPLE_CHARS);
  const weight: Record<string, number> = {};
  const count = (unit: string) => {
    const language = messageLanguage(unit);
    if (language) weight[language] = (weight[language] ?? 0) + letters(unit);
    return language;
  };
  for (const paragraph of sample.split(/\n+/)) {
    if (!paragraph.trim()) continue;
    if (count(paragraph) || paragraph.length <= SPLIT_CHARS) continue;
    for (const sentence of paragraph.split(/(?<=[.!?…。！？])\s*/)) if (sentence.trim()) count(sentence);
  }
  const [top, second] = Object.entries(weight).sort((a, b) => b[1] - a[1]);
  if (!top) return null;
  return !second || top[1] >= second[1] * LEAD ? top[0] : null;
}

export function speechLanguage(text: string, hint?: string | null): string | undefined {
  const given = cleanHint(hint);
  const detected = textLanguage(text);
  if (!detected) return given;
  if (given && baseLanguage(given) === detected) return given;
  return VOICE[detected] ?? given;
}

/** A voice as expo-speech's getAvailableVoicesAsync reports it. */
export type VoiceInfo = { identifier: string; language: string; quality?: string };

/** What to hand the speech engine as its `language` option, and the language left without a voice, if any. */
export type VoiceChoice = { language?: string; missing?: string };

/**
 * The speech engine's `language` option for a language, given the phone's voices.
 *
 * - No language: nothing (the phone's default voice).
 * - An empty list means "not known yet" (Android engines may report their voices late): the language is passed as
 *   is, no warning.
 * - A voice for the exact language and region, else one for the same language in another region (pt-PT for pt-BR).
 * - No voice for the language at all: nothing, so the phone's default voice reads, and `missing` names the
 *   language so the user can be told once. Reading isn't blocked.
 *
 * Android gets the bare language code: expo-speech builds the locale with Locale.Builder().setLanguage, which rejects
 * a tag such as "tr-TR" and then uses the phone's language (the reported bug), and the engine picks its own voice
 * for the language. No `voice` option there: when the engine's service has died, expo-speech looks voices up in a
 * null list and the whole utterance is rejected. iOS takes the tag and reads with the voice the user set for that
 * language in the system settings.
 */
export function pickVoice(language: string | undefined, voices: VoiceInfo[], os: string): VoiceChoice {
  if (!language) return {};
  const base = baseLanguage(language);
  const tag = (code: string) => code.replace(/_/g, '-').toLowerCase();
  if (voices.length === 0) return { language: os === 'android' ? base : language };
  const exact = voices.find((v) => tag(v.language) === tag(language));
  const same = exact ?? voices.find((v) => baseLanguage(v.language) === base);
  if (!same) return { missing: base };
  return { language: os === 'android' ? base : same.language.replace(/_/g, '-') };
}
