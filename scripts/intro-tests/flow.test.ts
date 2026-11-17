// The "Tell me about yourself" state machine (src/intro/flow.ts). Server-free.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { t } from '../../src/i18n';
import { EMPTY_EXTRACTION, type Extraction } from '../../src/intro/extract';
import { finalExtraction, type FlowEvent, type FlowState, hasBack, introReducer, pendingAnswers, START } from '../../src/intro/flow';

const run = (events: FlowEvent[], from: FlowState = START) => events.reduce(introReducer, from);
const said = (text: string): FlowEvent[] => [{ type: 'speak' }, { type: 'heard', text }, { type: 'voiceEnded', text }];
const understood = (result: Partial<Extraction>): FlowEvent => ({ type: 'understood', result: { ...EMPTY_EXTRACTION, ...result } });
const NAME = { topic: 'name' as const, value: 'Deniz', quote: "I'm Deniz" };

test('listening → transcript → understanding → follow-ups → review → saved', () => {
  let s = run(said("I'm Deniz"));
  assert.equal(s.phase.name, 'transcript');
  assert.equal(s.transcript, "I'm Deniz");
  s = run([{ type: 'edit', text: "I'm Deniz from İzmir" }, { type: 'submit', hasAi: true }], s);
  assert.deepEqual(s.phase, { name: 'understanding', round: 1 });
  s = introReducer(s, understood({ items: [NAME] }));
  assert.deepEqual(s.phase, { name: 'followUp', index: 0 });
  assert.deepEqual(s.questions.map((q) => q.id), ['food', 'shopping', 'city']);
  s = run([{ type: 'toggleChip', chip: 'vegan' }, { type: 'next' }, { type: 'skipQuestion' }, { type: 'skipQuestion' }], s);
  // Chips and skips only: no second request.
  assert.equal(s.phase.name, 'review');
  assert.deepEqual(finalExtraction(s, t).items.map((i) => `${i.topic}=${i.value}`), ['name=Deniz', 'diet=Vegan']);
  s = run([{ type: 'save' }, { type: 'saved', count: 2 }, { type: 'done' }], s);
  assert.deepEqual(s.phase, { name: 'exit', to: 'done' });
});

test('a typed or spoken follow-up answer leads to round 2, merged after round 1', () => {
  let s = run([...said('I like short answers'), { type: 'submit', hasAi: true }, understood({ items: [] })]);
  assert.deepEqual(s.questions.map((q) => q.id), ['food', 'name', 'shopping']);
  s = run([{ type: 'skipQuestion' }, { type: 'answerText', text: 'Deniz' }, { type: 'next' }, { type: 'toggleChip', chip: 'card' }, { type: 'next' }], s);
  assert.deepEqual(s.phase, { name: 'understanding', round: 2 });
  assert.deepEqual(pendingAnswers(s).map((p) => p.text), ['Deniz']);
  s = introReducer(s, understood({ items: [{ topic: 'name', value: 'Deniz', quote: 'Deniz' }] }));
  assert.equal(s.phase.name, 'review');
  assert.deepEqual(finalExtraction(s, t).items.map((i) => i.topic), ['payment', 'name']);
});

test('round 2 failing keeps the answers as said, with a notice', () => {
  let s = run([...said('hello there'), { type: 'submit', hasAi: true }, understood({ items: [NAME] })]);
  s = run([{ type: 'answerText', text: 'allergic to shellfish' }, { type: 'next' }, { type: 'skipQuestion' }, { type: 'skipQuestion' }], s);
  s = introReducer(s, { type: 'failed', reason: 'request', detail: 'offline' });
  assert.equal(s.phase.name, 'review');
  assert.equal(s.notice, 'answersVerbatim');
  assert.deepEqual(finalExtraction(s, t).items.map((i) => `${i.topic}=${i.value}`), ['name=Deniz', 'diet=allergic to shellfish']);
});

test('no AI, a failed request or an unreadable answer → failed, transcript kept, then the typed questions', () => {
  const noAi = run([...said("I'm Deniz"), { type: 'submit', hasAi: false }]);
  assert.deepEqual(noAi.phase, { name: 'failed', reason: 'noAi' });
  assert.equal(introReducer(noAi, { type: 'retry' }), noAi);
  const failed = run([...said("I'm Deniz"), { type: 'submit', hasAi: true }, { type: 'failed', reason: 'unreadable' }]);
  assert.deepEqual(failed.phase, { name: 'failed', reason: 'unreadable' });
  assert.equal(failed.transcript, "I'm Deniz");
  assert.deepEqual(introReducer(failed, { type: 'retry' }).phase, { name: 'understanding', round: 1 });
  assert.deepEqual(introReducer(failed, { type: 'questionsInstead' }).phase, { name: 'exit', to: 'typed' });
});

