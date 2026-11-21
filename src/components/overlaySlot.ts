// The layer the address bar's suggestion list and dimmed backdrop are drawn in (BarOverlay.tsx), kept apart so it can
// be tested without React Native.
//
// Why a layer of its own: on Android a native touch only reaches a view that lies inside every one of its parents. The
// list used to hang below the address bar, outside the bar's own box, so a tap on it was seen by React Native (the row
// ran) and also handed to the web page underneath (the link or button behind the row was pressed too). The layer is
// as large as the page, so every part of the list is inside its parents and the touch stops there.

export type OverlaySlot<T> = {
  /** Shows `content` for `owner`, replacing what was shown. */
  show(owner: object, content: T): void;
  /** Removes what `owner` showed; a late call from an owner that was replaced does nothing. */
  hide(owner: object): void;
  current(): T | null;
  subscribe(listener: () => void): () => void;
};

export function createOverlaySlot<T>(): OverlaySlot<T> {
  let owner: object | null = null;
  let content: T | null = null;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());
  return {
    show(next, value) {
      owner = next;
      content = value;
      changed();
    },
    hide(which) {
      if (owner !== which) return;
      owner = null;
      content = null;
      changed();
    },
    current: () => content,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type Edges = { top?: number; bottom?: number };

/**
 * Where the backdrop and the suggestion list go in the layer, whose edge touching the address bar is the bar's far
 * edge (`barHeight` from it). The backdrop fills the rest of the layer (no fixed height running past it) and the list
 * sits against the bar: below it at the top, above it at the bottom.
 */
export function omniboxOverlayFrame(barAtBottom: boolean, barHeight: number): { backdrop: Edges; list: Edges } {
  return barAtBottom
    ? { backdrop: { top: 0, bottom: barHeight }, list: { bottom: barHeight } }
    : { backdrop: { top: barHeight, bottom: 0 }, list: { top: barHeight } };
}
