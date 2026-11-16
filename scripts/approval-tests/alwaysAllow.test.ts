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
  kindForDownload,
  kindForSchedule,
  parseAlwaysAllow,
  serializeAlwaysAllow,
  withKind,
} from '../../src/agent/alwaysAllow.ts';

test('every device-permission kind can be allowed for good, nothing done on a page or on the user\'s behalf', () => {
  assert.deepEqual([...ALWAYS_ALLOW_KINDS], ['notification', 'calendarEvent', 'reminder', 'calendarRead', 'location', 'download']);
  for (const kind of ALWAYS_ALLOW_KINDS) assert.equal(isAlwaysAllowKind(kind), true, kind);
  for (const kind of [
    'click',
    'type',
    'submit',
    'upload',
    'share',
    'email',
    'sms',
    'purchase',
    'payment',
    'signIn',
    'personalData',
    'removeBookmarks',
    'readCalendar',
  ])
    assert.equal(isAlwaysAllowKind(kind), false, kind);
});

test('a download offers "Don\'t ask again" only for an ordinary file outside incognito', () => {
  assert.equal(kindForDownload({ risky: false, incognito: false }), 'download');
  assert.equal(kindForDownload({ risky: true, incognito: false }), undefined);
  assert.equal(kindForDownload({ risky: false, incognito: true }), undefined);
  assert.equal(kindForDownload({ risky: true, incognito: true }), undefined);
  // So a remembered "download" never skips a risky file's or an incognito conversation's confirmation.
  assert.equal(isAlwaysAllowed(['download'], kindForDownload({ risky: true, incognito: false })), false);
  assert.equal(isAlwaysAllowed(['download'], kindForDownload({ risky: false, incognito: true })), false);
  assert.equal(isAlwaysAllowed(['download'], kindForDownload({ risky: false, incognito: false })), true);
});

test('"Deny" is never remembered for any kind, even with the box ticked: the next one asks again', () => {
  for (const kind of ALWAYS_ALLOW_KINDS) {
    const after = afterAnswer([], kind, { allowed: false, dontAskAgain: true });
    assert.deepEqual(after, [], kind);
    assert.equal(isAlwaysAllowed(after, kind), false, kind);
  }
});

test('"Allow" with the box ticked remembers each new kind, and Settings can take it back', () => {
  for (const kind of ['calendarRead', 'location', 'download'] as const) {
    const after = afterAnswer([], kind, { allowed: true, dontAskAgain: true });
    assert.deepEqual(after, [kind]);
    assert.equal(isAlwaysAllowed(after, kind), true);
    assert.deepEqual(afterAnswer([], kind, { allowed: true, dontAskAgain: false }), []);
    assert.deepEqual(withKind(after, kind, false), []);
  }
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
  assert.equal(serializeAlwaysAllow(['download', 'location', 'notification', 'calendarRead']), 'notification,calendarRead,location,download');
  assert.deepEqual(parseAlwaysAllow('download,submit,location'), ['location', 'download']);
  for (const list of [[], ['notification'], [...ALWAYS_ALLOW_KINDS]] as const)
    assert.deepEqual(parseAlwaysAllow(serializeAlwaysAllow([...list])), [...list]);
});
