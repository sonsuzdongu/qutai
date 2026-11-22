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

/**
 * The menu's greatest width in a window `width` wide: with long labels (large text, German) it stops short of the left
 * edge and the camera cut-out on a phone on its side, as it does on the right, and the labels wrap instead.
 */
export function menuMaxWidth(width: number, insetLeft: number, insetRight: number) {
  return Math.max(0, width - insetLeft - insetRight - 2 * MARGIN);
}

/** Pixels of overflow that come from rounding (fractional row heights, hairline separators), not from a long menu. */
const ROUNDING = 2;

/**
 * Whether the menu's list should scroll: only when its content (`content`, from onContentSizeChange) is really taller
 * than the room it got (`viewport`, from onLayout). A menu that fits stays still instead of moving a pixel or two
 * under the finger; until both are measured it scrolls, so a long menu is never stuck.
 */
export function menuScrolls(content: number | null, viewport: number | null) {
  if (content === null || viewport === null) return true;
  return content - viewport > ROUNDING;
}
