import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { isShort, qrFrameSize } from '../ui/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openSettingsOrExplain } from '../device/settings';
import { t } from '../i18n';
import { DialogHost } from './Dialog';
import { radii } from '../ui/theme';

type Props = { visible: boolean; onScan: (data: string) => void; onClose: () => void };

/** Full-screen camera that reads one QR code. */
export function QrScanner({ visible, onScan, onClose }: Props) {
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {visible && <Scanner onScan={onScan} onClose={onClose} />}
      <DialogHost />
    </AppModal>
  );
}

function Scanner({ onScan, onClose }: Omit<Props, 'visible'>) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // Coming back from the phone's settings, where the user may have allowed the camera.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);
  // The camera reports a code many times a second; only the first one counts.
  const [done, setDone] = useState(false);
  // On a phone on its side the frame is smaller and Close sits lower, so the hint and Close don't overlap it.
  const screen = useWindowDimensions();
  const frame = qrFrameSize(screen);

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            done
              ? undefined
              : ({ data }) => {
                  setDone(true);
                  onScan(data);
                }
          }
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.message}>{t('qr.permission')}</Text>
          {permission && !permission.granted && (
            // Once refused for good, the system shows no prompt; only its settings page can allow the camera.
            <Pressable
              onPress={permission.canAskAgain ? requestPermission : openSettingsOrExplain}
              style={styles.allow}
              accessibilityRole="button"
            >
              <Text style={styles.allowText}>
                {permission.canAskAgain ? t('qr.allowCamera') : t('settings.openSystem')}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.frame, { width: frame, height: frame }]} pointerEvents="none" />
        <Text style={styles.hint}>{t('qr.scanHint')}</Text>
        <Pressable onPress={onClose} style={[styles.close, isShort(screen) && styles.closeLow]} accessibilityRole="button">
          <Text style={styles.closeText}>{t('common.close')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  message: { color: '#fff', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  allow: { paddingHorizontal: 20, minHeight: 44, paddingVertical: 8, borderRadius: radii.button, backgroundColor: '#1565c0', justifyContent: 'center' },
  allowText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 20 },
  frame: { width: 240, height: 240, borderRadius: 18, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  hint: { color: '#fff', fontSize: 15 },
  close: {
    position: 'absolute',
    bottom: 48,
    paddingHorizontal: 24,
    minHeight: 44,
    paddingVertical: 8,
    borderRadius: radii.button,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
  },
  closeLow: { bottom: 12 },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
