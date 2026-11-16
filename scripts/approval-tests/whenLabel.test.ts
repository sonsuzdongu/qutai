// The time in a confirmation (src/agent/whenLabel.ts): relative first with the clock time in brackets, the full date a
// day or more ahead, and the time-zone line only when the time was given in another zone than the phone's. Run with
// TZ=Europe/Istanbul (package.json), so the clock times below are fixed.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { describePlan, planSchedule } from '../../src/agent/scheduling.ts';
import { givenOffsetMinutes, showsTimeZone, whenLabel } from '../../src/agent/whenLabel.ts';
import { setLanguage } from '../../src/i18n/index.ts';

// Monday 16 November 2026, 13:33:00 in Istanbul (UTC+3).
const NOW = Date.UTC(2026, 10, 16, 10, 33, 0);
const at = (minutes: number, seconds = 0) => new Date(NOW + minutes * 60_000 + seconds * 1000);

afterEach(() => setLanguage('en'));

test('the phone runs in the fixed test time zone', () => {
  assert.equal(new Date(NOW).getTimezoneOffset(), -180);
});

test('English: in N minutes (clock)', () => {
  setLanguage('en');
  assert.equal(whenLabel(at(3), NOW), 'in 3 minutes (01:36 PM)');
  assert.equal(whenLabel(at(1), NOW), 'in 1 minute (01:34 PM)');
  assert.equal(whenLabel(at(0, 10), NOW), 'in 10 seconds (01:33 PM)');
  assert.equal(whenLabel(at(0, 1), NOW), 'in 1 second (01:33 PM)');
  assert.equal(whenLabel(at(125), NOW), 'in 2 hours 5 minutes (03:38 PM)');
  assert.equal(whenLabel(at(60), NOW), 'in 1 hour (02:33 PM)');
});

test('Turkish: N dakika sonra (saat)', () => {
  setLanguage('tr');
  assert.equal(whenLabel(at(3), NOW), '3 dakika sonra (13:36)');
  assert.equal(whenLabel(at(7), NOW), '7 dakika sonra (13:40)');
  assert.equal(whenLabel(at(0, 30), NOW), '30 saniye sonra (13:33)');
  assert.equal(whenLabel(at(90), NOW), '1 saat 30 dakika sonra (15:03)');
});

test('after midnight it says tomorrow; a day or more ahead is the full date', () => {
  setLanguage('tr');
  // 13:33 + 11 h 27 min = 01:00 the next day.
  assert.equal(whenLabel(at(11 * 60 + 27), NOW), '11 saat 27 dakika sonra (yarın 01:00)');
  assert.equal(whenLabel(at(23 * 60 + 59), NOW), '23 saat 59 dakika sonra (yarın 13:32)');
  const far = whenLabel(at(24 * 60), NOW);
  assert.match(far, /17 Kasım 2026/);
  assert.doesNotMatch(far, /sonra/);
  setLanguage('en');
  assert.match(whenLabel(at(3 * 24 * 60), NOW), /November 19, 2026/);
});

test('a time already past (the dialog waited) is the clock time alone', () => {
  setLanguage('tr');
  assert.equal(whenLabel(at(-1), NOW), '13:32');
  assert.equal(whenLabel(at(0), NOW), '13:33');
});

test('the offset a time was given with', () => {
  assert.equal(givenOffsetMinutes('2026-11-16T13:36'), null);
  assert.equal(givenOffsetMinutes('2026-11-16 13:36:00'), null);
  assert.equal(givenOffsetMinutes('2026-11-16T13:36:00+03:00'), 180);
  assert.equal(givenOffsetMinutes('2026-11-16T13:36:00+0300'), 180);
  assert.equal(givenOffsetMinutes('2026-11-16T10:36:00Z'), 0);
  assert.equal(givenOffsetMinutes('2026-11-16T05:36-05:00'), -300);
  assert.equal(givenOffsetMinutes(undefined), null);
  assert.equal(givenOffsetMinutes(600), null);
});

test('the time zone is named only when the time came in another zone', () => {
  const when = at(3);
  assert.equal(showsTimeZone(when, null), false);
  assert.equal(showsTimeZone(when, undefined), false);
  assert.equal(showsTimeZone(when, 180), false);
  assert.equal(showsTimeZone(when, 0), true);
  assert.equal(showsTimeZone(when, -300), true);
});

/** The text lines of a notification's confirmation. */
function notificationLines(input: Record<string, unknown>): string[] {
  const plan = planSchedule('schedule_notification', { title: 'Tea', body: 'The tea is ready', ...input }, NOW);
  assert.notEqual(typeof plan, 'string', String(plan));
  if (typeof plan === 'string') return [];
  return describePlan(plan, false, NOW).lines.map((line) => line.text);
}

test('notification dialog: relative time first, no time-zone line for the phone\'s own time', () => {
  setLanguage('tr');
  assert.deepEqual(notificationLines({ time: '2026-11-16T13:36' }).slice(1), ['“Tea”', 'The tea is ready', '3 dakika sonra (13:36)']);
  assert.deepEqual(notificationLines({ delay_seconds: 420 }).slice(1), ['“Tea”', 'The tea is ready', '7 dakika sonra (13:40)']);
  // Given with the phone's own offset: still no line.
  assert.equal(notificationLines({ time: '2026-11-16T13:36:00+03:00' }).length, 4);
  setLanguage('en');
  assert.equal(notificationLines({ time: '2026-11-16T13:36' })[3], 'in 3 minutes (01:36 PM)');
});

test('notification dialog: a time given in another zone names the zone; far dates keep the full date', () => {
  setLanguage('tr');
  // 11:00 UTC is 14:00 in Istanbul.
  const lines = notificationLines({ time: '2026-11-16T11:00:00Z' });
  assert.equal(lines[3], '27 dakika sonra (14:00)');
  assert.equal(lines.length, 5);
  assert.match(lines[4], /^Saat dilimi: /);
  const far = notificationLines({ time: '2026-11-20T09:00' })[3];
  assert.match(far, /20 Kasım 2026/);
});
