// When a conversation is saved (TABS-28, TABS-29; 20 Nov 2026 code review): the user's message when it is sent, each
// completed step, the end; a task interrupted by Qutai being killed shows, on the next start, the message and the
// steps done, marked as interrupted, with nothing that looks as if it were still running. Typing is saved per
// conversation, flushed on a switch and on leaving the foreground.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactHistory } from '../../src/agent/history';
import { Conversation } from '../../src/chat/Conversation';
import { ChatSaver, saveOnLeaving } from '../../src/storage/chatSaver';
import { makeHost, tick } from './host';

/** A loop that does `steps` steps (one tool call each), saying each, then hangs: Qutai is killed there. */
function stepsThenKilled(steps: number, killed: { at?: () => void }) {
  return async (opts: Parameters<Parameters<typeof makeHost>[0]>[0]) => {
    for (let i = 1; i <= steps; i++) {
      opts.turns.push({
        role: 'assistant',
        text: '',
        toolCalls: [{ id: `c${i}`, name: 'read_page', input: {} }],
        raw: null,
        rawProvider: 'anthropic',
        rawModel: 'm',
      });
      opts.onEvent({ type: 'action', icon: 'document', text: `Reading page ${i}`, tool: 'read_page' });
      opts.onEvent({ type: 'text_delta', text: 'Half an answ' });
      // The streamed piece reaches the shown messages (they are redrawn every 50 ms).
      await tick(60);
      opts.turns.push({ role: 'tool_results', results: [{ callId: `c${i}`, name: 'read_page', content: `page ${i}`, isError: false }] });
      opts.onStep?.();
    }
    // A step under way when Qutai is killed: its call has no result, and a reply is half streamed.
    opts.turns.push({
      role: 'assistant',
      text: '',
      toolCalls: [{ id: 'cx', name: 'click', input: {} }],
      raw: null,
      rawProvider: 'anthropic',
      rawModel: 'm',
    });
    await tick(60);
    killed.at?.();
    await new Promise(() => {});
  };
}

test('the message is saved when it is sent, then after each completed step', async () => {
  const killed: { at?: () => void } = {};
  const { send, browser, storage, saved } = makeHost(stepsThenKilled(2, killed));
  const chat = browser.conversationOf(browser.active);
  void send('Compare the prices');
  await tick(200);
  const writes = saved.filter((s) => s.key === chat.key);
  // Sent (1 turn), step 1 (3 turns), step 2 (5 turns).
  assert.deepEqual(
    writes.map((w) => w.turns),
    [1, 3, 5],
  );
  assert.equal(storage.get(chat.key)?.task?.sentId, chat.items[0].id);
});

test('killed between steps, restarted from storage: the message and the steps, marked interrupted, nothing running', async () => {
  const killed: { at?: () => void } = {};
  const { send, browser, storage } = makeHost(stepsThenKilled(2, killed));
  const chat = browser.conversationOf(browser.active);
  void send('Compare the prices');
  await tick(250);
  // The last write is what survives the kill.
  const stored = storage.get(chat.key)!;
  const restarted = new Conversation(() => {}, chat.key);
  restarted.restore(JSON.parse(JSON.stringify(stored)));
  assert.equal(restarted.running, false);
  assert.deepEqual(
    restarted.items.map((i) => i.kind),
    ['user', 'action', 'assistant', 'action', 'info'],
  );
  assert.equal(restarted.items[0].text, 'Compare the prices');
  assert.match(restarted.items.at(-1)!.text, /closed while this task was running/);
  assert.equal(restarted.items.at(-1)!.icon, 'stop');
  assert.ok(!restarted.items.some((i) => i.streaming), 'nothing looks as if it were still being written');
  // Saved again, it is no longer marked as running.
  assert.equal(restarted.toSaved().task, undefined);
  // The next message's history is complete: the step under way when Qutai was killed was not saved half done.
  restarted.turns.push({ role: 'user', text: 'Go on' });
  const sent = compactHistory(restarted.turns);
  for (let i = 0; i < sent.length; i++) {
    const turn = sent[i];
    if (turn.role !== 'assistant' || !turn.toolCalls.length) continue;
    const next = sent[i + 1];
    assert.equal(next.role, 'tool_results');
    assert.deepEqual(
      next.role === 'tool_results' && next.results.map((r) => r.callId),
      turn.toolCalls.map((c) => c.id),
    );
  }
});

