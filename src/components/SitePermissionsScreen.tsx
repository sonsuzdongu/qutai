import { useState, useSyncExternalStore } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { makeStyles, readableColumn, usePalette } from '../ui/theme';
import type { SitePermissionStore } from '../storage/sitePermissions';
import { SitePermissionSheet } from './SitePermissionSheet';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';
import { ScreenHeader } from './ScreenHeader';

type Props = {
  visible: boolean;
  store: SitePermissionStore;
  /** "Block ads and trackers" is on in Settings. */
  blockingEnabled: boolean;
  onClose: () => void;
};

/** Sites with their own permission; tap to change, ✕ to go back to the default. */
export function SitePermissionsScreen({ visible, store, blockingEnabled, onClose }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const version = useSyncExternalStore(store.subscribe, () =>
    store
      .list()
      .map((p) => p.host + p.level + p.personal + p.location + p.camera + p.microphone + p.blocking)
      .join(),
  );
  const sites = store.list();
  const [editing, setEditing] = useState<string | null>(null);
  void version;

  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader title={t('site.listTitle')} right={{ label: t('common.done'), onPress: onClose }} />
        <FlatList
          data={sites}
          keyExtractor={(p) => p.host}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.hint}>{t('site.listHint')}</Text>}
          ListEmptyComponent={<Text style={styles.empty}>{t('site.listEmpty')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => setEditing(item.host)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.texts}>
                <Text style={styles.host} numberOfLines={1}>
                  {item.host}
                </Text>
                <Text style={[styles.level, item.level === 'blocked' && styles.danger]}>
                  {t(`site.level.${item.level}`)}
                </Text>
                {item.personal !== 'ask' && (
                  <Text style={[styles.level, item.personal === 'block' && styles.danger]}>
                    {t(`site.personalSummary.${item.personal}`)}
                  </Text>
                )}
                {item.location !== 'ask' && (
                  <Text style={[styles.level, item.location === 'block' && styles.danger]}>
                    {t(`site.locationSummary.${item.location}`)}
                  </Text>
                )}
                {item.camera !== 'ask' && (
                  <Text style={[styles.level, item.camera === 'block' && styles.danger]}>
                    {t(`site.cameraSummary.${item.camera}`)}
                  </Text>
                )}
                {!item.blocking && <Text style={styles.level}>{t('site.blockingOffSummary')}</Text>}
                {item.microphone !== 'ask' && (
                  <Text style={[styles.level, item.microphone === 'block' && styles.danger]}>
                    {t(`site.microphoneSummary.${item.microphone}`)}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => store.reset(item.host)}
                hitSlop={10}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={t('site.reset')}
              >
                <Icon name="close" size={14} color={palette.textSecondary} />
              </Pressable>
            </Pressable>
          )}
        />
        <SitePermissionSheet
          host={editing}
          level={editing ? store.levelFor(editing) : 'default'}
          onSelect={(level) => editing && store.set(editing, level)}
          location={editing ? store.locationFor(editing) : 'ask'}
          onSelectLocation={(setting) => editing && store.setLocation(editing, setting)}
          camera={editing ? store.mediaFor(editing, 'camera') : 'ask'}
          microphone={editing ? store.mediaFor(editing, 'microphone') : 'ask'}
          onSelectMedia={(kind, setting) => editing && store.setMedia(editing, kind, setting)}
          personal={editing ? store.personalFor(editing) : 'ask'}
          onSelectPersonal={(setting) => editing && store.setPersonal(editing, setting)}
          blocking={editing ? store.blockingFor(editing) : true}
          onSetBlocking={(on) => editing && store.setBlocking(editing, on)}
          blockingEnabled={blockingEnabled}
          onClose={() => setEditing(null)}
        />
      </SafeAreaView>
      <DialogHost />
    </AppModal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  list: { ...readableColumn, padding: 16, gap: 8 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  pressed: { backgroundColor: c.pressed },
  texts: { flex: 1, gap: 2 },
  host: { fontSize: 15, color: c.text },
  level: { fontSize: 13, color: c.textSecondary },
  danger: { color: c.danger },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
}));
