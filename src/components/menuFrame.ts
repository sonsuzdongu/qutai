// Where the page menu (PageMenu.tsx) goes and how tall it may get; kept apart so it can be tested without React Native.

/** The address bar's height: the menu starts just past it. */
const BAR = 48;
/** Room kept free between the menu and the screen edge (system bar, keyboard) on the far side. */
const MARGIN = 8;

/**
 * The menu's position and greatest height in a window `area` tall (the modal's own size, so the system bars are
 * inside it): it never runs under the status bar, the navigation bar, the keyboard or the address bar.
 */
export function menuFrame(area: number, insetTop: number, insetBottom: number, keyboard: number, anchor: 'top' | 'bottom') {
  const below = Math.max(insetBottom, keyboard);
  if (anchor === 'bottom') {
    const bottom = below + BAR;
    return { top: undefined, bottom, maxHeight: Math.max(0, area - bottom - insetTop - MARGIN) };
  }
  const top = insetTop + BAR;
  return { top, bottom: undefined, maxHeight: Math.max(0, area - top - below - MARGIN) };
}
