import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AssistantLook } from '../ui/assistantLook';
import { usePalette, radii } from '../ui/theme';
import { useReduceMotion } from '../utils/useReduceMotion';

/**
 * TRIAL looks for listening and working (src/ui/assistantLook.ts), next to today's ("classic"):
 *
 *   band     ListeningLook: a glass sheet attached to the address bar's page-side edge, the words in it; aurora smoke
 *            inside, brightest along the sheet's free edge, which swells with the voice. GlassBack: the same glass
 *            behind the step strip and the answer card, with a thread of light around the strip.
 *   curtain  ListeningLook: the page dims from the bar's edge and rays of light rise with the voice, the words in
 *            white on the dark. EdgeLight: a line of light travelling around the screen while working.
 *
 * Blur: iOS uses the system material (a UIVisualEffectView blurs whatever is behind it, a web page included).
 * Android gets no blur here: expo-blur can only blur a BlurTargetView's content there, which would mean wrapping the
 * tabs, and whether a WebView's (and a video's) pixels come through is untested; so the Android sheet is the same
 * glass as a nearly opaque tint with the aurora on it. The "curtain" look never blurs, so it is the same everywhere.
 *
 * Cost: one Skia canvas each, a Reanimated frame callback moving one uniform 30 times a second (no JavaScript per
 * frame). Reduce motion: the same picture with a fixed time.
 */

const FRAME_MS = 1000 / 30;
const IOS = Platform.OS === 'ios';

const NOISE = `
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
`;

/** The aurora's colours (WorkingGlow.tsx): lighter on the dark theme. */
const COLOURS = `
  float3 blue = dark > 0.5 ? float3(0.36, 0.72, 0.94) : float3(0.08, 0.40, 0.75);
  float3 teal = dark > 0.5 ? float3(0.31, 0.82, 0.77) : float3(0.07, 0.62, 0.66);
  float3 violet = dark > 0.5 ? float3(0.62, 0.55, 0.98) : float3(0.40, 0.30, 0.85);
`;

/**
 * Smoke inside the glass sheet: strongest at the sheet's free edge (y = 0, or the bottom when flip = 1), where a
 * bright line sits; both reach further with the voice level. Weak where the words are. Premultiplied.
 */
const BAND_SKSL = `
uniform float2 size;
uniform float time;
uniform float dark;
uniform float level;
uniform float flip;
${NOISE}
half4 main(float2 p) {
  float t = time;
  float y = flip > 0.5 ? size.y - p.y : p.y;
  float2 w = float2(fbm(p / 150.0 + float2(t * 0.05, -t * 0.03)), fbm(p / 130.0 + float2(-t * 0.04, t * 0.05)));
  float smoke = fbm(p / 80.0 + w * 2.2 + float2(t * 0.06, t * 0.04));
  float hue = fbm(p / 210.0 + w + float2(-t * 0.02, t * 0.025));
  ${COLOURS}
  float3 col = mix(blue, teal, smoothstep(0.35, 0.7, hue));
  col = mix(col, violet, 0.55 * smoothstep(0.55, 0.85, smoke));
  float reach = 26.0 + 70.0 * level;
  float body = (0.3 + 0.7 * smoke) * (0.14 + 0.86 * exp(-y / reach));
  float line = exp(-y / (1.5 + 3.0 * level));
  float strength = dark > 0.5 ? 0.5 : 0.42;
  float a = clamp(strength * body + 0.7 * line, 0.0, 1.0);
  float3 c = mix(col, float3(1.0), 0.75 * line);
  return half4(half3(c * a), half(a));
}
`;

/**
 * The light curtain: a dark scrim, densest at the bar's edge (v = 0) and gone at the far side, with vertical rays
 * rising from that edge; their height follows the voice level. The scrim lies over the rays where the words are, so
 * white text keeps its contrast on any page. danger = 1 turns the rays red ("release to cancel"). Premultiplied.
 */
