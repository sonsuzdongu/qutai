// "Task finished" notifications (src/agent/taskNotice.ts): only while Qutai is not on screen, never for incognito
// conversations, not twice when "Keep working in the background" already notifies, and with "Notify me when a task
// finishes" off only when the task needs the user.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { taskNoticeFor, type TaskNoticeInput } from '../../src/agent/taskNotice.ts';

const away: Omit<TaskNoticeInput, 'event'> = {
  foreground: false,
  incognito: false,
  backgroundRunNotifies: false,
  notifyWhenDone: true,
};

test('in the background every ending is notified: done, failed, a question, a confirmation', () => {
  for (const event of ['done', 'failed', 'needsAnswer', 'needsApproval'] as const) {
    assert.equal(taskNoticeFor({ ...away, event }), event);
  }
});

test('nothing in the foreground, and nothing for a task the user stopped', () => {
  for (const event of ['done', 'failed', 'needsAnswer', 'needsApproval'] as const) {
    assert.equal(taskNoticeFor({ ...away, event, foreground: true }), null);
  }
  assert.equal(taskNoticeFor({ ...away, event: 'stopped' }), null);
});

test('never for an incognito conversation', () => {
  for (const event of ['done', 'failed', 'needsAnswer', 'needsApproval'] as const) {
    assert.equal(taskNoticeFor({ ...away, event, incognito: true }), null);
  }
});

test('not twice: the background run already posted its own notification', () => {
  assert.equal(taskNoticeFor({ ...away, event: 'done', backgroundRunNotifies: true }), null);
  assert.equal(taskNoticeFor({ ...away, event: 'needsApproval', backgroundRunNotifies: true }), null);
});

test('with "Notify me when a task finishes" off, only a task that needs the user', () => {
  const off = { ...away, notifyWhenDone: false };
  assert.equal(taskNoticeFor({ ...off, event: 'done' }), null);
  assert.equal(taskNoticeFor({ ...off, event: 'failed' }), null);
  assert.equal(taskNoticeFor({ ...off, event: 'needsAnswer' }), 'needsAnswer');
  assert.equal(taskNoticeFor({ ...off, event: 'needsApproval' }), 'needsApproval');
});