test('a task that ended normally is not shown as interrupted after a restart', async () => {
  const { send, browser, storage } = makeHost(async (opts) => {
    opts.turns.push({ role: 'assistant', text: 'Done.', toolCalls: [], raw: null, rawProvider: 'anthropic', rawModel: 'm' });
    opts.onEvent({ type: 'text', text: 'Done.' });
  });
  const chat = browser.conversationOf(browser.active);
  await send('Hi');
  const restarted = new Conversation(() => {}, chat.key);
  restarted.restore(storage.get(chat.key)!);
  assert.deepEqual(
    restarted.items.map((i) => i.kind),
    ['user', 'assistant'],
  );
});

test('typing in two conversations within the pause saves both (one timer per conversation)', async () => {
  const written: string[] = [];
  const saver = new ChatSaver(async (chat) => {
    written.push(`${chat.key}:${chat.draft}`);
  });
  const a = new Conversation(() => {}, 'tab-a');
  const b = new Conversation(() => {}, 'tab-b');
  a.setDraft('first tab');
  saver.soon(a, 30);
  await tick(10);
  b.setDraft('second tab');
  saver.soon(b, 30);
  await tick(60);
  assert.deepEqual(written.sort(), ['tab-a:first tab', 'tab-b:second tab']);
});

test('a switch or leaving the foreground writes the waiting typing at once', async () => {
  const written: string[] = [];
  const saver = new ChatSaver(async (chat) => {
    written.push(chat.draft);
  });
  const a = new Conversation(() => {}, 'a');
  const b = new Conversation(() => {}, 'b');
  a.setDraft('typed in a');
  saver.soon(a, 10_000);
  await saver.flush(a);
  assert.deepEqual(written, ['typed in a']);
  b.setDraft('typed in b');
  saver.soon(b, 10_000);
  await saver.flush();
  assert.deepEqual(written, ['typed in a', 'typed in b']);
  assert.equal(saver.pending(b), false);
});

test('saves of one conversation never overlap: requests during a write make one more, with the latest state', async () => {
  const written: string[] = [];
  let active = 0;
  let overlapped = false;
  const saver = new ChatSaver(async (chat) => {
    active++;
    if (active > 1) overlapped = true;
    await tick(15);
    written.push(chat.draft);
    active--;
  });
  const chat = new Conversation(() => {}, 'c');
  chat.setDraft('step 1');
  const first = saver.now(chat);
  chat.setDraft('step 2');
  void saver.now(chat);
  chat.setDraft('step 3');
  void saver.now(chat);
  await first;
  assert.equal(overlapped, false);
  assert.deepEqual(written, ['step 3', 'step 3'].slice(0, written.length));
  assert.equal(written.length, 2, 'one write, then exactly one more');
  assert.equal(written.at(-1), 'step 3');
});

test('leaving the foreground mid-task writes the running conversation and the waiting typing', async () => {
  const written: string[] = [];
  const saver = new ChatSaver(async (chat) => {
    written.push(chat.key);
  });
  const { send, browser, runner } = makeHost(async (opts) => {
    await new Promise<void>((resolve) => opts.signal.addEventListener('abort', () => resolve()));
  });
  const running = browser.conversationOf(browser.active);
  const other = browser.openTab('https://example.com/');
  browser.conversationOf(other).restore(null);
  const run = send('Work', { tab: browser.tabs[0] });
  await tick();
  browser.conversationOf(other).setDraft('half typed');
  saver.soon(browser.conversationOf(other), 10_000);
  await saveOnLeaving(saver, runner.tasks);
  assert.deepEqual(written.sort(), [browser.conversationOf(other).key, running.key].sort());
  running.stop();
  await run;
});
