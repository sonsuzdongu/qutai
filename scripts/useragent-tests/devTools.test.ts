// "Allow developer tools" (WPERM-20): src/browser/devTools.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { devToolsFor, tabInspectable } from '../../src/browser/devTools.ts';

test('a fresh install allows developer tools on a Mac only', () => {
  assert.equal(devToolsFor(null, true), true);
  assert.equal(devToolsFor(undefined, false), false);
});

test('a stored choice is kept', () => {
  assert.equal(devToolsFor('false', true), false);
  assert.equal(devToolsFor('true', false), true);
  assert.equal(devToolsFor('garbage', false), false);
});

test('incognito tabs are never inspectable on iOS; Android has one switch for every web view', () => {
  assert.equal(tabInspectable(true, false, 'ios'), true);
  assert.equal(tabInspectable(true, true, 'ios'), false);
  assert.equal(tabInspectable(false, false, 'ios'), false);
  assert.equal(tabInspectable(true, true, 'android'), true);
  assert.equal(tabInspectable(false, true, 'android'), false);
});
