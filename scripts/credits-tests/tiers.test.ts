// Credit-mode tiers (backend/README.md › Relay › Tiers) and paused Anthropic answers (› pause_turn) with the app's real
// adapters against the fake server: the tier form of the request, the answer's X-Qutai-* headers, the route kept with
// the conversation and sent back, tier_moved retried exactly once in the other provider's format, unknown / unavailable
// tiers, an older server without tiers, choices saved before tiers, and continuing a paused answer.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAnswerMeter, failedRequestCost } from '../../src/ai/cost.ts';
import type { ModelReply, ModelRequest, Turn } from '../../src/ai/types.ts';
import { parseConfig } from '../../src/credits/client.ts';
import { nothingSent, RelayError } from '../../src/credits/errors.ts';
import { continueAfterPause } from '../../src/credits/pause.ts';
import { createCreditsProvider } from '../../src/credits/provider.ts';
import { limitsFor, stepLimit } from '../../src/credits/rules.ts';
import { defaultTier, tierTarget } from '../../src/credits/tiers.ts';
import type { PublicConfig, Tier } from '../../src/credits/types.ts';
import { CONFIG, error, fakeServer, json, settlement, sse, type Answer } from './fake.ts';


function tier(id: string, format: Tier['format'], model: string, extra: Partial<Tier> = {}): Tier {
  return {
    id,
    order: 0,
    default: false,
    format,
    maxOutputTokens: 16000,
    webSearch: true,
    limits: { ...CONFIG.limits },
    approxCreditsPerStep: 420_000,
    prices: [],
    servedBy: { provider: format, model },
    ...extra,
  };
}

const TIERED: PublicConfig = {
  ...CONFIG,
  tiers: [
    tier('fast', 'anthropic', 'claude-haiku-5-5', { order: 0, limits: { ...CONFIG.limits, maxSteps: 25 }, approxCreditsPerStep: 90_000 }),
    tier('standard', 'anthropic', 'claude-sonnet-5-5', { order: 1, default: true }),
    tier('pro', 'anthropic', 'claude-opus-5-5', { order: 2, limits: { ...CONFIG.limits, maxSteps: 60 }, approxCreditsPerStep: 1_200_000 }),
  ],
  directModels: true,
};

const ROUTE = 'r'.repeat(250);

/** The answer's X-Qutai-* headers on a response. */
function served(res: Response, provider: string, model: string, tierId?: string, route?: string): Response {
  const headers = new Headers(res.headers);
  headers.set('X-Qutai-Provider', provider);
  headers.set('X-Qutai-Model', model);
  if (tierId) headers.set('X-Qutai-Tier', tierId);
  if (route) headers.set('X-Qutai-Route', route);
  return new Response(res.body, { status: res.status, headers });
}

const textStream = (text: string, charged = 2_000, extra: [string | null, unknown][] = []) =>
  sse([
    ['message_start', { type: 'message_start', message: { usage: { input_tokens: 900, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hm' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig-1' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 1 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 30 } }],
    ['message_stop', { type: 'message_stop' }],
    ...extra,
    settlement(charged),
  ]);

/** An answer that paused in a web search, with the relay's continuation. */
const pausedStream = (n: number, charged = 3_000, pause: unknown = { type: 'qutai.paused', continuation: `cont-${n}`, expiresAt: Date.now() + 15 * 60_000 }) =>
  sse([
    ['message_start', { type: 'message_start', message: { usage: { input_tokens: 1500, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `Searching ${n}` } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: `srvtoolu_${n}`, name: 'web_search', input: {} } }],
    ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: `{"query":"q${n}"}` } }],
    ['content_block_stop', { type: 'content_block_stop', index: 1 }],
    [
      'content_block_start',
      { type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: `srvtoolu_${n}`, content: [{ type: 'web_search_result', url: 'https://example.test/', title: 'T', encrypted_content: 'enc' }] } },
    ],
    ['content_block_stop', { type: 'content_block_stop', index: 2 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'pause_turn' }, usage: { output_tokens: 20 } }],
    ['message_stop', { type: 'message_stop' }],
    ...(pause ? ([['qutai.paused', pause]] as [string, unknown][]) : []),
    settlement(charged),
  ]);

