/**
 * The "Use the online speech service" setting's starting value (VOICE-25 in docs/design/25-voice.md). Pure: no React
 * Native, so it is tested with node:test (scripts/voice-tests/voiceOnlineDefault.test.ts).
 */
import type { VoiceOnline } from './voiceInput';

/**
 * A stored answer ('allowed', 'declined', or 'ask' saved by an earlier version) always wins. With nothing stored (a
 * fresh install): on a Mac, where the iOS app can't recognise speech on the device and voice input only works through
 * Apple's online speech service, the setting starts on ('allowed'); on phones and iPads Qutai asks the first time it is
 * needed ('ask'), as before.
 */
export function voiceOnlineFor(stored: string | null | undefined, onMac: boolean): VoiceOnline {
  if (stored === 'allowed' || stored === 'declined' || stored === 'ask') return stored;
  return onMac ? 'allowed' : 'ask';
}
