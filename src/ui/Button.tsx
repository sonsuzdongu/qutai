import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { WholeWordsText } from '../components/WholeWordsText';
import { createPressGuard, type PressAction } from './pressGuard';
import { makeStyles, radii, usePalette } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

/**
 * Qutai's text button (design record UI-28). It grows with its label instead of clipping it: a minimum height, never a
 * fixed one, and the label wraps between words at large text sizes or in long translations (a word that would break
 * gets a little smaller instead, WholeWordsText). An action that returns a promise holds
 * the button busy (a spinner beside the label, further presses ignored) until it settles. `size="large"` is the main
 * action of a screen (setup, sign-in, save); the regular size sits in cards, dialogs and lists.
 */
export function useBusyPress(onPress: PressAction | undefined) {
  const [busy, setBusy] = useState(false);
  const guard = useRef<ReturnType<typeof createPressGuard> | null>(null);
  guard.current ??= createPressGuard(setBusy);
  const press = () => {
    if (!onPress) return;
    // A failed action shows its own error; the button only needs to come back.
    void guard.current!.press(onPress)?.catch(() => {});
  };
  return { busy, press };
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'regular',
  danger,
  disabled,
  busy: busyProp,
  icon,
  style,
  textStyle,
  maxFontSizeMultiplier,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  onPress?: PressAction;
  variant?: ButtonVariant;
  size?: 'regular' | 'large';
  /** Red label on a secondary or text button (a destructive action that is not the main one). */
  danger?: boolean;
  disabled?: boolean;
  /** Busy from outside (work the screen started elsewhere); a promise from onPress sets it by itself. */
  busy?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  maxFontSizeMultiplier?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const styles = useStyles();
  const c = usePalette();
  const { busy: pressing, press } = useBusyPress(onPress);
  const busy = !!busyProp || pressing;
  const off = disabled || busy;
  const filled = variant === 'primary' || variant === 'destructive';
  return (
    <Pressable
      onPress={press}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [
        styles.base,
        size === 'large' ? styles.large : styles.regular,
        styles[variant],
        style,
        disabled && styles.disabled,
        pressed && (filled ? styles.pressedFill : styles.pressed),
      ]}
    >
      <View style={styles.content}>
        {busy ? <ActivityIndicator size="small" color={filled ? c.onTint : c.tintText} /> : icon}
        <WholeWordsText
          style={[
            styles.label,
            size === 'large' && styles.labelLarge,
            filled ? styles.onFill : danger ? styles.dangerText : styles.tintText,
            textStyle,
          ]}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          {label}
        </WholeWordsText>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  base: { alignItems: 'center', justifyContent: 'center' },
  regular: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radii.control },
  large: { minHeight: 50, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radii.button },
  primary: { backgroundColor: c.tint },
  secondary: { backgroundColor: c.sunken },
  text: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: c.dangerFill },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  labelLarge: { fontSize: 17, fontWeight: '700' },
  onFill: { color: c.onTint },
  tintText: { color: c.tintText },
  dangerText: { color: c.danger },
  pressed: { backgroundColor: c.pressed },
  pressedFill: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
}));
