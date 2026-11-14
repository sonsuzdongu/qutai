import { Pressable, Text, View } from 'react-native';
import { SITE_LEVELS, SiteLevel } from '../agent/sitePolicy';
import { t } from '../i18n';
import { LOCATION_SETTINGS, LocationSetting } from '../storage/sitePermissions';
import { makeStyles } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { BottomSheet } from './BottomSheet';

type Props = {
  /** The site being set; null hides the sheet. */
  host: string | null;
  level: SiteLevel;
  onSelect: (level: SiteLevel) => void;
  /** Whether the site itself may use the location. */
  location: LocationSetting;
  onSelectLocation: (setting: LocationSetting) => void;
  onClose: () => void;
};

/** Picks what Qutai may do on one site, and whether the site may use the location. */
export function SitePermissionSheet({ host, level, onSelect, location, onSelectLocation, onClose }: Props) {
  const styles = useStyles();
  return (
    <BottomSheet visible={host !== null} onClose={onClose} style={styles.sheet} bottomPadding={12}>
      <Text style={styles.title}>{t('site.title')}</Text>
      <Text style={styles.host} numberOfLines={1}>
        {host}
      </Text>
      {SITE_LEVELS.map((option) => {
        const selected = option === level;
        return (
          <Pressable
            key={option}
            onPress={() => {
              onSelect(option);
              onClose();
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Radio selected={selected} />
            <View style={styles.texts}>
              <Text style={[styles.label, option === 'blocked' && styles.danger]}>{t(`site.level.${option}`)}</Text>
              <Text style={styles.hint}>{t(`site.hint.${option}`)}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={styles.section}>{t('site.locationTitle')}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {LOCATION_SETTINGS.map((option) => {
          const selected = option === location;
          return (
            <Pressable
              key={option}
              onPress={() => onSelectLocation(option)}
              style={[styles.segmentButton, selected && styles.segmentSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                  selected && option === 'block' && styles.danger,
                ]}
              >
                {t(`site.location.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.locationHint}>{t(`site.locationHint.${location}`)}</Text>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 16 },
  title: { fontSize: 17, fontWeight: '700', color: c.text, paddingHorizontal: 20 },
  host: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  pressed: { backgroundColor: c.pressed },
  texts: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600', color: c.text },
  danger: { color: c.danger },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  section: { fontSize: 15, fontWeight: '700', color: c.text, paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 10, padding: 3, marginHorizontal: 20 },
  segmentButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 14, color: c.textSecondary },
  segmentTextSelected: { color: c.text, fontWeight: '700' },
  locationHint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, paddingHorizontal: 20, marginTop: 6 },
}));
