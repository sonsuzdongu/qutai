// A task host for Node (docs/design/16-tasks.md, TASK-17): the real Browser, Tab and Conversation classes, the real
// lifecycle (src/task/sendTask.ts, src/task/taskRunner.ts), and a fake agent loop the test scripts step by step.
// Everything the screen would do is recorded in `log`.
import type { AgentOptions } from '../../src/agent/runAgent';
import { Browser } from '../../src/browser/Browser';
import type { Conversation } from '../../src/chat/Conversation';
import { prepareForStorage, type SavedChat } from '../../src/storage/chat';
import { DEFAULT_SETTINGS, type Settings } from '../../src/storage/settings';
import type { SendOptions, TaskHost } from '../../src/task/sendTask';
import { sendTask } from '../../src/task/sendTask';
import { TaskRunner } from '../../src/task/taskRunner';

export type FakeLoop = (opts: AgentOptions) => Promise<void>;

/** Resolves when the signal aborts, after `unwindMs` (a tool that takes a moment to return). */
export function untilAborted(signal: AbortSignal, unwindMs = 0): Promise<void> {
  return new Promise((resolve) => {
    const done = () => setTimeout(resolve, unwindMs);
    if (signal.aborted) done();
    else signal.addEventListener('abort', done, { once: true });
  });
}

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** A loop that answers, one step. */
export const answers =
  (text = 'Done.'): FakeLoop =>
  async (opts) => {
    opts.turns.push({ role: 'assistant', text, toolCalls: [], raw: null, rawProvider: 'anthropic', rawModel: 'm' });
    opts.onEvent({ type: 'text', text });
  };

export function makeHost(loop: FakeLoop | ((opts: AgentOptions, n: number) => Promise<void>)) {
  const browser = new Browser();
  const runner = new TaskRunner();
  let settings: Settings = { ...DEFAULT_SETTINGS, provider: 'anthropic', apiKeys: { ...DEFAULT_SETTINGS.apiKeys, anthropic: 'k' } };
  const log: string[] = [];
  const saved: { key: string; items: number; turns: number }[] = [];
  /** What storage holds per key, as the app writes it (storage/chat.ts prepareForStorage, through JSON). */
  const storage = new Map<string, SavedChat>();
  let runs = 0;
  const marks = { on: false };
  const host: TaskHost = {
    browser,
    runner,
    runAgent: (opts) => (loop as (o: AgentOptions, n: number) => Promise<void>)(opts, ++runs),
    settings: () => settings,
    changeSettings: async (patch) => {
      settings = { ...settings, ...(typeof patch === 'function' ? patch(settings) : patch) };
    },
    sitePermissions: { blockingOffSites: () => [] } as never,
    memory: { list: async () => [] } as never,
    downloads: {} as never,
    history: { search: async () => [], sites: async () => [] },
    log: () => {},
    bookmarksRemoved: () => {},
    savedTaskUsed: () => {},
    showSettings: () => log.push('showSettings'),
    save: (chat: Conversation) => {
      saved.push({ key: chat.key, items: chat.items.length, turns: chat.turns.length });
      storage.set(chat.key, JSON.parse(JSON.stringify(prepareForStorage(chat.toSaved()))));
    },
    credits: {
      ready: () => false,
      signedIn: () => false,
      askDisclosure: async () => false,
      promptSignIn: () => {},
      config: async () => {
        throw new Error('no credits in tests');
      },
      refresh: () => {},
    },
    preparedSent: () => {},
    busy: (chat) => log.push(`busy:${chat.key}`),
    ui: {
      start: (closed) => log.push(`ui.start${closed ? ':closed' : ''}`),
      end: (view) => log.push(`ui.end:${view.outcome}:${view.answerText}`),
    },
    background: {
      begin: (title) => log.push(`bg.begin:${title ?? '-'}`),
      end: (outcome) => log.push(`bg.end:${outcome.kind}`),
      notifies: () => false,
    },
    notices: {
      notifyWhenDone: () => true,
      takeBackPaused: () => log.push('paused.takeBack'),
      notice: (_chat, event) => log.push(`notice:${event}`),
      ended: (_chat, kind) => log.push(`ended:${kind}`),
      taskTab: () => {},
    },
    clearMark: () => {
      marks.on = false;
      log.push('mark.clear');
    },
  };
  // Conversations of tabs opened in tests have nothing saved to read.
  const ready = () => browser.conversations.forEach((c) => c.loaded || c.restore(null));
  ready();
  return {
    host,
    browser,
    runner,
    log,
    saved,
    storage,
    marks,
    setSettings: (next: Partial<Settings>) => (settings = { ...settings, ...next }),
    send: (text: string, options?: SendOptions) => {
      ready();
      return sendTask(host, text, options);
    },
    ready,
  };
}
