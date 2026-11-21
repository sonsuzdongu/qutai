import { createContext, type ReactNode, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { createOverlaySlot, type OverlaySlot } from './overlaySlot';

const SlotContext = createContext<OverlaySlot<ReactNode> | null>(null);

/** One layer per HidingBar: the bar's content is given `slot`, and `BarOverlayLayer` draws what it shows. */
export function useBarOverlaySlot() {
  const [slot] = useState(() => createOverlaySlot<ReactNode>());
  return slot;
}

export function BarOverlayProvider({ slot, children }: { slot: OverlaySlot<ReactNode>; children: ReactNode }) {
  return <SlotContext.Provider value={slot}>{children}</SlotContext.Provider>;
}

/**
 * The layer over the page, as large as the page and the bar together (why: overlaySlot.ts). It lets touches through
 * where nothing is drawn, so the address bar under it still works.
 */
export function BarOverlayLayer({ slot }: { slot: OverlaySlot<ReactNode> }) {
  const content = useSyncExternalStore(slot.subscribe, slot.current);
  if (!content) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      {content}
    </View>
  );
}

/** Draws `children` in the HidingBar's layer instead of here; in place when there is none. */
export function BarOverlay({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  const [owner] = useState(() => ({}));
  // Every render hands over the new content (the typed text, fresh handlers); unmounting removes it.
  useLayoutEffect(() => {
    slot?.show(owner, children);
  });
  useLayoutEffect(() => () => slot?.hide(owner), [slot, owner]);
  return slot ? null : <>{children}</>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
});