const openaiStream = (text: string) =>
  sse([
    ['response.output_text.delta', { type: 'response.output_text.delta', delta: text }],
    [
      'response.completed',
      {
        type: 'response.completed',
        response: {
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }],
          usage: { input_tokens: 100, output_tokens: 10 },
        },
      },
    ],
    settlement(1_500),
  ]);

function request(model: string, turns: Turn[], extra: Partial<ModelRequest> = {}): ModelRequest {
  return {
    apiKey: '',
    model,
    system: 'system',
    tools: [],
    webSearch: true,
    turns,
    signal: new AbortController().signal,
    onText: () => {},
    audit: { conversation: 'c', incognito: false, host: null },
    agent: { step: 0, memoryTools: false },
    ...extra,
  };
}

/** `config` may be a function: the server's configuration as it is at each read (the owner changes it meanwhile). */
function setup(relay: Answer[], config: PublicConfig | (() => PublicConfig) = TIERED) {
  const read = typeof config === 'function' ? config : () => config;
  const server = fakeServer({ relay, config: read() });
  const client = server.client();
  let refreshed = 0;
  const p = createCreditsProvider({
    client: () => client,
    config: async () => read(),
    refreshConfig: async () => {
      refreshed++;
      return read();
    },
    appVersion: '1.2.0',
  });
  return { server, p, refreshed: () => refreshed };
}

/** What runAgent keeps of a reply (the assistant turn), so the next request sees it as the app would. */
function keep(turns: Turn[], reply: ModelReply, model: string) {
  turns.push({
    role: 'assistant',
    text: reply.text,
    toolCalls: reply.toolCalls,
    raw: reply.raw,
    rawProvider: 'qutai',
    rawModel: reply.served?.model || model,
    ...(reply.served ? { served: reply.served } : {}),
    ...(reply.stop === 'pause' ? { paused: true } : {}),
  });
}

// ---------- /config ----------

test('/config tiers: in their order, one default, the tier’s limits over the top-level ones, malformed ones dropped', () => {
  const config = parseConfig({
    models: [],
    limits: { maxSteps: 40, maxImages: 9 },
    directModels: false,
    tiers: [
      { id: 'pro', order: 2, format: 'anthropic', limits: { maxSteps: 60 }, approxCreditsPerStep: 1_200_000, servedBy: { provider: 'anthropic', model: 'claude-opus-5-5' } },
      { id: 'fast', order: 0, format: 'anthropic', default: false, approxCreditsPerStep: 'x' },
      { id: 'standard', order: 1, format: 'openai', default: true, servedBy: { provider: 'openai' } },
      { id: 'Bad Id', order: 3, format: 'anthropic' },
      { id: 'other', order: 4, format: 'mistral' },
      { id: 'fast', order: 5, format: 'gemini' },
    ],
  });
  assert.deepEqual(config.tiers.map((t) => t.id), ['fast', 'standard', 'pro']);
  assert.deepEqual(config.tiers.map((t) => t.default), [false, true, false]);
  assert.equal(config.tiers[2].limits.maxSteps, 60);
  assert.equal(config.tiers[2].limits.maxImages, 9);
  assert.equal(config.tiers[0].approxCreditsPerStep, null);
  assert.equal(config.tiers[1].servedBy, null);
  assert.deepEqual(config.tiers[2].servedBy, { provider: 'anthropic', model: 'claude-opus-5-5' });
  assert.equal(config.directModels, false);
  // No default named: the first one.
  assert.equal(parseConfig({ tiers: [{ id: 'a', format: 'gemini' }, { id: 'b', format: 'gemini' }] }).tiers[0].default, true);
});

