// Where a toast sits (Toast.tsx); kept apart so it can be tested without React Native.

/** Space between the toast and what is under it. */
const GAP = 16;

/**
 * The toast's distance from the bottom of the screen (UI-48): above the navigation bar or the open keyboard, whichever
 * reaches higher, and above a bar along the bottom (`bar`: the address bar at the bottom, the tab switcher's toolbar),
 * which rises with the keyboard. It never sits under another bar.
 */
export function toastBottom(insetBottom: number, keyboard: number, bar: number) {
  return Math.max(insetBottom, keyboard) + Math.max(0, bar) + GAP;
}
