import { Pressable, ScrollView, Text, View } from 'react-native';
import type { LoadError, LoadErrorKind } from '../browser/navigation';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';

const ICONS: Record<LoadErrorKind, string> = {
  offline: '📡',
  dns: '🔎',
  timeout: '⏳',
  unreachable: '🔌',
  cert: '⚠️',
  ssl: '🔓',
  cleartext: '🔓',
  generic: '⚠️',
};

/** Kinds where a local address gets the "same network, listening on the network" tips. */
const LOCAL_TIP_KINDS = new Set<LoadErrorKind>(['dns', 'timeout', 'unreachable', 'generic']);

/**
 * Shown instead of the WebView's default English error screen. A native view, outside the page: the assistant's
 * tools (which click and type inside web pages) can't press its buttons, so "Continue anyway" is always the user's.
 */
export function ErrorPage({
  error,
  url,
  local,
  incognito,
  onRetry,
  onBack,
  onContinue,
  onOpenHttp,
}: {
  error: LoadError;
  url: string;
  /** The address is on the device or the local network. */
  local: boolean;
  incognito: boolean;
  onRetry: () => void;
  /** Certificate errors: the primary action. */
  onBack: () => void;
  /** Certificate errors the user may get past (see certificateExceptions.ts); omitted when not offered. */
  onContinue?: () => void;
  /** An https address that failed to connect securely: open it over http instead (not secure). */
  onOpenHttp?: () => void;
}) {
  const styles = useStyles();
  const { kind } = error;
  const isCert = kind === 'cert';
  const body = isCert
    ? t(`loadError.cert.${error.cert ?? 'invalid'}`)
    : kind === 'ssl' && local
      ? t('loadError.sslLocal')
      : t(`loadError.${kind}`);
  return (
    <ScrollView
      style={[styles.container, incognito && styles.dark]}
      contentContainerStyle={styles.content}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.icon}>{ICONS[kind]}</Text>
      <Text style={[styles.title, incognito && styles.lightText]} accessibilityRole="header">
        {isCert ? t('loadError.certTitle') : t('loadError.title')}
      </Text>
      <Text style={[styles.body, incognito && styles.dimText]}>{body}</Text>
      {isCert && <Text style={[styles.body, incognito && styles.dimText]}>{t('loadError.certRisk')}</Text>}
      {local && LOCAL_TIP_KINDS.has(kind) && (
        <Text style={[styles.body, incognito && styles.dimText]}>{t('loadError.localTip')}</Text>
      )}
      {url ? (
        <Text style={styles.url} numberOfLines={2}>
          {url}
        </Text>
      ) : null}
      {isCert ? (
        <Pressable onPress={onBack} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('loadError.back')}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onRetry} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('loadError.retry')}</Text>
        </Pressable>
      )}
      {onOpenHttp && (
        <Pressable onPress={onOpenHttp} style={styles.secondary} accessibilityRole="button">
          <Text style={[styles.secondaryText, incognito && styles.dimText]}>{t('loadError.openHttp')}</Text>
        </Pressable>
      )}
      {isCert && onContinue && (
        <View style={styles.advanced}>
          <Text style={[styles.small, incognito && styles.dimText]}>{t('loadError.continueHint')}</Text>
          <Pressable onPress={onContinue} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.dangerText}>{t('loadError.continue')}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
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
  },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  dark: { backgroundColor: '#1c1b22' },
  icon: { fontSize: 44 },
  title: { fontSize: 19, fontWeight: '700', color: c.text, textAlign: 'center' },
  body: { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 21 },
  small: { fontSize: 13, color: c.textSecondary, textAlign: 'center', lineHeight: 18 },
  lightText: { color: '#f2f1f5' },
  dimText: { color: '#a9a8b3' },
  url: { fontSize: 12, color: c.textSecondary, textAlign: 'center' },
  primary: { marginTop: 10, backgroundColor: c.tint, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 },
  primaryText: { color: c.onTint, fontSize: 15, fontWeight: '600' },
  secondary: { paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: c.tintText, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  advanced: { marginTop: 18, alignItems: 'center', gap: 2 },
  dangerText: { color: c.danger, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}));
