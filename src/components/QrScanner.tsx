import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { DialogHost } from './Dialog';

type Props = { visible: boolean; onScan: (data: string) => void; onClose: () => void };

/** Full-screen camera that reads one QR code. */
export function QrScanner({ visible, onScan, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {visible && <Scanner onScan={onScan} onClose={onClose} />}
      <DialogHost />
    </Modal>
  );
}

function Scanner({ onScan, onClose }: Omit<Props, 'visible'>) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports a code many times a second; only the first one counts.
  const [done, setDone] = useState(false);

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
            <Pressable onPress={requestPermission} style={styles.allow} accessibilityRole="button">
              <Text style={styles.allowText}>{t('qr.allowCamera')}</Text>
            </Pressable>
          )}
        </View>
      )}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} pointerEvents="none" />
        <Text style={styles.hint}>{t('qr.scanHint')}</Text>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
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
  allow: { paddingHorizontal: 20, height: 44, borderRadius: 22, backgroundColor: '#1565c0', justifyContent: 'center' },
  allowText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 20 },
  frame: { width: 240, height: 240, borderRadius: 18, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  hint: { color: '#fff', fontSize: 15 },
  close: {
    position: 'absolute',
    bottom: 48,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
