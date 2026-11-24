import { hiddenLabel, type Memory, type MemoryCategory } from '../agent/memory';
import type { MessageKey } from '../i18n';
import type { IntroItem, IntroTopic } from './extract';

/**
 * What the review page lists and what is saved: the understood items as the same one-fact lines the typed questions
 * write (ProfileQuestions), in the same categories, plus the answer-style line for the custom instructions.
 */

export type ReviewRow = {
  key: string;
  topic: IntroTopic;
  /** Memory: the line saved. Instruction: the custom-instructions line. */
  kind: 'memory' | 'instruction';
  text: string;
  category: MemoryCategory;
  /** Age, gender, allergies and health: the row offers "Hide from the AI". */
  canHide: boolean;
  hidden: boolean;
  /** Label of a hidden row (what the AI is told it is); never derived from the value. */
  hiddenLabel: MessageKey | null;
  /**
   * Earlier notes of the same one-value kind (name, city, age, gender, payment) this row replaces when saved; `shown`
   * is what the review page may show (a hidden note's label, never its value).
   */
  replaces?: { id: string; shown: string }[];
};

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

const SENSITIVE: Partial<Record<IntroTopic, MessageKey>> = {
  age: 'voiceIntro.hiddenLabel.age',
  gender: 'voiceIntro.hiddenLabel.gender',
  allergy: 'voiceIntro.hiddenLabel.allergy',
  health: 'voiceIntro.hiddenLabel.health',
};

/** The order rows are listed in (the Memory screen's category order, then topic). */
const ORDER: IntroTopic[] = [
  'name',
  'age',
  'gender',
  'city',
  'payment',
  'delivery',
  'shopping',
  'diet',
  'allergy',
  'health',
  'other',
  'style',
];

const join = (items: IntroItem[], separator: string) =>
  items.map((i) => i.value.replace(/[.,;\s]+$/, '')).join(separator);

export function reviewRows(items: IntroItem[], t: T): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const row = (topic: IntroTopic, text: string, category: MemoryCategory, kind: ReviewRow['kind'] = 'memory') => {
    const label = SENSITIVE[topic] ?? null;
    rows.push({ key: `${topic}:${rows.length}`, topic, kind, text, category, canHide: !!label, hidden: false, hiddenLabel: label });
  };
  const of = (topic: IntroTopic) => items.filter((i) => i.topic === topic);
  for (const topic of ORDER) {
    const list = of(topic);
    if (!list.length) continue;
    switch (topic) {
      case 'name':
        row(topic, t('profile.fact.name', { value: list[0].value }), 'identity');
        break;
      case 'city':
        row(topic, t('profile.fact.city', { value: list[0].value }), 'addresses');
        break;
      case 'age':
        row(topic, t('voiceIntro.fact.age', { value: list[0].value }), 'identity');
        break;
      case 'gender':
        row(topic, t('voiceIntro.fact.gender', { value: list[0].value }), 'identity');
        break;
      case 'diet':
        row(topic, t('profile.fact.food', { value: join(list, ', ') }), 'food');
        break;
      case 'allergy':
        for (const i of list) row(topic, t('voiceIntro.fact.allergy', { value: i.value }), 'food');
        break;
      case 'health':
        for (const i of list) row(topic, t('voiceIntro.fact.health', { value: i.value }), 'food');
        break;
      case 'payment': {
        const p = list[0];
        const text =
          p.choice === 'cod'
            ? t('profile.fact.paymentCod')
            : p.choice === 'card'
              ? t('profile.fact.paymentCard')
              : t('voiceIntro.fact.payment', { value: p.value });
        row(topic, text, 'shopping');
        break;
      }
      case 'delivery':
        row(topic, t('profile.fact.delivery', { value: join(list, '. ') }), 'shopping');
        break;
      case 'shopping':
        for (const i of list) row(topic, t('voiceIntro.fact.shopping', { value: i.value }), 'shopping');
        break;
      case 'other':
        for (const i of list) row(topic, i.value, 'general');
        break;
      case 'style': {
        const choice = list[0].choice;
        // Free text about answers is not a standing instruction Qutai writes for the user. "Short" is already the
        // assistant's own rule (INTRO-34), so only "detailed" becomes a line.
        if (choice === 'detailed') row(topic, t('profile.style.detailedLine'), 'general', 'instruction');
        break;
      }
    }
  }
  return rows;
}

