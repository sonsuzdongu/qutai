import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Slowness } from '../browser/pendingNavigation';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { darkPalette, makeStyles, usePalette } from '../ui/theme';

/** A page-started navigation shows "example.com opening…" only once it has waited this long (no flicker on fast sites). */
const OPENING_DELAY_MS = 400;

/**
 * The small line next to the address bar while a navigation waits for the site (docs/design/14-tabs-and-conversations.md, "Pending
 * navigation"): which site is opening (a page-started navigation, whose address the bar doesn't show yet), that it
 * isn't answering yet (with Stop), that the connection is very slow (with Try again and Stop), or that the phone is
 * offline. Nothing is cancelled by the app on its own.
 */
export function NavigationStatus({
  navKey,
  opening,
  slowness,
  offline,
  dark,
  onStop,
  onRetry,
}: {
  /** Changes with every navigation (tab and number), so the opening delay starts over. */
  navKey: string;
  opening: string | null;
  slowness: Slowness;
  offline: boolean;
  dark: boolean;
  onStop: () => void;
  onRetry: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const [shownFor, setShownFor] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setShownFor(navKey), OPENING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navKey]);

  let text: string | null = null;
  if (offline) text = t('nav.offline');
  else if (slowness === 'verySlow') text = t('nav.verySlow');
  else if (slowness === 'slow') text = t('nav.slow', { host: opening ?? '' }).trim();
  else if (opening && shownFor === navKey) text = t('nav.opening', { host: opening });
  if (!text) return null;
  const actions = offline || slowness !== 'none';
  return (
    <View style={[styles.row, dark && styles.rowDark]} accessibilityLiveRegion="polite">
      <Icon name={offline ? 'offline' : 'wait'} size={14} color={dark ? DARK_DIM : palette.textSecondary} />
      <Text style={[styles.text, dark && styles.textDark]} numberOfLines={1} ellipsizeMode="middle">
        {text}
      </Text>
      {actions && slowness === 'verySlow' && (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button" style={styles.button}>
          <Text style={[styles.buttonText, dark && styles.buttonTextDark]}>{t('loadError.retry')}</Text>
        </Pressable>
      )}
      {actions && (
        <Pressable onPress={onStop} hitSlop={8} accessibilityRole="button" style={styles.button}>
          <Text style={[styles.buttonText, dark && styles.buttonTextDark]}>{t('common.stop')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const DARK_DIM = '#a9a8b3';

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: c.chrome,
  },
  rowDark: { backgroundColor: '#24232b' },
  text: { flex: 1, fontSize: 13, color: c.textSecondary },
  textDark: { color: DARK_DIM },
  button: { paddingHorizontal: 6, paddingVertical: 2 },
  buttonText: { fontSize: 13, fontWeight: '600', color: c.tintText },
  buttonTextDark: { color: darkPalette.tintText },
}));
