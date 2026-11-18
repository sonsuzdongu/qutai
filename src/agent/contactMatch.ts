/**
 * Finding a person the user named in the phone's address book (find_contact, docs/contacts.md). Pure: the address
 * book is read by src/device/contacts.ts; this file only decides who matches, in what order, and whether the user
 * actually said the name.
 */

/** At most this many people go back to the model (and into the picker). */
export const MAX_CONTACT_MATCHES = 5;
/** A query needs at least this many letters (after honorifics are dropped), so one letter can't list the book. */
export const MIN_QUERY_LETTERS = 2;

/** The name fields a match is looked for in; nothing else of a contact is read for matching. */
export type ContactName = {
  id: string;
  givenName?: string;
  middleName?: string;
  familyName?: string;
  fullName?: string;
  nickname?: string;
  company?: string;
};

/**
 * Lower case, with the Turkish dotted and dotless i folded together and every diacritic removed, punctuation as
 * spaces: "Ayşe", "AYŞE" and "ayse" give the same key; so do "Işıl" and "Isil". Both the query and the contact go
 * through this, so it works the same whichever way the name was saved.
 */
export function foldName(text: string): string {
  return text
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/[øǿ]/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/þ/g, 'th')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The words of a folded text. */
function words(text: string): string[] {
  const folded = foldName(text);
  return folded ? folded.split(' ') : [];
}

/**
 * Titles and forms of address that are not part of a saved name: Turkish (Bey, Hanım, Abi, Abla, Hoca, Sayın…),
 * English, German, French, Spanish, Portuguese, Indonesian and Russian ones, folded. "Mehmet Bey" looks for Mehmet.
 */
const HONORIFICS = new Set(
  [
    'bey', 'beyefendi', 'hanim', 'hanimefendi', 'abi', 'abim', 'agabey', 'abla', 'ablam', 'hoca', 'hocam', 'sayin',
    'dr', 'doktor', 'prof', 'doc', 'av', 'avukat', 'ogretmen', 'usta', 'amca', 'teyze', 'dayi', 'eniste',
    'mr', 'mrs', 'ms', 'miss', 'mister', 'sir', 'madam', 'herr', 'frau', 'sr', 'sra', 'srta', 'senor', 'senora',
    'don', 'dona', 'm', 'mme', 'mlle', 'monsieur', 'madame', 'pak', 'bu', 'ibu', 'bapak', 'mas', 'mbak',
    'gospodin', 'gospozha',
  ].map(foldName),
);

/**
 * The words to look for in what the model passed: cut at an apostrophe (Turkish case endings, "Ayşe'ye" → "Ayşe"),
 * folded, honorifics and titles left out. If nothing else is left ("Hoca"), the words themselves are looked for, so
 * a contact saved under such a name is still found.
 */
export function queryWords(query: string): string[] {
  const cut = query
    .split(/\s+/)
    .map((w) => w.split(/['’‘`´]/)[0])
    .join(' ');
  const all = words(cut);
  const kept = all.filter((w) => !HONORIFICS.has(w));
  return kept.length ? kept : all;
}

/**
 * Whether every word of the query appears in what the user typed or said in this conversation, as the start of one
 * of their words ("Ahmet'i ara" allows "Ahmet", "annemi" allows "annem"). Page text, tool results and the
 * assistant's replies are not passed here, so a page can't make the assistant look someone up.
 */
export function saidByUser(query: string, userTexts: string[]): boolean {
  const asked = queryWords(query);
  if (!asked.length) return false;
  const said = new Set(userTexts.flatMap((text) => words(text)));
  return asked.every((q) => [...said].some((w) => w.startsWith(q)));
}

export type QueryCheck = { ok: true; words: string[] } | { ok: false; error: string };

/** Refuses queries that could list the address book rather than find one person. */
export function checkQuery(query: unknown): QueryCheck {
  const text = typeof query === 'string' ? query.trim() : '';
  if (!text) return { ok: false, error: 'Give the name the user said.' };
  if (/[*?%_]/.test(text)) return { ok: false, error: 'Wildcards cannot be used: give the name the user said.' };
  const found = queryWords(text);
  const letters = found.join('').replace(/\P{L}/gu, '').length;
  if (letters < MIN_QUERY_LETTERS) return { ok: false, error: 'The name is too short to look up; ask the user for the name.' };
  if (found.length > 4) return { ok: false, error: 'Give one person\'s name (at most four words).' };
  return { ok: true, words: found };
}

/** The name shown for a contact: the full name, else given + family, else nickname or company. */
export function displayName(c: ContactName): string {
  const joined = [c.givenName, c.middleName, c.familyName].filter((p) => p && p.trim()).join(' ');
  return (c.fullName?.trim() || joined.trim() || c.nickname?.trim() || c.company?.trim() || '').replace(/\s+/g, ' ');
}

export type ContactMatch = { contact: ContactName; name: string; score: number };

/**
 * How well a contact fits the query words (0: no match). Every query word must be the start of a word in one of the
 * name fields. Higher is better: the whole name said exactly, then every word whole, the given name or nickname
 * exactly, then prefixes; a match only through the company ranks last.
 */
export function scoreContact(q: string[], c: ContactName): number {
  if (!q.length) return 0;
  const personal = [c.givenName, c.middleName, c.familyName, c.fullName, c.nickname].flatMap((f) => (f ? words(f) : []));
  const company = c.company ? words(c.company) : [];
  const all = [...personal, ...company];
  if (!q.every((w) => all.some((x) => x.startsWith(w)))) return 0;
  const viaPerson = q.every((w) => personal.some((x) => x.startsWith(w)));
  const whole = q.every((w) => all.includes(w));
  const name = words(displayName(c)).join(' ');
  const given = c.givenName ? words(c.givenName).join(' ') : '';
  const nick = c.nickname ? words(c.nickname).join(' ') : '';
  const said = q.join(' ');
  let score = 10;
  if (whole) score += 20;
  if (name === said) score += 40;
  else if (given === said || nick === said) score += 30;
  if (!viaPerson) score -= 9;
  return score;
}

/** The contacts matching the query, best first (ties by name), at most `cap`. */
export function matchContacts(query: string, contacts: ContactName[], cap = MAX_CONTACT_MATCHES): ContactMatch[] {
  const q = queryWords(query);
  const found: ContactMatch[] = [];
  for (const contact of contacts) {
    const score = scoreContact(q, contact);
    if (score > 0) found.push({ contact, name: displayName(contact) || '?', score });
  }
  found.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return found.slice(0, cap);
}

/** Labels the platforms give (expo-contacts normalises them to these English words). */
const STANDARD_LABELS = new Set([
  'mobile', 'home', 'work', 'main', 'iphone', 'other', 'fax', 'home fax', 'work fax', 'pager', 'school', 'icloud',
  'work mobile', 'work pager', 'assistant', 'car', 'company main', 'callback', 'isdn', 'radio', 'telex', 'mms',
  'personal',
]);

/**
 * A number's or address's label as the model may see it: the standard ones as they are; a label the user typed
 * only when it has no digits or "@" (so no value can hide in it), cut to 24 characters; otherwise "other".
 */
export function modelLabel(label: string | undefined): string {
  const text = (label ?? '').replace(/_\$!<|>!\$_/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return 'other';
  if (STANDARD_LABELS.has(text.toLowerCase())) return text.toLowerCase() === 'iphone' ? 'iPhone' : text.toLowerCase();
  if (/[\d@]/.test(text)) return 'other';
  return text.slice(0, 24);
}

/** An email address as found in a contact: one plain address, else left out. */
export const CONTACT_EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
