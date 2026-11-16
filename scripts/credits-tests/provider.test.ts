// The "Qutai Credits" provider (src/credits/provider.ts) with the app's real adapters: what goes to the relay for each
// provider, the answer read by the same parsing as a direct call, the server's charge as the request's cost, the
// checks before sending, and that no own API key ever leaves on this wire.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAnswerMeter, failedRequestCost, parseAnswerCost, sumCosts } from '../../src/ai/cost.ts';
import { ApiError } from '../../src/ai/http.ts';
import type { ModelRequest, Turn } from '../../src/ai/types.ts';
import { AGENT_PROFILE_ID } from '../../src/credits/agentProfileId.ts';
import { RelayError } from '../../src/credits/errors.ts';
import { formatCredits } from '../../src/credits/format.ts';
import { createCreditsProvider } from '../../src/credits/provider.ts';
import type { PublicConfig } from '../../src/credits/types.ts';
import { CONFIG, error, fakeServer, json, settlement, sse, type Answer } from './fake.ts';

const turns: Turn[] = [{ role: 'user', text: 'What is on this page?' }];

function request(model: string, extra: Partial<ModelRequest> = {}): ModelRequest {
  return {
    apiKey: 'sk-own-key-must-never-leave',
    model,
    system: 'the app’s own system prompt (the relay builds it from the profile)',
    tools: [],
    webSearch: true,
    turns,
    signal: new AbortController().signal,
    onText: () => {},
    audit: { conversation: 'c', incognito: false, host: null },
    agent: { step: 3, memory: '\n\nMemory:\nYou have no saved memories about the user yet.', customInstructions: 'Be brief', memoryTools: true },
    ...extra,
  };
}

function provider(relay: Answer[], config: PublicConfig = CONFIG, appVersion = '1.2.0') {
  const server = fakeServer({ relay, config });
  const client = server.client();
  const p = createCreditsProvider({ client: () => client, config: async () => config, appVersion });
  return { server, p };
}

