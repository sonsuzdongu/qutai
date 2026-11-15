/**
 * Which language the user is writing in, from their own messages: a small guess made on the phone (no AI request),
 * used to pick the voice-input language. Pure: no React Native imports.
 *
 * Signals, per language (see PROFILES; adding a language is adding a profile):
 * - letters only that language uses (Turkish ç ğ ı İ ş ö ü): the strongest signal, 1.5 points per word that has them;
 * - very frequent function words, plus a few weaker ones that other languages share by accident;
 * - word endings that only that language produces (Turkish -iyor, -ları…, English -ing, -tion…);
 * - for Turkish, a suffix after an apostrophe (Google'da, iPhone'un); for English, contractions (don't, it's).
 * What says nothing about the writer's language is removed first: URLs, e-mail addresses, numbers, code, text in
 * quotation marks (usually copied from a page), and names (capitalised words inside a sentence, CamelCase, ACRONYMS).
 *
 * Each message is judged on its own and the latest one with a clear language decides, so the language follows the
 * conversation message by message. A message needs some evidence and a clear lead to count: one English product name
 * in a Turkish message changes nothing, and a message without any signal ("ok", a link) keeps the previous answer.
 */

export type LanguageProfile = {
  /** ISO 639-1 code, e.g. "tr". */
  code: string;
  /** Letters (lowercase) that, in this app's languages, only this language uses. */
  letters?: string;
  /** Very frequent words (lowercase), 1 point each. */
  words: string[];
  /** Words this language uses often but others share by accident, ½ point each. */
  weakWords?: string[];
  /** Word endings only this language produces (tested on words of 5+ letters), 1 point each. */
  endings?: RegExp;
  /** A suffix written after an apostrophe (Turkish: Google'da), or a contraction (English: don't), 1.5 points. */
  apostrophe?: RegExp;
  /** Letters folded to ASCII, so words typed without this language's keyboard still match ("icin" for "için"). */
  fold?: Record<string, string>;
};

