// The online speech setting's starting value (src/device/voiceOnlineDefault.ts): on for a fresh install on a Mac,
// asked on phones and iPads, and a stored answer is never changed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voiceOnlineFor } from '../../src/device/voiceOnlineDefault.ts';

test('a fresh install: on on a Mac, ask elsewhere', () => {
  assert.equal(voiceOnlineFor(null, true), 'allowed');
  assert.equal(voiceOnlineFor(undefined, true), 'allowed');
  assert.equal(voiceOnlineFor(null, false), 'ask');
  assert.equal(voiceOnlineFor('nonsense', false), 'ask');
});

test('a stored answer always wins, also on a Mac', () => {
  for (const onMac of [true, false]) {
    assert.equal(voiceOnlineFor('declined', onMac), 'declined');
    assert.equal(voiceOnlineFor('allowed', onMac), 'allowed');
    assert.equal(voiceOnlineFor('ask', onMac), 'ask');
  }
});
