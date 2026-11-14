import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MARK } from './markGeometry';

type Props = {
  size: number;
  /** A task is running: the orbit circles continuously. */
  working?: boolean;
  /** When idle, sweep the orbit once on appearing and then every ~10 s. */
  sweepWhenIdle?: boolean;
  /** Off-screen marks (inactive tabs, a closed panel) don't animate. */
  animate?: boolean;
};

const SWEEP_MS = 2000;
const IDLE_PAUSE_MS = 10000;
const LAP_MS = 1600;

const { orbit, bowl, letter, background } = MARK;
const ORBIT_RECT = Skia.XYWHRect(
  orbit.center[0] - orbit.radii[0],
  orbit.center[1] - orbit.radii[1],
  orbit.radii[0] * 2,
  orbit.radii[1] * 2,
);
const ORBIT_PATH = Skia.PathBuilder.Make().addArc(ORBIT_RECT, 0, 359.9).detach();
const BOWL_PATH = Skia.PathBuilder.Make()
  .addOval(
    Skia.XYWHRect(bowl.center[0] - bowl.outer[0], bowl.center[1] - bowl.outer[1], bowl.outer[0] * 2, bowl.outer[1] * 2),
  )
  .addOval(
    Skia.XYWHRect(bowl.center[0] - bowl.inner[0], bowl.center[1] - bowl.inner[1], bowl.inner[0] * 2, bowl.inner[1] * 2),
  )
  .detach();
const TAIL_PATH = Skia.Path.MakeFromSVGString(MARK.tail)!;
// In the orbit's own (unrotated) frame, the half below the centre line is in front of the Q.
const BACK_CLIP = Skia.XYWHRect(-20, -20, 140, orbit.center[1] + 20);
const FRONT_CLIP = Skia.XYWHRect(-20, orbit.center[1], 140, 80);
const SPARKLE = Skia.Path.MakeFromSVGString('M 0 -4 Q 0.6 -0.6 4 0 Q 0.6 0.6 0 4 Q -0.6 0.6 -4 0 Q -0.6 -0.6 0 -4 Z')!;

