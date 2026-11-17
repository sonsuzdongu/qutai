// Which follow-up questions are asked (src/intro/followUps.ts) and how the review rows are made (items.ts). Server-free.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { t } from '../../src/i18n';
import { EMPTY_EXTRACTION, type Extraction, type IntroItem } from '../../src/intro/extract';
import { chipAnswers, chooseFollowUps, FOLLOW_UPS, textAnswers, verbatimItems } from '../../src/intro/followUps';
import { reviewRows, withStyleLine } from '../../src/intro/items';

const it = (topic: IntroItem['topic'], value: string, choice?: string): IntroItem => ({
  topic,
  value,
  quote: value,
  ...(choice ? { choice } : {}),
});
const ext = (items: IntroItem[], more: Partial<Extraction> = {}): Extraction => ({ ...EMPTY_EXTRACTION, items, ...more });
const ids = (e: Extraction) => chooseFollowUps(e).map((f) => f.id);

test('nothing said: the first three in priority order, food first', () => {
  assert.deepEqual(ids(EMPTY_EXTRACTION), ['food', 'name', 'shopping']);
});

test('never more than three, and none for a topic already covered', () => {
  assert.deepEqual(ids(ext([it('name', 'Deniz'), it('allergy', 'peanuts')])), ['shopping', 'city', 'style']);
  assert.deepEqual(ids(ext([it('name', 'D'), it('diet', 'v'), it('delivery', 'x'), it('city', 'c')])), ['style']);
  assert.deepEqual(
    ids(ext([it('name', 'D'), it('health', 'h'), it('shopping', 's'), it('city', 'c'), it('style', 's', 'short')])),
    [],
  );
});

test('a topic said not to apply or declined is not asked about', () => {
  assert.deepEqual(ids(ext([it('name', 'D')], { none: ['allergy'], declined: ['payment'] })), ['city', 'style']);
});

test('age and gender are never asked', () => {
  const all = FOLLOW_UPS.flatMap((f) => f.topics);
  assert.ok(!all.includes('age') && !all.includes('gender'));
});

test('chips become items with their translated label, or "does not apply"', () => {
  const food = FOLLOW_UPS.find((f) => f.id === 'food')!;
  const { items, none } = chipAnswers(food, ['vegan', 'nutAllergy', 'noAllergies', 'unknown'], t);
  assert.deepEqual(items.map((i) => [i.topic, i.value]), [['diet', 'Vegan'], ['allergy', 'Nut allergy']]);
  assert.deepEqual(none, ['allergy']);
  const shopping = FOLLOW_UPS.find((f) => f.id === 'shopping')!;
  assert.equal(chipAnswers(shopping, ['cod'], t).items[0].choice, 'cod');
});

test('only typed or spoken answers need the second request; failing that they are kept as said', () => {
  const questions = chooseFollowUps(EMPTY_EXTRACTION);
  const pending = textAnswers(questions, [
    { chips: ['vegan'], text: '', skipped: false },
    { chips: [], text: '  call me   Deniz ', skipped: false },
    { chips: [], text: 'cash', skipped: true },
  ]);
  assert.deepEqual(pending.map((p) => [p.question.id, p.text]), [['name', 'call me Deniz']]);
  assert.deepEqual(verbatimItems(pending).map((i) => [i.topic, i.value]), [['name', 'call me Deniz']]);
});

test('review rows: the typed questions’ lines and categories, sensitive rows can be hidden', () => {
  const rows = reviewRows(
    [
      it('allergy', 'peanuts'),
      it('allergy', 'shellfish'),
      it('name', 'Deniz'),
      it('diet', 'vegetarian'),
      it('diet', 'no pork.'),
      it('health', 'celiac disease'),
      it('age', '34'),
      it('gender', 'woman'),
      it('payment', 'cash on delivery', 'cod'),
      it('delivery', "Don't ring the doorbell"),
      it('delivery', 'Call first'),
      it('shopping', 'Shoe size 39'),
      it('city', 'İzmir'),
      it('other', 'Has a dog'),
      it('style', 'short', 'short'),
    ],
    t,
  );
  assert.deepEqual(
    rows.map((r) => [r.text, r.category, r.kind, r.canHide]),
    [
      ['Preferred name: Deniz', 'identity', 'memory', false],
      ['Age: 34', 'identity', 'memory', true],
      ['Gender: woman', 'identity', 'memory', true],
      ['City: İzmir', 'addresses', 'memory', false],
      ['Payment preference: cash on delivery', 'shopping', 'memory', false],
      ["Delivery note: Don't ring the doorbell. Call first", 'shopping', 'memory', false],
      ['Shopping: Shoe size 39', 'shopping', 'memory', false],
      ['Food: vegetarian, no pork', 'food', 'memory', false],
      ['Food allergy: peanuts', 'food', 'memory', true],
      ['Food allergy: shellfish', 'food', 'memory', true],
      ['Health condition that affects food: celiac disease', 'food', 'memory', true],
      ['Has a dog', 'general', 'memory', false],
      ['Answer briefly and to the point.', 'general', 'instruction', false],
    ],
  );
  assert.ok(rows.every((r) => !r.hidden));
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
});

test('a payment without a known choice keeps its words; a style without one is not an instruction', () => {
  const rows = reviewRows([it('payment', 'PayPal'), it('style', 'funny answers')], t);
  assert.deepEqual(rows.map((r) => r.text), ['Payment preference: PayPal']);
});

test('the style line replaces the other style line in the custom instructions', () => {
  const styles = [t('profile.style.shortLine'), t('profile.style.detailedLine')];
  assert.equal(
    withStyleLine(`Use metric units.\n${styles[1]}`, styles[0], styles),
    `Use metric units.\n${styles[0]}`,
  );
  assert.equal(withStyleLine('', styles[0], styles), styles[0]);
});

test('saving writes hidden rows with their translated label, never the value', async () => {
  const { introWrites } = await import('../../src/intro/items');
  const rows = reviewRows([it('allergy', 'peanuts'), it('age', '34'), it('style', 'short', 'short')], t);
  rows.find((r) => r.topic === 'allergy')!.hidden = true;
  assert.deepEqual(introWrites(rows, t), [
    { kind: 'memory', text: 'Age: 34', category: 'identity' },
    { kind: 'memory', text: 'Food allergy: peanuts', category: 'food', hidden: { label: 'Food allergy' } },
    { kind: 'instruction', line: 'Answer briefly and to the point.' },
  ]);
  const { hiddenLabelProblem } = await import('../../src/agent/memory');
  for (const key of ['age', 'gender', 'allergy', 'health'] as const) {
    assert.equal(hiddenLabelProblem(t(`voiceIntro.hiddenLabel.${key}`), 'Food allergy: peanuts'), null);
  }
});
