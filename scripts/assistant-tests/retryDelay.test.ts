// The wait before a request to an AI provider is tried again (src/ai/http.ts): 1, 2, 4 s, or the server's Retry-After
// when that is longer, never more than 20 s.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retryDelay } from '../../src/ai/http.ts';

test('retryDelay: the back-off, or a longer Retry-After, capped', () => {
  assert.deepEqual([0, 1, 2].map((n) => retryDelay(n, null)), [1000, 2000, 4000]);
  assert.equal(retryDelay(0, '7'), 7000);
  assert.equal(retryDelay(2, '1'), 4000, 'a shorter Retry-After never shortens the back-off');
  assert.equal(retryDelay(0, '600'), 20_000);
  assert.equal(retryDelay(0, 'soon'), 1000);
  assert.equal(retryDelay(0, ''), 1000);
  const now = Date.parse('2026-11-21T10:00:00Z');
  assert.equal(retryDelay(0, 'Sat, 21 Nov 2026 10:00:05 GMT', now), 5000);
  assert.equal(retryDelay(0, 'Sat, 21 Nov 2026 09:00:00 GMT', now), 1000, 'a date in the past');
});
