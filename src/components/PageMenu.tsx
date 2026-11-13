import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type MenuItem = {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Draws a separator above this item. */
  section?: boolean;
};

type Props = {
  visible: boolean;
  items: MenuItem[];
  incognito: boolean;
  onClose: () => void;
};

/** Overflow menu anchored under the ⋮ button, like the Chrome page menu. */
export function PageMenu({ visible, items, incognito, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const theme = incognito ? dark : light;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Menüyü kapat" />
      <View style={[styles.menu, theme.menu, { top: insets.top + 48, right: insets.right + 8 }]}>
        {items.map((item) => (
          <View key={item.label}>
            {item.section && <View style={[styles.separator, theme.separator]} />}
            <Pressable
              disabled={item.disabled}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => [styles.item, pressed && theme.pressed]}
              accessibilityRole="menuitem"
              accessibilityState={{ disabled: item.disabled }}
            >
              <Text style={[styles.icon, item.disabled && styles.disabled]}>{item.icon}</Text>
              <Text style={[styles.label, theme.text, item.disabled && styles.disabled]}>{item.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    minWidth: 230,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  icon: { width: 22, fontSize: 17, textAlign: 'center' },
  label: { fontSize: 15 },
  disabled: { opacity: 0.35 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});

const light = StyleSheet.create({
  menu: { backgroundColor: '#fff' },
  text: { color: '#222' },
  pressed: { backgroundColor: '#f1efe8' },
  separator: { backgroundColor: '#e0ddd4' },
});

const dark = StyleSheet.create({
  menu: { backgroundColor: '#2b2a33' },
  text: { color: '#f2f1f5' },
  pressed: { backgroundColor: '#3a3944' },
  separator: { backgroundColor: '#42414d' },
});