test('an older server: no tiers, the direct form still accepted', () => {
  const config = parseConfig({ models: [{ provider: 'anthropic', model: 'claude-sonnet-5-5' }], limits: { maxSteps: 40 } });
  assert.deepEqual(config.tiers, []);
  assert.equal(config.directModels, true);
  assert.equal(stepLimit(config, false), 40);
});

test('no tier is named or offered by the app: the server’s default tier, or its first when none is marked (CRED-39)', () => {
  assert.equal(defaultTier(TIERED)?.id, 'standard');
  assert.equal(defaultTier({ ...TIERED, tiers: TIERED.tiers.map((t) => ({ ...t, default: false })) })?.id, 'fast');
  assert.equal(defaultTier(CONFIG), null);
});

// ---------- stored choices ----------

test('a tier or model stored by an older version is ignored: every request goes to the server’s default tier; its limits apply', async () => {
  const stored = ['pro', 'fast', 'claude-haiku-5-5', 'claude-opus-5-5', 'some-model-9', 'research', ''];
  const { server, p } = setup(stored.map(() => served(textStream('Hi'), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE)));
  for (const model of stored) await p.call(request(model, [{ role: 'user', text: 'Hi' }]));
  assert.deepEqual(
    server.relayRequests().map((r) => r.body.tier),
    stored.map(() => 'standard'),
  );
  assert.ok(server.relayRequests().every((r) => r.body.model === undefined));

  assert.equal(limitsFor(TIERED, TIERED.tiers[0]).maxSteps, 25);
  assert.equal(stepLimit(TIERED, false, TIERED.tiers[2]), 60);
  assert.equal(stepLimit(TIERED, false, null), 40);
});

test('a conversation from before tiers keeps its history: the raw output of the same model is replayed, no route', async () => {
  const turns: Turn[] = [
    { role: 'user', text: 'Hi' },
    { role: 'assistant', text: 'Hello', toolCalls: [], raw: [{ type: 'thinking', thinking: 'x', signature: 'old-sig' }, { type: 'text', text: 'Hello' }], rawProvider: 'qutai', rawModel: 'claude-sonnet-5-5' },
    { role: 'user', text: 'More' },
  ];
  const { server, p } = setup([served(textStream('Sure'), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE)]);
  await p.call(request('claude-sonnet-5-5', turns));
  const [req] = server.relayRequests();
  assert.equal(req.body.tier, 'standard');
  assert.equal(req.body.route, undefined);
  assert.equal(req.body.input[1].content[0].signature, 'old-sig', 'the earlier answer’s thinking goes back unchanged');
});

// ---------- the tier form ----------

test('a new conversation on the default tier: { tier, provider: format }, no model, no route; the headers say what served it', async () => {
  const turns: Turn[] = [{ role: 'user', text: 'Hello' }];
  // The owner made "pro" the default in the panel; the stored "fast" from an older version plays no part.
  const proDefault: PublicConfig = { ...TIERED, tiers: TIERED.tiers.map((t) => ({ ...t, default: t.id === 'pro' })) };
  const { server, p } = setup([served(textStream('Hi there'), 'anthropic', 'claude-opus-5-5', 'pro', ROUTE)], proDefault);
  const reply = await p.call(request('fast', turns, { agent: { step: 2, memoryTools: true, memory: 'm' } }));
  const [req] = server.relayRequests();
  assert.deepEqual(Object.keys(req.body).sort(), ['context', 'input', 'options', 'profile', 'provider', 'step', 'stream', 'tier']);
  assert.equal(req.body.tier, 'pro');
  assert.equal(req.body.provider, 'anthropic');
  assert.equal(req.body.step, 2);
  assert.deepEqual(req.body.options, { webSearch: true, memoryTools: true });
  assert.equal(reply.text, 'Hi there');
  assert.deepEqual(reply.served, { provider: 'anthropic', model: 'claude-opus-5-5', tier: 'pro', route: ROUTE });
  assert.deepEqual(reply.cost?.served, { provider: 'anthropic', model: 'claude-opus-5-5' });
  assert.equal(reply.cost?.credits, 2_000);
});

