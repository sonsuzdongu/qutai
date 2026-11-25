// ⌥Space push-to-talk on a Mac and an iPad (UI-81): src/ui/voiceKey.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOICE_KEY_IDLE, VOICE_MIN_HOLD_MS, voiceKeyStep, type VoiceKeyState } from '../../src/ui/voiceKey';

/** Runs events [kind, time] from idle and returns the actions and the final state. */
function run(events: ['down' | 'up', number][]) {
  let state: VoiceKeyState = VOICE_KEY_IDLE;
  const actions: (string | null)[] = [];
  for (const [event, at] of events) {
    const next = voiceKeyStep(state, event, at);
    state = next.state;
    actions.push(next.action);
  }
  return { actions, state: state.kind };
}

test('holding listens and releasing sends', () => {
  assert.deepEqual(run([['down', 0], ['up', 1500]]), { actions: ['start', 'release'], state: 'idle' });
  assert.deepEqual(run([['down', 0], ['up', VOICE_MIN_HOLD_MS]]), { actions: ['start', 'release'], state: 'idle' });
});

test('a press let go almost at once is cancelled and never leaves listening on', () => {
  assert.deepEqual(run([['down', 0], ['up', 120]]), { actions: ['start', 'cancel'], state: 'idle' });
  assert.deepEqual(run([['down', 0], ['up', VOICE_MIN_HOLD_MS - 1]]), { actions: ['start', 'cancel'], state: 'idle' });
});

test('key repeat while held does nothing more', () => {
  assert.deepEqual(run([['down', 0], ['down', 500], ['down', 600], ['up', 900]]).actions, [
    'start',
    null,
    null,
    'release',
  ]);
});

test('a stray release with nothing going on does nothing', () => {
  assert.deepEqual(run([['up', 10]]), { actions: [null], state: 'idle' });
});

test('each press is its own session', () => {
  const r = run([['down', 0], ['up', 50], ['down', 1000], ['up', 2500]]);
  assert.deepEqual(r, { actions: ['start', 'cancel', 'start', 'release'], state: 'idle' });
});
