// The task lifecycle in Node (src/task/sendTask.ts, src/task/taskRunner.ts; TASK-17, 20 Nov 2026 code review):
// fake agent loops that finish, fail, are stopped and overlap, with the real Browser, Tab and Conversation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answers, makeHost, tick, untilAborted } from './host';

test('a task that finishes: the conversation ends, its state is cleared, it is saved', async () => {
  const { send, browser, runner, log, saved } = makeHost(answers('Hello.'));
  const chat = browser.conversationOf(browser.active);
  await send('Hi');
  assert.equal(chat.running, false);
  assert.equal(browser.agentTabId, null);
  assert.equal(runner.tasks.length, 0);
  assert.deepEqual(
    chat.items.map((i) => i.kind),
    ['user', 'assistant'],
  );
  assert.ok(log.includes('ui.end:done:Hello.'));
  assert.ok(log.includes('bg.end:done'));
  assert.ok(log.includes('ended:done'));
  assert.ok(saved.length >= 1);
});

test('a task that fails: one error line, ended as failed', async () => {
  const { send, browser, log } = makeHost(async () => {
    throw new Error('boom');
  });
  const chat = browser.conversationOf(browser.active);
  await send('Hi');
  assert.equal(chat.items.at(-1)?.kind, 'error');
  assert.ok(log.includes('ended:failed'));
  assert.equal(chat.running, false);
});

test('a stopped task: "Stopped", no "task ended" signal, nothing left running', async () => {
  const { send, browser, log } = makeHost(async (opts) => untilAborted(opts.signal));
  const chat = browser.conversationOf(browser.active);
  const run = send('Hi');
  await tick();
  assert.equal(chat.running, true);
  chat.stop();
  await run;
  assert.equal(chat.items.at(-1)?.icon, 'stop');
  assert.ok(!log.some((l) => l.startsWith('ended:')));
  assert.ok(log.includes('bg.end:stopped'));
  assert.equal(browser.agentTabId, null);
});

test('two sends in the same tick: only one starts; the other is kept in the input', async () => {
  const { send, browser, log } = makeHost(async (opts) => untilAborted(opts.signal));
  const chat = browser.conversationOf(browser.active);
  const first = send('First');
  const second = send('Second, by voice', { voice: true });
  await second;
  // The first is shown once its checks (the own-key consent, AI-32) are through.
  await tick(10);
  assert.ok(log.includes(`busy:${chat.key}`));
  assert.equal(chat.draft, 'Second, by voice');
  assert.equal(chat.items.filter((i) => i.kind === 'user').length, 1);
  chat.stop();
  await first;
});

test('a send that waited (voice transcript, saved task page) is turned away while another task runs', async () => {
  const { send, browser, log } = makeHost(async (opts) => untilAborted(opts.signal));
  const a = browser.active;
  const b = browser.openTab('https://example.com/', { activate: false });
  const first = send('In A');
  await tick(10);
  await send('Queued for B', { tab: b });
  assert.ok(log.includes(`busy:${browser.conversationOf(b).key}`));
  assert.equal(browser.conversationOf(b).draft, 'Queued for B');
  browser.conversationOf(a).stop();
  await first;
});

test('B starts while A unwinds: A\'s end clears none of B\'s state', async () => {
  let releaseA!: () => void;
  const { send, browser, log, runner } = makeHost(async (opts, n) => {
    if (n === 1) {
      await untilAborted(opts.signal);
      // A's tool takes a while to return after Stop.
      await new Promise<void>((resolve) => (releaseA = resolve));
      return;
    }
    await untilAborted(opts.signal);
  });
  const tabA = browser.active;
  const tabB = browser.openTab('https://example.com/');
  browser.conversationOf(tabB).restore(null);
  const a = send('Task A', { tab: tabA });
  await tick();
  browser.conversationOf(tabA).stop();
  // A is stopped but still unwinding; B (another conversation) may start at once.
  const b = send('Task B', { tab: tabB });
  await tick();
  assert.equal(browser.agentTabId, tabB.id);
  assert.equal(browser.conversationOf(tabB).running, true);
  const before = log.length;
  releaseA();
  await a;
  const afterA = log.slice(before);
  assert.equal(browser.agentTabId, tabB.id, "A's end left B's agent tab");
  assert.ok(!afterA.some((l) => l.startsWith('ui.end')), `A's end touched the strip: ${afterA}`);
  assert.ok(!afterA.includes('mark.clear'), "A's end cleared B's mark");
  assert.ok(!afterA.some((l) => l.startsWith('bg.end')), "A's end ended B's background run");
  assert.ok(!afterA.includes('paused.takeBack'));
  assert.equal(browser.conversationOf(tabB).running, true);
  assert.equal(browser.conversationOf(tabA).running, false);
  assert.equal(runner.live?.chat, browser.conversationOf(tabB));
  browser.conversationOf(tabB).stop();
  await b;
  assert.equal(browser.agentTabId, null);
});