test('the route is kept with the conversation and sent back with the same provider; the raw output goes back to its model', async () => {
  const turns: Turn[] = [{ role: 'user', text: 'Hello' }];
  // The tier was repointed meanwhile (config says Haiku): the running conversation stays on the model that served it.
  const config: PublicConfig = { ...TIERED, tiers: TIERED.tiers.map((t) => (t.id === 'standard' ? { ...t, servedBy: { provider: 'anthropic', model: 'claude-haiku-5-5' } } : t)) };
  const { server, p } = setup(
    [served(textStream('One'), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE), served(textStream('Two'), 'anthropic', 'claude-sonnet-5-5', 'standard', `${ROUTE}2`)],
    config,
  );
  keep(turns, await p.call(request('standard', turns)), 'standard');
  turns.push({ role: 'user', text: 'And?' });
  const second = await p.call(request('standard', turns));
  const [, req] = server.relayRequests();
  assert.equal(req.body.route, ROUTE);
  assert.equal(req.body.provider, 'anthropic');
  assert.equal(req.body.input[1].content[0].type, 'thinking', 'raw output replayed to the model that made it');
  assert.equal(req.body.input[1].content[0].signature, 'sig-1');
  assert.equal(second.served?.route, `${ROUTE}2`);
  assert.deepEqual(tierTarget(config.tiers[1], turns), { format: 'anthropic', model: 'claude-sonnet-5-5', route: ROUTE });
});

test('the owner makes another tier the default mid-conversation: no route (it is bound to its tier), the new tier’s format', async () => {
  const before: PublicConfig = { ...TIERED, tiers: [...TIERED.tiers.slice(0, 2), tier('pro', 'openai', 'gpt-6-astra', { order: 2 })] };
  const after: PublicConfig = { ...before, tiers: before.tiers.map((t) => ({ ...t, default: t.id === 'pro' })) };
  let config = before;
  const turns: Turn[] = [{ role: 'user', text: 'Hello' }];
  const { server, p } = setup([served(textStream('One'), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE), served(openaiStream('Two'), 'openai', 'gpt-6-astra', 'pro', 'r2')], () => config);
  keep(turns, await p.call(request('standard', turns)), 'standard');
  turns.push({ role: 'user', text: 'Harder' });
  config = after;
  await p.call(request('standard', turns));
  const [, req] = server.relayRequests();
  assert.equal(req.body.tier, 'pro');
  assert.equal(req.body.provider, 'openai');
  assert.equal(req.body.route, undefined);
  assert.ok(!JSON.stringify(req.body.input).includes('sig-1'), 'no other provider’s raw output');
});

test('tier_moved: rebuilt for the tier’s new provider and sent once more without a route, never with the other raw output', async () => {
  const turns: Turn[] = [{ role: 'user', text: 'Hello' }];
  const { server, p, refreshed } = setup([
    served(textStream('One'), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE),
    error('tier_moved', 409, { tier: { id: 'standard', provider: 'openai' } }),
    served(openaiStream('Two'), 'openai', 'gpt-6-astra', 'standard', 'r-openai'),
  ]);
  keep(turns, await p.call(request('standard', turns)), 'standard');
  turns.push({ role: 'user', text: 'And?' });
  const reply = await p.call(request('standard', turns));
  const [, moved, retry] = server.relayRequests();
  assert.equal(moved.body.route, ROUTE);
  assert.equal(moved.body.provider, 'anthropic');
  assert.equal(retry.body.provider, 'openai');
  assert.equal(retry.body.tier, 'standard');
  assert.equal(retry.body.route, undefined);
  assert.ok(Array.isArray(retry.body.input) && retry.body.input.some((i: { role?: string }) => i.role === 'assistant'), 'history rebuilt in OpenAI’s form');
  assert.ok(!JSON.stringify(retry.body.input).includes('sig-1'), 'Anthropic’s raw output is not replayed to OpenAI');
  assert.equal(reply.text, 'Two');
  assert.deepEqual(reply.served, { provider: 'openai', model: 'gpt-6-astra', tier: 'standard', route: 'r-openai' });
  assert.match(reply.notice ?? '', /another AI/);
  assert.equal(server.relayRequests().length, 3);
  assert.ok(refreshed() >= 1, 'the configuration is read again');
});

