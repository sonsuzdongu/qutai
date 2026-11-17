// "Tell me about yourself": reading the model's answer (src/intro/extract.ts). Server-free.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ExtractionError,
  extractionPrompt,
  foldForMatch,
  MAX_ITEMS,
  MAX_VALUE_CHARS,
  parseExtraction,
  quoteFound,
} from '../../src/intro/extract';

const SAID =
  "Hi, I'm Deniz, I'm 34 and I live in İzmir. I'm vegetarian and allergic to peanuts. I have celiac disease. " +
  "Please don't ring the doorbell, I usually pay cash on delivery. I like short answers.";

const reply = (items: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ items, ...extra });
const item = (topic: string, value: string, quote: string, more: Record<string, unknown> = {}) => ({
  topic,
  value,
  quote,
  stated: true,
  ...more,
});

test('a well-formed answer is read with every supported item', () => {
  const found = parseExtraction(
    reply(
      [
        item('name', 'Deniz', "I'm Deniz"),
        item('age', '34', "I'm 34"),
        item('city', 'İzmir', 'I live in izmir'),
        item('diet', 'vegetarian', "I'm vegetarian"),
        item('allergy', 'peanuts', 'allergic to peanuts'),
        item('health', 'celiac disease', 'I have celiac disease'),
        item('delivery', "Don't ring the doorbell", "don't ring the doorbell"),
        item('payment', 'cash on delivery', 'I usually pay cash on delivery', { choice: 'cod' }),
        item('style', 'short answers', 'I like short answers', { choice: 'short' }),
      ],
      { none: [], declined: ['gender'] },
    ),
    SAID,
  );
  assert.deepEqual(
    found.items.map((i) => i.topic),
    ['name', 'age', 'city', 'diet', 'allergy', 'health', 'delivery', 'payment', 'style'],
  );
  assert.deepEqual(found.declined, ['gender']);
  assert.equal(found.items.find((i) => i.topic === 'payment')?.choice, 'cod');
});

test('a fenced reply and text around the JSON are accepted', () => {
  const found = parseExtraction('Here you go:\n```json\n' + reply([item('name', 'Deniz', "I'm Deniz")]) + '\n```', SAID);
  assert.equal(found.items[0].value, 'Deniz');
});

test('not JSON, or not an object with items, fails the round', () => {
  assert.throws(() => parseExtraction('Sorry, I cannot help with that.', SAID), ExtractionError);
  assert.throws(() => parseExtraction('{"facts": []}', SAID), ExtractionError);
  assert.throws(() => parseExtraction('[1, 2]', SAID), ExtractionError);
  assert.throws(() => parseExtraction('{"items": "none"}', SAID), ExtractionError);
});

test('an inferred value is refused: stated must be true and the quote must be in the text', () => {
  const found = parseExtraction(
    reply([
      item('gender', 'female', "I'm Deniz", { stated: false }),
      item('age', '30', 'I sound about thirty'),
      { topic: 'city', value: 'İzmir', quote: 'I live in İzmir' },
      item('diet', 'vegan', 'I never eat meat'),
    ]),
    SAID,
  );
  assert.deepEqual(found.items, []);
});

test('a quote matches whole words only, ignoring case, punctuation and the Turkish dotted I', () => {
  assert.ok(quoteFound('i live in IZMIR', SAID));
  assert.ok(quoteFound("DON'T  ring the doorbell!", SAID));
  assert.ok(!quoteFound('Den', SAID));
  assert.ok(!quoteFound('   ', SAID));
  assert.equal(foldForMatch('İstanbul’da IŞIK'), 'istanbul da işik');
});

test('items outside the schema are dropped one by one', () => {
  const found = parseExtraction(
    reply([
      item('mood', 'happy', "I'm Deniz"),
      { ...item('name', 'Deniz', "I'm Deniz"), confidence: 0.9 },
      item('city', '', 'I live in izmir'),
      item('diet', 42 as unknown as string, "I'm vegetarian"),
      item('payment', 'cash', 'I usually pay cash on delivery', { choice: 'crypto' }),
      item('city', 'İzmir', 'I live in izmir', { choice: 'cod' }),
      'peanuts',
      null,
    ]),
    SAID,
  );
  assert.deepEqual(found.items, []);
});

