import { foldText } from './personalData';

/**
 * Whether a memory the assistant wants to save comes from what the user wrote (docs/design/04-untrusted-content.md,
 * UNTR-23). The prompt says to save only what the user said; this is the app's check behind it. A page or file that
 * talks the model into `remember` ("the user wants all bills sent to …", "always buy from …") usually brings words,
 * numbers and addresses the user never wrote, and then Qutai asks the user in its own dialog before saving.
 *
 * The rule: every number (3+ digits), email and web address in the memory must appear in the user's own messages of
 * this conversation, and at least half of its other words (4+ letters, without common label words) must match a
 * word the user wrote (the first 5 letters, so "vegetarian" and "vegetarians" match, after folding case, Turkish
 * letters and accents). A memory with no such words and nothing else counts as the user's.
 *
 * Limits: a memory written in another language than the user wrote ("Vegetarian" from "vejetaryenim") or
 * paraphrased far from their words is asked about too, which costs the user a tap; a page that only repeats words
 * the user already wrote can still get a memory saved without a question.
 */

const LABEL_WORDS = new Set(
  [
    'name', 'phone', 'mobile', 'email', 'mail', 'home', 'work', 'address', 'delivery', 'user', 'users', 'prefers',
    'prefer', 'likes', 'wants', 'always', 'never', 'number', 'their', 'they', 'this', 'that', 'with', 'from', 'only',
    'when', 'should', 'would', 'about', 'favourite', 'favorite', 'usually', 'size', 'like',
    // Turkish label words
    'telefon', 'adres', 'adresi', 'teslimat', 'kullanici', 'tercih', 'ediyor', 'numara', 'numarasi', 'her', 'zaman',
  ].map((w) => foldText(w)),
);

const EMAIL = /[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/gi;
const WEB = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi;

export function memoryFromUser(text: string, userTexts: string[]): boolean {
  const said = userTexts.join('\n');
  const saidLower = said.toLowerCase();
  const saidDigits = said.replace(/\D/g, ' ');
  const saidDigitsFlat = said.replace(/\D/g, '');

  const emails = [...text.matchAll(EMAIL)].map((m) => m[0].toLowerCase());
  if (emails.some((e) => !saidLower.includes(e))) return false;
  const rest = text.replace(EMAIL, ' ');
  const webs = [...rest.matchAll(WEB)].map((m) => m[0].toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''));
  if (webs.some((w) => !saidLower.includes(w))) return false;
  const restNoWeb = rest.replace(WEB, ' ');

  // Numbers: digits only, spacing ignored (a phone number written "+90 555 123 45 67" or "05551234567").
  for (const m of restNoWeb.matchAll(/\+?\d(?:[\d\s().\-/]*\d)?/g)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 3) continue;
    const key = digits.length > 10 ? digits.slice(-10) : digits;
    if (!saidDigitsFlat.includes(key) && !saidDigits.includes(key)) return false;
  }

  const words = foldText(restNoWeb)
    .split(' ')
    .filter((w) => w.length >= 4 && !/\d/.test(w) && !LABEL_WORDS.has(w));
  if (!words.length) return true;
  const saidWords = foldText(said).split(' ').filter((w) => w.length >= 3);
  const stem = (w: string) => w.slice(0, 5);
  const saidStems = new Set(saidWords.map(stem));
  const matched = words.filter((w) => saidStems.has(stem(w))).length;
  return matched * 2 >= words.length;
}