/**
 * The one-value kinds, and the start of their lines in the interface language ("Preferred name:"). Payment has three
 * lines (cash on delivery, card, other) whose starts may differ in a language, so it has three.
 */
const SINGLE_LINES: Partial<Record<IntroTopic, { template?: MessageKey; fixed?: MessageKey }[]>> = {
  name: [{ template: 'profile.fact.name' }],
  city: [{ template: 'profile.fact.city' }],
  age: [{ template: 'voiceIntro.fact.age' }],
  gender: [{ template: 'voiceIntro.fact.gender' }],
  payment: [{ template: 'voiceIntro.fact.payment' }, { fixed: 'profile.fact.paymentCod' }, { fixed: 'profile.fact.paymentCard' }],
};

const lower = (text: string) => text.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

/** "Preferred name:" from "Preferred name: {value}" or "Payment preference: card" (up to its colon). */
function lineStart(text: string): string | null {
  const at = text.search(/[:：]/);
  return at > 0 ? lower(text.slice(0, at + 1)) : null;
}

/** The starts of a one-value topic's lines, or [] for a topic that may have many notes. */
export function lineStarts(topic: IntroTopic, t: T): string[] {
  const starts = (SINGLE_LINES[topic] ?? []).map((line) =>
    lineStart(line.template ? t(line.template, { value: '' }) : t(line.fixed!)),
  );
  return [...new Set(starts.filter((s): s is string => !!s))];
}

/**
 * Marks which saved notes each one-value row replaces: notes of the same kind found by the start of their line (the
 * typed questions write the same lines). Saving updates the first and deletes the rest, so a second introduction
 * leaves one "Preferred name: …", not two. The review page shows them before anything is saved.
 */
export function withReplacements(
  rows: ReviewRow[],
  memories: Pick<Memory, 'id' | 'text' | 'sensitive' | 'label'>[],
  t: T,
): ReviewRow[] {
  return rows.map((row) => {
    if (row.kind !== 'memory') return row;
    const starts = lineStarts(row.topic, t);
    if (!starts.length) return row;
    const same = memories.filter((m) => starts.some((start) => lower(m.text).startsWith(start)));
    // The one with exactly this text first, so an unchanged note is just kept.
    same.sort((a, b) => Number(lower(b.text) === lower(row.text)) - Number(lower(a.text) === lower(row.text)));
    const replaces = same.map((m) => ({ id: m.id, shown: m.sensitive ? hiddenLabel(m) : m.text }));
    return replaces.length ? { ...row, replaces } : row;
  });
}

/** What saving the review page writes: memories (hidden ones with their label) and the custom-instructions line. */
export type IntroWrite =
  | { kind: 'memory'; text: string; category: MemoryCategory; hidden?: { label: string }; replace?: string[] }
  | { kind: 'instruction'; line: string };

export function introWrites(rows: ReviewRow[], t: T): IntroWrite[] {
  return rows.map((row) =>
    row.kind === 'instruction'
      ? { kind: 'instruction', line: row.text }
      : {
          kind: 'memory',
          text: row.text,
          category: row.category,
          ...(row.hidden && row.hiddenLabel ? { hidden: { label: t(row.hiddenLabel) } } : {}),
          ...(row.replaces?.length ? { replace: row.replaces.map((r) => r.id) } : {}),
        },
  );
}

/** The custom instructions with the answer-style line in place: the other style line goes, as in the typed question. */
export function withStyleLine(current: string, line: string, styleLines: string[]): string {
  const lines = current.split('\n').filter((l) => l.trim() && !styleLines.includes(l.trim()));
  lines.push(line);
  return lines.join('\n');
}
