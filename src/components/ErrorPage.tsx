import { Pressable, Text, View } from 'react-native';
import type { LoadErrorKind } from '../browser/navigation';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';

const ICONS: Record<LoadErrorKind, string> = { offline: '📡', dns: '🔎', timeout: '⏳', ssl: '🔓', generic: '⚠️' };

/** Shown instead of the WebView's default English error screen. */
export function ErrorPage({
  kind,
  url,
  incognito,
  onRetry,
}: {
  kind: LoadErrorKind;
  url: string;
  incognito: boolean;
  onRetry: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.container, incognito && styles.dark]}>
      <Text style={styles.icon}>{ICONS[kind]}</Text>
      <Text style={[styles.title, incognito && styles.lightText]}>{t('loadError.title')}</Text>
      <Text style={[styles.body, incognito && styles.dimText]}>{t(`loadError.${kind}`)}</Text>
      {url ? (
        <Text style={styles.url} numberOfLines={2}>
          {url}
        </Text>
      ) : null}
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>{t('loadError.retry')}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.chrome,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  dark: { backgroundColor: '#1c1b22' },
  icon: { fontSize: 44 },
  title: { fontSize: 19, fontWeight: '700', color: c.text, textAlign: 'center' },
  body: { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 21 },
  lightText: { color: '#f2f1f5' },
  dimText: { color: '#a9a8b3' },
  url: { fontSize: 12, color: c.textSecondary, textAlign: 'center' },
  retry: { marginTop: 10, backgroundColor: c.tint, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 },
  retryText: { color: c.onTint, fontSize: 15, fontWeight: '600' },
}));
