/**
 * ⌥Space, the keyboard's Qutai button on a Mac and an iPad (UI-81 in docs/design/27-interface.md): it listens only
 * while held, and letting go sends. A press let go almost at once is too short a hold: it is cancelled and nothing is
 * sent, as nothing happens on the Qutai button then. Pure: tested with node:test (scripts/layout-tests/voiceKey.test.ts).
 */

/** A press shorter than this is too short a hold: cancelled, nothing sent. */
export const VOICE_MIN_HOLD_MS = 300;

export type VoiceKeyState =
  | { kind: 'idle' }
  /** Down, listening; `since` when it went down. */
  | { kind: 'holding'; since: number };

export type VoiceKeyAction = 'start' | 'release' | 'cancel' | null;

export const VOICE_KEY_IDLE: VoiceKeyState = { kind: 'idle' };

export function voiceKeyStep(
  state: VoiceKeyState,
  event: 'down' | 'up',
  now: number,
): { state: VoiceKeyState; action: VoiceKeyAction } {
  if (state.kind === 'idle') {
    return event === 'down' ? { state: { kind: 'holding', since: now }, action: 'start' } : { state, action: null };
  }
  // Key repeat while held: nothing more.
  if (event === 'down') return { state, action: null };
  return { state: VOICE_KEY_IDLE, action: now - state.since < VOICE_MIN_HOLD_MS ? 'cancel' : 'release' };
}
