import { StyleSheet, View } from 'react-native';
import { usePalette } from './theme';

/** A drawn radio button (the ◉/○ text glyphs were small and font-dependent). */
export function Radio({ selected, size = 24 }: { selected: boolean; size?: number }) {
  const c = usePalette();
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: selected ? c.tint : c.textSecondary },
      ]}
    >
      {selected && (
        <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size / 4, backgroundColor: c.tint }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
