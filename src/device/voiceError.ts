import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';

/**
 * What an error from the speech recogniser means for the session (src/device/voiceInput.ts), kept apart so it can be
 * tested without the native module.
 *
 * - `ignore`: nothing went wrong for the user. The session ends as if no error came: no notice, not failed, the words
 *   heard are kept (and sent when that was going to happen).
 * - `retry`: the recogniser turned the language down at the start; listening starts again in the next language.
 * - `quiet`: the session failed, but without a notice (the words stay in the field, nothing is sent automatically).
 * - `report`: a real failure: the session failed and the user is told.
 */
export type VoiceErrorOutcome = 'ignore' | 'retry' | 'quiet' | 'report';

export type VoiceErrorInput = {
  code: ExpoSpeechRecognitionErrorCode;
  /** Qutai asked the recogniser to stop (the user lifted the finger or tapped the microphone, or Qutai stopped it). */
  stopping: boolean;
  /** Words were recognised in this session (final or interim). */
  hasText: boolean;
  /** Stopped by something other than the user (panel closed, app left, a call…). */
  interrupted: boolean;
  /** Another language is left to try. */
  canRetry: boolean;
};

/**
 * Codes that say something about the session itself. Anything else (Android's "client", "unknown"…) is the
 * recogniser's own trouble; Android sends "client" late, after Qutai stopped it, even when the words came through.
 */
const MEANINGFUL: ReadonlySet<ExpoSpeechRecognitionErrorCode> = new Set<ExpoSpeechRecognitionErrorCode>([
  'no-speech',
  'speech-timeout',
  'network',
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'busy',
  'too-many-requests',
  'interrupted',
  'language-not-supported',
]);

export function voiceErrorOutcome({ code, stopping, hasText, interrupted, canRetry }: VoiceErrorInput): VoiceErrorOutcome {
  if (code === 'aborted') return 'ignore';
  // Android only finds out when listening starts that the online recogniser lacks the language: the next one.
  if (code === 'language-not-supported' && !hasText && !interrupted && !stopping && canRetry) return 'retry';
  // Qutai stopped it itself (panel closed, app left…): no message about what followed.
  if (interrupted || code === 'interrupted') return 'quiet';
  const meaningful = MEANINGFUL.has(code);
  // Stopping on purpose: whatever the recogniser says now comes after the words, or is its own trouble with no
  // words lost. Only a meaningful error with nothing heard is still worth telling (no speech, no network…).
  if (stopping && (hasText || !meaningful)) return 'ignore';
  if (hasText) {
    // The recogniser's own trouble once the words are in (some Android recognisers end a held session this way):
    // the words are what the user said.
    if (!meaningful) return 'ignore';
    // A real error cut listening short: the words stay in the field, without a notice that would contradict them,
    // and are not sent on their own since they may be incomplete.
    return 'quiet';
  }
  return 'report';
}
