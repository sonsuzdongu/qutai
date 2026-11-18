import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

/**
 * A plain horizontal slider (no native dependency): drag or tap the track; a screen reader treats it as adjustable
 * (swipe up or down) with its label and the value read as written. Whole numbers between min and max.
 */
export function Slider({
  label,
  value,
  min,
  max,
  valueText,
  onChange,
  onStep,
  color = '#ffffff',
  trackColor = '#5a5a64',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** The value as shown and read ("+25"). */
  valueText: string;
  /** Kept the same from render to render (useCallback), so a drag is never cut short. */
  onChange: (value: number) => void;
  /** A screen reader's increment (1) or decrement (-1). */
  onStep: (direction: 1 | -1) => void;
  color?: string;
  trackColor?: string;
}) {
  const [width, setWidth] = useState(0);
  // Made again only when the track's size or the range changes, never mid-drag (a stable onChange is expected).
  const responder = useMemo(() => {
    const fromX = (x: number) => {
      if (width <= 0) return;
      const f = Math.min(1, Math.max(0, x / width));
      onChange(Math.round(min + f * (max - min)));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      // A horizontal drag stays with the slider even inside a scroll view.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => fromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => fromX(e.nativeEvent.locationX),
    });
  }, [width, min, max, onChange]);

  const f = max === min ? 0 : (value - min) / (max - min);
  // The filled part runs from zero (the middle for -100…100), so the direction of a change shows.
  const zero = min < 0 ? -min / (max - min) : 0;
  const from = Math.min(f, zero);
  const to = Math.max(f, zero);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={styles.box}
    >
      <View style={styles.labels} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={[styles.value, { color }]}>{valueText}</Text>
      </View>
      <View
        style={styles.touch}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        importantForAccessibility="no-hide-descendants"
        {...responder.panHandlers}
      >
        <View pointerEvents="none" style={[styles.track, { backgroundColor: trackColor }]}>
          <View style={[styles.fill, { left: `${from * 100}%`, width: `${(to - from) * 100}%`, backgroundColor: color }]} />
        </View>
        <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, f * width - 11), backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 2 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8 },
  label: { fontSize: 14, flexShrink: 1 },
  value: { fontSize: 14, fontVariant: ['tabular-nums'] },
  // A full touch target around a thin track.
  touch: { height: 44, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2 },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 2 },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, top: 11 },
});
