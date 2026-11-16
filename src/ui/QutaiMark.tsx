import { BlurMask, Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  SharedValue,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  size: number;
  /** A task is running: sparks keep twinkling. */
  working?: boolean;
  /** When idle, sparkle once on appearing and then every ~10 s. */
  sweepWhenIdle?: boolean;
  /** Sparkle continuously, e.g. as the centrepiece of the welcome screen. */
  alwaysSparkle?: boolean;
  /** Off-screen marks (inactive tabs, a closed panel) don't animate. */
  animate?: boolean;
};

const LOGO = require('../../assets/logo.png');
const BURST_MS = 1800;
const IDLE_PAUSE_MS = 10000;

/** A four-pointed star, centred on 0,0, 8 units across. */
const SPARK = Skia.Path.MakeFromSVGString(
  'M 0 -4 Q 0.55 -0.55 4 0 Q 0.55 0.55 0 4 Q -0.55 0.55 -4 0 Q -0.55 -0.55 0 -4 Z',
)!;

/**
 * Where the sparks appear on the Q (in a 100×100 box) and when, as a share of one burst:
 * along the ring and the tail, one after another.
 */
const SPARKS = [
  { x: 74, y: 14, scale: 1.3, at: 0.0 },
  { x: 93, y: 46, scale: 0.9, at: 0.14 },
  { x: 12, y: 34, scale: 1.0, at: 0.28 },
  { x: 90, y: 86, scale: 1.2, at: 0.42 },
  { x: 36, y: 90, scale: 0.8, at: 0.56 },
];

/** The Qutai logo; sparks twinkle over it now and then, and continuously while a task runs. */
export function QutaiMark({
  size,
  working = false,
  sweepWhenIdle = false,
  alwaysSparkle = false,
  animate = true,
}: Props) {
  const systemReduceMotion = useReducedMotion();
  const still = !animate || systemReduceMotion;
  // 0→1 over one burst; sparks read their own moment from it. -1: no sparks.
  const phase = useSharedValue(-1);

  useEffect(() => {
    cancelAnimation(phase);
    if (still) {
      // Still: a working (or always sparkling) mark keeps a few sparks lit, without motion.
      phase.value = working || alwaysSparkle ? 0.2 : -1;
      return;
    }
    if (working || alwaysSparkle) {
      phase.value = 0;
      phase.value = withRepeat(withTiming(1, { duration: BURST_MS, easing: Easing.linear }), -1);
      return;
    }
    phase.value = -1;
    if (!sweepWhenIdle) return;
    // Each burst is a one-off animation started by a timer, so nothing redraws during the pause.
    const burst = () => {
      phase.value = 0;
      phase.value = withTiming(1, { duration: BURST_MS, easing: Easing.linear }, (done) => {
        if (done) phase.value = -1;
      });
    };
    const first = setTimeout(burst, 300);
    const every = setInterval(burst, BURST_MS + IDLE_PAUSE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [still, working, alwaysSparkle, sweepWhenIdle, phase]);

  return (
    <View style={{ width: size, height: size }} accessible={false}>
      {/* Explicit width and height: an image from require() otherwise takes the file's own size
          (384 pt), and absoluteFill alone doesn't override that. */}
      <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" />
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group transform={[{ scale: size / 100 }]}>
          {SPARKS.map((spark) => (
            <Spark key={`${spark.x},${spark.y}`} {...spark} phase={phase} small={size < 48} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

/** One spark: grows, glints and fades within its share of the burst. */
function Spark({
  x,
  y,
  scale,
  at,
  phase,
  small,
}: {
  x: number;
  y: number;
  scale: number;
  at: number;
  phase: SharedValue<number>;
  small: boolean;
}) {
  // Small marks get relatively bigger sparks, or they'd be invisible.
  const base = scale * (small ? 1.7 : 1);
  const life = useDerivedValue(() => {
    if (phase.value < 0) return 0;
    const t = (phase.value - at) / 0.4;
    return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
  });
  const transform = useDerivedValue(() => [
    { translateX: x },
    { translateY: y },
    { scale: base * (0.4 + 0.6 * life.value) },
    { rotate: life.value * 0.6 },
  ]);
  return (
    <Group transform={transform} opacity={life}>
      <Path path={SPARK} color="#5ce1ff" transform={[{ scale: 1.8 }]}>
        <BlurMask blur={1.6} style="normal" />
      </Path>
      <Path path={SPARK} color="#ffffff" />
    </Group>
  );
}