test('nothing understood and nothing left to ask → failed "nothing"', () => {
  const allCovered = {
    items: [NAME, { topic: 'city' as const, value: 'x', quote: 'x' }, { topic: 'style' as const, value: 's', quote: 's', choice: 'short' }],
    none: ['allergy' as const],
    declined: ['payment' as const],
  };
  assert.equal(run([...said('xy'), { type: 'submit', hasAi: true }, understood(allCovered)]).phase.name, 'review');
  const nothing = run([...said('um'), { type: 'submit', hasAi: true }, understood({ none: ['allergy', 'name', 'payment', 'city', 'style'] })]);
  assert.deepEqual(nothing.phase, { name: 'failed', reason: 'nothing' });
});

test('stopping with nothing heard goes back with a notice; backgrounded mid-listening keeps the words', () => {
  const silent = run([{ type: 'speak' }, { type: 'voiceEnded', text: '' }]);
  assert.deepEqual(silent.phase, { name: 'intro' });
  assert.equal(silent.notice, 'noSpeech');
  // The app went to the background: voice input ends the session as interrupted, with the words so far.
  const away = run([{ type: 'speak' }, { type: 'heard', text: 'I live in' }, { type: 'voiceEnded', text: 'I live in' }]);
  assert.deepEqual(away.phase, { name: 'transcript' });
  assert.equal(away.transcript, 'I live in');
  // Speaking more appends (the screen passes the transcript as the draft); a silent second go keeps the first.
  const again = run([{ type: 'speak' }, { type: 'voiceEnded', text: '' }], away);
  assert.equal(again.transcript, 'I live in');
});

test('typing instead starts at the transcript; too short a text cannot be sent', () => {
  let s = introReducer(START, { type: 'typeInstead' });
  assert.deepEqual(s.phase, { name: 'transcript' });
  assert.ok(s.typing);
  s = run([{ type: 'edit', text: ' ' }, { type: 'submit', hasAi: true }], s);
  assert.equal(s.phase.name, 'transcript');
});

test('back, cancel, skip and start over', () => {
  const asked = run([...said('hello'), { type: 'submit', hasAi: true }]);
  assert.deepEqual(introReducer(asked, { type: 'cancel' }).phase, { name: 'transcript' });
  assert.deepEqual(introReducer(asked, { type: 'back' }).phase, { name: 'transcript' });
  const q = introReducer(asked, understood({ items: [NAME] }));
  const q2 = introReducer(q, { type: 'next' });
  assert.deepEqual(introReducer(q2, { type: 'back' }).phase, { name: 'followUp', index: 0 });
  assert.deepEqual(introReducer(q, { type: 'back' }).phase, { name: 'transcript' });
  const review = run([{ type: 'next' }, { type: 'next' }, { type: 'next' }], q);
  assert.equal(review.phase.name, 'review');
  assert.deepEqual(introReducer(review, { type: 'back' }).phase, { name: 'followUp', index: 2 });
  assert.deepEqual(introReducer(START, { type: 'skipAll' }).phase, { name: 'exit', to: 'skip' });
  assert.deepEqual(introReducer(review, { type: 'startOver' }), START);
  assert.ok(!hasBack(START) && hasBack(review));
});

test('a single-choice chip answers at once; a chip of another question is ignored', () => {
  let s = run([...said('hi'), { type: 'submit', hasAi: true }, understood({ items: [NAME], none: ['allergy'], declined: ['payment'] })]);
  assert.deepEqual(s.questions.map((q) => q.id), ['city', 'style']);
  s = introReducer(s, { type: 'next' });
  assert.equal(introReducer(s, { type: 'toggleChip', chip: 'vegan' }), s);
  s = introReducer(s, { type: 'toggleChip', chip: 'detailed' });
  assert.equal(s.phase.name, 'review');
  assert.equal(finalExtraction(s, t).items.find((i) => i.topic === 'style')?.choice, 'detailed');
});

test('events that do not belong to the phase change nothing', () => {
  assert.equal(introReducer(START, { type: 'heard', text: 'x' }), START);
  assert.equal(introReducer(START, { type: 'save' }), START);
  assert.equal(introReducer(START, { type: 'understood', result: EMPTY_EXTRACTION }), START);
});

test('listening that never started (microphone refused) goes back without "didn’t hear anything"', () => {
  const refused = run([{ type: 'speak' }, { type: 'voiceEnded', text: '', started: false }]);
  assert.deepEqual(refused.phase, { name: 'intro' });
  assert.equal(refused.notice, null);
  const typing = run([{ type: 'typeInstead' }, { type: 'speak' }, { type: 'voiceEnded', text: '', started: false }]);
  assert.deepEqual(typing.phase, { name: 'transcript' });
});

test('leaving the flow is left to the screen around (no page change of its own that would swallow setup’s)', async () => {
  const { leavesFlow } = await import('../../src/intro/flow');
  assert.ok(leavesFlow({ type: 'done' }));
  assert.ok(leavesFlow({ type: 'questionsInstead' }));
  assert.ok(leavesFlow({ type: 'skipAll' }));
  assert.ok(!leavesFlow({ type: 'next' }));
  assert.ok(!leavesFlow({ type: 'typeInstead' }));
});
