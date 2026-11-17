import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useWaitingForUser } from '../device/backgroundTask';
import { usePalette } from '../ui/theme';
import { useReduceMotion } from '../utils/useReduceMotion';

/** How far the light reaches in from each screen edge, in points. */
export const GLOW_DEPTH = 40;
/** The screen's rounded corners the light follows (a typical phone's; a square screen just sees a softer corner). */
const CORNER = 28;
/** Frames per second of the drift: slow motion needs no more, and half the frames is half the GPU work. */
const FRAME_MS = 1000 / 30;

/**
 * Aurora / smoke light along the screen's edges in the brand blues with a little teal and violet: domain-warped
 * value noise drifting slowly, never repeating, with a gentle breath. Only the band within GLOW_DEPTH of an edge is
 * drawn (four thin canvases, not a full-screen layer); alpha falls to 0 inward, so page text near the edges stays
 * readable. Premultiplied output.
 */
export const GLOW_SKSL = `
uniform float2 size;
uniform float2 offset;
uniform float time;
uniform float dark;
uniform float depth;
uniform float radius;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x), mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 3; k++) { v += a * noise(p); p = p * 2.03 + float2(1.7, 9.2); a *= 0.5; }
  return v;
}

half4 main(float2 pos) {
  float2 p = pos + offset;
  float2 c = size * 0.5;
  float2 q = abs(p - c) - (c - float2(radius));
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float e = max(-d, 0.0);
  if (e >= depth) return half4(0.0);
  float t = time;
  // Smoke: noise warped by noise, drifting in two directions at different speeds.
  float2 w = float2(fbm(p / 160.0 + float2(t * 0.045, -t * 0.03)), fbm(p / 140.0 + float2(-t * 0.035, t * 0.05)));
  float smoke = fbm(p / 75.0 + w * 2.2 + float2(t * 0.06, t * 0.04));
  float hue = fbm(p / 220.0 + w + float2(-t * 0.02, t * 0.025));
  // The light reaches further where the smoke is thick.
  float reach = depth * (0.4 + 0.6 * smoke);
  float fall = 1.0 - smoothstep(0.0, reach, e);
  fall = fall * fall;
  float breath = 0.8 + 0.2 * sin(t * 1.3);
  float3 blue = dark > 0.5 ? float3(0.36, 0.72, 0.94) : float3(0.08, 0.40, 0.75);
  float3 teal = dark > 0.5 ? float3(0.31, 0.82, 0.77) : float3(0.07, 0.62, 0.66);
  float3 violet = dark > 0.5 ? float3(0.62, 0.55, 0.98) : float3(0.40, 0.30, 0.85);
  float3 col = mix(blue, teal, smoothstep(0.35, 0.7, hue));
  col = mix(col, violet, 0.55 * smoothstep(0.55, 0.85, smoke));
  float strength = dark > 0.5 ? 0.62 : 0.48;
  float a = strength * fall * (0.45 + 0.55 * smoke) * breath;
  return half4(half3(col * a), half(a));
}
`;

const SOURCE = Skia.RuntimeEffect.Make(GLOW_SKSL)!;

/**
 * The working glow at screen level (docs/working-mode.md): around the whole screen while a task runs, over the page
 * and the panel, under the step strip. Off while a dialog waits for the user's answer and while Qutai isn't in the
 * foreground (nothing runs then). Takes no touches, is hidden from screen readers, and lies outside the tabs'
 * containers, so the assistant's screenshots never contain it.
 *
 * Cost: the drift is a Reanimated frame callback on the UI thread (no JavaScript per frame) that moves one uniform
 * 30 times a second; Skia draws only the edge bands. With "Reduce motion" the same light is drawn once, still.
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
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(7.3);
  const last = useSharedValue(0);
  useFrameCallback((frame) => {
    'worklet';
    const now = frame.timeSinceFirstFrame;
    if (now - last.value < FRAME_MS) return;
    last.value = now;
    time.value = 7.3 + now / 1000;
  }, !reduceMotion);

  const dark = palette.dark ? 1 : 0;
  const D = GLOW_DEPTH;
  const edges = [
    { key: 'top', x: 0, y: 0, w: width, h: D },
    { key: 'bottom', x: 0, y: height - D, w: width, h: D },
    { key: 'left', x: 0, y: D, w: D, h: Math.max(0, height - 2 * D) },
    { key: 'right', x: width - D, y: D, w: D, h: Math.max(0, height - 2 * D) },
  ];
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.over]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {edges.map((e) => (
        <Edge key={e.key} x={e.x} y={e.y} w={e.w} h={e.h} width={width} height={height} dark={dark} time={time} />
      ))}
    </View>
  );
}

function Edge({
  x,
  y,
  w,
  h,
  width,
  height,
  dark,
  time,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  dark: number;
  time: ReturnType<typeof useSharedValue<number>>;
}) {
  const uniforms = useDerivedValue(() => ({
    size: [width, height],
    offset: [x, y],
    time: time.value,
    dark,
    depth: GLOW_DEPTH,
    radius: CORNER,
  }));
  if (w <= 0 || h <= 0) return null;
  return (
    <Canvas style={{ position: 'absolute', left: x, top: y, width: w, height: h }} pointerEvents="none">
      <Fill>
        <Shader source={SOURCE} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  over: { zIndex: 20, elevation: 20 },
});
