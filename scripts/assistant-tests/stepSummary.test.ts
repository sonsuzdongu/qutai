// The finished task's steps folded into one line in the assistant panel (src/chat/stepSummary.ts): what is counted,
// how forms are told apart, and which runs of step lines fold (never the running task's own).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MIN_FOLDED_STEPS,
  segmentChat,
  stepSummaryText,
  summarizeSteps,
  type StepItem,
} from '../../src/chat/stepSummary.ts';
import { setLanguage } from '../../src/i18n/index.ts';

const step = (tool: string): StepItem => ({ kind: 'action', tool });

test('counts every step and sorts them into pages opened, read, forms, searches and files', () => {
  const s = summarizeSteps([
    { kind: 'user' },
    step('web_search'),
    step('navigate'),
    step('read_page'),
    step('click'),
    step('type'),
    step('type'),
    step('select_option'),
    step('click'),
    { kind: 'error' },
    step('open_tab'),
    step('save_pdf'),
    { kind: 'assistant' },
  ]);
  assert.deepEqual(s, { steps: 10, opened: 2, read: 1, forms: 1, searches: 1, files: 1 });
});

test('a form is a run of fields on one page; clicks and scrolling between fields stay in it, a new page starts another', () => {
  assert.equal(summarizeSteps([step('type'), step('click'), step('scroll'), step('type')]).forms, 1);
  assert.equal(summarizeSteps([step('type'), step('navigate'), step('type')]).forms, 2);
  assert.equal(summarizeSteps([step('type'), step('switch_tab'), step('upload_file')]).forms, 2);
  assert.equal(summarizeSteps([step('click'), step('scroll')]).forms, 0);
});

test('conversations saved before the tool name was kept are summarised from the icons', () => {
  const s = summarizeSteps([
    { kind: 'action', icon: 'globe' },
    { kind: 'action', icon: 'keyboard' },
    { kind: 'action', icon: 'tap' },
    { kind: 'action', icon: 'find' },
    { kind: 'action' },
  ]);
  assert.deepEqual(s, { steps: 5, opened: 1, read: 0, forms: 1, searches: 1, files: 0 });
});

test('the line: the step count, then at most three details, singular and plural (en, tr)', () => {
  setLanguage('en');
  assert.equal(
    stepSummaryText({ steps: 7, opened: 2, read: 0, forms: 1, searches: 0, files: 0 }),
    '7 steps · opened 2 pages · filled 1 form',
  );
  assert.equal(stepSummaryText({ steps: 1, opened: 0, read: 1, forms: 0, searches: 0, files: 0 }), '1 step · read 1 page');
  assert.equal(
    stepSummaryText({ steps: 12, opened: 3, read: 2, forms: 2, searches: 1, files: 1 }).split(' · ').length,
    4,
  );
  setLanguage('tr');
  assert.equal(
    stepSummaryText({ steps: 7, opened: 2, read: 0, forms: 1, searches: 0, files: 0 }),
    '7 adım · 2 sayfa açıldı · 1 form dolduruldu',
  );
  setLanguage('en');
});

const kinds = (...k: string[]): StepItem[] => k.map((kind) => (kind === 'action' ? step('click') : { kind }));

test('a finished run of enough steps folds, with errors and status lines between steps inside it', () => {
  const items = kinds('user', 'action', 'error', 'action', 'info', 'action', 'assistant');
  assert.deepEqual(segmentChat(items, false), [
    { type: 'item', index: 0 },
    { type: 'steps', start: 1, end: 6 },
    { type: 'item', index: 6 },
  ]);
});

test('an error or "Stopped" after the last step stays in view, outside the fold', () => {
  const items = kinds('user', 'action', 'action', 'action', 'error', 'info');
  assert.deepEqual(segmentChat(items, false), [
    { type: 'item', index: 0 },
    { type: 'steps', start: 1, end: 4 },
    { type: 'item', index: 4 },
    { type: 'item', index: 5 },
  ]);
});

test('short runs stay as lines', () => {
  const items = kinds('user', ...Array(MIN_FOLDED_STEPS - 1).fill('action'), 'assistant');
  assert.ok(segmentChat(items, false).every((s) => s.type === 'item'));
});

test('while a task runs its own steps show live; earlier tasks stay folded', () => {
  const items = kinds('user', 'action', 'action', 'action', 'assistant', 'user', 'action', 'action', 'action');
  const segments = segmentChat(items, true);
  assert.deepEqual(segments[1], { type: 'steps', start: 1, end: 4 });
  assert.deepEqual(segments.slice(-3), [
    { type: 'item', index: 6 },
    { type: 'item', index: 7 },
    { type: 'item', index: 8 },
  ]);
  // Once it has finished, the new run folds too.
  assert.deepEqual(segmentChat(items, false).at(-1), { type: 'steps', start: 6, end: 9 });
});

test('every item appears exactly once, in order', () => {
  const items = kinds('user', 'action', 'info', 'action', 'action', 'choices', 'user', 'action', 'error', 'assistant');
  const seen: number[] = [];
  for (const s of segmentChat(items, false)) {
    if (s.type === 'item') seen.push(s.index);
    else for (let i = s.start; i < s.end; i++) seen.push(i);
  }
  assert.deepEqual(seen, items.map((_, i) => i));
});
