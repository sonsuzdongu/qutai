// What "Open" and "Save…" do for a finished download on each kind of device (DL-19): src/storage/openFileSteps.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { offersSaveCopy, openSteps } from '../../src/storage/openFileSteps';

test('a Mac opens the file in its own app first, then Quick Look, then the share sheet', () => {
  assert.deepEqual(openSteps('mac', true), ['app', 'preview', 'share']);
  assert.deepEqual(openSteps('mac', false), ['app', 'share']);
});

test('an iPad previews with Quick Look and shares only what Quick Look cannot show', () => {
  assert.deepEqual(openSteps('tablet', true), ['preview', 'share']);
  assert.deepEqual(openSteps('tablet', false), ['share']);
});

test('an iPhone keeps the share sheet', () => {
  assert.deepEqual(openSteps('phone', true), ['share']);
  assert.deepEqual(openSteps('phone', false), ['share']);
});

test('every device ends with the share sheet as the last resort', () => {
  for (const device of ['mac', 'tablet', 'phone', 'android'] as const) {
    for (const canPreview of [true, false]) assert.equal(openSteps(device, canPreview).at(-1), 'share');
  }
});

test('"Save…" is offered on a Mac only', () => {
  assert.equal(offersSaveCopy('mac'), true);
  assert.equal(offersSaveCopy('tablet'), false);
  assert.equal(offersSaveCopy('phone'), false);
  assert.equal(offersSaveCopy('android'), false);
});
