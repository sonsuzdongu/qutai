// GET /config › auth: parseConfig must keep it, or Android's Sign in with Apple button (shown only when the server offers
// the web flow) can never appear.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseConfig } from '../../src/credits/client.ts';

test('config: auth.appleWeb is kept when the server offers it', () => {
  assert.deepEqual(parseConfig({ auth: { appleWeb: true } }).auth, { appleWeb: true });
  assert.deepEqual(parseConfig({ auth: { appleWeb: false } }).auth, { appleWeb: false });
});

test('config: only an explicit true turns the web flow on', () => {
  for (const appleWeb of [undefined, null, 'true', 1, {}]) {
    assert.deepEqual(parseConfig({ auth: { appleWeb } }).auth, { appleWeb: false }, JSON.stringify(appleWeb));
  }
});

test('config: an older server without auth leaves it absent', () => {
  for (const auth of [undefined, null, 'x', true, []]) {
    assert.equal(parseConfig({ auth }).auth, undefined, JSON.stringify(auth));
  }
});
