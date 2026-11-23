// Where the page menu (PageMenu.tsx) goes and how tall it may get; kept apart so it can be tested without React Native.

/** The address bar's height: the menu starts just past it. */
const BAR = 48;
/** The menu's width (Chrome's is about the same); its labels wrap inside it. */
const WIDTH = 230;
/** Room kept free between the menu and the screen edge (system bar, keyboard) on the far side. */
const MARGIN = 8;

/**
 * The room the menu may fill, as distances from the top and bottom of the modal: never under the status bar, the
 * navigation bar, the keyboard or the address bar. The menu sits at the end next to the bar (`justify`) and shrinks
 * inside this room by layout, its list scrolling when it does not fit.
 *
 * No window or modal height goes in: the room is distances from the modal's edges, so the menu reaches up to the status
 * bar (or down to the navigation bar) whatever height the system reports for the window (UI-47).
 */
export function menuFrame(insetTop: number, insetBottom: number, keyboard: number, anchor: 'top' | 'bottom') {
  const below = Math.max(insetBottom, keyboard);
  if (anchor === 'bottom') {
    return { top: insetTop + MARGIN, bottom: below + BAR, justify: 'flex-end' as const };
  }
  return { top: insetTop + BAR, bottom: below + MARGIN, justify: 'flex-start' as const };
}

/**
 * The menu's width in a window `width` wide: 230 pt, or less where the window is narrower, keeping clear of both side
 * edges and the camera cut-out on a phone on its side (`menuMaxWidth`).
 *
 * Always a fixed number, never "as wide as the content": the list is a ScrollView, which gives the menu no width of its
 * own, and in a menu sized to its content React Native measured the list's rows before their width was known, as
 * single lines. A label that then wrapped at the real width ("Ekran görüntülerinden PDF (PDF bozuk görünürse)", or
 * any label in a wider system font) made the rows taller than the height measured for them: the last row was cut and
 * the list scrolled, with free page above the menu (UI-47).
 */
export function menuWidth(width: number, insetLeft: number, insetRight: number) {
  return Math.min(WIDTH, menuMaxWidth(width, insetLeft, insetRight));
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
