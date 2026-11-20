import type { ComponentRef } from 'react';
import { memo, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { makeStyles, radii, common } from '../ui/theme';
import { qrMatrix } from '../device/qr';
import { BottomSheet } from './BottomSheet';

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
  const codeRef = useRef<ComponentRef<typeof View>>(null);
  return (
    <BottomSheet
      visible={url !== null}
      onClose={onClose}
      style={styles.sheet}
      contentStyle={styles.content}
      bottomPadding={16}
    >
      {url && (
        <>
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
        </>
      )}
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 20 },
  content: { paddingHorizontal: 20, alignItems: 'center', gap: 14 },
  title: common(c).title,
  // Always white: scanners need a light margin around the code, in dark mode and in the shared image too.
  code: { padding: 16, backgroundColor: '#ffffff', borderRadius: radii.card },
  row: { flexDirection: 'row' },
  url: { fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  button: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 8,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.tint,
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: c.tintText },
  primary: { backgroundColor: c.tint },
  primaryText: { color: c.onTint },
}));
