import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { clampTextZoom, TEXT_ZOOM_MAX, TEXT_ZOOM_MIN } from '../storage/settings';

type Props = {
  visible: boolean;
  zoom: number;
  onChange: (zoom: number) => void;
  onClose: () => void;
};

/** Bottom sheet for page text size; changes apply to every tab immediately. */
export function TextSizeSheet({ visible, zoom, onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const set = (value: number) => onChange(clampTextZoom(value));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('textSize.title')}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.done}>{t('common.done')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.sample, { fontSize: (15 * zoom) / 100 }]} numberOfLines={2}>
          {t('textSize.sample')}
        </Text>
        <View style={styles.controls}>
          <Pressable
            onPress={() => set(zoom - 10)}
            disabled={zoom <= TEXT_ZOOM_MIN}
            style={[styles.step, zoom <= TEXT_ZOOM_MIN && styles.disabled]}
            accessibilityLabel={t('textSize.smaller')}
          >
            <Text style={styles.stepSmall}>A</Text>
          </Pressable>
          <Text style={styles.value} accessibilityLiveRegion="polite">
            %{zoom}
          </Text>
          <Pressable
            onPress={() => set(zoom + 10)}
            disabled={zoom >= TEXT_ZOOM_MAX}
            style={[styles.step, zoom >= TEXT_ZOOM_MAX && styles.disabled]}
            accessibilityLabel={t('textSize.larger')}
          >
            <Text style={styles.stepLarge}>A</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => set(100)} disabled={zoom === 100} style={styles.reset} accessibilityRole="button">
          <Text style={[styles.resetText, zoom === 100 && styles.disabled]}>{t('textSize.reset')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    backgroundColor: '#faf9f5',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: '#222' },
  done: { fontSize: 16, fontWeight: '600', color: '#c96442' },
  sample: { color: '#333', minHeight: 44 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 56,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3c9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSmall: { fontSize: 14, fontWeight: '600', color: '#333' },
  stepLarge: { fontSize: 22, fontWeight: '600', color: '#333' },
  value: { fontSize: 18, fontWeight: '600', color: '#222' },
  reset: { alignSelf: 'center', paddingVertical: 6 },
  resetText: { fontSize: 15, color: '#c96442', fontWeight: '600' },
  disabled: { opacity: 0.35 },
});
