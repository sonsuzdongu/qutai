/**
 * Layout decisions that depend on the window's size (docs/landscape.md). Pure: sizes in, sizes out, so they are
 * tested without a device (`npm run test:layout`). They follow the window, never "the orientation": on an iPad in
 * Split View or Stage Manager a landscape screen can hold a narrow, tall window.
 */

export type WindowSize = { width: number; height: number };

/** The assistant panel's widest, on any screen. */
export const PANEL_MAX_WIDTH = 420;
/** The panel's narrowest in a wide window (a phone on its side): room for the conversation and its input. */
export const PANEL_MIN_SIDE_WIDTH = 320;
/** Below this height the window is short (a phone on its side): headers get compact. */
export const SHORT_WINDOW = 480;

/** Wider than tall. */
export function isWide({ width, height }: WindowSize) {
  return width > height;
}

/** A phone on its side, or a short window: compact headers, less vertical padding. */
export function isShort({ height }: WindowSize) {
  return height < SHORT_WINDOW;
}

/**
 * The assistant panel's width. It always comes in from the trailing edge over the page. Upright: 88 % of the width
 * (the page's edge shows beside it, tap there to close), up to 420. Wide: about half the width, at least 320 and at
 * most 420, so the page stays in view beside it and the conversation keeps the full height (a sheet from the bottom
 * would leave ~330 pt for both on a phone on its side).
 */
export function panelWidth(window: WindowSize) {
  const { width } = window;
  const upright = Math.min(Math.round(width * 0.88), PANEL_MAX_WIDTH);
  if (!isWide(window)) return upright;
  return Math.min(upright, Math.max(PANEL_MIN_SIDE_WIDTH, Math.round(width * 0.5)));
}

/** The panel's header height: 56 normally, 44 (still a full touch target) in a short window. */
export function panelHeaderHeight(window: WindowSize) {
  return isShort(window) ? 44 : 56;
}

/** Tab switcher columns by the room there is: 2 on a phone upright, 3 on its side or a small tablet, 4 wider. */
export function tabColumns(contentWidth: number) {
  if (contentWidth < 600) return 2;
  if (contentWidth < 900) return 3;
  return 4;
}

/** A tab card's width for the given number of columns, between the grid's padding and gaps. */
export function tabCardWidth(contentWidth: number, columns: number, padding: number, gap: number) {
  return Math.floor((contentWidth - padding * 2 - gap * (columns - 1)) / columns);
}

/**
 * Height / width of a tab card's preview: the window's own shape (thumbnails are taken at the page's shape), kept
 * between 0.6 and 1.25 so a card is never a sliver or a tower.
 */
export function previewRatio({ width, height }: WindowSize) {
  if (width <= 0 || height <= 0) return 1.25;
  return Math.min(1.25, Math.max(0.6, height / width));
}

/**
 * The answer card's tallest: 360, but never past the room above its bottom edge (below the status bar, with a
 * small gap). At least 120, so the title and the button always show; its text scrolls.
 */
export function answerCardMaxHeight(windowHeight: number, bottom: number, topInset: number) {
  return Math.max(120, Math.min(360, windowHeight - bottom - topInset - 16));
}

/** The QR scanner's frame: 240, at most half the window's short side (hint and Close fit around it). */
export function qrFrameSize({ width, height }: WindowSize) {
  return Math.min(240, Math.round(Math.min(width, height) * 0.5));
}

/** A key for the window's size, kept with a screenshot shown to the model. */
export function windowKey({ width, height }: WindowSize) {
  return `${Math.round(width)}x${Math.round(height)}`;
}

/**
 * Whether a screenshot's pixel coordinates still map onto the page: false once the window turned or changed size
 * since (the page's viewport changed with it, so the same fractions point somewhere else).
 */
export function screenshotStillValid(takenAt: string, now: WindowSize) {
  return takenAt === windowKey(now);
}
