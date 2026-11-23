import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Soft aurora light in the logo's colours (blues and cyan) over the app's own
 * background colour. Still by default (drawn once); with `animate` the light drifts slowly (one loop in
 * LOOP_MS), and stops for Reduce Motion or when `animate` turns off (UI-53).
 *
 * `fade` is how far down the screen the light reaches (0–1); below that it is the plain
 * background, so body text there keeps the theme's measured contrast. Strengths are tuned so
 * even the brightest spot keeps the theme's text colour at 4.5:1 or more.
 */
export const AURORA_SKSL = `
uniform float2 size;
uniform float3 base;
uniform float dark;
uniform float fade;
uniform float t;
uniform float motion;

float3 mixTo(float3 c, float3 k, float w) { return c + (k - c) * w; }
float blob(float2 uv, float2 c, float r) { float2 d = uv - c; return exp(-dot(d, d) / r); }

half4 main(float2 p) {
  float2 uv = p / max(size.x, 1.0);
  float y = p.y / max(size.y, 1.0);
  float reach = 1.0 - smoothstep(fade * 0.55, fade, y);
  // One loop per t 0→1, seamless (whole multiples of a); motion 0 keeps the still picture.
  float a = t * 6.2831853;
  float2 o1 = motion * float2(0.10 * sin(a), 0.05 * sin(2.0 * a));
  float2 o2 = motion * float2(-0.10 * sin(a + 1.3) + 0.10 * sin(1.3), 0.06 * (sin(a + 0.7) - sin(0.7)));
  float2 o3 = motion * float2(0.18 * sin(2.0 * a), 0.04 * sin(a));
  float b1 = blob(uv, float2(0.10, 0.05) + o1, 0.16) * reach;
  float b2 = blob(uv, float2(0.95, 0.22) + o2, 0.20) * reach;
  float b3 = blob(uv, float2(0.55, 0.02) + o3, 0.07) * reach;
  float3 c = base;
  if (dark > 0.5) {
    c = mixTo(c, float3(0.12, 0.40, 0.80), 0.30 * b1);
    c = mixTo(c, float3(0.16, 0.72, 0.85), 0.22 * b2);
    c = mixTo(c, float3(0.06, 0.30, 0.62), 0.24 * b3);
  } else {
    c = mixTo(c, float3(0.80, 0.88, 1.00), 0.34 * b1);
    c = mixTo(c, float3(0.80, 0.96, 0.98), 0.32 * b2);
    c = mixTo(c, float3(0.86, 0.91, 1.00), 0.24 * b3);
  }
  return half4(half3(c), 1.0);
}
`;

const SOURCE = Skia.RuntimeEffect.Make(AURORA_SKSL)!;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

type Props = {
  /** The screen's own background colour (#rrggbb), which the light fades into. */
  base: string;
  dark: boolean;
  /** How far down the light reaches, as a share of the height (1 = everywhere). */
  fade?: number;
  /** The light drifts slowly (only while true, and never with Reduce Motion). */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** One full drift of the light: slow enough to read as ambient, not as movement to follow. */
const LOOP_MS = 24000;

export function Aurora({ base, dark, fade = 1, animate = false, style }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const reduceMotion = useReducedMotion();
  const moving = animate && !reduceMotion;
  const t = useSharedValue(0);
  useEffect(() => {
    if (!moving) {
      cancelAnimation(t);
      return;
    }
    // Continue from where it stopped, so coming back to the page doesn't jump; the shader repeats every 1.
    const from = t.value % 1;
    t.value = from;
    t.value = withRepeat(withTiming(from + 1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [moving, t]);
  const width = size?.width ?? 1;
  const height = size?.height ?? 1;
  const baseRgb = rgb(base);
  const uniforms = useDerivedValue(() => ({
    size: [width, height],
    base: baseRgb,
    dark: dark ? 1 : 0,
    fade,
    t: t.value,
    motion: animate ? 1 : 0,
  }));
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: base }, style]}
      pointerEvents="none"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {size && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={SOURCE} uniforms={uniforms} />
          </Fill>
        </Canvas>
      )}
    </View>
  );
}
