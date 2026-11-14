import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { hideSplash, onSplashHidden } from '../ui/launch';
import { QutaiMark } from '../ui/QutaiMark';
import { darkPalette, lightPalette } from '../ui/theme';

/** The mark fades in and grows to full size over MARK_MS; then the cover fades into the app over COVER_FADE_MS. */
export const MARK_MS = 450;
export const COVER_FADE_MS = 250;
const MARK_SIZE = 96;

/**
 * - `animate`: cold start, motion allowed: the Qutai mark appears with a short fade and scale, then the cover
 *   cross-fades into the app (browser or onboarding) once the app is ready underneath.
 * - `still`: reduce motion, "Animate the logo" off, or the app already started once in this process: no animation;
 *   the mark shows only if the app is slow to be ready, and the cover goes without a fade.
 * - `plain`: the app lock is on: the theme colour only, held until the user unlocks, so neither the browser nor
 *   the mark is ever seen behind or before the lock screen.
 */
export type IntroVariant = 'animate' | 'still' | 'plain';

type Props = {
  variant: IntroVariant;
  dark: boolean;
  /** The app's first screen is rendered underneath. */
  ready: boolean;
  /** Keep the cover (the app lock is showing). */
  hold: boolean;
  onDone: () => void;
};

/**
 * A full-screen cover in the native splash's colour, on top of the app while it starts. It hides the native splash
 * once the app is ready (or the splash's safety timeout passed), so the hand-over has no flash. It never takes
 * touches: the app underneath is usable as soon as it is ready.
 */
export function LaunchIntro({ variant, dark, ready, hold, onDone }: Props) {
  const palette = dark ? darkPalette : lightPalette;
  const [cover] = useState(() => new Animated.Value(1));
  const [mark] = useState(() => new Animated.Value(variant === 'animate' ? 0 : 1));
  const [markShown, setMarkShown] = useState(variant !== 'animate');
  const [splashGone, setSplashGone] = useState(false);
  const leaving = useRef(false);

  // The first real frame is the app underneath (the cover is in the same colour as the splash): hide the splash
  // once it is drawn. Not cancelled on unmount: without animation the cover goes in the same moment.
  useEffect(() => {
    if (ready) requestAnimationFrame(hideSplash);
  }, [ready]);

  // The mark's entrance starts as the splash fades, whether because the app is ready or the splash timed out.
  useEffect(
    () =>
      onSplashHidden(() => {
        setSplashGone(true);
        if (variant !== 'animate') return;
        Animated.timing(mark, {
          toValue: 1,
          duration: MARK_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setMarkShown(true));
      }),
    [variant, mark],
  );

  useEffect(() => {
    if (!ready || hold || !markShown || leaving.current) return;
    leaving.current = true;
    if (variant !== 'animate') {
      onDone();
      return;
    }
    Animated.timing(cover, {
      toValue: 0,
      duration: COVER_FADE_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [ready, hold, markShown, variant, cover, onDone]);

  // Still: the mark only appears when the app is slow, i.e. the splash timed out before the app was ready.
  const withMark = variant === 'animate' || (variant === 'still' && splashGone && !ready);
  const scale = mark.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.cover, { backgroundColor: palette.bg, opacity: cover }]}
    >
      {withMark && (
        <Animated.View style={{ opacity: mark, transform: [{ scale }] }}>
          <QutaiMark size={MARK_SIZE} animate={false} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
