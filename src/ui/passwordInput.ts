/**
 * Logic of the shared password field (PasswordField.tsx), kept free of React Native so the tests can run it.
 *
 * iOS: a UITextField that becomes secure while it is being edited behaves like a secure field entered anew, so the next
 * key replaces everything typed so far (a letter leaves only that letter, backspace empties the field). Hiding the
 * password with the eye would wipe it on the next key. After the eye hides the text, the first change is checked: if
 * the field kept nothing of the text around the cursor, it was this wipe, and the edit is applied to the text instead.
 */

export type Selection = { start: number; end: number };

/** How many characters `a` and `b` share at the start, and at the end (not overlapping each other). */
function sharedEnds(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < max && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < max - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  return prefix + suffix;
}

/**
 * The text after the first change that follows re-securing the field (iOS). `previous` is the text before the change,
 * `next` what the field reports, `selection` the cursor or selection before the change.
 * - An ordinary edit (typing or deleting at the cursor, replacing the selection) keeps at least the text outside the
 *   selection, less one character for a backspace: returned unchanged.
 * - A wipe kept less than that: `next` is only what was typed (empty for a backspace), applied at the selection.
 */
export function repairSecureReentry(previous: string, next: string, selection: Selection): string {
  if (previous.length === 0) return next;
  const start = Math.max(0, Math.min(selection.start, selection.end, previous.length));
  const end = Math.min(previous.length, Math.max(selection.start, selection.end));
  // Everything was selected: replacing all of it is what the user did.
  if (start === 0 && end === previous.length) return next;
  const removable = Math.max(end - start, 1);
  if (sharedEnds(previous, next) >= previous.length - removable) return next;
  if (next.length === 0) {
    // Backspace: the character before the cursor, or the selection.
    return start === end ? previous.slice(0, Math.max(0, start - 1)) + previous.slice(end) : previous.slice(0, start) + previous.slice(end);
  }
  return previous.slice(0, start) + next + previous.slice(end);
}

/** The keyboard and autofill hints for a password the user makes up now ('new') or one they already have ('current'). */
export function passwordHints(purpose: 'new' | 'current') {
  return purpose === 'new'
    ? ({ autoComplete: 'new-password', textContentType: 'newPassword' } as const)
    : ({ autoComplete: 'current-password', textContentType: 'password' } as const);
}
