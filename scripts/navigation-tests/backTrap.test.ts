// Back-button traps (src/browser/backTrap.ts): which entries a page left without the user's gesture, and how far the
// user's Back goes past them, run as the page runs the rules.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACK_TRAP_RULE, BACK_TRAP_SCRIPT } from '../../src/browser/backTrap';
import { agentInstallScript } from '../../src/browser/agentScript';

const rules = new Function(`${BACK_TRAP_RULE}; return { qutaiLeftWithoutGesture, qutaiBackSteps };`)() as {
  qutaiLeftWithoutGesture: (touched: boolean, active: boolean, userInitiated: boolean) => boolean;
  qutaiBackSteps: (keys: string[], index: number, marked: (k: string) => boolean) => { steps: number; beyond: boolean };
};

test('an entry is marked only when the user did nothing on it and the navigation had no gesture', () => {
  assert.equal(rules.qutaiLeftWithoutGesture(false, false, false), true);
  assert.equal(rules.qutaiLeftWithoutGesture(true, false, false), false);
  assert.equal(rules.qutaiLeftWithoutGesture(false, true, false), false);
  assert.equal(rules.qutaiLeftWithoutGesture(false, false, true), false);
});

test('Back goes one entry when nothing before is marked', () => {
  assert.deepEqual(rules.qutaiBackSteps(['a', 'b', 'c'], 2, () => false), { steps: 1, beyond: false });
  assert.deepEqual(rules.qutaiBackSteps(['a'], 0, () => true), { steps: 1, beyond: false });
});

test('Back skips the marked entries and stops at the first one the user made', () => {
  const marked = new Set(['b', 'c']);
  assert.deepEqual(rules.qutaiBackSteps(['a', 'b', 'c', 'd'], 3, (k) => marked.has(k)), { steps: 3, beyond: false });
  // An unmarked entry in the middle is never skipped.
  const some = new Set(['c']);
  assert.deepEqual(rules.qutaiBackSteps(['a', 'b', 'c', 'd'], 3, (k) => some.has(k)), { steps: 2, beyond: false });
});

test('all of the site’s earlier entries marked: back to the entry before the site', () => {
  assert.deepEqual(rules.qutaiBackSteps(['a', 'b', 'c'], 2, (k) => k !== 'c'), { steps: 3, beyond: true });
});

// The script in a small fake page: the Navigation API, user input and history.go.
function fakePage(opts: { activeAt?: () => boolean } = {}) {
  let entries = [{ key: 'k0', index: 0 }];
  let current = entries[0];
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const navListeners: ((e: unknown) => void)[] = [];
  const store = new Map<string, string>();
  const gone: number[] = [];
  let n = 1;
  const nav = {
    entries: () => entries,
    get currentEntry() {
      return current;
    },
    addEventListener: (_t: string, fn: (e: unknown) => void) => navListeners.push(fn),
  };
  const History = function () {} as unknown as { prototype: { go: (d: number) => void } };
  History.prototype.go = (d: number) => {
    gone.push(d);
    const target = current.index + d;
    if (target >= 0 && target < entries.length) current = entries[target];
  };
  const win = {
    navigation: nav,
    history: new (History as unknown as new () => unknown)(),
    setTimeout: (fn: () => void) => fn(),
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] ??= []).push(fn),
  };
  const agent: Record<string, (...a: unknown[]) => unknown> = {};
  new Function('__qutaiAgent', 'window', 'History', 'navigator', 'Date', BACK_TRAP_SCRIPT)(
    agent,
    win,
    History,
    { userActivation: { get isActive() { return opts.activeAt?.() ?? false; } } },
    Date,
  );
  return {
    agent,
    gone,
    touch() {
      for (const fn of listeners.pointerdown ?? []) fn({ isTrusted: true });
    },
    push(userInitiated = false) {
      for (const fn of navListeners) fn({ navigationType: 'push', userInitiated });
      entries = entries.slice(0, current.index + 1);
      const entry = { key: `k${n++}`, index: entries.length };
      entries.push(entry);
      current = entry;
    },
    get index() {
      return current.index;
    },
    store,
  };
}

test('one entry back: the page goes back itself (WebKit’s own goBack can refuse)', () => {
  const page = fakePage();
  page.touch();
  page.push(true);
  assert.equal(page.agent.back(), 1);
  assert.deepEqual(page.gone, [-1]);
});

test('a page that pushes entries on load is left with one Back', () => {
  const page = fakePage();
  page.push();
  page.push();
  assert.equal(page.agent.back(), 3);
  // Nothing before the site in this tab: back to its first entry.
  assert.deepEqual(page.gone, [-3, -2]);
  assert.equal(page.index, 0);
});

test('entries made after the user touched the page are kept', () => {
  const page = fakePage();
  page.touch();
  page.push(); // k0 left after a touch
  page.push(); // k1 left without one
  assert.equal(page.agent.back(), 2);
  assert.equal(page.index, 0);
});

test('a late command (past its deadline) does nothing', () => {
  const page = fakePage();
  page.push();
  assert.equal(page.agent.back(Date.now() - 1), 0);
  assert.deepEqual(page.gone, []);
});

test('marks are kept in the site’s session storage', () => {
  const page = fakePage();
  page.push();
  assert.equal(page.store.get('__qutaiBackMarks'), JSON.stringify({ k0: 1 }));
});

test('the script is part of the page script installer on iOS only', () => {
  const os = process.env.QUTAI_TEST_OS;
  try {
    process.env.QUTAI_TEST_OS = 'ios';
    assert.ok(agentInstallScript('__qtest').includes('qutaiBackSteps'));
    process.env.QUTAI_TEST_OS = 'android';
    assert.ok(!agentInstallScript('__qtest').includes('qutaiBackSteps'));
  } finally {
    if (os === undefined) delete process.env.QUTAI_TEST_OS;
    else process.env.QUTAI_TEST_OS = os;
  }
});
