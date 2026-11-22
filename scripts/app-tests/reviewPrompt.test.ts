// The rating sheet on its own (src/device/reviewPromptRule.ts, UI-41): once on the 3rd and once on the 30th day Qutai
// is opened, counting calendar days, not launches.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dueReviewDay,
  EMPTY_REVIEW_STATE,
  localDay,
  markAsked,
  parseReviewState,
  recordDay,
  type ReviewPromptState,
} from '../../src/device/reviewPromptRule.ts';

function openOn(days: string[], start: ReviewPromptState = EMPTY_REVIEW_STATE): ReviewPromptState {
  return days.reduce(recordDay, start);
}

test('several launches on one day count once', () => {
  const s = openOn(['2026-11-23', '2026-11-23', '2026-11-23']);
  assert.equal(s.days, 1);
  assert.equal(dueReviewDay(s), null);
});

test('the 3rd day of use is due, days need not be in a row', () => {
  const s = openOn(['2026-11-01', '2026-11-05', '2026-11-20']);
  assert.equal(s.days, 3);
  assert.equal(dueReviewDay(s), 3);
});

test('asked on day 3: not again until day 30', () => {
  let s = markAsked(openOn(['d1', 'd2', 'd3']), 3);
  assert.equal(dueReviewDay(s), null);
  s = openOn(Array.from({ length: 26 }, (_, i) => `e${i}`), s);
  assert.equal(s.days, 29);
  assert.equal(dueReviewDay(s), null);
  s = recordDay(s, 'last');
  assert.equal(dueReviewDay(s), 30);
  s = markAsked(s, 30);
  assert.equal(dueReviewDay(recordDay(s, 'later')), null);
});

test('a missed day stays due; reaching day 30 first asks only once', () => {
  const s = { days: 31, lastDay: 'x', asked: [] };
  assert.equal(dueReviewDay(s), 30);
  assert.deepEqual(markAsked(s, 30).asked, [3, 30]);
});

test('stored state: unreadable starts over, a good one round-trips', () => {
  assert.deepEqual(parseReviewState(null), EMPTY_REVIEW_STATE);
  assert.deepEqual(parseReviewState('{bad'), EMPTY_REVIEW_STATE);
  const s = { days: 4, lastDay: '2026-11-23', asked: [3] };
  assert.deepEqual(parseReviewState(JSON.stringify(s)), s);
});

test('local day is YYYY-MM-DD in the phone time zone', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
