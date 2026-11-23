// Memory's "Organise for me" with Qutai Credits (src/agent/organiseMemory.ts, src/credits/client.ts organiseMemory):
// the server's own request (backend README › Relay › Organise memory) instead of the relay, whose agent profile
// replaces the organise instructions. Server-free.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrganiseNotAvailable, proposeCategories, type OrganiseCall } from '../../src/agent/organiseMemory.ts';
import type { Memory } from '../../src/agent/memory.ts';
import type { ModelRequest, Provider } from '../../src/ai/types.ts';
import { RelayError } from '../../src/credits/errors.ts';
import { setLanguage } from '../../src/i18n/index.ts';
import { error, fakeServer, json } from './fake.ts';

setLanguage('en');
const signal = () => new AbortController().signal;
const memory = (id: string, text: string, over: Partial<Memory> = {}): Memory => ({
  id,
  text,
  category: 'general',
  createdAt: 1,
  updatedAt: 1,
  sensitive: false,
  label: null,
  ...over,
});
const MEMORIES = [
  memory('a1', 'Leave parcels with the neighbour'),
  memory('b2', 'Vegetarian'),
  memory('c3', 'TR1234567', { sensitive: true, label: 'Passport number' }),
  memory('d4', 'Likes jazz'),
];
const QUTAI = { provider: 'qutai' as const, apiKey: '', model: '' };
/** A provider that must not be called (the relay can't carry the organise instructions). */
const noRelay = { call: async () => assert.fail('the credits relay was called') } as unknown as Provider;

test('Qutai Credits: only ids and texts go to the server (a hidden memory as its label), never through the relay', async () => {
  const bodies: unknown[] = [];
  const credits: OrganiseCall = async (body) => (bodies.push(body), { moves: { a1: 'shopping', b2: 'food', c3: 'travel', d4: 'general', zz: 'food', a1x: 'nope' } });
  const moves = await proposeCategories(MEMORIES, QUTAI, signal(), { provider: noRelay, credits });
  assert.deepEqual(bodies, [
    {
      items: [
        { id: 'a1', text: 'Leave parcels with the neighbour' },
        { id: 'b2', text: 'Vegetarian' },
        { id: 'c3', text: 'Passport number (value hidden)' },
        { id: 'd4', text: 'Likes jazz' },
      ],
    },
  ]);
  assert.ok(!JSON.stringify(bodies).includes('TR1234567'), 'a hidden value never leaves the phone');
  // Only moves out of the current category, for memories that were sent, to known categories.
  assert.deepEqual(moves.map((m) => `${m.memory.id}→${m.category}`), ['a1→shopping', 'b2→food', 'c3→travel']);
});

test('Qutai Credits: signed out, an older server, refusals and a malformed answer each say what happened', async () => {
  await assert.rejects(proposeCategories(MEMORIES, QUTAI, signal(), { provider: noRelay, credits: null }), (e: unknown) => e instanceof RelayError && e.kind === 'not_signed_in');
  const refuse = (kind: ConstructorParameters<typeof RelayError>[0], status: number): OrganiseCall => async () => {
    throw new RelayError(kind, status);
  };
  await assert.rejects(proposeCategories(MEMORIES, QUTAI, signal(), { provider: noRelay, credits: refuse('unknown', 404) }), OrganiseNotAvailable);
  await assert.rejects(proposeCategories(MEMORIES, QUTAI, signal(), { provider: noRelay, credits: refuse('insufficient_credits', 402) }), (e: unknown) => {
    assert.ok(e instanceof RelayError);
    assert.match(e.message, /enough Qutai Credits/);
    return true;
  });
  await assert.rejects(proposeCategories(MEMORIES, QUTAI, signal(), { provider: noRelay, credits: async () => 'Sure! Here you go' }), (e: unknown) => e instanceof RelayError && e.kind === 'bad_response');
});

test('own key: unchanged, the instructions are the system prompt and the facts the one turn', async () => {
  const sent: ModelRequest[] = [];
  const provider = { call: async (req: ModelRequest) => (sent.push(req), { text: '{"b2": "food"}', toolCalls: [] }) } as unknown as Provider;
  const moves = await proposeCategories(MEMORIES, { provider: 'anthropic', apiKey: 'k', model: 'm' }, signal(), { provider, credits: async () => assert.fail('the server route was called') });
  assert.deepEqual(moves.map((m) => m.memory.id), ['b2']);
  assert.match(sent[0].system, /Reply with JSON only/);
  assert.deepEqual(sent[0].tools, []);
  assert.equal(sent[0].audit.conversation, 'memory:organise');
});

test('client: posts the facts to /relay/organise-memory signed in, keeps the balance, and an older server is a 404', async () => {
  const server = fakeServer({ organise: json({ moves: { a1: 'shopping' } }, 200, { 'X-Qutai-Balance': '4200000', 'X-Qutai-Charged': '800' }) });
  const answer = await server.client().organiseMemory({ items: [{ id: 'a1', text: 'x' }] }, signal());
  assert.deepEqual(answer, { moves: { a1: 'shopping' } });
  const req = server.requests.find((r) => r.path === '/relay/organise-memory')!;
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.authorization, 'Bearer token-1');
  assert.equal(req.headers['x-qutai-app-version'], '1.2.0');
  assert.deepEqual(req.body, { items: [{ id: 'a1', text: 'x' }] });
  assert.deepEqual(server.events.balances, [4_200_000]);

  const older = fakeServer();
  await assert.rejects(older.client().organiseMemory({ items: [{ id: 'a1', text: 'x' }] }, signal()), (e: unknown) => e instanceof RelayError && e.status === 404);
  const poor = fakeServer({ organise: error('insufficient_credits', 402) });
  await assert.rejects(poor.client().organiseMemory({ items: [{ id: 'a1', text: 'x' }] }, signal()), (e: unknown) => e instanceof RelayError && e.kind === 'insufficient_credits');
});
