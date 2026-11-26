// A streamed answer that doesn't end properly is not a finished answer (26 Nov 2026 code review). An Anthropic stream
// that closes before message_delta's stop reason is an error; a Chat Completions reply whose tool call has half its
// arguments runs no tool; Gemini's "try again without streaming" isn't used for refusals that have nothing to do with
// streaming (a second request may be billed); and a stream with no data for ten minutes ends with a timeout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callAnthropic } from '../../src/ai/anthropic.ts';
import { toChatReply } from '../../src/ai/chatWire.ts';
import { streamFailed } from '../../src/ai/gemini.ts';
import { GeminiStreamError } from '../../src/ai/geminiStream.ts';
import { ApiError } from '../../src/ai/http.ts';
import { plainError } from '../../src/ai/plainError.ts';
import { readOrStall, StreamStalledError } from '../../src/ai/stall.ts';
import type { ModelRequest } from '../../src/ai/types.ts';
import type { Wire } from '../../src/ai/wire.ts';

function wireOf(events: unknown[]): Wire {
  return {
    replayAs: 'anthropic',
    json: async () => {
      throw new Error('not streamed');
    },
    sse: async (_url, _headers, _body, _signal, onEvent) => {
      for (const data of events) onEvent({ event: 'message', data });
    },
  };
}

function request(onText: (delta: string) => void): ModelRequest {
  return {
    apiKey: 'test-key',
    model: 'claude-sonnet-5-5',
    system: 'System',
    tools: [],
    turns: [{ role: 'user', text: 'Hello' }],
    signal: new AbortController().signal,
    audit: { conversation: 'c', incognito: false, host: null },
    onText,
  } as ModelRequest;
}

const START = [
  { type: 'message_start', message: { usage: { input_tokens: 5, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Half an ans' } },
];

test('Anthropic: a stream that closes before its stop reason is an error, not an answer', async () => {
  let shown = '';
  await assert.rejects(
    callAnthropic(request((d) => (shown += d)), wireOf(START)),
    /ended unexpectedly/,
  );
  assert.equal(shown, 'Half an ans');
});

test('Anthropic: a tool call cut off mid-input is never returned as a call with empty input', async () => {
  const events = [
    START[0],
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't1', name: 'click', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"ref": "e' } },
  ];
  await assert.rejects(callAnthropic(request(() => {}), wireOf(events)), /ended unexpectedly/);
});

test('Anthropic: a complete stream is read as before', async () => {
  const reply = await callAnthropic(
    request(() => {}),
    wireOf([
      ...START,
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } },
      { type: 'message_stop' },
    ]),
  );
  assert.equal(reply.text, 'Half an ans');
  assert.equal(reply.stop, 'end');
});

const chatCall = (args: string) => ({
  message: {
    role: 'assistant' as const,
    content: null,
    tool_calls: [{ id: 'c1', type: 'function' as const, function: { name: 'click', arguments: args } }],
  },
  finishReason: null,
  usage: undefined,
});

test('Chat Completions: half a call’s arguments means the reply was cut off, and no tool runs', () => {
  const reply = toChatReply(chatCall('{"ref": "e'));
  // runAgent runs tools only for 'tool_use'; any other stop answers each call "Not executed: the response was cut off".
  assert.equal(reply.stop, 'max_tokens');
  assert.deepEqual(reply.toolCalls[0].input, {});
});

test('Chat Completions: whole arguments, and none at all, still run', () => {
  assert.equal(toChatReply(chatCall('{"ref": "e12"}')).stop, 'tool_use');
  assert.deepEqual(toChatReply(chatCall('{"ref": "e12"}')).toolCalls[0].input, { ref: 'e12' });
  assert.equal(toChatReply(chatCall('')).stop, 'tool_use');
});

test('Gemini: only a rejected request or a broken stream is repeated without streaming', () => {
  for (const status of [401, 403, 429, 500, 503]) {
    assert.equal(streamFailed(new ApiError(`API error ${status}`, status)), false, `${status} is not repeated`);
  }
  assert.equal(streamFailed(new ApiError('API error 400', 400)), true);
  assert.equal(streamFailed(new GeminiStreamError('cut', 'incomplete')), true);
  assert.equal(streamFailed(new GeminiStreamError('blocked', 'blocked')), false);
  assert.equal(streamFailed(new Error('other')), false);
});

test('a stream with no data ends with a timeout and closes the connection', async () => {
  let cancelled = false;
  const silent = {
    read: () => new Promise<never>(() => {}),
    cancel: async () => {
      cancelled = true;
    },
  };
  const error = await readOrStall(silent, 20).then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(error instanceof StreamStalledError);
  assert.equal(cancelled, true);
  assert.equal(plainError(error).kind, 'timeout');
});

test('a stream that keeps sending is read as it comes', async () => {
  const reader = { read: async () => ({ done: false, value: 1 }), cancel: async () => {} };
  assert.deepEqual(await readOrStall(reader, 20), { done: false, value: 1 });
});
