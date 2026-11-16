// "Don't ask again" for the assistant's confirmations (src/agent/alwaysAllow.ts): which kinds can be allowed for good,
// that only an allow with the box ticked is remembered (a denial never), when a confirmation is skipped, and how the
// list is stored in settings.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  afterAnswer,
  ALWAYS_ALLOW_KINDS,
  cleanAlwaysAllow,
  isAlwaysAllowed,
  isAlwaysAllowKind,
  kindForSchedule,
  parseAlwaysAllow,
  serializeAlwaysAllow,
  withKind,
} from '../../src/agent/alwaysAllow.ts';

test('only low-risk phone actions can be allowed for good', () => {
  assert.deepEqual([...ALWAYS_ALLOW_KINDS], ['notification', 'calendarEvent', 'reminder']);
  for (const kind of ['click', 'type', 'download', 'upload', 'share', 'email', 'purchase', 'signIn', 'location', 'readCalendar'])
    assert.equal(isAlwaysAllowKind(kind), false, kind);
});

test('scheduling plans map to their kind', () => {
  assert.equal(kindForSchedule('notification'), 'notification');
  assert.equal(kindForSchedule('event'), 'calendarEvent');
  assert.equal(kindForSchedule('reminder'), 'reminder');
});

test('a confirmation is skipped only for a remembered kind', () => {
  assert.equal(isAlwaysAllowed(['notification'], 'notification'), true);
  assert.equal(isAlwaysAllowed(['notification'], 'reminder'), false);
  assert.equal(isAlwaysAllowed([], 'notification'), false);
  // No kind: an action on a page, a download, a share… always asks.
  assert.equal(isAlwaysAllowed([...ALWAYS_ALLOW_KINDS], undefined), false);
});

test('only "Allow" with the box ticked is remembered; a denial never is', () => {
  assert.deepEqual(afterAnswer([], 'notification', { allowed: true, dontAskAgain: true }), ['notification']);
  assert.deepEqual(afterAnswer([], 'notification', { allowed: true, dontAskAgain: false }), []);
  assert.deepEqual(afterAnswer([], 'notification', { allowed: false, dontAskAgain: true }), []);
  assert.deepEqual(afterAnswer([], 'notification', { allowed: false, dontAskAgain: false }), []);
  assert.deepEqual(afterAnswer(['reminder'], undefined, { allowed: true, dontAskAgain: true }), ['reminder']);
  // Denying an already remembered kind (it can't be asked, but if it were) doesn't take it away either.
  assert.deepEqual(afterAnswer(['reminder'], 'reminder', { allowed: false, dontAskAgain: true }), ['reminder']);
  // Once each, in the Settings order.
  assert.deepEqual(afterAnswer(['reminder'], 'notification', { allowed: true, dontAskAgain: true }), ['notification', 'reminder']);
  assert.deepEqual(afterAnswer(['notification'], 'notification', { allowed: true, dontAskAgain: true }), ['notification']);
});

test('Settings switches add and take away one kind', () => {
  assert.deepEqual(withKind([], 'calendarEvent', true), ['calendarEvent']);
  assert.deepEqual(withKind(['notification', 'calendarEvent'], 'notification', false), ['calendarEvent']);
  assert.deepEqual(withKind(['notification'], 'notification', true), ['notification']);
  assert.deepEqual(withKind([], 'reminder', false), []);
});

test('stored as a list of known kinds; anything else is dropped', () => {
  assert.equal(serializeAlwaysAllow(['reminder', 'notification']), 'notification,reminder');
  assert.equal(serializeAlwaysAllow([]), '');
  assert.deepEqual(parseAlwaysAllow('notification,reminder'), ['notification', 'reminder']);
  assert.deepEqual(parseAlwaysAllow(' reminder , click,notification,notification'), ['notification', 'reminder']);
  assert.deepEqual(parseAlwaysAllow(null), []);
  assert.deepEqual(parseAlwaysAllow(''), []);
  assert.deepEqual(cleanAlwaysAllow(['purchase', 'calendarEvent', 42]), ['calendarEvent']);
  for (const list of [[], ['notification'], [...ALWAYS_ALLOW_KINDS]] as const)
    assert.deepEqual(parseAlwaysAllow(serializeAlwaysAllow([...list])), [...list]);
});
