// Long conversations get a bounded request (PERF-11, 20 Nov 2026 code review): a very long synthetic conversation
// through the app's real history functions and each provider format's real request builder (Anthropic, OpenAI,
// Gemini, and the chat-completions format of OpenRouter, Cloudflare and the custom endpoint; Qutai Credits sends
// one of the first three through its relay wire). The request stays bounded, a tool call never loses its result, the
// current message and its task are sent whole, and the cached prefix does not change within a task.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  boundHistory,
  compactHistory,
  LEFT_OUT_NOTE,
  MAX_HISTORY_CHARS,
  releaseOldImages,
  requestHistory,
  turnSize,
} from '../../src/agent/history';
import { callAnthropic } from '../../src/ai/anthropic';
import { buildChatBody } from '../../src/ai/chatWire';
import { callGemini } from '../../src/ai/gemini';
import { callOpenAI } from '../../src/ai/openai';
import type { ModelRequest, ProviderId, Turn } from '../../src/ai/types';
import type { Wire } from '../../src/ai/wire';

const page = (n: number) => `Page ${n}: ` + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(90);
const shot = { mediaType: 'image/jpeg', data: 'A'.repeat(200_000) };

/** One message and its task: `steps` tool calls with page-sized results (one a screenshot), then an answer. */
function exchange(turns: Turn[], n: number, steps = 4) {
  turns.push({ role: 'user', text: `Message ${n}: compare the prices on these pages, please. `.repeat(3) });
  for (let s = 0; s < steps; s++) {
    const id = `m${n}s${s}`;
    turns.push({ role: 'assistant', text: '', toolCalls: [{ id, name: 'read_page', input: {} }], raw: null, rawProvider: 'anthropic', rawModel: 'm' });
    turns.push({
      role: 'tool_results',
      results: [{ callId: id, name: s === 1 ? 'view_screenshot' : 'read_page', content: s === 1 ? 'Screenshot.' : page(n), isError: false, ...(s === 1 ? { images: [shot] } : {}) }],
    });
  }
  turns.push({ role: 'assistant', text: `Answer ${n}: ` + 'The cheapest is the second shop. '.repeat(40), toolCalls: [], raw: null, rawProvider: 'anthropic', rawModel: 'm' });
}

function longConversation(messages: number): Turn[] {
  const turns: Turn[] = [];
  for (let n = 0; n < messages; n++) exchange(turns, n);
  return turns;
}

const size = (turns: Turn[]) => turns.reduce((sum, t) => sum + turnSize(t), 0);

function assertPaired(turns: Turn[]) {
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.role !== 'assistant' || !turn.toolCalls.length || i === turns.length - 1) continue;
    const next = turns[i + 1];
    assert.equal(next.role, 'tool_results', `call at ${i} has no results`);
    assert.deepEqual(
      next.role === 'tool_results' && next.results.map((r) => r.callId),
      turn.toolCalls.map((c) => c.id),
    );
  }
}

test('a very long conversation: the request is bounded, starts at a message with a note, keeps every pair', () => {
  const turns = longConversation(400);
  exchange(turns, 400);
  const full = size(compactHistory(turns));
  const sent = requestHistory(turns);
  assert.ok(full > 3 * MAX_HISTORY_CHARS, `the synthetic conversation is long (${full})`);
  const lastUser = sent.findLastIndex((t) => t.role === 'user');
  assert.ok(size(sent.slice(0, lastUser)) <= MAX_HISTORY_CHARS, 'earlier part within the limit');
  assert.equal(sent[0].role, 'user');
  assert.ok(sent[0].role === 'user' && sent[0].text.startsWith(LEFT_OUT_NOTE));
  assertPaired(sent);
  // The current message and its task are sent whole (as compacted).
  const compacted = compactHistory(turns);
  const tail = compacted.slice(compacted.findLastIndex((t) => t.role === 'user'));
  assert.deepEqual(sent.slice(lastUser), tail);
  // The same history always gives the same request.
  assert.deepEqual(requestHistory(turns), sent);
  // At most one image is sent (the newest screenshot).
  assert.equal(sent.flatMap((t) => (t.role === 'tool_results' ? t.results.flatMap((r) => r.images ?? []) : [])).length, 1);
});

test('a short conversation is sent exactly as before', () => {
  const turns = longConversation(5);
  assert.deepEqual(requestHistory(turns), compactHistory(turns));
  const compacted = compactHistory(turns);
  assert.equal(boundHistory(compacted), compacted, 'the same array, untouched');
});

test('within a task, every step\'s request starts with the previous one (the cache keeps working)', () => {
  const turns = longConversation(300);
  turns.push({ role: 'user', text: 'One more thing.' });
  let previous: Turn[] | null = null;
  for (let s = 0; s < 12; s++) {
    const id = `last${s}`;
    turns.push({ role: 'assistant', text: '', toolCalls: [{ id, name: 'read_page', input: {} }], raw: null, rawProvider: 'anthropic', rawModel: 'm' });
    turns.push({ role: 'tool_results', results: [{ callId: id, name: 'read_page', content: 'short', isError: false }] });
    const sent = requestHistory(turns);
    if (previous) assert.deepEqual(sent.slice(0, previous.length), previous, `step ${s} changed the history before it`);
    previous = sent;
  }
});