const anthropicStream = (text: string, extra: [string | null, unknown][] = []) =>
  sse([
    ['message_start', { type: 'message_start', message: { usage: { input_tokens: 1200, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu_1', name: 'read_page', input: {} } }],
    ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{}' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 1 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 40 } }],
    ['message_stop', { type: 'message_stop' }],
    ...extra,
    settlement(2_600, 4_000_000),
  ]);

test('Anthropic through the relay: the conversation only, the reply parsed as a direct one, the charge as its cost', async () => {
  const { server, p } = provider([anthropicStream('Hello')]);
  const streamed: string[] = [];
  const reply = await p.call(request('claude-sonnet-5-5', { onText: (d) => streamed.push(d) }));
  assert.equal(reply.text, 'Hello');
  assert.deepEqual(streamed, ['Hello']);
  assert.deepEqual(reply.toolCalls, [{ id: 'tu_1', name: 'read_page', input: {} }]);
  assert.equal(reply.stop, 'tool_use');
  assert.equal(reply.usage?.input, 1200);
  assert.equal(reply.usage?.output, 40);
  assert.deepEqual(reply.cost, { usage: reply.usage, credits: 2_600, source: 'server', served: { provider: 'anthropic', model: 'claude-sonnet-5-5' } });
  // An older server (no X-Qutai-* headers, the direct form): what served it is the model asked for.
  assert.deepEqual(reply.served, { provider: 'anthropic', model: 'claude-sonnet-5-5' });

  const [req] = server.relayRequests();
  assert.deepEqual(req.body, {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    profile: AGENT_PROFILE_ID,
    step: 3,
    options: { webSearch: true, memoryTools: true },
    context: { memory: '\n\nMemory:\nYou have no saved memories about the user yet.', customInstructions: 'Be brief' },
    stream: true,
    input: [{ role: 'user', content: [{ type: 'text', text: 'What is on this page?' }] }],
  });
  const sent = JSON.stringify(req);
  assert.ok(!sent.includes('sk-own-key'), 'the own key never goes to Qutai’s server');
  assert.ok(!sent.includes('the app’s own system prompt'), 'the system prompt is the server’s');
});

test('OpenAI through the relay: Responses input, web search left out where the server doesn’t allow it', async () => {
  const response = {
    status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hi there', annotations: [] }] }],
    usage: { input_tokens: 900, output_tokens: 12 },
  };
  const { server, p } = provider([
    sse([
      [null, { type: 'response.output_text.delta', output_index: 0, delta: 'Hi there' }],
      [null, { type: 'response.completed', response }],
      settlement(1_000),
    ]),
  ]);
  const reply = await p.call(request('gpt-5.6-terra'));
  assert.equal(reply.text, 'Hi there');
  assert.equal(reply.cost?.credits, 1_000);
  const [req] = server.relayRequests();
  assert.equal(req.body.provider, 'openai');
  assert.deepEqual(req.body.options, { memoryTools: true }, 'gpt-5.6-terra has no web search in this config');
  assert.deepEqual(req.body.input, [{ role: 'user', content: 'What is on this page?' }]);
});

test('Gemini through the relay without streaming: Interactions steps, the charge from the headers', async () => {
  const interaction = { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Merhaba' }] }], usage: { total_input_tokens: 10, total_output_tokens: 2 } };
  const { server, p } = provider([json(interaction, 200, { 'X-Qutai-Charged': '321', 'X-Qutai-Balance': '99' })]);
  const reply = await p.call(request('gemini-3.8-flash', { onText: undefined }));
  assert.equal(reply.text, 'Merhaba');
  assert.equal(reply.cost?.credits, 321);
  const [req] = server.relayRequests();
  assert.equal(req.body.stream, false);
  assert.deepEqual(req.body.input, [{ type: 'user_input', content: [{ type: 'text', text: 'What is on this page?' }] }]);
});

test('Gemini’s "stream failed, try without streaming" still works, and both requests’ charges count', async () => {
  const interaction = { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'ok' }] }] };
  const { server, p } = provider([
    sse([['qutai.error', { type: 'qutai.error', code: 'upstream_error' }], settlement(50)]),
    json(interaction, 200, { 'X-Qutai-Charged': '70' }),
  ]);
  const reply = await p.call(request('gemini-3.8-flash'));
  assert.equal(reply.text, 'ok');
  assert.equal(reply.cost?.credits, 120);
  assert.deepEqual(server.relayRequests().map((r) => r.body.stream), [true, false]);
});

test('a refusal is not repeated by Gemini’s fallback', async () => {
  const { server, p } = provider([error('insufficient_credits', 402)]);
  await assert.rejects(p.call(request('gemini-3.8-flash')), (e: unknown) => e instanceof RelayError && e.kind === 'insufficient_credits');
  assert.equal(server.relayRequests().length, 1);
});

test('the provider’s own refusal comes back as the direct call’s error (Gemini’s thought-signature fallback)', async () => {
  const assistant: Turn = { role: 'assistant', text: 'earlier', toolCalls: [], raw: [{ type: 'thought', signature: 'x' }], rawProvider: 'qutai', rawModel: 'gemini-3.8-flash', streamed: true };
  const interaction = { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'again' }] }] };
  const { server, p } = provider([
    error('upstream_rejected', 422, { upstream: { status: 400, code: 'missing_thought_signature', message: 'thought signature missing' } }),
    json(interaction),
  ]);
  const reply = await p.call(request('gemini-3.8-flash', { turns: [...turns, assistant, { role: 'user', text: 'go on' }] }));
  assert.equal(reply.text, 'again');
  const [first, second] = server.relayRequests();
  assert.deepEqual(first.body.input[1], { type: 'thought', signature: 'x' }, 'raw output replayed to the same provider id');
  assert.deepEqual(second.body.input[1], { type: 'model_output', content: [{ type: 'text', text: 'earlier' }] }, 'then rebuilt from text');
});

test('upstream_rejected for Anthropic is an ApiError with the provider’s message', async () => {
  const { p } = provider([error('upstream_rejected', 422, { upstream: { status: 400, type: 'invalid_request_error', message: 'prompt is too long' } })]);
  await assert.rejects(p.call(request('claude-sonnet-5-5')), (e: unknown) => e instanceof ApiError && e.status === 400 && /prompt is too long/.test(e.message));
});

