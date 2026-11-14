import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

/**
 * Soft aurora light in the logo's colours (indigo, violet, a little orange) over the app's own
 * background colour. Drawn once (no animation), so it costs nothing after the first frame.
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

float3 mixTo(float3 c, float3 k, float w) { return c + (k - c) * w; }
float blob(float2 uv, float2 c, float r) { float2 d = uv - c; return exp(-dot(d, d) / r); }

half4 main(float2 p) {
  float2 uv = p / max(size.x, 1.0);
  float y = p.y / max(size.y, 1.0);
  float reach = 1.0 - smoothstep(fade * 0.55, fade, y);
  float b1 = blob(uv, float2(0.10, 0.05), 0.16) * reach;
  float b2 = blob(uv, float2(0.95, 0.22), 0.20) * reach;
  float b3 = blob(uv, float2(0.55, 0.02), 0.07) * reach;
  float3 c = base;
  if (dark > 0.5) {
    c = mixTo(c, float3(0.30, 0.27, 0.88), 0.30 * b1);
    c = mixTo(c, float3(0.49, 0.23, 0.93), 0.26 * b2);
    c = mixTo(c, float3(0.85, 0.38, 0.17), 0.16 * b3);
  } else {
    c = mixTo(c, float3(0.80, 0.82, 1.00), 0.34 * b1);
    c = mixTo(c, float3(0.89, 0.83, 1.00), 0.32 * b2);
    c = mixTo(c, float3(1.00, 0.88, 0.80), 0.24 * b3);
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
  style?: StyleProp<ViewStyle>;
};

export function Aurora({ base, dark, fade = 1, style }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: base }, style]}
      pointerEvents="none"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {size && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader
              source={SOURCE}
              uniforms={{ size: [size.width, size.height], base: rgb(base), dark: dark ? 1 : 0, fade }}
            />
          </Fill>
        </Canvas>
      )}
    </View>
  );
}
