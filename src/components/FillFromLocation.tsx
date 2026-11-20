import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { ensureLocationPermission, LocationUnavailableError, readPlaceName } from '../device/location';
import { openSettingsOrExplain, PermissionDeniedError } from '../device/settings';
import { getLanguage, t } from '../i18n';
import { formatPlace, LOCATION_PROBLEM_TEXT, type LocationProblem } from '../intro/place';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii } from '../ui/theme';

/** Which of the short lines an error from reading the place gets (src/intro/place.ts). */
function problemOf(e: unknown): LocationProblem {
  if (e instanceof PermissionDeniedError) return 'denied';
  if (e instanceof LocationUnavailableError && e.reason !== 'failed') return e.reason;
  return 'failed';
}

/**
 * "Use my location" on the city question (`INTRO-31`; the typed questions and "Ask me questions", and the follow-up
 * after a spoken or typed introduction). Asks for the location permission only on this tap, never before; reads the
 * position once, has the platform's geocoder name it, and fills in district, city or province, and country
 * (src/intro/place.ts) as an ordinary answer the user can edit, clear or replace before going on. The position itself
 * is kept nowhere and never goes to the AI. Typing and skipping work without any of this.
 */
export function FillFromLocation({ onFill, onStart }: { onFill: (text: string) => void; onStart?: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; settings: boolean } | null>(null);
  const fill = async () => {
    onStart?.();
    setBusy(true);
    setProblem(null);
    try {
      await ensureLocationPermission();
      const place = await readPlaceName();
      onFill(formatPlace(place, getLanguage()));
    } catch (e) {
      setProblem({ text: t(LOCATION_PROBLEM_TEXT[problemOf(e)]), settings: e instanceof PermissionDeniedError && !e.canAskAgain });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.box}>
      <Pressable
        onPress={() => void fill()}
        disabled={busy}
        style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ busy }}
      >
        <Icon name="location" size={18} color={palette.tintText} />
        <Text style={styles.text}>{t(busy ? 'profile.locationBusy' : 'profile.useLocation')}</Text>
      </Pressable>
      {problem && (
        <Text style={styles.warning} accessibilityLiveRegion="polite">
          {problem.text}
        </Text>
      )}
      {problem?.settings && (
        <Pressable onPress={openSettingsOrExplain} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.text}>{t('settings.openSystem')}</Text>
        </Pressable>
      )}
      <Text style={styles.hint}>
        {t(Platform.OS === 'ios' ? 'profile.locationPrivacyIos' : 'profile.locationPrivacyAndroid')}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { gap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: c.tint,
  },
  text: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  hint: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  warning: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  pressed: { backgroundColor: c.pressed },
}));