test('tier_moved twice: retried once, not twice; the error says so', async () => {
  const { server, p } = setup([error('tier_moved', 409, { tier: { id: 'standard', provider: 'openai' } }), error('tier_moved', 409, { tier: { id: 'standard', provider: 'gemini' } })]);
  await assert.rejects(p.call(request('standard', [{ role: 'user', text: 'Hi' }])), (e: unknown) => e instanceof RelayError && e.kind === 'tier_moved' && /Send it again/.test(e.message));
  assert.equal(server.relayRequests().length, 2);
  assert.deepEqual(server.relayRequests().map((r) => r.body.provider), ['anthropic', 'openai']);
});

test('tier_unknown: the configuration is read again, nothing was sent or charged, a clear message (both languages)', async () => {
  const { server, p, refreshed } = setup([error('tier_unknown', 400)]);
  await assert.rejects(p.call(request('standard', [{ role: 'user', text: 'Hi' }])), (e: unknown) => {
    assert.ok(e instanceof RelayError && e.kind === 'tier_unknown');
    assert.match(e.message, /AI settings have just changed/);
    assert.ok(nothingSent(e), 'the message can go back into the input');
    return true;
  });
  assert.equal(server.relayRequests().length, 1);
  assert.equal(refreshed(), 1);
  const { setLanguage } = await import('../../src/i18n/index.ts');
  setLanguage('tr');
  try {
    assert.match(new RelayError('tier_unknown', 400).message, /az önce değişti/);
    assert.match(new RelayError('tier_unavailable', 503).message, /geçici olarak kullanılamıyor/);
  } finally {
    setLanguage('en');
  }
});

test('tier_unknown after the owner renamed the default tier: /config read again and sent once on the new default; never twice', async () => {
  const renamed: PublicConfig = { ...TIERED, tiers: TIERED.tiers.map((t) => (t.id === 'standard' ? { ...t, id: 'everyday' } : t)) };
  let config = TIERED;
  const { server, p } = setup([error('tier_unknown', 400), served(textStream('Hi'), 'anthropic', 'claude-sonnet-5-5', 'everyday', ROUTE)], () => config);
  const call = p.call(request('pro', [{ role: 'user', text: 'Hi' }]));
  config = renamed;
  const reply = await call;
  assert.equal(reply.text, 'Hi');
  assert.deepEqual(server.relayRequests().map((r) => r.body.tier), ['standard', 'everyday']);

  let flip = 0;
  const again = setup([error('tier_unknown', 400), error('tier_unknown', 400), textStream('never')], () => (flip++ % 2 ? renamed : TIERED));
  await assert.rejects(again.p.call(request('', [{ role: 'user', text: 'Hi' }])), (e: unknown) => e instanceof RelayError && e.kind === 'tier_unknown');
  assert.equal(again.server.relayRequests().length, 2);
});

test('tier_unavailable (Retry-After 300): not waited out, said plainly, nothing charged', async () => {
  const { server, p } = setup([error('tier_unavailable', 503, {}, { 'Retry-After': '300' })]);
  await assert.rejects(p.call(request('fast', [{ role: 'user', text: 'Hi' }])), (e: unknown) => {
    assert.ok(e instanceof RelayError && e.kind === 'tier_unavailable');
    assert.match(e.message, /temporarily unavailable/);
    assert.ok(nothingSent(e));
    return true;
  });
  assert.equal(server.relayRequests().length, 1);
});

