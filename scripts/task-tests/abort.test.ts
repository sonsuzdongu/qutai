// Stop interrupts a running tool (TASK-18, 20 Nov 2026 code review): the task's signal reaches the tab's waits
// (a page load, settling after a click, a page command, a pause), the agent loop ends the step at once, and every
// tool call the model made still gets a result in the history. The real runAgent, executeTool, Browser and Tab; the
// provider's answers come from a stand-in fetch.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { executeTool } from '../../src/agent/executeTool';
import { compactHistory, pairToolCalls, UNFINISHED_CALL } from '../../src/agent/history';
import { runAgent } from '../../src/agent/runAgent';
import type { Turn } from '../../src/ai/types';
import { Browser } from '../../src/browser/Browser';
import { sleep, StoppedError } from '../../src/utils/sleep';
import { makeWorld } from '../injection-tests/world';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A tab with a page that never answers a command and never finishes loading. */
function stuckTab() {
  const browser = new Browser();
  const tab = browser.active;
  tab.url = 'https://slow.example/';
  (tab as unknown as { webview: unknown }).webview = { injectJavaScript: () => {}, goBack: () => {}, reload: () => {}, stopLoading: () => {} };
  tab.loading = true;
  const world = makeWorld({ browser, agentTabId: tab.id, memories: [], contacts: [], userTexts: () => ['Go'] });
  return { browser, tab, world };
}

const within = async (ms: number, work: Promise<unknown>) => {
  const started = Date.now();
  await work.catch(() => {});
  return Date.now() - started <= ms;
};

test('the tab\'s waits end at once when the task stops', async () => {
  const { tab } = stuckTab();
  const stop = new AbortController();
  const load = tab.waitForNextLoad(15000, stop.signal);
  const settle = tab.settle(stop.signal);
  const command = tab.run('readPage', [0], 10000, stop.signal);
  const pause = sleep(10000, stop.signal);
  setTimeout(() => stop.abort(), 20);
  for (const wait of [load, settle, command, pause]) {
    await assert.rejects(wait, StoppedError);
  }
  // Nothing is left waiting on the tab.
  assert.equal((tab as unknown as { pending: Map<string, unknown> }).pending.size, 0);
  assert.equal((tab as unknown as { loadWaiters: unknown[] }).loadWaiters.length, 0);
});

test('a tool waiting for a page load, a click settling, a pause: each returns within a second of Stop', async () => {
  for (const [name, input] of [
    ['navigate', { url: 'https://slow.example/next' }],
    ['wait', { seconds: 10 }],
    ['read_page', {}],
    ['go_back', {}],
  ] as const) {
    const { world } = stuckTab();
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 30);
    const ok = await within(1000, executeTool(name, input as Record<string, unknown>, { ...world.ctx, signal: stop.signal }));
    assert.ok(ok, `${name} did not return within a second of Stop`);
  }
});

/** An Anthropic answer that calls one tool. */
function toolAnswer(name: string, input: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-test',
      content: [
        { type: 'text', text: 'Working on it.' },
        { type: 'tool_use', id: 'call_1', name, input },
        { type: 'tool_use', id: 'call_2', name: 'read_page', input: {} },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

test('Stop during a tool: the loop returns within a second, and every call has its result', async () => {
  const { world } = stuckTab();
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    return toolAnswer('wait', { seconds: 10 });
  }) as typeof fetch;
  const turns: Turn[] = [{ role: 'user', text: 'Wait for the page.' }];
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 150);
  const started = Date.now();
  await runAgent({
    ...world.ctx,
    provider: 'anthropic',
    apiKey: 'test',
    model: 'claude-test',
    turns,
    stream: false,
    signal: stop.signal,
    audit: { conversation: () => 'test', incognito: () => false },
    onEvent: () => {},
  });
  assert.ok(Date.now() - started < 1150, `took ${Date.now() - started} ms`);
  assert.equal(requests, 1);
  assert.deepEqual(
    turns.map((t) => t.role),
    ['user', 'assistant', 'tool_results'],
  );
  const results = (turns[2] as Extract<Turn, { role: 'tool_results' }>).results;
  assert.deepEqual(
    results.map((r) => [r.callId, r.content]),
    [
      ['call_1', 'Stopped by the user.'],
      ['call_2', 'Stopped by the user.'],
    ],
  );
});

test('a call left without a result (killed mid-step) is answered before the history is sent again', () => {
  const turns: Turn[] = [
    { role: 'user', text: 'Book it' },
    {
      role: 'assistant',
      text: '',
      toolCalls: [
        { id: 'a', name: 'click', input: {} },
        { id: 'b', name: 'read_page', input: {} },
      ],
      raw: null,
      rawProvider: 'anthropic',
      rawModel: 'm',
    },
    { role: 'tool_results', results: [{ callId: 'a', name: 'click', content: 'Clicked', isError: false }] },
    { role: 'assistant', text: '', toolCalls: [{ id: 'c', name: 'wait', input: {} }], raw: null, rawProvider: 'anthropic', rawModel: 'm' },
    { role: 'user', text: 'Still there?' },
  ];
  const paired = pairToolCalls(turns);
  assert.deepEqual(
    paired.map((t) => t.role),
    ['user', 'assistant', 'tool_results', 'assistant', 'tool_results', 'user'],
  );
  assert.deepEqual(
    (paired[2] as Extract<Turn, { role: 'tool_results' }>).results.map((r) => [r.callId, r.content]),
    [
      ['a', 'Clicked'],
      ['b', UNFINISHED_CALL],
    ],
  );
  assert.equal((paired[4] as Extract<Turn, { role: 'tool_results' }>).results[0].content, UNFINISHED_CALL);
  // What is sent is paired too, and a complete history is left as it is.
  assert.equal(compactHistory(turns).length, 6);
  assert.equal(pairToolCalls(paired), paired);
  // A last answer that paused mid-search is continued, never answered with results.
  const paused = turns.slice(0, 4);
  assert.equal(pairToolCalls(paused).at(-1), paused.at(-1));
});
