import MaskedViewBase from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentType, ReactElement, ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewProps, ViewStyle } from 'react-native';

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

/** A primary button on the brand gradient. */
export function GradientButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
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
        {icon}
        <Text style={[styles.label, textStyle]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  invisible: { opacity: 0 },
  button: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