test('an older server: the direct form with the model, even when the stored choice is a tier name it doesn’t know', async () => {
  const { server, p } = setup([textStream('Hi')], CONFIG);
  await p.call(request('claude-sonnet-5-5', [{ role: 'user', text: 'Hi' }]));
  const [req] = server.relayRequests();
  assert.equal(req.body.model, 'claude-sonnet-5-5');
  assert.equal(req.body.tier, undefined);
  assert.equal(req.body.route, undefined);
});

test('an answer in another format than the request’s is never handed to the parser; its charge still counts', async () => {
  const { p } = setup([served(openaiStream('x'), 'openai', 'gpt-6-astra', 'standard', ROUTE)]);
  const streamed: string[] = [];
  await assert.rejects(p.call(request('standard', [{ role: 'user', text: 'Hi' }], { onText: (d) => streamed.push(d) })), (e: unknown) => {
    assert.ok(e instanceof RelayError && e.kind === 'bad_response');
    assert.equal(failedRequestCost(e)?.credits, 1_500);
    return true;
  });
  assert.deepEqual(streamed, []);
});

// ---------- pause_turn ----------

test('a paused answer is continued: step + 1, the same options, the continuation, the paused turn appended unchanged as its own message', async () => {
  const turns: Turn[] = [{ role: 'user', text: 'Research this' }];
  const { server, p } = setup([
    served(pausedStream(1), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE),
    served(pausedStream(2), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE),
    served(textStream('Done'), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE),
  ]);
  const meter = createAnswerMeter('qutai', 'standard');
  const base = { webSearch: true, research: true };
  let step = 0;
  let continuation: string | undefined;
  for (;;) {
    const reply = await p.call(request('standard', turns, { ...base, agent: { step, memoryTools: true, ...(continuation ? { continuation } : {}) } }));
    meter.add(reply.cost);
    keep(turns, reply, 'standard');
    if (reply.stop !== 'pause') break;
    const next = continueAfterPause(reply.continuation, step, 40, Date.now());
    assert.ok(next);
    continuation = next.continuation;
    step++;
  }
  const [first, second, third] = server.relayRequests();
  assert.equal(first.body.continuation, undefined);
  assert.equal(second.body.step, 1);
  assert.equal(second.body.continuation, 'cont-1');
  assert.deepEqual(second.body.options, first.body.options);
  assert.equal(second.body.route, ROUTE);
  const last = second.body.input.at(-1);
  assert.equal(last.role, 'assistant');
  assert.deepEqual(last.content, [
    { type: 'text', text: 'Searching 1' },
    { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'q1' } },
    { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://example.test/', title: 'T', encrypted_content: 'enc' }] },
  ]);
  // Paused again: that turn goes as its own assistant message after the first, never joined to it.
  assert.equal(third.body.step, 2);
  assert.equal(third.body.continuation, 'cont-2');
  const [a, b] = third.body.input.slice(-2);
  assert.equal(a.role, 'assistant');
  assert.equal(b.role, 'assistant');
  assert.equal(a.content[1].id, 'srvtoolu_1');
  assert.equal(b.content[1].id, 'srvtoolu_2');
  assert.equal(b.content.length, 3);
  // Each part's charge counted once.
  assert.equal(meter.result()?.credits, 3_000 + 3_000 + 2_000);
  assert.equal(meter.result()?.requests, 3);
});

test('a paused answer without streaming: the continuation from the headers', async () => {
  const body = { content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } }], stop_reason: 'pause_turn', usage: { input_tokens: 5, output_tokens: 5 } };
  const res = served(
    json(body, 200, { 'X-Qutai-Charged': '700', 'X-Qutai-Balance': '1', 'X-Qutai-Continuation': 'cont-json', 'X-Qutai-Continuation-Expires': String(Date.now() + 60_000) }),
    'anthropic',
    'claude-sonnet-5-5',
    'standard',
    ROUTE,
  );
  const { p } = setup([res]);
  const reply = await p.call(request('standard', [{ role: 'user', text: 'Hi' }], { onText: undefined }));
  assert.equal(reply.stop, 'pause');
  assert.equal(reply.continuation?.continuation, 'cont-json');
  assert.equal(reply.cost?.credits, 700);
});