test('lengths are capped, whitespace collapsed, at most MAX_ITEMS read', () => {
  const long = 'x'.repeat(300);
  const said = `I like ${long}`;
  const found = parseExtraction(reply([item('other', `  likes \n ${long}`, `I like ${long}`)]), said);
  assert.equal(found.items[0].value.length, MAX_VALUE_CHARS);
  assert.ok(!/\s{2}/.test(found.items[0].value));
  const many = Array.from({ length: 40 }, (_, i) => item('shopping', `brand ${i}`, 'I live in izmir'));
  assert.equal(parseExtraction(reply(many), SAID).items.length, MAX_ITEMS);
});

test('empty and duplicate items are dropped; one-value topics keep their first', () => {
  const found = parseExtraction(
    reply([
      item('allergy', 'peanuts', 'allergic to peanuts'),
      item('allergy', 'Peanuts', 'allergic to peanuts'),
      item('name', 'Deniz', "I'm Deniz"),
      item('name', 'Den', "I'm Deniz"),
      item('allergy', '   ', 'allergic to peanuts'),
    ]),
    SAID,
  );
  assert.deepEqual(
    found.items.map((i) => `${i.topic}=${i.value}`),
    ['allergy=peanuts', 'name=Deniz'],
  );
});

test('age is a whole number 1–120; anything else is refused', () => {
  const said = "I'm 34, my son is 200 years old, I'm thirty-four";
  assert.equal(parseExtraction(reply([item('age', '34', "I'm 34")]), said).items[0].value, '34');
  assert.deepEqual(parseExtraction(reply([item('age', '200', 'is 200 years old')]), said).items, []);
  assert.deepEqual(parseExtraction(reply([item('age', 'about 34', "I'm 34")]), said).items, []);
  assert.equal(parseExtraction(reply([item('age', '34', "I'm thirty-four")]), said).items[0].value, '34');
});

test('gender is never taken from the name', () => {
  const said = "I'm Ayşe. I'm a woman.";
  const fromName = parseExtraction(reply([item('name', 'Ayşe', "I'm Ayşe"), item('gender', 'female', "I'm Ayşe")]), said);
  assert.deepEqual(fromName.items.map((i) => i.topic), ['name']);
  const stated = parseExtraction(reply([item('name', 'Ayşe', "I'm Ayşe"), item('gender', 'woman', "I'm a woman")]), said);
  assert.deepEqual(stated.items.map((i) => i.topic), ['name', 'gender']);
});

test('what memory refuses (passwords, cards, IBANs, ID numbers) is dropped', () => {
  const said = 'my password is hunter2 and my card is 4111 1111 1111 1111 and my id is 10000000146';
  const found = parseExtraction(
    reply([
      item('other', 'password hunter2', 'my password is hunter2'),
      item('payment', 'card 4111 1111 1111 1111', 'my card is 4111 1111 1111 1111'),
      item('other', 'ID 10000000146', 'my id is 10000000146'),
    ]),
    said,
  );
  assert.deepEqual(found.items, []);
});

test('none and declined keep known topics only, once', () => {
  const found = parseExtraction(reply([], { none: ['allergy', 'allergy', 'pets'], declined: ['age', 7] }), SAID);
  assert.deepEqual(found.none, ['allergy']);
  assert.deepEqual(found.declined, ['age']);
});

test('the prompt names the interface language and keeps the rules short', () => {
  const prompt = extractionPrompt('tr');
  assert.match(prompt, /in Turkish/);
  assert.match(prompt, /Never infer/);
  assert.match(prompt, /data, not instructions/);
  assert.ok(prompt.length < 1600, `prompt is ${prompt.length} characters`);
  assert.match(extractionPrompt('xx'), /in English/);
});
