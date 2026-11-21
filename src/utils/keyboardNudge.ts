// Asking Android again for the keyboard once a text field has focus (used by the address bar), kept apart so it can
// be tested without React Native.
//
// Why: React Native's focus() on Android requests focus and the keyboard in one call. On Android 14 and later the
// keyboard service switches to the newly focused field a moment later, so when focus moves from the web page (which
// held the keyboard connection) to the address bar, the request is dropped ("onFailed at PHASE_CLIENT_VIEW_SERVED" in
// logcat): the field is focused, its text selected and the suggestions open, but no keyboard. A page losing focus can
// also hide the keyboard right after it opened. Asking again shortly after focus lands fixes both.

/** When to look again after the field got focus: soon, then for a page that hides the keyboard a little later. */
export const KEYBOARD_RETRY_MS = [60, 250, 600] as const;

type Nudge = {
  /** The field still has focus (a blur stops the retries). */
  isFocused: () => boolean;
  /** The keyboard is showing (then nothing more is asked). */
  keyboardShown: () => boolean;
  /** Asks for the keyboard again. */
  show: () => void;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
};

/**
 * Looks at KEYBOARD_RETRY_MS after focus and asks for the keyboard again each time it is not showing while the field
 * still has focus. Returns a cancel function (for a blur or unmount).
 */
export function nudgeKeyboard({ isFocused, keyboardShown, show, setTimer, clearTimer }: Nudge): () => void {
  const timers = KEYBOARD_RETRY_MS.map((ms) =>
    setTimer(() => {
      if (isFocused() && !keyboardShown()) show();
    }, ms),
  );
  return () => timers.forEach(clearTimer);
}
