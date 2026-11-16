import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, AppState, StyleSheet } from 'react-native';
import { useWaitingForUser } from '../device/backgroundTask';
import { usePalette } from '../ui/theme';
import { useReduceMotion } from '../utils/useReduceMotion';

/** How far the glow reaches in from each edge, in points. */
const DEPTH = 28;
/** One breath (in and out), slow enough to read as calm rather than busy. */
const BREATH_MS = 3200;
const LOW = 0.45;

/**
 * A soft glow fading inward from the page's edges in the brand blue while the assistant works on this tab: four static
 * gradients and one animated opacity on the native driver (no JS per frame). Static with "Reduce motion" on.
 *
 * Drawn over the page by BrowserView as a sibling of the tabs' containers, never inside one, so the assistant's
 * screenshots and saved page images (device/screenshot.ts captures the tab's container) don't contain it. It takes no
 * touches and no room, is hidden from screen readers, and is off while the task waits for the user's answer and while
 * Qutai isn't in the foreground (picture-in-picture shows only the video; a full-screen video covers the app).
 */
export function WorkingGlow({ visible }: { visible: boolean }) {
  const waiting = useWaitingForUser();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  if (!visible || waiting || !active) return null;
  return <Glow />;
}

function Glow() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(LOW));
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.8);
      return;
    }
    const half = BREATH_MS / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: half, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: LOW, duration: half, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  // The brand blue, a little lighter on the dark theme so it reads on dark pages too.
  const edge = palette.dark ? 'rgba(92,184,240,0.55)' : 'rgba(21,101,192,0.42)';
  const clear = palette.dark ? 'rgba(92,184,240,0)' : 'rgba(21,101,192,0)';
  return (
    <Animated.View
      // Above the tab on screen (BrowserView gives it zIndex 1).
      style={[StyleSheet.absoluteFill, styles.over, { opacity }]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <LinearGradient colors={[edge, clear]} style={[styles.edge, styles.top]} />
      <LinearGradient colors={[clear, edge]} style={[styles.edge, styles.bottom]} />
      <LinearGradient colors={[edge, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.edge, styles.left]} />
      <LinearGradient colors={[clear, edge]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.edge, styles.right]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  over: { zIndex: 2 },
  edge: { position: 'absolute' },
  top: { top: 0, left: 0, right: 0, height: DEPTH },
  bottom: { bottom: 0, left: 0, right: 0, height: DEPTH },
  left: { top: 0, bottom: 0, left: 0, width: DEPTH },
  right: { top: 0, bottom: 0, right: 0, width: DEPTH },
});
