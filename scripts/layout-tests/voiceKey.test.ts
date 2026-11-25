// ⌥Space push-to-talk on a Mac and an iPad (UI-81): src/ui/voiceKey.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOICE_KEY_IDLE, voiceKeyStep, type VoiceKeyEvent, type VoiceKeyState } from '../../src/ui/voiceKey';

/** Runs [event, press] pairs from idle and returns the actions and the final state. */
function run(events: [VoiceKeyEvent, number][]) {
  let state: VoiceKeyState = VOICE_KEY_IDLE;
  const actions: (string | null)[] = [];
  for (const [event, press] of events) {
    const next = voiceKeyStep(state, event, press);
    state = next.state;
    actions.push(next.action);
  }
  return { actions, state: state.kind };
}

test('held past the hold time it listens, and letting go sends', () => {
  assert.deepEqual(run([['down', 1], ['timer', 1], ['up', 1]]), { actions: ['arm', 'start', 'release'], state: 'idle' });
});

test('a quick press never starts the microphone', () => {
  assert.deepEqual(run([['down', 1], ['up', 1]]), { actions: ['arm', null], state: 'idle' });
  // Its timer firing late changes nothing.
  assert.deepEqual(run([['down', 1], ['up', 1], ['timer', 1]]), { actions: ['arm', null, null], state: 'idle' });
});

test('many quick presses in a row start nothing, and an old timer never starts a newer press', () => {
  const r = run([
    ['down', 1],
    ['up', 1],
    ['down', 2],
    ['up', 2],
    ['down', 3],
    ['timer', 1],
    ['timer', 2],
  ]);
  assert.deepEqual(r, { actions: ['arm', null, 'arm', null, 'arm', null, null], state: 'armed' });
  assert.deepEqual(voiceKeyStep({ kind: 'armed', press: 3 }, 'timer', 3).action, 'start');
});

test('key repeat and duplicate presses while held do nothing', () => {
  assert.deepEqual(run([['down', 1], ['down', 1], ['timer', 1], ['down', 1], ['up', 1]]).actions, [
    'arm',
    null,
    'start',
    null,
    'release',
  ]);
});

test('losing the window ends the press: cancelled while listening, nothing before', () => {
  assert.deepEqual(run([['down', 1], ['timer', 1], ['blur', 1]]), { actions: ['arm', 'start', 'cancel'], state: 'idle' });
  assert.deepEqual(run([['down', 1], ['blur', 1]]), { actions: ['arm', null], state: 'idle' });
  // The key's release after that does nothing more: exactly one end per press.
  assert.deepEqual(run([['down', 1], ['timer', 1], ['blur', 1], ['up', 1]]).actions, ['arm', 'start', 'cancel', null]);
});

test('a stray release or timer with nothing going on does nothing', () => {
  assert.deepEqual(run([['up', 1], ['timer', 1], ['blur', 1]]), { actions: [null, null, null], state: 'idle' });
});
