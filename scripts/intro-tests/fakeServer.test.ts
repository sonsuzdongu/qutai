// "Tell me about yourself" end to end through the app's real custom-endpoint adapter (src/ai/custom.ts) against the
// fake AI server (scripts/fake-ai/server.mjs), started here on a free local port. No provider, no spend.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { after, before, test } from 'node:test';
import { custom } from '../../src/ai/custom';
import { ExtractionError, answersTurn, transcriptTurn } from '../../src/intro/extract';
import { reviewRows } from '../../src/intro/items';
import { understand, type IntroTarget } from '../../src/intro/request';
import { t } from '../../src/i18n';

const port = 18000 + Math.floor(Math.random() * 1000);
let server: ChildProcess;
const target: IntroTarget = { provider: 'custom', model: 'fake', apiKey: '', endpoint: `http://127.0.0.1:${port}/v1` };
const signal = () => new AbortController().signal;

before(async () => {
  server = spawn(process.execPath, [new URL('../fake-ai/server.mjs', import.meta.url).pathname, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((resolve) => server.stdout!.once('data', () => resolve()));
});
after(() => server.kill());

test('round 1: a spoken introduction becomes checked items and review rows', async () => {
  const said = "Hi, I'm Deniz, I'm 34 and I live in Izmir. I'm vegetarian and allergic to peanuts. Please don't ring the doorbell. I like short answers.";
  const found = await understand(target, transcriptTurn(said), 'en', signal(), custom);
  assert.deepEqual(
    found.items.map((i) => `${i.topic}=${i.value}`),
    ['name=Deniz', 'city=Izmir', 'age=34', 'allergy=peanuts', 'diet=vegetarian', "delivery=don't ring the doorbell", 'style=short answers'],
  );
  assert.deepEqual(
    reviewRows(found.items, t).map((r) => r.text),
    [
      'Preferred name: Deniz',
      'Age: 34',
      'City: Izmir',
      "Delivery note: don't ring the doorbell",
      'Food: vegetarian',
      'Food allergy: peanuts',
      'Answer briefly and to the point.',
    ],
  );
});

test('round 2: follow-up answers, quotes checked against the answers only', async () => {
  const answers = [{ about: 'what to call them', text: 'Deniz' }, { about: 'the city they live in', text: 'Ankara' }];
  const found = await understand(target, answersTurn(answers), 'en', signal(), custom, answers.map((a) => a.text).join('\n'));
  assert.deepEqual(found.items.map((i) => `${i.topic}=${i.value}`), ['name=Deniz', 'city=Ankara']);
});

test('an answer that is not JSON fails the round', async () => {
  await assert.rejects(understand(target, 'garbage in, garbage out', 'en', signal(), custom), ExtractionError);
});