const CURTAIN_SKSL = `
uniform float2 size;
uniform float time;
uniform float level;
uniform float flip;
uniform float danger;
${NOISE}
half4 main(float2 p) {
  float t = time;
  float v = flip > 0.5 ? p.y / size.y : 1.0 - p.y / size.y;
  float scrim = 0.9 * (1.0 - smoothstep(0.3, 1.0, v));
  float n1 = noise(float2(p.x / 26.0 + t * 0.12, t * 0.07));
  float n2 = noise(float2(p.x / 61.0 - t * 0.05, 3.1 + t * 0.04));
  float ray = 0.55 * n1 + 0.45 * n2;
  float h = (0.4 + 0.6 * ray) * (0.6 + 0.4 * level);
  float ra = 1.0 - smoothstep(0.0, h, v);
  ra = ra * (0.45 + 0.55 * ray) * (0.75 + 0.25 * level);
  float hue = noise(float2(p.x / 140.0 + t * 0.03, 7.7));
  float3 col = mix(float3(0.36, 0.72, 0.94), float3(0.31, 0.82, 0.77), smoothstep(0.3, 0.7, hue));
  col = mix(col, float3(0.62, 0.55, 0.98), 0.6 * smoothstep(0.5, 0.9, n2));
  col = mix(col, float3(1.0, 0.36, 0.36), danger);
  float light = ra * (1.0 - 0.6 * scrim);
  float a = scrim + (1.0 - scrim) * light;
  float3 c = float3(0.03, 0.04, 0.09) * scrim + col * light;
  return half4(half3(c), half(a));
}
`;

/**
 * A line of light on a rounded rectangle (the screen, or the step strip): two bright stretches travel around it, a
 * white glint at each head, a dim line and a soft haze everywhere else. \`offset\` is where this canvas lies in the
 * rectangle (the screen's is drawn as four thin edge canvases). Premultiplied.
 */
const EDGE_SKSL = `
uniform float2 size;
uniform float2 offset;
uniform float time;
uniform float dark;
uniform float radius;
uniform float inset;
uniform float core;
uniform float haze;
uniform float glow;
half4 main(float2 pos) {
  float2 p = pos + offset;
  float2 c = size * 0.5;
  float2 q = abs(p - c) - (c - float2(radius + inset));
  float e = abs(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius);
  if (e > haze * 3.0) return half4(0.0);
  float ang = atan(p.y - c.y, p.x - c.x) / 6.2831853 + 0.5;
  float h1 = fract(ang - time * 0.07);
  float h2 = fract(ang + 0.5 - time * 0.07);
  // Each stretch: a soft front, a long tail behind it, a glint at the head.
  float comet = min(1.0, exp(-h1 * 7.0) * smoothstep(0.0, 0.02, h1) + 0.7 * exp(-h2 * 7.0) * smoothstep(0.0, 0.02, h2));
  float glint = exp(-min(min(h1, 1.0 - h1), min(h2, 1.0 - h2)) * 70.0);
  ${COLOURS}
  float hue = 6.2831853 * (ang * 2.0 + time * 0.02);
  float3 col = mix(mix(blue, teal, 0.5 + 0.5 * sin(hue)), violet, 0.35 + 0.35 * sin(hue + 2.1));
  float line = exp(-e / core);
  // The soft light around the line: strongest at the line, gone by three times the haze width.
  float soft = glow * exp(-e / haze) * (1.0 - smoothstep(haze * 1.5, haze * 3.0, e));
  float a = clamp((0.16 + 0.84 * max(comet, glint)) * (0.9 * line + soft), 0.0, 1.0);
  col = mix(col, float3(1.0), 0.8 * glint * line);
  return half4(half3(col * a), half(a));
}
`;

// Compiled when first shown, not when App's imports load.
type Effect = NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>;
const compiled: Record<string, Effect> = {};
const effect = (sksl: string): Effect => (compiled[sksl] ??= Skia.RuntimeEffect.Make(sksl)!);

