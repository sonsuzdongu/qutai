// The chat follows a streaming answer only while the user is at the end (UI-30): before, it jumped back to the end on
// every streamed piece, so an earlier message could not be read while Qutai was answering.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAtEnd, nextFollowing } from '../../src/chat/followEnd.ts';

const at = (offset: number) => ({ offset, viewport: 600, content: 2000 });

test('the end, and a little short of it, count as the end', () => {
  assert.equal(isAtEnd(at(1400)), true);
  assert.equal(isAtEnd(at(1360)), true);
  assert.equal(isAtEnd(at(1000)), false);
});

test('scrolling up by hand stops following, scrolling back down starts it again', () => {
  let following = true;
  following = nextFollowing(following, at(900), true);
  assert.equal(following, false);
  following = nextFollowing(following, at(1395), true);
  assert.equal(following, true);
});

test('content growing under a still list, or the list scrolling itself, never stops following', () => {
  // The answer grew by 400 points; the list has not caught up yet.
  assert.equal(nextFollowing(true, { offset: 1400, viewport: 600, content: 2400 }, false), true);
});

test('not following: the answer growing does not start it, reaching the end does', () => {
  assert.equal(nextFollowing(false, at(900), false), false);
  assert.equal(nextFollowing(false, at(1400), false), true);
});
