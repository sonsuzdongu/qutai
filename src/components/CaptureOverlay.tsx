import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelCapture, useCaptureProgress } from '../device/fullPage';
import { t } from '../i18n';

/**
 * Shown while a full-page capture scrolls the page: it catches every touch so nothing moves the
 * page meanwhile, and offers Cancel. It lies over the app, outside the captured tab view, so it
 * never appears in the pieces.
 */
export function CaptureOverlay() {
  const progress = useCaptureProgress();
  const insets = useSafeAreaInsets();
  if (!progress) return null;
  const capturing = progress.stage === 'capturing';
  return (
    <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true}>
      <View style={[styles.pill, { bottom: insets.bottom + 24 }]} accessibilityLiveRegion="polite">
        <ActivityIndicator color="#fff" size="small" />
        <Text style={styles.text}>
          {capturing ? t('capture.progress', { done: progress.done, total: progress.total }) : t('capture.stitching')}
        </Text>
        {capturing && (
          <Pressable
            onPress={cancelCapture}
            hitSlop={10}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '90%',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(30,30,30,0.92)',
  },
  text: { color: '#fff', fontSize: 14, flexShrink: 1 },
  cancel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.15)' },
  cancelText: { color: '#8ab4ff', fontSize: 14, fontWeight: '600' },
});
