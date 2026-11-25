// ⌥Space push-to-talk on a Mac and an iPad (UI-81): src/ui/voiceKey.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOICE_KEY_IDLE, VOICE_TAP_MS, voiceKeyStep, type VoiceKeyState } from '../../src/ui/voiceKey';

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
  assert.deepEqual(run([['down', 0], ['up', VOICE_TAP_MS]]), { actions: ['start', 'release'], state: 'idle' });
});

test('a short tap keeps listening, the next tap sends', () => {
  const r = run([['down', 0], ['up', 120], ['down', 4000], ['up', 4100]]);
  assert.deepEqual(r, { actions: ['start', null, 'release', null], state: 'idle' });
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

test('after a session the next press starts a new one', () => {
  const r = run([['down', 0], ['up', 2000], ['down', 3000], ['up', 3050]]);
  assert.deepEqual(r, { actions: ['start', 'release', 'start', null], state: 'toggled' });
});
