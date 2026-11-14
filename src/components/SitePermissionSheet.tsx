import { Pressable, Text, View } from 'react-native';
import { SITE_LEVELS, SiteLevel } from '../agent/sitePolicy';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { BottomSheet } from './BottomSheet';

type Props = {
  /** The site being set; null hides the sheet. */
  host: string | null;
  level: SiteLevel;
  onSelect: (level: SiteLevel) => void;
  onClose: () => void;
};

/** Picks what Qutai may do on one site. */
export function SitePermissionSheet({ host, level, onSelect, onClose }: Props) {
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
}));
