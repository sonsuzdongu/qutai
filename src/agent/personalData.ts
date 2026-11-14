import { Memory, PERSONAL_CATEGORIES } from './memory';

/**
 * Finds remembered personal details in text the assistant is about to type or select on a page, so the app (not
 * only the prompt) can ask before they reach a site. Pure code; nothing here logs or keeps the text.
 *
 * What counts, from the memories:
 * - Phone-like numbers (7 to 15 digits, any spacing) in any memory: matched digit-wise on their last 10 digits, so
 *   "+90 555 123 45 67", "0555 123 4567" and "5551234567" are the same number; a typed run of 7 or more digits that
 *   ends the stored number (a form that splits the area code) matches too. In identity and travel memories, numbers
 *   labelled as ID or passport numbers count as ID numbers.
 * - Email addresses in any memory, case-insensitively.
 * - Letter-and-digit codes of 6 or more characters (passport numbers) in identity and travel memories.
 * - In identity, addresses and travel memories, the value after a short label ("Delivery address: …") split at
 *   commas into parts; a part counts when, normalised (case, Turkish letters, accents and punctuation folded), it is
 *   at least 6 characters long and has two or more words or a digit: a street line, "34710 İstanbul", a full name.
 *   Typed text matches when it contains such a part, or is a stretch of 8 or more characters (with a digit or two
 *   words) inside one.
 * - Single words of 3 or more letters from a name memory ("Preferred name: Ayşe") match only when they are the whole
 *   typed text (a first-name field).
 *
 * Limits: a city, district, country or postal code typed on its own is not personal (a search for "İstanbul" asks
 * nothing); a date of birth or a number written differently from how it was saved (letters for digits, another
 * order) is not recognised; memories in shopping, food, budget and general count only through the numbers and
 * emails in them, so "cash on delivery" or "Zili çalmayın" never ask. Only what is in memory is protected: details
 * the user typed in the chat and that were never saved are not.
 */

export type PersonalKind = 'name' | 'phone' | 'email' | 'address' | 'idNumber' | 'travel' | 'other';

/** The order kinds are named in, e.g. "name, phone and delivery address". */
export const PERSONAL_KINDS: PersonalKind[] = ['name', 'phone', 'email', 'address', 'idNumber', 'travel', 'other'];

type Needle =
  | { type: 'digits'; key: string; kind: PersonalKind }
  | { type: 'email'; value: string }
  | { type: 'code'; value: string; kind: PersonalKind }
  | { type: 'part'; value: string; kind: PersonalKind }
  | { type: 'word'; value: string };

/** Lowercase, Turkish dotted/dotless i and accents folded, anything but letters and digits as single spaces. */
export function foldText(text: string): string {
  return text
    .replace(/[İI]/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** "Delivery address: Atatürk Cad. 12/3, …" → label and value; no label when the part before ":" isn't short words. */
function splitLabel(text: string): { label: string; value: string } {
  const at = text.indexOf(':');
  if (at > 0 && at <= 30 && !/\d/.test(text.slice(0, at))) {
    return { label: foldText(text.slice(0, at)), value: text.slice(at + 1).trim() };
  }
  return { label: '', value: text };
}

const EMAIL = /[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/gi;

/**
 * Digit runs with spaces, dashes, dots, slashes or brackets between them (an optional leading "+"), as digits only.
 * A run right after a letter is part of a code ("U12345678"), which has its own needle.
 */
function digitRuns(text: string): string[] {
  return [...text.matchAll(/(^|[^\p{L}\d])(\+?\d(?:[\d\s().\-/]*\d)?)/gu)].map((m) => m[2].replace(/\D/g, ''));
}

const NAME_LABEL = /\b(name|ad|adi|adim|isim|ismim|soyad|soyadi|hitap)\b/;
const ID_LABEL = /\b(id|kimlik|tc|passport|pasaport|national)\b/;

/** `label`: the folded label, or the whole folded text when the memory has none ("Passport number U123…"). */
function kindOf(memory: Memory, label: string): PersonalKind {
  if (memory.category === 'addresses') return 'address';
  if (memory.category === 'travel') return ID_LABEL.test(label) ? 'idNumber' : 'travel';
  if (NAME_LABEL.test(label)) return 'name';
  if (ID_LABEL.test(label)) return 'idNumber';
  return 'other';
}

/** The parts of the memories worth protecting; build once per check (at most 100 memories). */
export function personalNeedles(memories: Memory[]): Needle[] {
  const needles: Needle[] = [];
  for (const memory of memories) {
    const personal = PERSONAL_CATEGORIES.has(memory.category);
    const { label, value } = splitLabel(memory.text);
    const kind = kindOf(memory, label || foldText(value));
    for (const match of memory.text.matchAll(EMAIL)) {
      needles.push({ type: 'email', value: match[0].toLowerCase() });
    }
    for (const digits of digitRuns(memory.text)) {
      if (digits.length < 7 || digits.length > 15) continue;
      needles.push({
        type: 'digits',
        key: digits.slice(-10),
        kind: personal && kind === 'idNumber' ? 'idNumber' : 'phone',
      });
    }
    if (!personal) continue;
    for (const match of value.matchAll(/\b(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z\d]{6,}\b/g)) {
      needles.push({ type: 'code', value: match[0].toLowerCase(), kind: kind === 'other' ? 'idNumber' : kind });
    }
    for (const raw of value.split(/[,;\n]/)) {
      // Emails and numbers have their own needles above; a part without letters or with an "@" is one of those.
      if (raw.includes('@') || !/\p{L}/u.test(raw)) continue;
      const part = foldText(raw);
      if (part.length >= 6 && (part.includes(' ') || /\d/.test(part)))
        needles.push({ type: 'part', value: part, kind });
    }
    if (kind === 'name') {
      for (const word of foldText(value).split(' ')) {
        if (word.length >= 3 && !/\d/.test(word)) needles.push({ type: 'word', value: word });
      }
    }
  }
  return needles;
}

/**
 * The kinds of remembered personal details in `text`, empty when there are none. Cheap: a few string scans per
 * memory part.
 */
export function findPersonalData(text: string, needles: Needle[]): Set<PersonalKind> {
  const found = new Set<PersonalKind>();
  if (!text.trim() || !needles.length) return found;
  const lower = text.toLowerCase();
  const runs = digitRuns(text).filter((d) => d.length >= 7);
  // An email also reads as words ("ayse yilmaz example com"); it is matched as an email only.
  const folded = foldText(text.replace(EMAIL, ' '));
  for (const needle of needles) {
    switch (needle.type) {
      case 'digits':
        if (runs.some((run) => run.endsWith(needle.key) || needle.key.endsWith(run))) found.add(needle.kind);
        break;
      case 'email':
        if (lower.includes(needle.value)) found.add('email');
        break;
      case 'code':
        if (lower.includes(needle.value)) found.add(needle.kind);
        break;
      case 'part':
        if (
          folded.includes(needle.value) ||
          (folded.length >= 8 && (folded.includes(' ') || /\d/.test(folded)) && needle.value.includes(folded))
        ) {
          found.add(needle.kind);
        }
        break;
      case 'word':
        if (folded === needle.value) found.add('name');
        break;
    }
  }
  return found;
}
