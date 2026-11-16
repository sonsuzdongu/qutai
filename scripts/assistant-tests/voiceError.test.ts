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