test('raw output from an own-key request is never replayed through the relay (and the other way round)', async () => {
  const own: Turn = { role: 'assistant', text: 'from my key', toolCalls: [], raw: [{ type: 'thinking', thinking: 't', signature: 's' }], rawProvider: 'anthropic', rawModel: 'claude-sonnet-5-5' };
  const { server, p } = provider([anthropicStream('x')]);
  await p.call(request('claude-sonnet-5-5', { turns: [...turns, own, { role: 'user', text: 'next' }] }));
  const input = server.relayRequests()[0].body.input;
  assert.deepEqual(input[1], { role: 'assistant', content: [{ type: 'text', text: 'from my key' }] });
});

test('checked before sending: maintenance, too old an app, a model not offered; nothing goes out', async () => {
  const cases: [PublicConfig, string, string, string][] = [
    [{ ...CONFIG, maintenance: { enabled: true, message: 'Back at 10:00' } }, '1.2.0', 'claude-sonnet-5-5', 'maintenance'],
    [{ ...CONFIG, minAppVersion: '2.0.0' }, '1.2.0', 'claude-sonnet-5-5', 'upgrade_required'],
    [CONFIG, '1.2.0', 'claude-opus-5-5', 'model_not_allowed'],
  ];
  for (const [config, version, model, kind] of cases) {
    const { server, p } = provider([anthropicStream('x')], config, version);
    await assert.rejects(p.call(request(model)), (e: unknown) => e instanceof RelayError && e.kind === kind);
    assert.equal(server.relayRequests().length, 0);
  }
  const { p } = provider([], { ...CONFIG, maintenance: { enabled: true, message: 'Back at 10:00' } });
  await assert.rejects(p.call(request('claude-sonnet-5-5')), /Back at 10:00/);
});

test('signed out: refused before anything is sent', async () => {
  const p = createCreditsProvider({ client: () => null, config: async () => CONFIG, appVersion: '1.2.0' });
  await assert.rejects(p.call(request('claude-sonnet-5-5')), (e: unknown) => e instanceof RelayError && e.kind === 'not_signed_in');
});

test('a request cut short keeps its charge for the answer’s total', async () => {
  const { p } = provider([sse([['message_start', { type: 'message_start' }], ['qutai.error', { type: 'qutai.error', code: 'upstream_timeout' }], settlement(800)])]);
  const meter = createAnswerMeter('qutai', 'claude-sonnet-5-5');
  try {
    await p.call(request('claude-sonnet-5-5'));
    assert.fail('should fail');
  } catch (e) {
    assert.ok(e instanceof RelayError && e.kind === 'upstream_timeout');
    meter.add(failedRequestCost(e));
  }
  assert.equal(meter.result()?.credits, 800);
});

test('credits add up per answer, never as dollars, and survive saving', () => {
  const meter = createAnswerMeter('qutai', 'claude-sonnet-5-5');
  const usage = { input: 10, cacheRead: 0, cacheWrite: 0, cacheWriteLong: 0, output: 5, thinking: 0, searches: 0 };
  meter.add({ usage, credits: 100, source: 'server' });
  meter.add({ usage, credits: 250, source: 'server' });
  meter.add(undefined);
  const answer = meter.result()!;
  assert.equal(answer.credits, 350);
  assert.equal(answer.nanos, undefined);
  assert.equal(answer.source, 'server');
  assert.equal(answer.requests, 3);
  assert.deepEqual(parseAnswerCost(JSON.parse(JSON.stringify(answer))), answer);
  assert.equal(sumCosts([answer, answer]).credits, 700);
  assert.equal(sumCosts([answer, { usage, nanos: 5 }]).credits, undefined, 'no total across own-key and credit answers');
});

test('credits as text', () => {
  assert.equal(formatCredits(12_345_678), '12.35');
  assert.equal(formatCredits(420_000), '0.42');
  assert.equal(formatCredits(3_100), '0.0031');
  assert.equal(formatCredits(50), '< 0.0001');
  assert.equal(formatCredits(0), '0');
  assert.equal(formatCredits(-2_500_000), '-2.50');
  assert.equal(formatCredits(1_234_560_000, { decimal: ',', group: '.' }), '1.234,56');
  assert.equal(formatCredits(25_000_000_000), '25,000');
});
