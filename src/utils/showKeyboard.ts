import { Platform, type TextInputInstance } from 'react-native';

type FocusCommands = { focus: (input: TextInputInstance) => void };

// React Native's own native "focus" command for Android text fields. TextInput.focus() skips a field that already
// has focus, but the native command on a focused field asks the keyboard service to show the keyboard again (why we
// need that: keyboardNudge.ts). Not part of React Native's typed API, so it is looked up once and left out if missing.
const commands: FocusCommands | null = (() => {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require('react-native/Libraries/Components/TextInput/AndroidTextInputNativeComponent') as {
      Commands?: FocusCommands;
    };
    return typeof native.Commands?.focus === 'function' ? native.Commands : null;
  } catch {
    return null;
  }
})();

/** Asks Android to show the keyboard for a field that already has focus; nothing on iOS. */
export function showKeyboardFor(input: TextInputInstance | null) {
  if (!input || !commands) return;
  try {
    commands.focus(input);
  } catch {
    // A field that has just gone away: nothing to show.
  }
}
