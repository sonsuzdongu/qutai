import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VISIBLE_MS = 2200;

/** Short, non-blocking confirmation such as "Link copied". Works the same on iOS and Android. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const show = useCallback((text: string) => {
    setMessage(text);
    setKey((k) => k + 1);
  }, []);
  const hide = useCallback(() => setMessage(null), []);
  return { message, key, show, hide };
}

export function Toast({ message, onHidden }: { message: string | null; onHidden: () => void }) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onHidden());
    }, VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, opacity, onHidden]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { bottom: insets.bottom + 24, opacity }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(30,30,30,0.92)',
  },
  text: { color: '#fff', fontSize: 14, textAlign: 'center' },
});
