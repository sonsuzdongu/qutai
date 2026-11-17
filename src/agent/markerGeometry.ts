/**
 * Where the action marker is drawn (docs/working-mode.md). Pure: no React Native, tested on its own
 * (scripts/assistant-tests/workingMode.test.ts).
 *
 * The page script reports an element's box as fractions of the visual viewport (what the WebView view shows, so pinch
 * zoom and scrolling are already accounted for). The app measures the tab's container in window coordinates; the
 * marker layer has its own window origin. The marker's box is the fractions laid over the container, in the layer's
 * coordinates.
 */

/** A box as fractions (0–1) of the visible area of the page. */
export type FractionBox = { x: number; y: number; width: number; height: number };
/** A rectangle in points. */
export type Rect = { x: number; y: number; width: number; height: number };

/** How long the marker shows before a click or typing runs, in ms (one constant for every action). */
export const MARKER_DWELL_MS = 320;

/** Smallest ring drawn around a tiny target (a checkbox, an icon), in points. */
export const MIN_RING = 28;

function finite(...values: number[]): boolean {
  return values.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/** To a hundredth of a point (no floating-point noise). */
const round = (v: number) => Math.round(v * 100) / 100;

/**
 * The marker's rectangle in the layer's coordinates, clipped to the page's view; null when the box is missing,
 * empty or entirely outside the visible page (then no marker and no dwell).
 */
export function markerRect(box: FractionBox | null | undefined, view: Rect, layerOrigin: { x: number; y: number }): Rect | null {
  if (!box || !finite(box.x, box.y, box.width, box.height, view.x, view.y, view.width, view.height)) return null;
  if (view.width <= 0 || view.height <= 0 || box.width <= 0 || box.height <= 0) return null;
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const right = Math.min(1, box.x + box.width);
  const bottom = Math.min(1, box.y + box.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: round(view.x - layerOrigin.x + left * view.width),
    y: round(view.y - layerOrigin.y + top * view.height),
    width: round((right - left) * view.width),
    height: round((bottom - top) * view.height),
  };
}

/** A point given as fractions of the visible page, in the layer's coordinates; null when outside. */
export function markerPoint(fx: number, fy: number, view: Rect, layerOrigin: { x: number; y: number }): { x: number; y: number } | null {
  if (!finite(fx, fy) || fx < 0 || fy < 0 || fx > 1 || fy > 1) return null;
  return { x: round(view.x - layerOrigin.x + fx * view.width), y: round(view.y - layerOrigin.y + fy * view.height) };
}

/** The ring for a click: a circle centred on the target, at least MIN_RING across and at most 96. */
export function ringFor(rect: Rect): { cx: number; cy: number; size: number } {
  const size = Math.min(96, Math.max(MIN_RING, Math.min(Math.max(rect.width, rect.height), 72) + 12));
  return { cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2, size };
}
