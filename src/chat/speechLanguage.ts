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

/**
 * What to hand the speech engine: its `language` option, on iOS also the `voice` chosen; the language left without a
 * voice, if any; and `lowQuality` when only basic voices are installed for it (the user can be told once how to get a
 * better one).
 */
export type VoiceChoice = { language?: string; voice?: string; missing?: string; lowQuality?: true };

/**
 * How natural a voice sounds, from what the platform reports. iOS: Premium (iOS 16+; expo-speech reports it as
 * "Default", so it is read from the identifier) > Enhanced > the Siri voices > compact; the Eloquence voices and the
 * novelty voices ("Bells", "Bad News"…) are last. Android: the engine's quality (expo-speech says "Enhanced" above
 * QUALITY_NORMAL), and a voice that needs the network counts a little less than the same quality on the phone (it
 * stalls without a connection).
 */
export function voiceRank(voice: VoiceInfo, os: string): number {
  const id = voice.identifier.toLowerCase();
  if (os === 'ios') {
    if (/\.premium\./.test(id)) return 4;
    if (voice.quality === 'Enhanced' || /\.enhanced\./.test(id)) return 3;
    if (id.includes('siri')) return 2;
    if (id.includes('eloquence') || id.startsWith('com.apple.speech.synthesis.voice.')) return 0;
    return 1;
  }
  const enhanced = voice.quality === 'Enhanced' ? 2 : 1;
  return id.includes('network') ? enhanced - 0.5 : enhanced;
}

/** Below this rank only basic voices are installed for the language. */
const GOOD_RANK = { ios: 3, android: 1.5 } as const;

/**
 * The speech engine's options for a language, given the phone's voices.
 *
 * - No language: nothing (the phone's default voice).
 * - An empty list means "not known yet" (Android engines may report their voices late): the language is passed as
 *   is, no warning.
 * - Voices for the exact language and region, else the same language in another region (pt-PT for pt-BR); among
 *   them the most natural one (voiceRank). `previous` (the voice chosen for this language before) is kept while it is
 *   still installed and as good as any, so the voice never changes between sentences or answers.
 * - No voice for the language at all: nothing, so the phone's default voice reads, and `missing` names the
 *   language so the user can be told once. Reading isn't blocked.
 *
 * Android gets the bare language code: expo-speech builds the locale with Locale.Builder().setLanguage, which rejects
 * a tag such as "tr-TR" and then uses the phone's language (the reported bug), and the engine picks its own voice
 * for the language. No `voice` option there: when the engine's service has died, expo-speech looks voices up in a
 * null list and the whole utterance is rejected. The list still says whether a natural voice is installed. iOS
 * takes the tag and the chosen voice's identifier.
 */
export function pickVoice(language: string | undefined, voices: VoiceInfo[], os: string, previous?: string): VoiceChoice {
  if (!language) return {};
  const base = baseLanguage(language);
  const tag = (code: string) => code.replace(/_/g, '-').toLowerCase();
  if (voices.length === 0) return { language: os === 'android' ? base : language };
  const exact = voices.filter((v) => tag(v.language) === tag(language));
  const candidates = exact.length ? exact : voices.filter((v) => baseLanguage(v.language) === base);
  if (!candidates.length) return { missing: base };
  // The most natural; the first listed among equals (a stable order from the platform).
  let best = candidates[0];
  for (const v of candidates) if (voiceRank(v, os) > voiceRank(best, os)) best = v;
  const kept = previous ? candidates.find((v) => v.identifier === previous) : undefined;
  if (kept && voiceRank(kept, os) >= voiceRank(best, os)) best = kept;
  const lowQuality = voiceRank(best, os) < (os === 'ios' ? GOOD_RANK.ios : GOOD_RANK.android);
  return {
    ...(os === 'android' ? { language: base } : { language: best.language.replace(/_/g, '-'), voice: best.identifier }),
    ...(lowQuality ? { lowQuality: true as const } : {}),
  };
}