/** Seconds, advanced 30 times a second on the UI thread while `run`; a fixed moment otherwise. */
function useClock(run: boolean): SharedValue<number> {
  const time = useSharedValue(7.3);
  const last = useSharedValue(0);
  const clock = useFrameCallback((frame) => {
    'worklet';
    const now = frame.timeSinceFirstFrame;
    if (now - last.value < FRAME_MS) return;
    last.value = now;
    time.value = 7.3 + now / 1000;
  }, run);
  useEffect(() => clock.setActive(run), [clock, run]);
  return time;
}

/** The voice level (0–1), eased so the light swells instead of flickering; a steady middle with reduce motion. */
function useEasedLevel(level: number, still: boolean): SharedValue<number> {
  const eased = useSharedValue(0);
  useEffect(() => {
    eased.value = still ? 0.4 : withTiming(Math.max(0, Math.min(1, level)), { duration: 140 });
  }, [eased, level, still]);
  return eased;
}

/** What the listening UI shows; kept as it last was while it leaves. */
type Listening = {
  status: string;
  transcript: string;
  /** The language being listened in ("TR"), when known. */
  tag: string | null;
  note: string | null;
  cancelling: boolean;
};

const NOTHING: Listening = { status: '', transcript: '', tag: null, note: null, cancelling: false };

/** The address bar's page-side edge in window points: the bar is 48 pt high, inside the safe area. */
function barEdge(height: number, insets: { top: number; bottom: number }, barAtBottom: boolean): number {
  return barAtBottom ? height - insets.bottom - 48 : insets.top + 48;
}

/**
 * Listening in the "band" or "curtain" look, in place of the classic bubble. Takes no touches (the finger is on the
 * button). Always mounted, invisible until `show`: a canvas that is only created when the hold starts draws its
 * first frame late (the surface and the shader's program are made then), so the light used to come a second after
 * the words. Nothing animates while it is hidden. It keeps what it last showed while it fades out.
 */
/** How strongly the listening look shows while still getting ready. */
const WAITING_STRENGTH = 0.45;

