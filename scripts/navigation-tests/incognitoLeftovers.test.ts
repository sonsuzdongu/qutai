// An ended incognito session's files (INC-30): a removal that fails is recorded and tried once more, but not once a
// new incognito session has started, whose files the removal would take.
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { removeIncognitoFiles } from '../../src/browser/Browser';
import { recentStorageFailures, resetStorageFailures } from '../../src/storage/failures';

afterEach(() => {
  mock.timers.reset();
  resetStorageFailures();
});

function failingOnce() {
  let calls = 0;
  return {
    remove: () => {
      calls++;
      if (calls === 1) throw new Error('busy');
    },
    calls: () => calls,
  };
}

test('a failed removal is recorded and tried again', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const r = failingOnce();
  removeIncognitoFiles('incognito.test', r.remove, () => true, 2000);
  assert.equal(r.calls(), 1);
  assert.deepEqual(recentStorageFailures().map((f) => f.label), ['incognito.test']);
  mock.timers.tick(2000);
  assert.equal(r.calls(), 2);
});

test('no second try once a new incognito session has started', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const r = failingOnce();
  removeIncognitoFiles('incognito.test', r.remove, () => false, 2000);
  mock.timers.tick(2000);
  assert.equal(r.calls(), 1);
});

test('a removal that works is not repeated', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  removeIncognitoFiles('incognito.test', () => void calls++, () => true, 2000);
  mock.timers.tick(5000);
  assert.equal(calls, 1);
  assert.equal(recentStorageFailures().length, 0);
});
