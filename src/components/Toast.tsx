import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, radii } from '../ui/theme';
import { useKeyboardHeight } from '../utils/useKeyboardHeight';
import { toastBottom } from './toastPlacement';

const VISIBLE_MS = 2200;
/** A toast with a button stays longer, so there is time to reach it. */
const ACTION_VISIBLE_MS = 5000;

/** A button in a toast, e.g. "Show" for a task that finished in another tab. */
export type ToastAction = { label: string; onPress: () => void };

/** Short, non-blocking confirmation such as "Link copied". Works the same on iOS and Android. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<ToastAction | null>(null);
  const [key, setKey] = useState(0);
  const show = useCallback((text: string, withAction?: ToastAction) => {
    setMessage(text);
    setAction(withAction ?? null);
    setKey((k) => k + 1);
  }, []);
  const hide = useCallback(() => {
    setMessage(null);
    setAction(null);
  }, []);
  return { message, action, key, show, hide };
}

export function Toast({
  message,
  action,
  onHidden,
  bottomInset = 0,
  dark = false,
}: {
  message: string | null;
  action?: ToastAction | null;
  onHidden: () => void;
  /** Height of a bar along the bottom (the address bar, a toolbar): the toast stays above it (UI-48). */
  bottomInset?: number;
  /** Always dark (an incognito tab); otherwise the app's theme (UI-48). */
  dark?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const styles = useStyles(dark);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onHidden());
    }, action ? ACTION_VISIBLE_MS : VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, action, opacity, onHidden]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents={action ? 'box-none' : 'none'}
      style={[styles.toast, action && styles.withAction, { bottom: toastBottom(insets.bottom, keyboard, bottomInset), opacity }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, action && styles.textWithAction]}>{message}</Text>
      {action ? (
        <Pressable
          onPress={() => {
            action.onPress();
            onHidden();
          }}
          hitSlop={10}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

// The app's palette (UI-48): a raised card of the theme's surface, like the app's sheets; the button in the brand colour.
const useStyles = makeStyles((c) => ({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.window,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  withAction: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 8 },
  text: { color: c.text, fontSize: 14, textAlign: 'center' },
  textWithAction: { flexShrink: 1, textAlign: 'left' },
  action: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.control },
  pressed: { opacity: 0.6 },
  actionText: { color: c.tintText, fontSize: 14, fontWeight: '600' },
}));
