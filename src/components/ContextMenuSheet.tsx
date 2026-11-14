import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ContextTarget } from '../browser/contextMenu';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';

export type ContextAction = { icon: string; label: string; onPress: () => void };

type Props = {
  target: ContextTarget | null;
  actions: ContextAction[];
  onClose: () => void;
};

/** Bottom sheet for a long-pressed link or image. */
export function ContextMenuSheet({ target, actions, onClose }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      {target && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.header}>
            {target.src ? <Image source={{ uri: target.src }} style={styles.preview} resizeMode="cover" /> : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>
                {target.linkText || target.alt || target.href || target.src}
              </Text>
              {target.href || !target.src.startsWith('data:') ? (
                <Text style={styles.url} numberOfLines={1}>
                  {target.href || target.src}
                </Text>
              ) : null}
            </View>
          </View>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.icon}>{action.icon}</Text>
              <Text style={styles.label}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.backdrop },
  sheet: { backgroundColor: c.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
  },
  preview: { width: 48, height: 48, borderRadius: 8, backgroundColor: c.sunken },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: c.text },
  url: { fontSize: 12, color: c.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13 },
  pressed: { backgroundColor: c.pressed },
  icon: { width: 22, fontSize: 17, textAlign: 'center' },
  label: { fontSize: 16, color: c.text },
}));
