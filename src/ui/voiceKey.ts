/**
 * ⌥Space, the keyboard's Qutai button on a Mac and an iPad (UI-81 in docs/design/27-interface.md): it listens only
 * while held, and letting go sends. The microphone starts only once the key has been held VOICE_MIN_HOLD_MS, so a
 * quick press never touches the audio (as on the Qutai button, a press that short does nothing). Every press has
 * exactly one end: its release, or losing the window (cancelled). Key repeat is ignored. Pure: tested with node:test
 * (scripts/layout-tests/voiceKey.test.ts).
 */

/** Held at least this long before listening starts; let go sooner, nothing happens. */
export const VOICE_MIN_HOLD_MS = 300;

export type VoiceKeyState =
  | { kind: 'idle' }
  /** Down, waiting for VOICE_MIN_HOLD_MS; `press` tells this press's timer from an older one. */
  | { kind: 'armed'; press: number }
  /** Held long enough: listening until released. */
  | { kind: 'holding'; press: number };

/**
 * arm: start the timer for this press (`voiceKeyStep(state, 'timer', press)` when it fires). start / release /
 * cancel: the push-to-talk's own start, send, call off.
 */
export type VoiceKeyAction = 'arm' | 'start' | 'release' | 'cancel' | null;

/** down / up: the key; timer: the hold time passed for press `press`; blur: the window lost focus. */
export type VoiceKeyEvent = 'down' | 'up' | 'timer' | 'blur';

export const VOICE_KEY_IDLE: VoiceKeyState = { kind: 'idle' };

export function voiceKeyStep(
  state: VoiceKeyState,
  event: VoiceKeyEvent,
  press: number,
): { state: VoiceKeyState; action: VoiceKeyAction } {
  const none = { state, action: null };
  switch (state.kind) {
    case 'idle':
      return event === 'down' ? { state: { kind: 'armed', press }, action: 'arm' } : none;
    case 'armed':
      if (event === 'timer') return press === state.press ? { state: { kind: 'holding', press }, action: 'start' } : none;
      // Let go (or the window went away) before the hold time: nothing was started, nothing to end.
      if (event === 'up' || event === 'blur') return { state: VOICE_KEY_IDLE, action: null };
      return none;
    case 'holding':
      if (event === 'up') return { state: VOICE_KEY_IDLE, action: 'release' };
      if (event === 'blur') return { state: VOICE_KEY_IDLE, action: 'cancel' };
      return none;
  }
}
