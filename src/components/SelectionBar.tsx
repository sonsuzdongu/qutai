import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SelectionAction = { label: string; onPress: () => void };

/** Floats at the bottom of the page while text is selected; the OS copy menu stays near the selection. */
export function SelectionBar({
  actions,
  dark,
  bottomOffset = 0,
}: {
  actions: SelectionAction[];
  dark: boolean;
  /** Extra space at the bottom, e.g. for an address bar there. */
  bottomOffset?: number;
}) {
  return (
    <View style={[styles.wrap, { bottom: 16 + bottomOffset }]} pointerEvents="box-none">
      <View style={[styles.bar, dark && styles.barDark]}>
        {actions.map((action, i) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.button, i > 0 && styles.divider, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.label, i === 0 && styles.primary]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    borderRadius: 22,
    backgroundColor: '#2b2a28',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  barDark: { backgroundColor: '#42414d' },
  button: { paddingHorizontal: 14, paddingVertical: 11 },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.2)' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  label: { color: '#fff', fontSize: 14 },
  primary: { color: '#7cc8f2', fontWeight: '700' },
});