export function ListeningLook({
  look,
  show,
  barAtBottom,
  level,
  waiting = false,
  ...content
}: {
  look: Exclude<AssistantLook, 'classic'>;
  show: boolean;
  barAtBottom: boolean;
  level: number;
  /**
   * Still getting ready (the recogniser isn't hearing yet): the look shows at less than full strength with its "Getting
   * ready…" line, so it never looks like listening before words can be heard.
   */
  waiting?: boolean;
  status: string;
  transcript: string;
  tag: string | null;
  note: string | null;
  cancelling: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const [appear] = useState(() => new Animated.Value(0));
  const [kept, setKept] = useState<Listening>(NOTHING);
  if (
    show &&
    (kept.status !== content.status ||
      kept.transcript !== content.transcript ||
      kept.tag !== content.tag ||
      kept.note !== content.note ||
      kept.cancelling !== content.cancelling)
  ) {
    setKept(content);
  }

  useEffect(() => {
    Animated.timing(appear, {
      toValue: show ? (waiting ? WAITING_STRENGTH : 1) : 0,
      duration: reduceMotion ? 0 : show ? 220 : 240,
      easing: show ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [show, waiting, appear, reduceMotion]);

  const Look = look === 'band' ? Sheet : Curtain;
  return (
    <Look
      c={show ? content : kept}
      barAtBottom={barAtBottom}
      appear={appear}
      level={show ? level : 0}
      active={show}
      still={reduceMotion}
    />
  );
}

type LookProps = {
  c: Listening;
  barAtBottom: boolean;
  appear: Animated.Value;
  level: number;
  /** Showing: the clock runs. */
  active: boolean;
  still: boolean;
};

function Sheet({ c, barAtBottom, appear, level, active, still }: LookProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const time = useClock(active && !still);
  const eased = useEasedLevel(level, still);
  const dark = palette.dark ? 1 : 0;
  const flip = barAtBottom ? 0 : 1;
  const uniforms = useDerivedValue(() => ({ size: [size.w, size.h], time: time.value, dark, level: eased.value, flip }));

  const edge = barEdge(height, insets, barAtBottom);
  const tint = c.cancelling ? 'rgba(150,32,32,0.9)' : glassTint(palette.dark);
  const text = c.cancelling ? '#ffffff' : palette.text;
  const soft = c.cancelling ? '#f3d6d6' : palette.textSecondary;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.sheet,
        barAtBottom ? [styles.sheetUp, { bottom: height - edge }] : [styles.sheetDown, { top: edge }],
        { borderColor: glassEdge(palette.dark) },
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [barAtBottom ? 44 : -44, 0] }) }],
        },
      ]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {IOS ? (
        <BlurView
          tint={palette.dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
          intensity={85}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      {size.w > 0 && !c.cancelling ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Fill>
            <Shader source={effect(BAND_SKSL)} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : null}
      <View
        style={[
          styles.sheetBody,
          { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right },
          barAtBottom ? styles.sheetBodyUp : styles.sheetBodyDown,
        ]}
      >
        <View style={styles.head}>
          <LevelDot level={level} still={still} color={c.cancelling ? '#ffffff' : palette.tintText} />
          <Text style={[styles.status, { color: soft }]} numberOfLines={2}>
            {c.status}
          </Text>
          {c.tag ? (
            <View style={[styles.tag, { borderColor: soft }]}>
              <Text style={[styles.tagText, { color: soft }]}>{c.tag}</Text>
            </View>
          ) : null}
        </View>
        {c.transcript ? (
          <Text style={[styles.words, { color: text }]} numberOfLines={5} ellipsizeMode="head">
            {c.transcript}
          </Text>
        ) : null}
        {c.note ? <Text style={[styles.note, { color: soft }]}>{c.note}</Text> : null}
      </View>
    </Animated.View>
  );
}

function Curtain({ c, barAtBottom, appear, level, active, still }: LookProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const time = useClock(active && !still);
  const eased = useEasedLevel(level, still);
  const edge = barEdge(height, insets, barAtBottom);
  // From the bar's edge over a little more than half of the page; never the whole of a phone on its side.
  const tall = Math.round(Math.min(480, (barAtBottom ? edge : height - edge) * 0.72));
  const flip = barAtBottom ? 0 : 1;
  const danger = c.cancelling ? 1 : 0;
  const uniforms = useDerivedValue(() => ({
    size: [width, tall],
    time: time.value,
    level: eased.value,
    flip,
    danger,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.curtain,
        { height: tall, opacity: appear },
        barAtBottom ? { bottom: height - edge, justifyContent: 'flex-end' } : { top: edge, justifyContent: 'flex-start' },
      ]}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill>
          <Shader source={effect(CURTAIN_SKSL)} uniforms={uniforms} />
        </Fill>
      </Canvas>
      <View style={[styles.curtainBody, { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]}>
        <View style={[styles.head, styles.curtainHead]}>
          <LevelDot level={level} still={still} color={c.cancelling ? '#ff8a80' : '#4fd1c5'} />
          <Text style={[styles.status, styles.curtainStatus]} numberOfLines={2}>
            {c.status}
          </Text>
          {c.tag ? (
            <View style={[styles.tag, styles.curtainTag]}>
              <Text style={[styles.tagText, styles.curtainTagText]}>{c.tag}</Text>
            </View>
          ) : null}
        </View>
        {c.transcript ? (
          <Text style={styles.curtainWords} numberOfLines={5} ellipsizeMode="head">
            {c.transcript}
          </Text>
        ) : null}
        {c.note ? <Text style={[styles.note, styles.curtainNote]}>{c.note}</Text> : null}
      </View>
    </Animated.View>
  );
}

/** The listening mark: a dot that grows with the voice. */
function LevelDot({ level, still, color }: { level: number; still: boolean; color: string }) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(scale, { toValue: still ? 1 : 1 + level * 0.9, duration: still ? 0 : 110, useNativeDriver: true }).start();
  }, [scale, level, still]);
  return <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ scale }] }]} />;
}

/** The glass's own colour over the blur (iOS) or instead of it (Android: nearly opaque, so text never sits on the page). */
function glassTint(dark: boolean): string {
  if (IOS) return dark ? 'rgba(36,35,44,0.5)' : 'rgba(255,255,255,0.5)';
  return dark ? 'rgba(36,35,44,0.95)' : 'rgba(255,255,255,0.95)';
}

