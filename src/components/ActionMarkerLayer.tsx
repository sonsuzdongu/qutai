import { LinearGradient } from 'expo-linear-gradient';
import { ComponentRef, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { clearMark, markerStore, setMarkerLayerOrigin, type Mark } from '../agent/actionMarker';
import { Icon } from '../ui/Icon';
import { usePalette } from '../ui/theme';
import { useReduceMotion } from '../utils/useReduceMotion';

/**
 * Where the assistant acts (docs/working-mode.md): a ring that ripples out on a click target, a frame around a field
 * being typed into, a short trace for scrolling, one faint sweep while a page is read. Drawn by the app over the
 * page (never in it): takes no touches and no room, is hidden from screen readers (the step strip says the same in
 * words) and sits outside the tab's container, so the assistant's screenshots don't contain it. Animations run on the
 * native driver; with "Reduce motion" the ring and frame are static and there is no trace or sweep motion.
 */
export function ActionMarkerLayer() {
  const mark = useSyncExternalStore(markerStore.subscribe, markerStore.get);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const reduceMotion = useReduceMotion();
  const palette = usePalette();
  const colors = markerColors(palette.dark);

  useEffect(() => () => setMarkerLayerOrigin(null), []);
  const size = useRef('');
  const measure = (e: LayoutChangeEvent) => {
    // The screen turned (or the window was resized): a marker on screen points at where the element was, so it goes;
    // the next step measures again (docs/landscape.md).
    const next = `${Math.round(e.nativeEvent.layout.width)}x${Math.round(e.nativeEvent.layout.height)}`;
    if (size.current && size.current !== next) clearMark();
    size.current = next;
    ref.current?.measureInWindow((x, y, width, height) => setMarkerLayerOrigin(width > 0 && height > 0 ? { x, y } : null));
  };

  return (
    <View
      ref={ref}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      collapsable={false}
      onLayout={measure}
    >
      {mark ? <Marker key={mark.id} mark={mark} still={reduceMotion} colors={colors} /> : null}
    </View>
  );
}

/** The marker's colours: the brand blue (lighter on the dark theme), with the aurora's teal for the ripple. */
export function markerColors(dark: boolean) {
  return dark
    ? { line: '#5CB8F0', soft: 'rgba(92,184,240,0.16)', ripple: '#4FD1C5', clear: 'rgba(92,184,240,0)', band: 'rgba(92,184,240,0.14)' }
    : { line: '#1565C0', soft: 'rgba(21,101,192,0.10)', ripple: '#1BA6B0', clear: 'rgba(21,101,192,0)', band: 'rgba(21,101,192,0.10)' };
}

type Colors = ReturnType<typeof markerColors>;

function Marker({ mark, still, colors }: { mark: Mark; still: boolean; colors: Colors }) {
  const [appear] = useState(() => new Animated.Value(still ? 1 : 0));
  const [ripple] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const run = Animated.parallel([
      Animated.timing(appear, { toValue: 1, duration: 140, useNativeDriver: true }),
      mark.kind === 'ring'
        ? Animated.loop(
            Animated.timing(ripple, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            { iterations: 2 },
          )
        : Animated.timing(ripple, {
            toValue: 1,
            duration: mark.kind === 'sweep' ? 800 : 600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
    ]);
    run.start();
    return () => run.stop();
  }, [appear, ripple, still, mark.kind]);

  switch (mark.kind) {
    case 'ring': {
      const { cx, cy, size } = mark;
      const box = { left: cx - size / 2, top: cy - size / 2, width: size, height: size, borderRadius: size / 2 };
      return (
        <>
          {still ? null : (
            <Animated.View
              style={[
                styles.abs,
                box,
                {
                  borderWidth: 2,
                  borderColor: colors.ripple,
                  opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                  transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
                },
              ]}
            />
          )}
          <Animated.View
            style={[
              styles.abs,
              box,
              {
                borderWidth: 3,
                borderColor: colors.line,
                backgroundColor: colors.soft,
                opacity: appear,
                transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
              },
            ]}
          />
        </>
      );
    }
    case 'frame': {
      const { x, y, width, height } = mark.rect;
      const pad = 4;
      return (
        <Animated.View
          style={[
            styles.abs,
            {
              left: x - pad,
              top: y - pad,
              width: width + pad * 2,
              height: height + pad * 2,
              borderRadius: Math.min(10, (height + pad * 2) / 2),
              borderWidth: 2.5,
              borderColor: colors.line,
              backgroundColor: colors.soft,
              opacity: appear,
            },
          ]}
        />
      );
    }
    case 'scroll': {
      const { view, direction } = mark;
      const cy = view.y + view.height / 2;
      const left = view.x + view.width - 34;
      const sign = direction === 'down' ? 1 : -1;
      return (
        <View style={[styles.abs, styles.trace, { left, top: cy - 60, backgroundColor: colors.soft }]}>
          <Animated.View
            style={{
              opacity: still ? 1 : ripple.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [{ translateY: still ? 0 : ripple.interpolate({ inputRange: [0, 1], outputRange: [-30 * sign, 30 * sign] }) }],
            }}
          >
            <Icon name={direction === 'down' ? 'chevronDown' : 'chevronUp'} size={24} color={colors.line} />
          </Animated.View>
        </View>
      );
    }
    case 'sweep': {
      if (still) return null;
      const { view } = mark;
      const band = 72;
      return (
        <View style={[styles.abs, { left: view.x, top: view.y, width: view.width, height: view.height, overflow: 'hidden' }]}>
          <Animated.View
            style={{
              height: band,
              opacity: ripple.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
              transform: [{ translateY: ripple.interpolate({ inputRange: [0, 1], outputRange: [-band, view.height] }) }],
            }}
          >
            <LinearGradient colors={[colors.clear, colors.band, colors.clear]} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  trace: { width: 28, height: 120, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
