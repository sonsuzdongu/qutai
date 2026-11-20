import { Text, View } from 'react-native';
import type { AppOffer } from '../agent/appTool';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { makeStyles, usePalette, common } from '../ui/theme';

/** The chat's card for an app the assistant made or changed: what happened, Open, and Undo for a change. */
export function AppCard({ offer, dark, onOpen, onUndo }: { offer: AppOffer; dark?: boolean; onOpen: () => void; onUndo: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const status =
    offer.change === 'created'
      ? t('apps.cardCreated', { name: offer.name })
      : offer.change === 'undone'
        ? t('apps.cardUndone', { name: offer.name, version: offer.version })
        : t('apps.cardChanged', { name: offer.name, version: offer.version });
  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.row}>
        <Icon name="apps" size={18} color={palette.tintText} />
        <Text style={[styles.status, dark && styles.textDark]}>{status}</Text>
      </View>
      {offer.note ? <Text style={[styles.text, dark && styles.textDark]}>{offer.note}</Text> : null}
      <View style={styles.buttons}>
        <Button
          label={t('apps.open')}
          onPress={onOpen}
          style={styles.grow}
          accessibilityLabel={t('apps.openLabel', { name: offer.name })}
        />
        {offer.change === 'changed' && (
          <Button
            variant="secondary"
            label={t('apps.undo')}
            onPress={onUndo}
            style={styles.grow}
            icon={<Icon name="undo" size={16} color={palette.tintText} />}
            accessibilityLabel={t('apps.undoLabel', { name: offer.name, version: offer.version })}
          />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { ...common(c).card, padding: 14, gap: 8, alignSelf: 'stretch' },
  grow: { flexGrow: 1 },
  cardDark: { backgroundColor: '#2a2930' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
  text: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  textDark: { color: '#f2f1ee' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
