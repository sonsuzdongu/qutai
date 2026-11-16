/**
 * Unit tests for the approximate cost of answers: usage parsing per provider (src/ai/usage.ts, through the same
 * stream accumulators the app uses) and the cost maths (src/ai/cost.ts, src/ai/prices.ts).
 * Run: npm run test:cost (Node's built-in test runner, like scripts/account-tests/).
 *
 * The payloads are the providers' documented examples as read on 16 Nov 2026 (the page is named at each test).
 * Where a page lists the fields but its example could not be copied, the payload is built from the documented field
 * names with made-up numbers, and the test says so. No real provider was called.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAnswerMeter, formatUsd, parseAnswerCost, parseRequestCost, priceRequest, sumCosts } from '../../src/ai/cost.ts';
import { createChatAccumulator, fromChatResponse, toChatReply, buildChatBody } from '../../src/ai/chatWire.ts';
import { accumulateGeminiStream } from '../../src/ai/geminiStream.ts';
import { findPrice, PRICES, PRICES_AS_OF } from '../../src/ai/prices.ts';
import {
  anthropicUsage,
  chatUsage,
  EMPTY_USAGE,
  geminiUsage,
  mergeAnthropicStreamUsage,
  openaiUsage,
  totalTokens,
  type Usage,
} from '../../src/ai/usage.ts';

const usage = (u: Partial<Usage>): Usage => ({ ...EMPTY_USAGE, ...u });
const NOV_16 = Date.parse('2026-11-16T12:00:00Z');

describe('Anthropic usage', () => {
  it('reads the pricing page example (cache read and write, one web search)', () => {
    // platform.claude.com/docs/en/about-claude/pricing, web search usage example.
    const u = anthropicUsage({
      input_tokens: 105,
      output_tokens: 6039,
      cache_read_input_tokens: 7123,
      cache_creation_input_tokens: 7345,
      server_tool_use: { web_search_requests: 1 },
    });
    assert.deepEqual(u, usage({ input: 105, output: 6039, cacheRead: 7123, cacheWrite: 7345, searches: 1 }));
  });

  it('splits cache writes by TTL and reads thinking tokens when the response has them', () => {
    // Field names from the Messages API reference (cache_creation, output_tokens_details); numbers made up.
    const u = anthropicUsage({
      input_tokens: 10,
      output_tokens: 500,
      cache_creation_input_tokens: 300,
      cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
      output_tokens_details: { thinking_tokens: 120 },
    });
    assert.deepEqual(u, usage({ input: 10, output: 500, thinking: 120, cacheWrite: 100, cacheWriteLong: 200 }));
  });

  it('merges a stream: message_start, then message_delta with cumulative counts', () => {
    // platform.claude.com/docs/en/build-with-claude/streaming, web search stream example (verbatim data).
    const start = {
      type: 'message_start',
      message: {
        id: 'msg_01G...',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 2679, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 3 },
      },
    };
    const delta = {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: {
        input_tokens: 10682,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 510,
        server_tool_use: { web_search_requests: 1 },
      },
    };
    let merged = mergeAnthropicStreamUsage(undefined, start.message.usage);
    merged = mergeAnthropicStreamUsage(merged, delta.usage);
    assert.deepEqual(anthropicUsage(merged), usage({ input: 10682, output: 510, searches: 1 }));
  });

  it('keeps message_start input when message_delta carries only output (basic stream example)', () => {
    let merged = mergeAnthropicStreamUsage(undefined, { input_tokens: 25, output_tokens: 1 });
    merged = mergeAnthropicStreamUsage(merged, { output_tokens: 15 });
    assert.deepEqual(anthropicUsage(merged), usage({ input: 25, output: 15 }));
  });
});

describe('OpenAI Responses usage', () => {
  it('takes cache reads and writes out of input_tokens (prompt caching guide example)', () => {
    // developers.openai.com/api/docs/guides/prompt-caching: 12000 input, 4000 cached, 7000 written: 1000 ordinary.
    const u = openaiUsage(
      {
        input_tokens: 12000,
        input_tokens_details: {
          cached_tokens: 4000,
          cache_write_tokens: 7000,
          cache_write_tokens_details: { ttl_30m_tokens: 5000, ttl_12h_tokens: 2000 },
        },
        output_tokens: 10,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 12010,
      },
      [],
    );
    assert.deepEqual(u, usage({ input: 1000, cacheRead: 4000, cacheWrite: 5000, cacheWriteLong: 2000, output: 10 }));
  });

  it('counts reasoning inside output and one search per web_search_call item (reasoning guide example)', () => {
    // developers.openai.com/api/docs/guides/reasoning: 75 input, 1186 output of which 1024 reasoning.
    const u = openaiUsage(
      {
        input_tokens: 75,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 1186,
        output_tokens_details: { reasoning_tokens: 1024 },
        total_tokens: 1261,
      },
      [{ type: 'reasoning' }, { type: 'web_search_call', action: { query: 'a' } }, { type: 'web_search_call' }, { type: 'message' }],
    );
    assert.deepEqual(u, usage({ input: 75, output: 1186, thinking: 1024, searches: 2 }));
  });

  it('counts cache writes without a TTL split at the short price', () => {
    const u = openaiUsage({ input_tokens: 100, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 60 }, output_tokens: 1 }, []);
    assert.deepEqual(u, usage({ input: 40, cacheWrite: 60, output: 1 }));
  });
});

describe('Gemini Interactions usage', () => {
  it('adds thinking to output and keeps usage from interaction.completed in a stream', () => {
    // aistudio.google.com/docs/streaming, interaction.completed example for gemini-4-hydrogen (numbers as documented).
    const interaction = accumulateGeminiStream([
      { event_type: 'interaction.created', interaction: { status: 'in_progress' } },
      { event_type: 'step.start', index: 0, step: { type: 'model_output', content: [{ type: 'text', text: 'Hi' }] } },
      { event_type: 'step.stop', index: 0 },
      {
        event_type: 'interaction.completed',
        interaction: {
          status: 'completed',
          service_tier: 'standard',
          object: 'interaction',
          usage: {
            total_tokens: 346,
            total_input_tokens: 11,
            input_tokens_by_modality: [{ modality: 'text', tokens: 11 }],
            total_cached_tokens: 0,
            total_output_tokens: 90,
            total_tool_use_tokens: 0,
            total_thought_tokens: 245,
          },
        },
      },
    ]);
    const u = geminiUsage(interaction.usage);
    assert.deepEqual(u, usage({ input: 11, output: 335, thinking: 245 }));
    assert.equal(totalTokens(u!), 346);
  });

  it('counts cached tokens apart from input and Google Search queries from grounding_tool_count', () => {
    // Field names from the Interactions API reference; numbers made up.
    const u = geminiUsage({
      total_input_tokens: 5000,
      total_cached_tokens: 3000,
      total_output_tokens: 200,
      total_thought_tokens: 50,
      total_tool_use_tokens: 400,
      grounding_tool_count: [
        { type: 'google_search', count: 3 },
        { type: 'google_maps', count: 1 },
      ],
    });
    assert.deepEqual(u, usage({ input: 2400, cacheRead: 3000, output: 250, thinking: 50, searches: 3 }));
  });
});

describe('Chat Completions usage (OpenRouter, custom endpoint)', () => {
  // OpenRouter's usage-accounting page lists these fields (its example could not be copied): numbers made up.
  const openrouterUsage = {
    prompt_tokens: 1000,
    completion_tokens: 300,
    total_tokens: 1300,
    prompt_tokens_details: { cached_tokens: 400, cache_write_tokens: 100 },
    completion_tokens_details: { reasoning_tokens: 120 },
    cost: 0.00123,
    is_byok: false,
    cost_details: { upstream_inference_cost: null },
    server_tool_use_details: { web_search_requests: 2 },
  };

  it('reads OpenRouter usage and its reported cost', () => {
    assert.deepEqual(
      chatUsage(openrouterUsage, 'openrouter'),
      usage({ input: 500, cacheRead: 400, cacheWrite: 100, output: 300, thinking: 120, searches: 2, reportedNanos: 1_230_000 }),
    );
  });

  it("adds the provider's charge to OpenRouter's fee with the user's own key (is_byok)", () => {
    const u = chatUsage({ ...openrouterUsage, cost: 0.0001, is_byok: true, cost_details: { upstream_inference_cost: 0.002 } }, 'openrouter');
    assert.equal(u?.reportedNanos, 2_100_000);
  });

  it('never trusts a cost field from a custom endpoint', () => {
    assert.equal(chatUsage(openrouterUsage, 'custom')?.reportedNanos, undefined);
  });

  it("reads OpenRouter's final stream chunk (one choice with an empty delta, usage at the top level)", () => {
    // openrouter.ai/docs/api-reference/streaming: the usage chunk repeats finish_reason, then [DONE].
    const acc = createChatAccumulator();
    acc.push({ choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null }] });
    acc.push({ choices: [{ index: 0, delta: {}, finish_reason: 'stop', native_finish_reason: 'stop' }] });
    acc.push({
      choices: [{ index: 0, delta: { content: '', role: 'assistant' }, finish_reason: 'stop', native_finish_reason: 'stop' }],
      usage: openrouterUsage,
    });
    const reply = toChatReply(acc.finish(), 'openrouter');
    assert.equal(reply.text, 'Hello');
    assert.equal(reply.usage?.reportedNanos, 1_230_000);
    assert.equal(reply.usage?.output, 300);
  });

  it("reads OpenAI's stream usage chunk (empty choices) and a non-streamed response", () => {
    // OpenAI chat object: with stream_options.include_usage, a last chunk with empty choices carries the usage.
    const acc = createChatAccumulator();
    acc.push({ choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: 'stop' }], usage: null });
    acc.push({ choices: [], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } });
    assert.deepEqual(toChatReply(acc.finish(), 'custom').usage, usage({ input: 20, output: 5 }));

    const res = fromChatResponse({
      choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10, prompt_tokens_details: { cached_tokens: 2 } },
    });
    assert.deepEqual(toChatReply(res, 'custom').usage, usage({ input: 5, cacheRead: 2, output: 3 }));
  });

  it('asks for stream usage only when streaming and asked to', () => {
    const base = { model: 'm', system: 's', tools: [], turns: [], provider: 'custom' as const };
    assert.deepEqual(buildChatBody({ ...base, stream: true, streamUsage: true }).stream_options, { include_usage: true });
    assert.equal(buildChatBody({ ...base, stream: false, streamUsage: true }).stream_options, undefined);
    assert.equal(buildChatBody({ ...base, stream: true }).stream_options, undefined);
  });

  it('has no usage when the server sent none', () => {
    const acc = createChatAccumulator();
    acc.push({ choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: 'stop' }] });
    assert.equal(toChatReply(acc.finish(), 'custom').usage, undefined);
  });
});

describe('price table', () => {
  it('has a source and a read date on every row, and whole micro-dollar prices', () => {
    for (const row of PRICES) {
      assert.match(row.source, /^https:\/\//);
      assert.match(row.read, /^\d{4}-\d{2}-\d{2}$/);
      for (const v of [row.input, row.output, row.cacheRead, row.cacheWrite, row.cacheWriteLong, row.search])
        if (v !== undefined) assert.ok(Number.isSafeInteger(v) && v >= 0);
    }
    assert.match(PRICES_AS_OF, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('picks the prompt-size tier: over 100,000 tokens for Claude Haiku 5.5, over 272,000 for OpenAI', () => {
    assert.equal(findPrice('anthropic', 'claude-haiku-5-5', 100_000, NOV_16)?.above, undefined);
    assert.equal(findPrice('anthropic', 'claude-haiku-5-5', 100_001, NOV_16)?.above, 100_000);
    assert.equal(findPrice('openai', 'gpt-5.6-terra', 272_000, NOV_16)?.input, 2_000_000);
    assert.equal(findPrice('openai', 'gpt-5.6-terra', 272_001, NOV_16)?.input, 4_000_000);
  });

  it('follows announced price changes by date (UTC days)', () => {
    assert.equal(findPrice('gemini', 'gemini-4-carbon', 0, Date.parse('2026-11-30T23:59:59Z'))?.input, 2_000_000);
    assert.equal(findPrice('gemini', 'gemini-4-carbon', 0, Date.parse('2026-12-01T00:00:00Z'))?.input, 4_000_000);
    assert.equal(findPrice('gemini', 'gemini-3.8-flash', 0, Date.parse('2027-01-01T00:00:00Z'))?.output, 7_500_000);
  });

  it('has no price for OpenRouter, the custom endpoint or an unknown model', () => {
    assert.equal(findPrice('openrouter', 'anthropic/claude-sonnet-5-5', 10, NOV_16), null);
    assert.equal(findPrice('custom', 'llama', 10, NOV_16), null);
    assert.equal(findPrice('anthropic', 'claude-unknown', 10, NOV_16), null);
  });
});

describe('cost maths', () => {
  it('prices the Anthropic pricing page example on Claude Sonnet 5.5 exactly', () => {
    // 105 × $2 + 7123 × $0.10 + 7345 × $2.50 + 6039 × $10 per million, plus one search at $10 per 1,000.
    const cost = priceRequest(
      'anthropic',
      'claude-sonnet-5-5',
      usage({ input: 105, output: 6039, cacheRead: 7123, cacheWrite: 7345, searches: 1 }),
      NOV_16,
    );
    assert.equal(cost.nanos, 89_674_800);
    assert.equal(cost.source, 'list');
    assert.equal(cost.pricesAsOf, PRICES_AS_OF);
  });

  it('prices the whole request at the higher tier, counting cache reads toward the threshold', () => {
    // Claude Haiku 5.5: 1,000 input + 99,500 cache reads = 100,500 > 100,000.
    const cost = priceRequest('anthropic', 'claude-haiku-5-5', usage({ input: 1000, cacheRead: 99_500, output: 100 }), NOV_16);
    // 1000 × 0.50 + 99,500 × 0.05 + 100 × 2.50 = 500 + 4975 + 250 micro-dollars.
    assert.equal(cost.nanos, 5_725_000);
  });

  it('adds Gemini thinking at the output price', () => {
    const cost = priceRequest('gemini', 'gemini-4-hydrogen', usage({ input: 11, output: 335, thinking: 245 }), NOV_16);
    // 11 × $1.50 + 335 × $7.50 per million = 16.5 + 2512.5 micro-dollars.
    assert.equal(cost.nanos, 2_529_000);
  });

  it('rounds to nano-dollars once, without floating-point drift', () => {
    // 3 tokens at $0.10 per million is 0.3 micro-dollars: exactly 300 nano-dollars (0.1 + 0.2 style sums stay exact).
    const one = priceRequest('anthropic', 'claude-haiku-5-5', usage({ input: 1 }), NOV_16).nanos!;
    const three = priceRequest('anthropic', 'claude-haiku-5-5', usage({ input: 3 }), NOV_16).nanos!;
    assert.equal(one, 100);
    assert.equal(three, 300);
    assert.equal(one + one + one, three);
  });

  it("prefers the provider's reported cost, and shows tokens only without a price", () => {
    assert.deepEqual(priceRequest('openrouter', 'x/y', usage({ input: 1, reportedNanos: 42 }), NOV_16).nanos, 42);
    assert.equal(priceRequest('openrouter', 'x/y', usage({ input: 1, reportedNanos: 42 }), NOV_16).source, 'provider');
    const custom = priceRequest('custom', 'llama', usage({ input: 1000, output: 10 }), NOV_16);
    assert.equal(custom.nanos, undefined);
    assert.equal(custom.source, undefined);
  });

  it('has no price when a token kind used has no price (a cache write on Gemini)', () => {
    assert.equal(priceRequest('gemini', 'gemini-4-hydrogen', usage({ cacheWrite: 10 }), NOV_16).nanos, undefined);
  });

  it('sums an answer over its requests; one unpriced request leaves tokens only', () => {
    const meter = createAnswerMeter('anthropic', 'claude-sonnet-5-5');
    meter.add(priceRequest('anthropic', 'claude-sonnet-5-5', usage({ input: 1000, output: 100 }), NOV_16));
    meter.add(priceRequest('anthropic', 'claude-sonnet-5-5', usage({ input: 2000, output: 200, cacheRead: 1000 }), NOV_16));
    meter.add(undefined);
    const result = meter.result()!;
    assert.equal(result.requests, 3);
    assert.equal(result.reported, 2);
    // 3000 × $2 + 300 × $10 + 1000 × $0.10 per million = 6000 + 3000 + 100 micro-dollars.
    assert.equal(result.nanos, 9_100_000);
    assert.deepEqual(result.usage, usage({ input: 3000, output: 300, cacheRead: 1000 }));

    const mixed = createAnswerMeter('custom', 'llama');
    mixed.add(priceRequest('custom', 'llama', usage({ input: 5 }), NOV_16));
    assert.equal(mixed.result()!.nanos, undefined);
    assert.equal(createAnswerMeter('custom', 'x').result(), null);
  });

  it('adds answers up only when all are priced', () => {
    assert.deepEqual(sumCosts([{ nanos: 10, usage: usage({ input: 1 }) }, { nanos: 5, usage: usage({ output: 2 }) }]), { nanos: 15, tokens: 3 });
    assert.deepEqual(sumCosts([{ nanos: 10, usage: usage({ input: 1 }) }, { usage: usage({ output: 2 }) }]), { tokens: 3 });
  });

  it('formats dollars from whole nano-dollars', () => {
    assert.equal(formatUsd(0), '$0');
    assert.equal(formatUsd(50_000), '< $0.0001');
    assert.equal(formatUsd(2_529_000), '$0.0025');
    assert.equal(formatUsd(89_674_800), '$0.090');
    assert.equal(formatUsd(12_345_678), '$0.012');
    assert.equal(formatUsd(1_234_567_890), '$1.23');
    assert.equal(formatUsd(1_235_000_000, ','), '$1,24');
  });

  it('reads stored figures back as numbers only', () => {
    const stored = { provider: 'anthropic', model: 'claude-sonnet-5-5', requests: 2, reported: 3, usage: { input: 5, output: 'x', extra: 1 }, nanos: 7, source: 'list', pricesAsOf: '2026-11-16', text: 'no' };
    assert.deepEqual(parseAnswerCost(stored), {
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      requests: 2,
      reported: 2,
      usage: usage({ input: 5 }),
      nanos: 7,
      source: 'list',
      pricesAsOf: '2026-11-16',
    });
    assert.equal(parseAnswerCost({ ...stored, provider: 'evil' }), undefined);
    assert.deepEqual(parseRequestCost({ usage: { input: -1 }, nanos: 1.5 }), { usage: usage({}) });
  });
});
