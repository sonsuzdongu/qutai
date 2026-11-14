import { useSyncExternalStore } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { dayLabel, formatSize } from '../i18n/format';
import type { DownloadEntry, DownloadStore } from '../storage/downloads';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';
import { downloadFraction, downloadProgressLabel } from './DownloadIndicator';

type Props = {
  visible: boolean;
  store: DownloadStore;
  onOpen: (entry: DownloadEntry) => void;
  onDelete: (entry: DownloadEntry) => void;
  onClose: () => void;
};

/** Files downloaded in Qutai (iOS; Android uses the system Downloads folder). Tap to share or save to Files. */
export function DownloadsScreen({ visible, store, onOpen, onDelete, onClose }: Props) {
  const styles = useStyles();
  useSyncExternalStore(store.subscribe, store.getVersion);
  const entries = store.list();
  const active = store.activeList();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <View style={styles.header}>
          <View style={styles.side} />
          <Text style={styles.title}>{t('downloads.title')}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]}>
            <Text style={styles.done}>{t('common.done')}</Text>
          </Pressable>
        </View>
        <FlatList
          data={[...entries]}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={active.length ? undefined : <Text style={styles.empty}>{t('downloads.empty')}</Text>}
          ListHeaderComponent={
            active.length ? (
              <View style={styles.activeList}>
                {active.map((a) => {
                  const fraction = downloadFraction(a);
                  return (
                    <View key={a.id} style={styles.row}>
                      <Text style={styles.icon}>⬇</Text>
                      <View style={styles.texts}>
                        <Text style={styles.name} numberOfLines={2}>
                          {a.name}
                        </Text>
                        <View style={styles.track}>
                          <View style={[styles.bar, { width: `${Math.round((fraction ?? 0.15) * 100)}%` }]} />
                        </View>
                        <Text style={styles.meta} numberOfLines={1}>
                          {[t('downloads.started'), downloadProgressLabel(a)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => store.cancel(a.id)}
                        hitSlop={10}
                        style={styles.remove}
                        accessibilityLabel={t('downloads.cancel')}
                      >
                        <Text style={styles.removeText}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={styles.icon}>{item.incognito ? '🕶' : '📄'}</Text>
              <View style={styles.texts}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[formatSize(item.size), dayLabel(item.createdAt)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable
                onPress={() => onDelete(item)}
                hitSlop={10}
                style={styles.remove}
                accessibilityLabel={t('downloads.delete')}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </Pressable>
          )}
        />
      </SafeAreaView>
      <DialogHost />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  side: { flex: 1 },
  right: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  done: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  list: { padding: 16, gap: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  pressed: { backgroundColor: c.pressed },
  icon: { fontSize: 22 },
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 15, color: c.text },
  meta: { fontSize: 12, color: c.textSecondary },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 14, color: c.textSecondary },
  activeList: { gap: 8, marginBottom: 8 },
  track: { height: 3, borderRadius: 2, backgroundColor: c.sunken, overflow: 'hidden', marginVertical: 2 },
  bar: { height: 3, borderRadius: 2, backgroundColor: c.tint },
}));
