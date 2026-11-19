import type { MessageKey } from '../i18n';
import type { Extraction, IntroItem, IntroTopic } from './extract';

/**
 * Which follow-up questions Qutai asks after the introduction: fixed, translated questions picked here (never text
 * from the model), at most three, only about important things the user did not mention, said not to apply, or decline.
 * Age and gender are never asked: they are saved only when the user volunteers them, and so is the answer style
 * (`INTRO-29`: setup adds the short-answers line itself, src/intro/answerStyle.ts).
 */

export type FollowUpId = 'food' | 'name' | 'shopping' | 'city';

export type Chip = {
  /** Stable id, also what a test checks. */
  id: string;
  label: MessageKey;
  /** The item a tap adds (its label, in the interface language, is the value), or the topic it says doesn't apply. */
  item?: { topic: IntroTopic; choice?: string };
  none?: IntroTopic;
};

export type FollowUp = {
  id: FollowUpId;
  question: MessageKey;
  /** What the round-2 request is told the answer is about. */
  about: string;
  /** The topics this question covers. */
  topics: IntroTopic[];
  chips: Chip[];
  /** Answers by chip pick more than one (food); otherwise a chip answers at once. */
  multi: boolean;
};

export const MAX_FOLLOW_UPS = 3;

/** In priority order: food first (an allergy matters for safety), then what the assistant uses most. */
export const FOLLOW_UPS: FollowUp[] = [
  {
    id: 'food',
    question: 'voiceIntro.ask.food',
    about: 'food: diet, allergies, health conditions that affect what they eat',
    topics: ['diet', 'allergy', 'health'],
    multi: true,
    chips: [
      { id: 'noAllergies', label: 'voiceIntro.chip.noAllergies', none: 'allergy' },
      { id: 'vegetarian', label: 'profile.chip.vegetarian', item: { topic: 'diet' } },
      { id: 'vegan', label: 'profile.chip.vegan', item: { topic: 'diet' } },
      { id: 'halal', label: 'profile.chip.halal', item: { topic: 'diet' } },
      { id: 'glutenFree', label: 'profile.chip.glutenFree', item: { topic: 'diet' } },
      { id: 'lactoseFree', label: 'profile.chip.lactoseFree', item: { topic: 'diet' } },
      { id: 'nutAllergy', label: 'profile.chip.nutAllergy', item: { topic: 'allergy' } },
    ],
  },
  {
    id: 'name',
    question: 'voiceIntro.ask.name',
    about: 'what to call them',
    topics: ['name'],
    multi: false,
    chips: [],
  },
  {
    id: 'shopping',
    question: 'voiceIntro.ask.shopping',
    about: 'shopping: how they pay and notes for deliveries',
    topics: ['payment', 'delivery', 'shopping'],
    multi: true,
    chips: [
      { id: 'cod', label: 'profile.payment.cod', item: { topic: 'payment', choice: 'cod' } },
      { id: 'card', label: 'profile.payment.card', item: { topic: 'payment', choice: 'card' } },
      { id: 'noBell', label: 'profile.chip.noBell', item: { topic: 'delivery' } },
      { id: 'callFirst', label: 'profile.chip.callFirst', item: { topic: 'delivery' } },
      { id: 'leaveDoor', label: 'profile.chip.leaveDoor', item: { topic: 'delivery' } },
    ],
  },
  {
    id: 'city',
    question: 'voiceIntro.ask.city',
    about: 'the city they live in',
    topics: ['city'],
    multi: false,
    chips: [],
  },
];

/**
 * "Ask me questions" (the third way to start the introduction): all four, one at a time, in the order a conversation
 * would take (name and city first), each answered by a chip, by typing or by voice, or skipped.
 */
const ASK_ME_ORDER: FollowUpId[] = ['name', 'city', 'food', 'shopping'];

export function askMeQuestions(): FollowUp[] {
  return ASK_ME_ORDER.map((id) => {
    const question = FOLLOW_UPS.find((f) => f.id === id)!;
    // The follow-up wording ("You didn't mention food…") assumes an introduction came first; asked cold, the typed
    // questions' own wording reads right.
    return id === 'food' ? { ...question, question: 'profile.foodTitle' } : question;
  });
}

/** The questions to ask, best first: none whose topics are covered, said not to apply, or declined. */
export function chooseFollowUps(found: Extraction, max = MAX_FOLLOW_UPS): FollowUp[] {
  const covered = new Set<IntroTopic>([...found.items.map((i) => i.topic), ...found.none, ...found.declined]);
  return FOLLOW_UPS.filter((f) => !f.topics.some((topic) => covered.has(topic))).slice(0, max);
}

/** An answer to one follow-up: chips picked, words typed or said, or skipped. */
export type FollowUpAnswer = { chips: string[]; text: string; skipped: boolean };

export const EMPTY_ANSWER: FollowUpAnswer = { chips: [], text: '', skipped: false };

/** What the picked chips say, as items and "doesn't apply" topics; `label` translates a chip. */
export function chipAnswers(
  question: FollowUp,
  chipIds: string[],
  label: (key: MessageKey) => string,
): { items: IntroItem[]; none: IntroTopic[] } {
  const items: IntroItem[] = [];
  const none: IntroTopic[] = [];
  for (const chip of question.chips.filter((c) => chipIds.includes(c.id))) {
    const text = label(chip.label);
    if (chip.item) items.push({ topic: chip.item.topic, value: text, quote: text, ...(chip.item.choice ? { choice: chip.item.choice } : {}) });
    if (chip.none) none.push(chip.none);
  }
  return { items, none };
}

/** The free-text answers that need the round-2 request (skipped and chip-only answers don't). */
export function textAnswers(questions: FollowUp[], answers: FollowUpAnswer[]): { question: FollowUp; text: string }[] {
  return questions.flatMap((question, i) => {
    const answer = answers[i];
    const text = answer && !answer.skipped ? answer.text.replace(/\s+/g, ' ').trim() : '';
    return text ? [{ question, text }] : [];
  });
}

/**
 * When round 2 can't be had: each typed or spoken answer kept as the user said it, as an item of the question's main
 * topic (shown on the review page, editable there). Nothing is made up; nothing they said is lost.
 */
export function verbatimItems(pending: { question: FollowUp; text: string }[]): IntroItem[] {
  const main: Record<FollowUpId, IntroTopic> = {
    food: 'diet',
    name: 'name',
    shopping: 'shopping',
    city: 'city',
  };
  return pending.map(({ question, text }) => ({ topic: main[question.id], value: text.slice(0, 120), quote: text }));
}
