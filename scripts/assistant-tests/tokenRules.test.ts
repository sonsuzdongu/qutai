/**
 * The token rules of docs/performance-2026-11.md: old page snapshots compacted in batches (src/agent/history.ts), so
 * the history sent stays a stable prefix for the providers' prompt caches, and the cache breakpoint on the last user
 * message of an Anthropic request (src/ai/anthropic.ts). Run: npm run test:assistant.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { callAnthropic, withHistoryBreakpoint } from '../../src/ai/anthropic.ts';
import type { ModelRequest, Turn } from '../../src/ai/types.ts';
import type { Wire } from '../../src/ai/wire.ts';
import { COMPACT_BATCH, COMPACT_THRESHOLD, compactHistory, KEEP_FULL_RESULTS } from '../../src/agent/history.ts';

const big = (n: number) => `Tab: t1\nURL: https://example.com/${n}\n` + `page ${n} `.repeat(COMPACT_THRESHOLD / 4);

/** A task of `n` read_page steps: user, then (assistant call, tool results) per step. */
function task(n: number): Turn[] {
  const turns: Turn[] = [{ role: 'user', text: 'Compare these pages.' }];
  for (let i = 0; i < n; i++) {
    turns.push({ role: 'assistant', text: '', toolCalls: [{ id: `c${i}`, name: 'read_page', input: {} }], raw: null, rawProvider: 'anthropic', rawModel: 'm' });
    turns.push({ role: 'tool_results', results: [{ callId: `c${i}`, name: 'read_page', content: big(i), isError: false }] });
  }
  return turns;
}

const fullCount = (turns: Turn[]) =>
  turns.filter((t) => t.role === 'tool_results' && t.results[0].content.length > COMPACT_THRESHOLD).length;

describe('compactHistory in batches', () => {
  it('keeps every snapshot while there are at most KEEP_FULL_RESULTS', () => {
    for (let n = 0; n <= KEEP_FULL_RESULTS; n++) assert.equal(fullCount(compactHistory(task(n))), n);
  });

  it('keeps between KEEP_FULL_RESULTS and KEEP_FULL_RESULTS + COMPACT_BATCH - 1 in full, the newest ones', () => {
    for (let n = KEEP_FULL_RESULTS + 1; n < 20; n++) {
      const out = compactHistory(task(n));
      const full = fullCount(out);
      assert.ok(full >= KEEP_FULL_RESULTS && full <= KEEP_FULL_RESULTS + COMPACT_BATCH - 1, `n=${n}: ${full} full`);
      // The full ones are the newest.
      const results = out.filter((t) => t.role === 'tool_results');
      results.slice(-full).forEach((t) => assert.ok(t.role === 'tool_results' && t.results[0].content.length > COMPACT_THRESHOLD));
      results.slice(0, -full).forEach((t) => assert.match(t.role === 'tool_results' ? t.results[0].content : '', /\[Older page snapshot removed\]$/));
    }
  });

  it('changes the history sent only once per batch: the earlier request stays a prefix of the next one', () => {
    let breaks = 0;
    for (let n = 1; n < 30; n++) {
      const before = JSON.stringify(compactHistory(task(n)));
      const after = JSON.stringify(compactHistory(task(n + 1)));
      if (!after.startsWith(before.slice(0, -1))) breaks++;
    }
    // Before batching (one result compacted per step) this was 27 out of 29.
    assert.ok(breaks <= Math.ceil(29 / COMPACT_BATCH), `${breaks} breaks`);
    assert.ok(COMPACT_BATCH >= 2);
  });

  it('gives the same result for the same turns (nothing depends on time or calls)', () => {
    assert.deepEqual(compactHistory(task(9)), compactHistory(task(9)));
  });

  it('does not change what it has already compacted when compacted again (saved conversations)', () => {
    const once = compactHistory(task(7));
    assert.deepEqual(compactHistory(once), once);
  });

  it('counts only large results, wherever they are', () => {
    const turns = task(5);
    turns.splice(1, 0, { role: 'assistant', text: '', toolCalls: [{ id: 'x', name: 'click', input: {} }], raw: null, rawProvider: 'anthropic', rawModel: 'm' }, {
      role: 'tool_results',
      results: [{ callId: 'x', name: 'click', content: 'Clicked ref=3.', isError: false }],
    });
    const out = compactHistory(turns);
    const click = out[2];
    assert.ok(click.role === 'tool_results' && click.results[0].content === 'Clicked ref=3.');
  });
});

describe('Anthropic cache breakpoint on the history', () => {
  const block = (text: string) => ({ type: 'text', text });

  it('marks the last block of the last user message only', () => {
    const msgs = [
      { role: 'user' as const, content: [block('a')] },
      { role: 'assistant' as const, content: [block('b')] },
      { role: 'user' as const, content: [block('c'), block('d')] },
    ];
    const out = withHistoryBreakpoint(msgs);
    assert.deepEqual(out[2].content[1], { type: 'text', text: 'd', cache_control: { type: 'ephemeral' } });
    assert.equal(out[2].content[0].cache_control, undefined);
    assert.equal(out[0].content[0].cache_control, undefined);
    // The input is not changed (raw output kept with the history is never marked).
    assert.equal((msgs[2].content[1] as Record<string, unknown>).cache_control, undefined);
  });

  it('skips a final assistant message (a paused turn goes back exactly as received)', () => {
    const paused = { role: 'assistant' as const, content: [block('p')] };
    const out = withHistoryBreakpoint([{ role: 'user', content: [block('u')] }, paused]);
    assert.equal(out[1], paused);
    assert.deepEqual(out[0].content[0].cache_control, { type: 'ephemeral' });
  });

  it('sends two breakpoints in all (system, history): within what the relay accepts from the app', async () => {
    let body: Record<string, unknown> = {};
    const wire: Wire = {
      replayAs: 'anthropic',
      async json<T>(_u: string, _h: Record<string, string>, b: Record<string, unknown>) {
        body = b;
        return { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' } as T;
      },
      async sse() {},
    };
    const turns = task(3);
    const raw = [{ type: 'tool_use', id: 'c0', name: 'read_page', input: {} }];
    turns[1] = { ...(turns[1] as Extract<Turn, { role: 'assistant' }>), raw, rawProvider: 'anthropic', rawModel: 'claude-sonnet-5-5' };
    const req = { apiKey: 'k', model: 'claude-sonnet-5-5', system: 's', tools: [], webSearch: false, turns, signal: new AbortController().signal } as unknown as ModelRequest;
    await callAnthropic(req, wire);
    const text = JSON.stringify(body);
    assert.equal(text.split('"cache_control"').length - 1, 2);
    const messages = body.messages as { role: string; content: Record<string, unknown>[] }[];
    const last = messages[messages.length - 1];
    assert.equal(last.content[last.content.length - 1].type, 'tool_result');
    assert.deepEqual(last.content[last.content.length - 1].cache_control, { type: 'ephemeral' });
    // The raw block replayed from the history is not marked.
    assert.equal((raw[0] as Record<string, unknown>).cache_control, undefined);
  });
});
