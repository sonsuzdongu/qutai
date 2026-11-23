import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelCapture, useCaptureProgress } from '../device/fullPage';
import { t } from '../i18n';
import { darkPalette, makeStyles, radii, usePalette } from '../ui/theme';
import { useKeyboardHeight } from '../utils/useKeyboardHeight';
import { toastBottom } from './toastPlacement';

/**
 * Shown while a full-page capture scrolls the page: it catches every touch so nothing moves the
 * page meanwhile, and offers Cancel. It lies over the app, outside the captured tab view, so it
 * never appears in the pieces.
 */
export function CaptureOverlay({ bottomInset = 0, dark = false }: { bottomInset?: number; dark?: boolean }) {
  const progress = useCaptureProgress();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // Like a toast (UI-48): the app's theme (dark: an incognito tab), above the address bar at the bottom.
  const styles = useStyles(dark);
  const system = usePalette();
  const palette = dark ? darkPalette : system;
  if (!progress) return null;
  const capturing = progress.stage === 'capturing';
  return (
    <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true}>
      <View style={[styles.pill, { bottom: toastBottom(insets.bottom, keyboard, bottomInset) }]} accessibilityLiveRegion="polite">
        <ActivityIndicator color={palette.tintText} size="small" />
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

const useStyles = makeStyles((c) => ({
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
  text: { color: c.text, fontSize: 14, flexShrink: 1 },
  cancel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  pressed: { backgroundColor: c.pressed },
  cancelText: { color: c.tintText, fontSize: 14, fontWeight: '600' },
}));
