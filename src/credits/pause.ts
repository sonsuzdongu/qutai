import type { RelayPause } from './types';

/**
 * Whether a Qutai Credits answer that paused (Anthropic `pause_turn`; backend/README.md › Relay › pause_turn) is
 * continued at once as the next step, and with what. Not when the server gave no continuation (a turn it can't sign),
 * when the next step would pass the step limit (continuations count like any step), or when the continuation has
 * expired; the task then ends with the pause note. Pure, for the tests.
 */
export function continueAfterPause(pause: RelayPause | undefined, step: number, maxSteps: number, now: number): RelayPause | null {
  if (!pause) return null;
  if (step + 1 >= maxSteps) return null;
  if (pause.expiresAt <= now) return null;
  return pause;
}
