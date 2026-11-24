import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { BarOverlayLayer, BarOverlayProvider, useBarOverlaySlot } from './BarOverlay';

/**
 * The address bar above or below the page (`UI-36` in docs/design/27-interface.md). The bar always stays: the page is
 * laid out next to it, so a site's own fixed header or bottom navigation is never under it.
 */
export function BarLayout({
  bar,
  position,
  children,
  status,
  onBarHeight,
}: {
  bar: ReactNode;
  position: 'top' | 'bottom';
  children: ReactNode;
  /**
   * A line drawn over the page against the bar (the slow-site line, UI-68): it takes no room, so the page doesn't move
   * when it appears. Inside this view's own box, so its buttons get every touch on Android.
   */
  status?: ReactNode;
  /** The bar's measured height, e.g. to keep a toast above it (UI-48). */
  onBarHeight?: (height: number) => void;
}) {
  // What the bar draws over the page (the address suggestions), in a layer as large as the page: BarOverlay.tsx.
  const overlay = useBarOverlaySlot();
  const [height, setHeight] = useState(0);
  const onBarLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== height) {
      setHeight(h);
      onBarHeight?.(h);
    }
  };
  const barView = (
    <View onLayout={onBarLayout} style={styles.bar}>
      <BarOverlayProvider slot={overlay}>{bar}</BarOverlayProvider>
    </View>
  );
  return (
    <View style={styles.flex}>
      {position === 'top' ? barView : null}
      {children}
      {position === 'bottom' ? barView : null}
      {status ? (
        <View style={styles.statusLayer} pointerEvents="box-none">
          <View style={[styles.status, position === 'top' ? { top: height } : { bottom: height }]}>{status}</View>
        </View>
      ) : null}
      <BarOverlayLayer slot={overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { zIndex: 10 },
  statusLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 15 },
  // Slightly see-through over the page (owner, 24 Nov 2026).
  status: { position: 'absolute', left: 0, right: 0, opacity: 0.9 },
});
