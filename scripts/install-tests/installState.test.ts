import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installAction, parseMarker } from '../../src/storage/installState';

test('a marker from an earlier launch: nothing to do', () => {
  for (const db of ['present', 'missing', 'unknown'] as const) assert.equal(installAction('done', db), 'none');
});

test('no marker and no database: a new installation, clear leftovers', () => {
  assert.equal(installAction('missing', 'missing'), 'wipe');
});

test('no marker but a database: an existing installation updating, keep everything', () => {
  assert.equal(installAction('missing', 'present'), 'markExisting');
});

test('anything unreadable: never wipe', () => {
  assert.equal(installAction('unknown', 'missing'), 'none');
  assert.equal(installAction('unknown', 'present'), 'none');
  assert.equal(installAction('missing', 'unknown'), 'none');
});

test('an unfinished wipe is finished', () => {
  assert.equal(installAction('pending', 'present'), 'wipe');
  assert.equal(installAction('pending', 'missing'), 'wipe');
});

test('marker content', () => {
  assert.equal(parseMarker(null), 'missing');
  assert.equal(parseMarker('pending\n'), 'pending');
  assert.equal(parseMarker('done'), 'done');
  assert.equal(parseMarker('garbage'), 'done');
  assert.equal(parseMarker(''), 'done');
});