export const PROFILES: LanguageProfile[] = [
  {
    code: 'tr',
    letters: 'çğışöü',
    words: (
      've bir bu şu için ile ama gibi daha çok var yok ben sen biz siz onlar nasıl neden niye nerede hangi kaç ' +
      'şey her bana beni benim sana seni senin lütfen tamam evet hayır değil olarak kadar sonra önce şimdi bunu ' +
      'şunu onu bunun burada orada mi mı mu mü misin mısın musun müsün miyim mıyım misiniz mısınız veya yani hem ' +
      'ki nedir hakkında sayfa sayfayı sayfadaki sayfada fiyat fiyatı ucuz bul göster yap ara oku özetle çevir ' +
      'git gönder kapat aç bak söyle anlat yaz olan olur oldu nasılsın merhaba selam teşekkürler sağol bugün ' +
      'yarın dün ise yine hiç bile artık sadece tüm bütün diğer başka şöyle böyle hemen biraz iyi kötü yeni ' +
      'eski büyük küçük ilk son türkçe ingilizce neler nelerdir'
    ).split(' '),
    weakWords: 'da de ne ya en o'.split(' '),
    endings:
      /(?:[ıiuü]yor(?:um|sun|uz|sunuz|lar|du|muş)?|(?:lar|ler)(?:ı|i|da|de|dan|den|a|e|ın|in|la|le)|(?:mak|mek)(?:ta|te|tan|ten|la|le)?|(?:ab|eb)il(?:ir|iyor|ecek)|(?:dı|di|du|dü|tı|ti|tu|tü)(?:k|nız|niz|nuz|nüz|lar|ler)|(?:sın|sin|sun|sün)(?:ız|iz|uz|üz)|(?:ması|mesi|ğını|ğini|sını|sini|daki|deki|ndan|nden|unu|unda|undan|inden|ında|ından|ını|ına))$/,
    apostrophe: /^[a-z0-9çğışöü]+['’](?:da|de|ta|te|dan|den|tan|ten|ın|in|un|ün|nın|nin|nun|nün|a|e|ya|ye|ı|i|u|ü|yı|yi|yu|yü|la|le|yla|yle|daki|deki|taki|teki|dır|dir|tır|tir|ı|ları|leri|lar|ler)$/,
    fold: { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' },
  },
  {
    code: 'en',
    words: (
      'the and is are was were to of for with this that these those what which who how why where when can could ' +
      'would should will do does did it its i you your my me we our they their them please from about find show ' +
      'open summarize summarise translate page price cheapest not yes there here have has all some any just also ' +
      'than then or but if get tell read make best compare want need like know think give take look see more most ' +
      'very much many only into out up down over again next new old first last today tomorrow yesterday hi hello ' +
      'thanks thank okay ok sure near cheap buy'
    ).split(' '),
    weakWords: 'a an on in at be so no go by as'.split(' '),
    endings: /(?:ing|tion|tions|ness|ment|ments|ly|ed)$/,
    apostrophe: /^[a-z]+['’](?:s|t|re|ll|ve|m|d)$/,
  },
];

/** One message adds at most this much to a language (a long paste weighs no more than a few sentences). */
const MESSAGE_CAP = 5;
/** Below this, a message has no signal at all. */
const MIN_EVIDENCE = 1.5;
/** Lead over the second language a message needs to count as written in the first. */
const MIN_LEAD = 1.5;

const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\w.-]+@[\w-]+\.[\w.]+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|dev|app|ai|co|tr|uk|de|edu|gov|info|me|tv)(?:\/\S*)?\b/gi;
const CODE = /```[\s\S]*?```|`[^`]*`/g;
/** Text in double or typographic quotation marks: usually copied from a page. */
const QUOTED = /"[^"]*"|“[^”]*”|«[^»]*»|„[^“”]*[“”]/g;
const WORD = /[\p{L}]+(?:['’][\p{L}]+)?/gu;
const SENTENCE_END = /[.!?…:\n]\s*$/;

/** The language codes detection knows about. */
export const DETECTABLE = PROFILES.map((p) => p.code);

function fold(word: string, map: Record<string, string> | undefined): string {
  if (!map) return word;
  let out = '';
  for (const ch of word) out += map[ch] ?? ch;
  return out;
}

type Prepared = {
  profile: LanguageProfile;
  words: Set<string>;
  weak: Set<string>;
  folded: Set<string>;
};

let prepared: Prepared[] | null = null;
function prepare(): Prepared[] {
  if (prepared) return prepared;
  const all = PROFILES.map((profile) => ({
    profile,
    words: new Set(profile.words),
    weak: new Set(profile.weakWords ?? []),
    folded: new Set<string>(),
  }));
  // A word typed without the language's letters ("icin") counts, unless the folded form is another language's word.
  for (const p of all) {
    if (!p.profile.fold) continue;
    for (const word of p.profile.words) {
      const plain = fold(word, p.profile.fold);
      if (plain === word) continue;
      const clash = all.some((o) => o !== p && (o.words.has(plain) || o.weak.has(plain)));
      if (!clash) p.folded.add(plain);
    }
  }
  prepared = all;
  return all;
}

/** Lowercase that keeps Turkish İ as i (the default would add a combining dot) and English I as i. */
const lower = (s: string) => s.replace(/İ/g, 'i').toLowerCase();
/** For the letter test only: Turkish İ stays a Turkish letter (ı stands in for it). */
const lowerKeepingDot = (s: string) => s.replace(/İ/g, 'ı').toLowerCase();

/** Points per language for one message; languages with no signal are absent. */
export function scoreMessage(text: string): Record<string, number> {
  const profiles = prepare();
  const scores: Record<string, number> = {};
  const add = (code: string, n: number) => (scores[code] = (scores[code] ?? 0) + n);
  const clean = text.replace(CODE, ' ').replace(QUOTED, ' ').replace(URL, ' ');

  for (const match of clean.matchAll(WORD)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const before = clean.slice(0, index);
    const atStart = before.trim() === '' || SENTENCE_END.test(before);
    const word = lower(raw);
    const [stem] = raw.split(/['’]/);
    // Apostrophes first: a name followed by a Turkish suffix (Google'da) says Turkish even though the name is skipped.
    for (const p of profiles) if (p.profile.apostrophe?.test(word)) add(p.profile.code, 1.5);
    if (/['’]/.test(raw)) continue;
    // Names, brands and acronyms: capitalised inside a sentence, CamelCase (iPhone), ALL CAPS. "I" is English.
    const capitalised = /^\p{Lu}/u.test(stem) && !atStart && raw !== 'I';
    const camel = /\p{Ll}\p{Lu}/u.test(raw);
    const caps = raw.length > 1 && raw === raw.toUpperCase() && raw !== raw.toLowerCase();
    if (capitalised || camel || caps) continue;

    for (const p of profiles) {
      const { profile } = p;
      if (profile.letters && [...lowerKeepingDot(raw)].some((ch) => profile.letters!.includes(ch))) add(profile.code, 1.5);
      if (p.words.has(word) || p.folded.has(word)) add(profile.code, 1);
      else if (p.weak.has(word)) add(profile.code, 0.5);
      if (word.length >= 5 && profile.endings?.test(word)) add(profile.code, 1);
    }
  }
  return scores;
}

/** The language one message is clearly written in, or null (too short, mixed, or only names, links and numbers). */
export function messageLanguage(text: string): string | null {
  const ranked = Object.entries(scoreMessage(text))
    .map(([code, points]) => [code, Math.min(points, MESSAGE_CAP)] as const)
    .sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || top[1] < MIN_EVIDENCE) return null;
  return top[1] - (second?.[1] ?? 0) >= MIN_LEAD ? top[0] : null;
}

/**
 * The language the user writes in now, from their messages (oldest first, as in the conversation): the language of
 * the latest message that clearly has one, so each message the user sends (typed or spoken) sets the language for
 * the next listening. Messages without a clear language ("ok", a link, a product name) keep the one before. Null
 * when no message says.
 */
export function detectWritingLanguage(messages: string[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const language = messageLanguage(messages[i]);
    if (language) return language;
  }
  return null;
}
