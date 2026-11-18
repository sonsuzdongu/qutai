// Errors from the speech recogniser (src/device/voiceError.ts): a late error after Qutai stopped listening, or one
// that comes once the words are in, never shows "Voice typing didn't work" nor throws the words away; a real failure
// with nothing heard is still reported.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voiceErrorOutcome, type VoiceErrorInput } from '../../src/device/voiceError.ts';

const base: VoiceErrorInput = { code: 'client', stopping: false, hasText: false, interrupted: false, canRetry: false };

test('Android\'s late "client" error after the finger is lifted, with the words in: ignored', () => {
  assert.equal(voiceErrorOutcome({ ...base, code: 'client', stopping: true, hasText: true }), 'ignore');
});

test('any error while stopping with words heard is ignored, so the words are kept and sent', () => {
  for (const code of ['client', 'no-speech', 'network', 'speech-timeout', 'busy', 'bad-grammar'] as const) {
    assert.equal(voiceErrorOutcome({ ...base, code, stopping: true, hasText: true }), 'ignore', code);
  }
});

test('the recogniser\'s own trouble while stopping with nothing heard: no notice either', () => {
  assert.equal(voiceErrorOutcome({ ...base, code: 'client', stopping: true }), 'ignore');
  assert.equal(voiceErrorOutcome({ ...base, code: 'bad-grammar', stopping: true }), 'ignore');
});

test('a meaningful error while stopping with nothing heard is still reported', () => {
  for (const code of ['no-speech', 'speech-timeout', 'network', 'not-allowed', 'audio-capture'] as const) {
    assert.equal(voiceErrorOutcome({ ...base, code, stopping: true }), 'report', code);
  }
});

test('a real failure with no text while listening is reported, the unknown ones too', () => {
  for (const code of ['client', 'network', 'no-speech', 'service-not-allowed', 'busy'] as const) {
    assert.equal(voiceErrorOutcome({ ...base, code }), 'report', code);
  }
});

test('words in while still listening: "client" is ignored, a real error ends it quietly', () => {
  assert.equal(voiceErrorOutcome({ ...base, code: 'client', hasText: true }), 'ignore');
  assert.equal(voiceErrorOutcome({ ...base, code: 'network', hasText: true }), 'quiet');
});

test('stopped by Qutai (panel closed, app left) or an interruption: quiet', () => {
  assert.equal(voiceErrorOutcome({ ...base, code: 'network', interrupted: true, stopping: true }), 'quiet');
  assert.equal(voiceErrorOutcome({ ...base, code: 'interrupted' }), 'quiet');
});

test('"aborted" is never anything', () => {
  assert.equal(voiceErrorOutcome({ ...base, code: 'aborted' }), 'ignore');
  assert.equal(voiceErrorOutcome({ ...base, code: 'aborted', hasText: true, stopping: true }), 'ignore');
});

test('a language turned down at the start goes on to the next one, but not once stopping or with words', () => {
  const code = 'language-not-supported';
  assert.equal(voiceErrorOutcome({ ...base, code, canRetry: true }), 'retry');
  assert.equal(voiceErrorOutcome({ ...base, code }), 'report');
  assert.equal(voiceErrorOutcome({ ...base, code, canRetry: true, stopping: true }), 'report');
  assert.equal(voiceErrorOutcome({ ...base, code, canRetry: true, hasText: true }), 'quiet');
});

// 18 Nov 2026: listening on Android started late and was unreliable. The on-device recogniser failing to start goes
// online (when allowed) instead of ending; a held session the recogniser ended by itself listens on.
import { MAX_RESTARTS, shouldKeepListening } from '../../src/device/voiceError.ts';

test('the on-device recogniser failing before anything was heard: the same language online, when allowed', () => {
  for (const code of ['language-not-supported', 'service-not-allowed', 'client', 'busy'] as const) {
    assert.equal(voiceErrorOutcome({ ...base, code, canGoOnline: true, canRetry: true }), 'online', code);
  }
  // Not allowed online (incognito, declined): the old outcomes.
  assert.equal(voiceErrorOutcome({ ...base, code: 'language-not-supported', canRetry: true }), 'retry');
  // Words already heard, stopping or interrupted: never restarted online.
  assert.notEqual(voiceErrorOutcome({ ...base, code: 'client', canGoOnline: true, hasText: true }), 'online');
  assert.notEqual(voiceErrorOutcome({ ...base, code: 'client', canGoOnline: true, stopping: true }), 'online');
  assert.notEqual(voiceErrorOutcome({ ...base, code: 'client', canGoOnline: true, interrupted: true }), 'online');
  // A network or microphone problem is not the on-device recogniser's.
  assert.equal(voiceErrorOutcome({ ...base, code: 'audio-capture', canGoOnline: true }), 'report');
});

const held = { continuous: true, asked: false, interrupted: false, restarting: false, error: null, restarts: 0 } as const;

test('a held session the recogniser ended by itself listens on', () => {
  assert.equal(shouldKeepListening(held), true);
  assert.equal(shouldKeepListening({ ...held, error: 'no-speech' }), true);
  assert.equal(shouldKeepListening({ ...held, error: 'speech-timeout' }), true);
  assert.equal(shouldKeepListening({ ...held, error: 'client' }), true);
});

test('it ends when the user stopped it, something interrupted it, a real error came or it keeps failing', () => {
  assert.equal(shouldKeepListening({ ...held, continuous: false }), false);
  assert.equal(shouldKeepListening({ ...held, asked: true }), false);
  assert.equal(shouldKeepListening({ ...held, interrupted: true }), false);
  assert.equal(shouldKeepListening({ ...held, restarting: true }), false);
  for (const error of ['network', 'audio-capture', 'not-allowed', 'service-not-allowed', 'language-not-supported'] as const) {
    assert.equal(shouldKeepListening({ ...held, error }), false, error);
  }
  assert.equal(shouldKeepListening({ ...held, restarts: MAX_RESTARTS }), false);
});
