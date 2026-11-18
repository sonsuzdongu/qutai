import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';

/**
 * What an error from the speech recogniser means for the session (src/device/voiceInput.ts), kept apart so it can be
 * tested without the native module.
 *
 * - `ignore`: nothing went wrong for the user. The session ends as if no error came: no notice, not failed, the words
 *   heard are kept (and sent when that was going to happen).
 * - `retry`: the recogniser turned the language down at the start; listening starts again in the next language.
 * - `online`: the on-device recogniser couldn't start (its model missing or not loadable, its service not bound):
 *   listening starts again in the same language with the phone's online recogniser, which the user allowed.
 * - `quiet`: the session failed, but without a notice (the words stay in the field, nothing is sent automatically).
 * - `report`: a real failure: the session failed and the user is told.
 */
export type VoiceErrorOutcome = 'ignore' | 'retry' | 'online' | 'quiet' | 'report';

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
  /** The session runs on the on-device recogniser and the online one is allowed (not incognito, the user agreed). */
  canGoOnline?: boolean;
};

/** Errors that mean the on-device recogniser itself couldn't start (Android: model, binding, a busy service). */
const ON_DEVICE_TROUBLE: ReadonlySet<ExpoSpeechRecognitionErrorCode> = new Set<ExpoSpeechRecognitionErrorCode>([
  'language-not-supported',
  'service-not-allowed',
  'client',
  'busy',
]);

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

export function voiceErrorOutcome({
  code,
  stopping,
  hasText,
  interrupted,
  canRetry,
  canGoOnline = false,
}: VoiceErrorInput): VoiceErrorOutcome {
  if (code === 'aborted') return 'ignore';
  // The on-device recogniser failed before hearing anything: the same language online, before any other language.
  if (canGoOnline && ON_DEVICE_TROUBLE.has(code) && !hasText && !interrupted && !stopping) return 'online';
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

export type KeepListeningInput = {
  /** The session listens through pauses (holding the Qutai button or the microphone, "Tell me about yourself"). */
  continuous: boolean;
  /** Qutai asked the recogniser to stop (the finger was lifted, Stop). */
  asked: boolean;
  /** Stopped by something other than the user (app left, a call, a dialog), or called off. */
  interrupted: boolean;
  /** Another start is already planned (next language, online). */
  restarting: boolean;
  /** The error the recogniser ended with, if any. */
  error: ExpoSpeechRecognitionErrorCode | null;
  /** Restarts so far in this hold. */
  restarts: number;
};

/** Restarts allowed in one hold: a recogniser that keeps ending at once is not started forever. */
export const MAX_RESTARTS = 4;

/**
 * Whether a held session the recogniser ended by itself starts listening again. Android's recogniser may end a
 * "continuous" session after a silence or a final result (older versions, some vendors' recognisers, the online
 * service's time limit) while the finger is still down; the hold goes on, with what was heard so far kept. A real
 * error (network, microphone, permission) ends it.
 */
export function shouldKeepListening({ continuous, asked, interrupted, restarting, error, restarts }: KeepListeningInput): boolean {
  if (!continuous || asked || interrupted || restarting || restarts >= MAX_RESTARTS) return false;
  return error === null || error === 'no-speech' || error === 'speech-timeout' || error === 'client';
}
