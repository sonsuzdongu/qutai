import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../utils/useReduceMotion';

const SLIDE_MS = 200;

/**
 * The address bar and the page, with the bar sliding away while the page is scrolled down (`UI` rules in
 * docs/design/27-interface.md).
 *
 * The choice (inset, resized once, never per frame): the page is laid out next to the bar, so a site's fixed header
 * or footer is never under a visible bar. The slide itself is a transform on the native thread. The page's height
 * changes only once per hide or show, at the edge away from the bar, so its content doesn't move:
 * - hiding: the page first grows by the bar's height at its far edge (out of sight, clipped), then the bar slides out
 *   (at the top, the page slides up with it into the freed space; at the bottom, the bar slides off over the page);
 * - showing: the bar slides back first, then the page gives the space back.
 * With Reduce motion there is no slide: the bar is shown or hidden at once.
 */
export function HidingBar({
  bar,
  position,
  hidden,
  children,
}: {
  bar: ReactNode;
  position: 'top' | 'bottom';
  hidden: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const [height, setHeight] = useState(0);
  const [slide] = useState(() => new Animated.Value(0));
  // The page is extended (laid out with the bar's room) while the bar is hidden or on its way out or in.
  const [extended, setExtended] = useState(false);
  const [target, setTarget] = useState(hidden);
  if (target !== hidden) {
    setTarget(hidden);
    // Hiding: the page grows first. Showing with Reduce motion: the room goes back at once.
    if (hidden) setExtended(true);
    else if (reduceMotion) setExtended(false);
  }

  useEffect(() => {
    if (hidden) {
      if (!extended) return;
      if (reduceMotion) {
        slide.setValue(1);
        return;
      }
      Animated.timing(slide, { toValue: 1, duration: SLIDE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    if (reduceMotion) {
      slide.setValue(0);
      return;
    }
    let cancelled = false;
    Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished && !cancelled) setExtended(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hidden, extended, reduceMotion, slide]);

  const onBarLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== height) setHeight(h);
  };
  const room = extended ? height : 0;

  if (position === 'top') {
    const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -height] });
    return (
      <View style={styles.clip}>
        <Animated.View style={[styles.flex, { marginBottom: -room, transform: [{ translateY }] }]}>
          <View onLayout={onBarLayout} style={styles.bar}>
            {bar}
          </View>
          {children}
        </Animated.View>
      </View>
    );
  }
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return (
    <View style={styles.clip}>
      {children}
      <Animated.View onLayout={onBarLayout} style={[styles.bar, { marginTop: -room, transform: [{ translateY }] }]}>
        {bar}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The clip keeps the moving bar out of the status bar and home indicator areas.
  clip: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  bar: { zIndex: 10 },
});
