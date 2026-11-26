// iOS: files in Qutai's own Downloads folder that no list entry points to (src/storage/downloadLeftovers.ts, INC-31).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leftoverNames } from '../../src/storage/downloadLeftovers.ts';

test('a file no entry names is a leftover; listed and running downloads are kept', () => {
  const entries = [
    { name: 'report.pdf', uri: 'file:///var/app/Documents/Downloads/report.pdf' },
    { name: 'running.zip', uri: null },
  ];
  assert.deepEqual(leftoverNames(['report.pdf', 'running.zip', 'private.jpg', 'half.mp4'], entries), ['private.jpg', 'half.mp4']);
  assert.deepEqual(leftoverNames([], entries), []);
  assert.deepEqual(leftoverNames(['a.txt'], []), ['a.txt']);
});

test("a file is kept when only the entry's address names it, encoded or not", () => {
  const entries = [
    { name: 'renamed later', uri: 'file:///d/Downloads/yaz%20tatili%20(1).jpg' },
    { name: 'x', uri: 'file:///d/Downloads/100%.txt' },
  ];
  assert.deepEqual(leftoverNames(['yaz tatili (1).jpg', '100%.txt', 'other.jpg'], entries), ['other.jpg']);
});
