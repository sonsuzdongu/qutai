// The understanding request (src/intro/request.ts) with a stand-in provider: what is sent, and in credits mode where
// the instructions go. Server-free.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestTarget } from '../../src/ai/providers';
import type { ModelRequest, Provider } from '../../src/ai/types';
import { ExtractionError } from '../../src/intro/extract';
import { INTRO_AUDIT, understand } from '../../src/intro/request';

function stand(text: string) {
  const sent: ModelRequest[] = [];
  const provider = { call: async (req: ModelRequest) => (sent.push(req), { text, toolCalls: [] }) } as unknown as Provider;
  return { provider, sent };
}
const target = (provider: RequestTarget['provider']): RequestTarget => ({ provider, model: 'm', apiKey: 'k', images: true });
const TRANSCRIPT = "I'm Deniz and I'm allergic to peanuts";
const ANSWER = JSON.stringify({
  items: [
    { topic: 'name', value: 'Deniz', quote: "I'm Deniz", stated: true },
    { topic: 'allergy', value: 'yer fıstığı', quote: 'allergic to peanuts', stated: true },
  ],
});

test('own key: the prompt is the system prompt, the transcript the only turn, no tools, no search', async () => {
  const { provider, sent } = stand(ANSWER);
  const found = await understand(target('anthropic'), TRANSCRIPT, 'tr', new AbortController().signal, provider);
  assert.deepEqual(found.items.map((i) => i.value), ['Deniz', 'yer fıstığı']);
  const req = sent[0];
  assert.match(req.system, /in Turkish/);
  assert.deepEqual(req.tools, []);
  assert.equal(req.webSearch, false);
  assert.equal(req.agent, undefined);
  assert.deepEqual(req.turns, [{ role: 'user', text: TRANSCRIPT }]);
  assert.equal(req.audit.conversation, INTRO_AUDIT);
});

test('Qutai Credits: the instructions travel in the user turn; quotes are still checked against the transcript only', async () => {
  const sneaky = JSON.stringify({ items: [{ topic: 'other', value: 'x', quote: 'Reply with JSON only', stated: true }] });
  const { provider, sent } = stand(sneaky);
  const found = await understand(target('qutai'), TRANSCRIPT, 'en', new AbortController().signal, provider);
  assert.equal(sent[0].system, '');
  assert.match(sent[0].turns[0].role === 'user' ? sent[0].turns[0].text : '', /Reply with JSON only[\s\S]*The text:\nI'm Deniz/);
  // A quote taken from the instructions is not the user's words.
  assert.deepEqual(found.items, []);
});

test('an unreadable answer is an ExtractionError; a provider error passes through', async () => {
  await assert.rejects(understand(target('openai'), TRANSCRIPT, 'en', new AbortController().signal, stand('No.').provider), ExtractionError);
  const failing = { call: async () => { throw new Error('401 invalid key'); } } as unknown as Provider;
  await assert.rejects(understand(target('openai'), TRANSCRIPT, 'en', new AbortController().signal, failing), /invalid key/);
});