test('when a paused answer is not continued: no continuation, expired, or the step limit', () => {
  const now = 1_000_000;
  const pause = { continuation: 'c', expiresAt: now + 60_000 };
  assert.deepEqual(continueAfterPause(pause, 3, 40, now), pause);
  assert.equal(continueAfterPause(undefined, 3, 40, now), null);
  assert.equal(continueAfterPause({ ...pause, expiresAt: now }, 3, 40, now), null);
  assert.equal(continueAfterPause(pause, 39, 40, now), null, 'the next step would pass the limit');
});

test('a paused answer whose turn the server can’t sign carries no continuation', async () => {
  const { p } = setup([served(pausedStream(1, 3_000, null), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE)]);
  const reply = await p.call(request('standard', [{ role: 'user', text: 'Hi' }]));
  assert.equal(reply.stop, 'pause');
  assert.equal(reply.continuation, undefined);
  assert.equal(reply.cost?.credits, 3_000);
});

test('continuation_invalid ends the continuation (no retry, nothing charged); a tier move during one ends it too', async () => {
  const turns: Turn[] = [{ role: 'user', text: 'Hi' }];
  const first = setup([served(pausedStream(1), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE), error('continuation_invalid', 409)]);
  keep(turns, await first.p.call(request('standard', turns)), 'standard');
  await assert.rejects(first.p.call(request('standard', turns, { agent: { step: 1, memoryTools: false, continuation: 'cont-1' } })), (e: unknown) => {
    assert.ok(e instanceof RelayError && e.kind === 'continuation_invalid');
    assert.equal(failedRequestCost(e), undefined);
    return true;
  });
  assert.equal(first.server.relayRequests().length, 2);

  const moved = setup([error('tier_moved', 409, { tier: { id: 'standard', provider: 'openai' } })]);
  await assert.rejects(
    moved.p.call(request('standard', turns, { agent: { step: 1, memoryTools: false, continuation: 'cont-1' } })),
    (e: unknown) => e instanceof RelayError && e.kind === 'continuation_invalid',
  );
  assert.equal(moved.server.relayRequests().length, 1, 'a continuation is never rebuilt for another provider');
});

test('stopping during a continuation behaves like any stop: aborted, nothing more sent', async () => {
  const controller = new AbortController();
  const turns: Turn[] = [{ role: 'user', text: 'Hi' }];
  const { server, p } = setup([
    served(pausedStream(1), 'anthropic', 'claude-sonnet-5-5', 'standard', ROUTE),
    () => {
      controller.abort();
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    },
  ]);
  keep(turns, await p.call(request('standard', turns)), 'standard');
  await assert.rejects(
    p.call(request('standard', turns, { signal: controller.signal, agent: { step: 1, memoryTools: false, continuation: 'cont-1' } })),
    (e: unknown) => e instanceof Error && e.name === 'AbortError',
  );
  assert.equal(server.relayRequests().length, 2);
});

test('a forced /config refresh asks past the HTTP cache (the server allows a minute); ordinary reads don’t', async () => {
  const { createCreditsStore } = await import('../../src/credits/store.ts');
  const server = fakeServer({ config: TIERED });
  const client = server.client();
  await client.config();
  await client.config(true);
  const [plain, fresh] = server.requests.filter((r) => r.path === '/config');
  assert.equal(plain.headers['cache-control'], undefined);
  assert.equal(fresh.headers['cache-control'], 'no-cache');
  const asked: boolean[] = [];
  const store = createCreditsStore({
    client: () => null,
    publicClient: () => ({ ...client, config: (f?: boolean) => (asked.push(!!f), client.config(f)) }),
  });
  await store.config();
  await store.config(0);
  assert.deepEqual(asked, [false, true]);
});