const glassEdge = (dark: boolean) => (dark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.75)');

/**
 * The glass behind the step strip and the answer card in the "band" look: fills its parent (which must not have a
 * background of its own), rounded like it. `thread`: a thread of light travels around it (the strip while working).
 */
export function GlassBack({ radius, thread = false }: { radius: number; thread?: boolean }) {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  return (
    <>
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]} pointerEvents="none">
        {IOS ? (
          <BlurView
            tint={palette.dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
            intensity={85}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glassTint(palette.dark) }]} />
      </View>
      {thread ? <Thread radius={radius} dark={palette.dark} still={reduceMotion} /> : null}
    </>
  );
}

function Thread({ radius, dark, still }: { radius: number; dark: boolean; still: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const time = useClock(!still);
  const d = dark ? 1 : 0;
  const uniforms = useDerivedValue(() => ({
    size: [size.w, size.h],
    offset: [0, 0],
    time: time.value,
    dark: d,
    radius: Math.min(radius, size.h / 2) - 1,
    inset: 1,
    core: 1.3,
    haze: 4,
    glow: 0.32,
  }));
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Fill>
            <Shader source={effect(EDGE_SKSL)} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : null}
    </View>
  );
}

/** How far in from each screen edge the travelling light is drawn, and the screen's corner it follows. */
const EDGE_DEPTH = 82;
const SCREEN_CORNER = 28;

/**
 * Working in the "curtain" look: a line of light travelling around the screen's edge, drawn in four thin edge
 * canvases like the classic glow (WorkingGlow.tsx), so the page's middle is never covered or redrawn.
 */
export function EdgeLight() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const time = useClock(!reduceMotion);
  const D = EDGE_DEPTH;
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
        <ScreenEdge key={e.key} x={e.x} y={e.y} w={e.w} h={e.h} width={width} height={height} dark={palette.dark ? 1 : 0} time={time} />
      ))}
    </View>
  );
}

function ScreenEdge({
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
  time: SharedValue<number>;
}) {
  const uniforms = useDerivedValue(() => ({
    size: [width, height],
    offset: [x, y],
    time: time.value,
    dark,
    radius: SCREEN_CORNER,
    inset: 4,
    core: 5.5,
    haze: 26,
    glow: 0.75,
  }));
  if (w <= 0 || h <= 0) return null;
  return (
    <Canvas style={{ position: 'absolute', left: x, top: y, width: w, height: h }} pointerEvents="none">
      <Fill>
        <Shader source={effect(EDGE_SKSL)} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  over: { zIndex: 20, elevation: 20 },
  clip: { overflow: 'hidden' },
  sheet: { position: 'absolute', left: 0, right: 0, zIndex: 50, overflow: 'hidden' },
  sheetUp: { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, borderTopWidth: StyleSheet.hairlineWidth },
  sheetDown: { borderBottomLeftRadius: radii.sheet, borderBottomRightRadius: radii.sheet, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetBody: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 6 },
  sheetBodyUp: { paddingTop: 18, paddingBottom: 16 },
  sheetBodyDown: { paddingTop: 14, paddingBottom: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  status: { flex: 1, fontSize: 13, fontWeight: '600' },
  tag: {
    minWidth: 28,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  words: { fontSize: 20, lineHeight: 27, fontWeight: '500' },
  note: { fontSize: 12 },
  curtain: { position: 'absolute', left: 0, right: 0, zIndex: 50 },
  curtainBody: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingVertical: 22, gap: 8 },
  curtainHead: { justifyContent: 'center' },
  curtainStatus: { flex: 0, flexShrink: 1, color: '#c9d6e8' },
  curtainTag: { borderColor: 'rgba(255,255,255,0.5)' },
  curtainTagText: { color: '#ffffff' },
  curtainWords: { color: '#ffffff', fontSize: 24, lineHeight: 31, fontWeight: '600', textAlign: 'center' },
  curtainNote: { color: '#c9c8d0', textAlign: 'center' },
});