test("closing A's tab mid-run stops A and lets B start; A still ends and is saved", async () => {
  let releaseA!: () => void;
  const { send, browser, saved } = makeHost(async (opts, n) => {
    await untilAborted(opts.signal);
    if (n === 1) await new Promise<void>((resolve) => (releaseA = resolve));
  });
  const tabA = browser.openTab('https://a.example/');
  const tabB = browser.openTab('https://b.example/');
  const chatA = tabA.conversation;
  const a = send('Task A', { tab: tabA });
  await tick();
  assert.equal(chatA.running, true);
  browser.closeTab(tabA.id);
  // The conversation is gone from the browser, but its run is still unwinding.
  assert.equal(chatA.running, true);
  assert.ok(!browser.conversations.includes(chatA));
  const b = send('Task B', { tab: tabB });
  await tick();
  assert.equal(browser.agentTabId, tabB.id);
  releaseA();
  await a;
  assert.equal(chatA.running, false);
  assert.ok(saved.some((s) => s.key === chatA.key));
  assert.equal(browser.agentTabId, tabB.id);
  browser.conversationOf(tabB).stop();
  await b;
});

test('a new message in the conversation of a stopped task waits for it to unwind, so the history stays in order', async () => {
  let releaseA!: () => void;
  const { send, browser } = makeHost(async (opts, n) => {
    if (n === 1) {
      opts.turns.push({
        role: 'assistant',
        text: '',
        toolCalls: [{ id: 'c1', name: 'wait', input: {} }],
        raw: null,
        rawProvider: 'anthropic',
        rawModel: 'm',
      });
      await untilAborted(opts.signal);
      await new Promise<void>((resolve) => (releaseA = resolve));
      opts.turns.push({ role: 'tool_results', results: [{ callId: 'c1', name: 'wait', content: 'Stopped by the user.', isError: true }] });
      return;
    }
    opts.turns.push({ role: 'assistant', text: 'B', toolCalls: [], raw: null, rawProvider: 'anthropic', rawModel: 'm' });
    opts.onEvent({ type: 'text', text: 'B' });
  });
  const chat = browser.conversationOf(browser.active);
  const a = send('A');
  await tick();
  chat.stop();
  const b = send('B');
  await tick(5);
  assert.equal(chat.turns.filter((t) => t.role === 'user').length, 1, 'B waited');
  releaseA();
  await a;
  await b;
  assert.deepEqual(
    chat.turns.map((t) => t.role),
    ['user', 'assistant', 'tool_results', 'user', 'assistant'],
  );
});

test('the screen switching to an incognito tab mid-run does not stop the task; touching one keeps it out of notifications', async () => {
  const { send, browser, log } = makeHost(async (opts) => {
    await tick(5);
    // The agent reads an incognito tab.
    opts.privacy!.touchedIncognito = true;
    opts.onEvent({ type: 'text', text: 'Read it.' });
  });
  const normal = browser.active;
  const run = send('Compare', { tab: normal });
  await tick();
  browser.openTab('https://private.example/', { incognito: true });
  await run;
  assert.ok(log.includes('bg.end:stopped'), 'nothing from it goes in a notification');
  assert.equal(normal.conversation.running, false);
  assert.equal(browser.agentTabId, null);
});

test('a provider without a key: the message stays shown, nothing runs, the slot is free', async () => {
  const { send, browser, runner, setSettings, log } = makeHost(answers());
  setSettings({ apiKeys: { ...makeHost(answers()).host.settings().apiKeys, anthropic: '' } });
  const chat = browser.conversationOf(browser.active);
  await send('Hi');
  assert.equal(chat.turns.length, 0);
  assert.equal(runner.tasks.length, 0);
  assert.ok(log.includes('showSettings'));
  assert.ok(!log.includes('ui.start'));
});

test('settings patches from a task land on the settings as they are then', async () => {
  const { send, host, setSettings } = makeHost(async (opts) => {
    await tick(5);
    await opts.appSettings!.change({ blockAds: false });
  });
  const run = send('Turn off ad blocking');
  await tick();
  // Changed meanwhile elsewhere (the Settings screen).
  setSettings({ haptics: false });
  await run;
  assert.equal(host.settings().blockAds, false);
  assert.equal(host.settings().haptics, false, 'the change made meanwhile is kept');
});
