import type { ComponentRef } from 'react';
import { memo, useMemo, useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { qrMatrix } from '../device/qr';
import { DialogHost } from './Dialog';

type Props = {
  /** The address to encode; null hides the sheet. */
  url: string | null;
  onShareLink: (url: string) => void;
  onShareImage: (view: ComponentRef<typeof View>) => void;
  onClose: () => void;
};

const SIZE = 232;

/** Draws the code with plain views, so it needs no SVG library. */
const QrGrid = memo(function QrGrid({ text }: { text: string }) {
  const styles = useStyles();
  const rows = useMemo(() => qrMatrix(text), [text]);
  const cell = SIZE / rows.length;
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((dark, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: dark ? '#111' : '#fff' }} />
          ))}
        </View>
      ))}
    </View>
  );
});

/** Shows the page's address as a QR code, to open it on another device. */
export function QrCodeSheet({ url, onShareLink, onShareImage, onClose }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const codeRef = useRef<ComponentRef<typeof View>>(null);
  return (
    <Modal visible={url !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      {url && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title}>{t('qr.title')}</Text>
          <View ref={codeRef} collapsable={false} style={styles.code} accessibilityLabel={t('qr.a11y', { url })}>
            <QrGrid text={url} />
          </View>
          <Text style={styles.url} numberOfLines={2}>
            {url}
          </Text>
          <View style={styles.buttons}>
            <Pressable onPress={() => onShareLink(url)} style={styles.button} accessibilityRole="button">
              <Text style={styles.buttonText}>{t('qr.shareLink')}</Text>
            </Pressable>
            <Pressable
              onPress={() => codeRef.current && onShareImage(codeRef.current)}
              style={[styles.button, styles.primary]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, styles.primaryText]}>{t('qr.shareImage')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      <DialogHost />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.backdrop },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 14,
  },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  // Always white: scanners need a light margin around the code, in dark mode and in the shared image too.
  code: { padding: 16, backgroundColor: '#ffffff', borderRadius: 12 },
  row: { flexDirection: 'row' },
  url: { fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.tint,
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: c.tintText },
  primary: { backgroundColor: c.tint },
  primaryText: { color: c.onTint },
}));
