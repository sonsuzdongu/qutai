/**
 * ⌥Space, the keyboard's Qutai button on a Mac and an iPad (UI-81 in docs/design/27-interface.md): held, it listens
 * like holding the button and releasing sends; a short tap toggles instead (the first tap starts listening, the next
 * one sends). Pure: tested with node:test (scripts/layout-tests/voiceKey.test.ts).
 */

/** A press shorter than this is a tap (toggle); longer, a hold (released = sent). */
export const VOICE_TAP_MS = 300;

export type VoiceKeyState =
  | { kind: 'idle' }
  /** Down, listening; `since` when it went down. */
  | { kind: 'holding'; since: number }
  /** Tapped once: listening until the next tap. */
  | { kind: 'toggled' }
  /** The second tap's key is still down: its release does nothing. */
  | { kind: 'ending' };

export type VoiceKeyAction = 'start' | 'release' | null;

export const VOICE_KEY_IDLE: VoiceKeyState = { kind: 'idle' };

export function voiceKeyStep(
  state: VoiceKeyState,
  event: 'down' | 'up',
  now: number,
): { state: VoiceKeyState; action: VoiceKeyAction } {
  switch (state.kind) {
    case 'idle':
      return event === 'down' ? { state: { kind: 'holding', since: now }, action: 'start' } : { state, action: null };
    case 'holding':
      if (event === 'down') return { state, action: null };
      return now - state.since < VOICE_TAP_MS
        ? { state: { kind: 'toggled' }, action: null }
        : { state: VOICE_KEY_IDLE, action: 'release' };
    case 'toggled':
      return event === 'down' ? { state: { kind: 'ending' }, action: 'release' } : { state, action: null };
    case 'ending':
      return event === 'up' ? { state: VOICE_KEY_IDLE, action: null } : { state, action: null };
  }
}