/** The Qutai logo, drawn in code: gradient tile, gradient Q, and an orange orbit that comes and goes. */
export function QutaiMark({ size, working = false, sweepWhenIdle = false, animate = true }: Props) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(shown);
    if (!animate || reduceMotion) {
      // Still: a working mark keeps its orbit as the "busy" sign, without motion.
      shown.value = working ? 1 : 0;
      phase.value = 0.3;
      return;
    }
    if (working) {
      shown.value = withTiming(1, { duration: 250 });
      phase.value = 0;
      phase.value = withRepeat(withTiming(1, { duration: LAP_MS, easing: Easing.linear }), -1);
      return;
    }
    if (sweepWhenIdle) {
      // Each sweep is a one-off animation started by a timer, so nothing redraws during the pause.
      const sweep = () => {
        phase.value = 0;
        phase.value = withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.cubic) });
        shown.value = withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(SWEEP_MS - 700, withTiming(0, { duration: 400 })),
        );
      };
      const first = setTimeout(sweep, 300);
      const every = setInterval(sweep, SWEEP_MS + IDLE_PAUSE_MS);
      return () => {
        clearTimeout(first);
        clearInterval(every);
      };
    }
    shown.value = withTiming(0, { duration: 250 });
  }, [animate, reduceMotion, working, sweepWhenIdle, phase, shown]);

  // Thin lines vanish at small sizes, so they get relatively thicker there.
  const weight = size < 48 ? 1.7 : 1;
  const ringOpacity = useDerivedValue(() => shown.value * 0.85);
  const trailStart = useDerivedValue(() => Math.max(0, phase.value - 0.2));
  const headX = useDerivedValue(() => orbit.center[0] + orbit.radii[0] * Math.cos(phase.value * 2 * Math.PI));
  const headY = useDerivedValue(() => orbit.center[1] + orbit.radii[1] * Math.sin(phase.value * 2 * Math.PI));
  const sparkle = useDerivedValue(() => shown.value * (0.6 + 0.4 * Math.sin(phase.value * 6 * Math.PI)));

  const orbitLayer = (clip: typeof BACK_CLIP) => (
    <Group clip={clip} opacity={shown}>
      <Path
        path={ORBIT_PATH}
        style="stroke"
        strokeWidth={orbit.width * 2.4 * weight}
        strokeCap="round"
        opacity={ringOpacity}
      >
        <LinearGradient
          start={vec(orbit.center[0] - orbit.radii[0], 0)}
          end={vec(orbit.center[0] + orbit.radii[0], 0)}
          colors={[...orbit.colors]}
        />
        <BlurMask blur={2.2} style="normal" />
      </Path>
      <Path path={ORBIT_PATH} style="stroke" strokeWidth={orbit.width * weight} strokeCap="round" opacity={ringOpacity}>
        <LinearGradient
          start={vec(orbit.center[0] - orbit.radii[0], 0)}
          end={vec(orbit.center[0] + orbit.radii[0], 0)}
          colors={[...orbit.colors]}
        />
      </Path>
      <Path
        path={ORBIT_PATH}
        style="stroke"
        strokeWidth={orbit.width * 1.6 * weight}
        strokeCap="round"
        start={trailStart}
        end={phase}
        color="#fff3d6"
      >
        <BlurMask blur={1.2} style="solid" />
      </Path>
      <Circle cx={headX} cy={headY} r={2.6 * weight} color="#fffaf0">
        <BlurMask blur={1.6} style="solid" />
      </Circle>
    </Group>
  );

  return (
    <Canvas style={{ width: size, height: size }} accessible={false}>
      <Group transform={[{ scale: size / 100 }]}>
        <RoundedRect x={0} y={0} width={100} height={100} r={MARK.corner}>
          <LinearGradient
            start={vec(background.from[0], background.from[1])}
            end={vec(background.to[0], background.to[1])}
            colors={[...background.colors]}
            positions={[...background.positions]}
          />
        </RoundedRect>
        <Group clip={Skia.RRectXY(Skia.XYWHRect(0, 0, 100, 100), MARK.corner, MARK.corner)}>
          {MARK.glows.map((g) => (
            <Rect key={g.color} x={0} y={0} width={100} height={100} opacity={g.opacity}>
              <RadialGradient c={vec(g.center[0], g.center[1])} r={g.radius} colors={[g.color, `${g.color}00`]} />
            </Rect>
          ))}

          <Group
            transform={[{ rotate: (orbit.rotation * Math.PI) / 180 }]}
            origin={vec(orbit.center[0], orbit.center[1])}
          >
            {orbitLayer(BACK_CLIP)}
          </Group>

          <Group transform={[{ translateY: 2.5 }]}>
            <Path path={BOWL_PATH} fillType="evenOdd" color="#05041a" opacity={0.45}>
              <BlurMask blur={2.5} style="normal" />
            </Path>
            <Path path={TAIL_PATH} color="#05041a" opacity={0.45}>
              <BlurMask blur={2.5} style="normal" />
            </Path>
          </Group>
          <Group>
            <LinearGradient
              start={vec(letter.from[0], letter.from[1])}
              end={vec(letter.to[0], letter.to[1])}
              colors={[...letter.colors]}
              positions={[...letter.positions]}
            />
            <Path path={BOWL_PATH} fillType="evenOdd" />
            <Path path={TAIL_PATH} />
          </Group>

          <Group
            transform={[{ rotate: (orbit.rotation * Math.PI) / 180 }]}
            origin={vec(orbit.center[0], orbit.center[1])}
          >
            {orbitLayer(FRONT_CLIP)}
          </Group>

          <Group opacity={sparkle}>
            <Path path={SPARKLE} color="#fff3d6" transform={[{ translateX: 84 }, { translateY: 27 }]} />
            <Path path={SPARKLE} color="#ffd9a8" transform={[{ translateX: 13 }, { translateY: 63 }, { scale: 0.7 }]} />
          </Group>
        </Group>
      </Group>
    </Canvas>
  );
}
