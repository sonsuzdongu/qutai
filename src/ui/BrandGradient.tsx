import MaskedViewBase from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentType, ReactElement, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewProps, ViewStyle } from 'react-native';

import { useBusyPress } from './Button';
import type { PressAction } from './pressGuard';
import { usePalette } from './theme';

// The package's class typings predate React 19's JSX types; the component itself works as documented.
const MaskedView = MaskedViewBase as unknown as ComponentType<ViewProps & { maskElement: ReactElement }>;

/**
 * The logo's blues as gradients. Every stop is measured so text stays readable:
 * - fill: white text on each stop is 5.3:1 or more (the logo's light cyans fail with white, so it ends on teal)
 * - text on light backgrounds: each stop 5:1 or more on the theme's light surfaces
 * - text on dark backgrounds: each stop 7.5:1 or more
 */
export const BRAND_GRADIENT = {
  fill: ['#0b3d91', '#1565c0', '#0e7490'],
  textLight: ['#0b3d91', '#1565c0', '#0e7490'],
  textDark: ['#5cb8f0', '#4dd0e1', '#7ee8f5'],
} as const;

/** Text painted with the brand gradient; it stays a real Text for fonts, sizing and screen readers. */
export function GradientText({
  children,
  style,
  dark,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Defaults to the app's appearance. */
  dark?: boolean;
}) {
  const palette = usePalette();
  const colors = (dark ?? palette.dark) ? BRAND_GRADIENT.textDark : BRAND_GRADIENT.textLight;
  return (
    <MaskedView
      accessible
      accessibilityLabel={children}
      maskElement={
        <Text style={style} accessible={false}>
          {children}
        </Text>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {/* Invisible copy of the text gives the gradient exactly the text's size. */}
        <Text style={[style, styles.invisible]} accessible={false}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

/**
 * A primary button on the brand gradient. An action that returns a promise holds it busy until it settles, so a
 * double tap cannot run it twice (UI-28); give it a minimum height, not a fixed one, so the label can wrap.
 */
export function GradientButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
  icon,
  maxFontSizeMultiplier,
}: {
  label: string;
  onPress: PressAction;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: ReactNode;
  /** Caps how far the system's larger text sizes grow the label (it wraps rather than clips when it grows). */
  maxFontSizeMultiplier?: number;
}) {
  const { busy, press } = useBusyPress(onPress);
  return (
    <Pressable
      onPress={press}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, style, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={BRAND_GRADIENT.fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {busy ? <ActivityIndicator size="small" color="#ffffff" /> : icon}
        <Text style={[styles.label, textStyle]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  invisible: { opacity: 0 },
  button: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' },
  label: { color: '#ffffff', fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