test('from message to message, the start of the history changes only once in a while', () => {
  const turns: Turn[] = [];
  let starts = 0;
  let first: string | null = null;
  for (let n = 0; n < 400; n++) {
    exchange(turns, n);
    const sent = requestHistory(turns);
    const head = sent[0].role === 'user' ? sent[0].text : '';
    if (head !== first) starts++;
    first = head;
  }
  // Without the block cut the start would move with almost every message once the limit is reached.
  assert.ok(starts < 40, `the start changed ${starts} times in 400 messages`);
});

test('old screenshots leave memory without changing any request', () => {
  const turns = longConversation(6);
  const before = JSON.stringify(compactHistory(turns));
  releaseOldImages(turns);
  const held = turns.flatMap((t) => (t.role === 'tool_results' ? t.results.flatMap((r) => r.images ?? []) : [])).length;
  assert.equal(held, 1, 'only the newest screenshot is held');
  assert.equal(JSON.stringify(compactHistory(turns)), before);
});

/** The body a provider adapter builds, caught before it is sent. */
async function bodyFor(call: (req: ModelRequest, wire: Wire) => Promise<unknown>, provider: ProviderId, turns: Turn[]) {
  let body: Record<string, unknown> | null = null;
  const wire: Wire = {
    replayAs: provider,
    json: async (_url, _headers, b) => {
      body = b;
      throw new Error('caught');
    },
    sse: async (_url, _headers, b) => {
      body = b;
      throw new Error('caught');
    },
  };
  await call(
    {
      apiKey: 'k',
      model: 'test-model',
      system: 'You are Qutai.',
      tools: [],
      webSearch: false,
      turns,
      signal: new AbortController().signal,
      audit: { conversation: 'c', incognito: false, host: null, resultHosts: new Map() } as never,
    },
    wire,
  ).catch(() => {});
  assert.ok(body, 'the adapter built a body');
  return body as Record<string, unknown>;
}

/** Every call id has its result id in the body (whatever the format's names for them). */
function assertBodyPaired(calls: string[], results: string[], format: string) {
  assert.ok(calls.length > 0, format);
  assert.deepEqual([...results].sort(), [...calls].sort(), `${format}: every call has its result`);
}

test('each provider format: the request from a very long conversation is bounded and complete', async () => {
  const turns = longConversation(400);
  exchange(turns, 400);
  const sent = requestHistory(turns);
  const limit = MAX_HISTORY_CHARS * 2 + 300_000; // the earlier part, the current task, one screenshot's data

  type Block = { type: string; id?: string; tool_use_id?: string; cache_control?: unknown };
  const anthropic = await bodyFor(callAnthropic as never, 'anthropic', sent);
  const messages = anthropic.messages as { role: string; content: Block[] }[];
  assert.ok(JSON.stringify(anthropic).length < limit, `anthropic ${JSON.stringify(anthropic).length}`);
  const blocks = messages.flatMap((m) => m.content);
  assertBodyPaired(
    blocks.filter((b) => b.type === 'tool_use').map((b) => b.id!),
    blocks.filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id!),
    'anthropic',
  );
  assert.equal(messages[0].role, 'user');
  // The cache breakpoint is still on the last user message.
  const marked = messages.flatMap((m, i) => (m.content.some((b) => b.cache_control) ? [i] : []));
  assert.deepEqual(marked, [messages.findLastIndex((m) => m.role === 'user')]);

  const openai = await bodyFor(callOpenAI as never, 'openai', sent);
  const items = openai.input as { type?: string; call_id?: string }[];
  assert.ok(JSON.stringify(openai).length < limit, 'openai');
  assertBodyPaired(
    items.filter((i) => i.type === 'function_call').map((i) => i.call_id!),
    items.filter((i) => i.type === 'function_call_output').map((i) => i.call_id!),
    'openai',
  );

  const gemini = await bodyFor(callGemini as never, 'gemini', sent);
  const steps = gemini.input as { type: string; id?: string; call_id?: string }[];
  assert.ok(JSON.stringify(gemini).length < limit, 'gemini');
  assert.equal(steps[0].type, 'user_input');
  assertBodyPaired(
    steps.filter((x) => x.type === 'function_call').map((x) => x.id!),
    steps.filter((x) => x.type === 'function_result').map((x) => x.call_id!),
    'gemini',
  );

  for (const provider of ['openrouter', 'cloudflare', 'custom'] as ProviderId[]) {
    const chat = buildChatBody({ model: 'm', system: 'You are Qutai.', tools: [], turns: sent, provider, stream: false, maxTokens: 1000 });
    const msgs = chat.messages as { role: string; tool_calls?: { id: string }[]; tool_call_id?: string }[];
    assert.ok(JSON.stringify(chat).length < limit, provider);
    assertBodyPaired(
      msgs.flatMap((m) => m.tool_calls?.map((c) => c.id) ?? []),
      msgs.filter((m) => m.role === 'tool').map((m) => m.tool_call_id!),
      provider,
    );
  }
});
