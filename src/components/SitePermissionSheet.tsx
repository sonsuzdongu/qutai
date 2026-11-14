import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SITE_LEVELS, SiteLevel } from '../agent/sitePolicy';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { DialogHost } from './Dialog';

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
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={host !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
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
      </View>
      <DialogHost />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.backdrop },
  sheet: { backgroundColor: c.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 16 },
  title: { fontSize: 17, fontWeight: '700', color: c.text, paddingHorizontal: 20 },
  host: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  pressed: { backgroundColor: c.pressed },
  texts: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600', color: c.text },
  danger: { color: c.danger },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
}));
